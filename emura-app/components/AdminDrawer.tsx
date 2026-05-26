'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import type { OrgContext, Site, Department, OrgMember } from '@/lib/db';
import {
  updateOrgName,
  listSites, addSite, renameSite, deleteSite,
  listDepartments, addDepartment, renameDepartment, deleteDepartment,
  listMembers, updateMember, removeMember,
  createInvite, countDeptQuotes,
} from '@/lib/db';

interface Props {
  open:          boolean;
  onClose:       () => void;
  orgCtx:        OrgContext;
  onOrgRenamed:  (name: string) => void;
  currentUserId: string;
}

type DrawerTab = 'org' | 'sites' | 'users';

interface SiteWithDepts extends Site { departments: Department[] }

export default function AdminDrawer({ open, onClose, orgCtx, onOrgRenamed, currentUserId }: Props) {
  const [tab, setTab]             = useState<DrawerTab>('org');
  const [orgName, setOrgName]     = useState(orgCtx.orgName);
  const [savingOrg, setSavingOrg] = useState(false);

  const [sites, setSites]         = useState<SiteWithDepts[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');

  const [members, setMembers]     = useState<OrgMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  // member email resolution: userId → email (from invite records)
  const [emailMap, setEmailMap]   = useState<Record<string, string>>({});

  const [inviteEmail, setInviteEmail]       = useState('');
  const [inviteRole, setInviteRole]         = useState<OrgMember['role']>('estimator');
  const [inviteDept, setInviteDept]         = useState('');
  const [inviteLink, setInviteLink]         = useState('');
  const [inviteLoading, setInviteLoading]   = useState(false);

  const supabase = createClient();

  // ── Load sites + departments ───────────────────────────────

  const loadSites = useCallback(async () => {
    const raw = await listSites(supabase, orgCtx.orgId);
    const withDepts = await Promise.all(raw.map(async s => ({
      ...s,
      departments: await listDepartments(supabase, s.id),
    })));
    setSites(withDepts);
    setSitesLoaded(true);
  }, [orgCtx.orgId]);

  // ── Load members ───────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    const raw = await listMembers(supabase, orgCtx.orgId);
    setMembers(raw);
    setMembersLoaded(true);
    // Resolve emails via security-definer RPC (can access auth.users)
    const { data } = await supabase.rpc('get_org_member_emails', { p_org_id: orgCtx.orgId });
    if (data) {
      const map: Record<string, string> = {};
      (data as { user_id: string; email: string }[]).forEach(r => { map[r.user_id] = r.email; });
      setEmailMap(map);
    }
  }, [orgCtx.orgId]);

  useEffect(() => {
    if (!open) return;
    if (tab === 'sites' && !sitesLoaded) loadSites();
    if (tab === 'users' && !membersLoaded) loadMembers();
  }, [open, tab, sitesLoaded, membersLoaded, loadSites, loadMembers]);

  if (!open) return null;

  // ── Org tab handlers ───────────────────────────────────────

  async function handleSaveOrgName() {
    setSavingOrg(true);
    await updateOrgName(supabase, orgCtx.orgId, orgName);
    onOrgRenamed(orgName);
    setSavingOrg(false);
  }

  // ── Sites tab handlers ─────────────────────────────────────

  async function handleAddSite() {
    if (!newSiteName.trim()) return;
    const s = await addSite(supabase, orgCtx.orgId, newSiteName.trim());
    if (s) setSites(prev => [...prev, { ...s, departments: [] }]);
    setNewSiteName('');
  }

  async function handleRenameSite(id: string, name: string) {
    await renameSite(supabase, id, name);
    setSites(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }

  async function handleDeleteSite(id: string) {
    if (!confirm('Delete this site? All departments and their quotes will also be deleted.')) return;
    await deleteSite(supabase, id);
    setSites(prev => prev.filter(s => s.id !== id));
  }

  async function handleAddDept(siteId: string, name: string) {
    if (!name.trim()) return;
    const d = await addDepartment(supabase, siteId, name.trim());
    if (!d) return;
    setSites(prev => prev.map(s => s.id === siteId
      ? { ...s, departments: [...s.departments, d] }
      : s
    ));
  }

  async function handleRenameDept(siteId: string, deptId: string, name: string) {
    await renameDepartment(supabase, deptId, name);
    setSites(prev => prev.map(s => s.id === siteId
      ? { ...s, departments: s.departments.map(d => d.id === deptId ? { ...d, name } : d) }
      : s
    ));
  }

  async function handleDeleteDept(siteId: string, deptId: string) {
    const count = await countDeptQuotes(supabase, deptId);
    const msg = count > 0
      ? `This department has ${count} quote${count > 1 ? 's' : ''}. Delete it and all its quotes?`
      : 'Delete this department?';
    if (!confirm(msg)) return;
    await deleteDepartment(supabase, deptId);
    setSites(prev => prev.map(s => s.id === siteId
      ? { ...s, departments: s.departments.filter(d => d.id !== deptId) }
      : s
    ));
  }

  // ── Users tab handlers ─────────────────────────────────────

  async function handleUpdateMember(memberId: string, role: OrgMember['role'], deptId: string | null) {
    await updateMember(supabase, memberId, role, deptId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role, departmentId: deptId } : m));
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this user from the org?')) return;
    await removeMember(supabase, memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }

  async function handleGenerateInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteLink('');
    const token = await createInvite(
      supabase, orgCtx.orgId,
      inviteEmail.trim(), inviteRole,
      inviteDept || null,
    );
    setInviteLoading(false);
    if (token) {
      setInviteLink(`${window.location.origin}/join?token=${token}`);
    }
  }

  // Flatten all departments across all sites for dropdowns
  const allDepts = sites.flatMap(s => s.departments.map(d => ({ ...d, siteName: s.name })));

  const tabBtn = (id: DrawerTab, label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '8px 0', fontSize: 12.5, fontWeight: tab === id ? 700 : 400,
        background: tab === id ? '#fff' : 'transparent',
        border: 'none', borderBottom: tab === id ? '2px solid #3b82f6' : '2px solid transparent',
        cursor: 'pointer', color: tab === id ? '#1a2940' : '#666',
      }}
    >{label}</button>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Drawer panel */}
      <div className="drawer-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 0' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1a2940' }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginTop: 10 }}>
          {tabBtn('org',   'Organization')}
          {tabBtn('sites', 'Sites & Depts')}
          {tabBtn('users', 'Users')}
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>

          {/* ── Org tab ── */}
          {tab === 'org' && (
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#444', display: 'block', marginBottom: 4 }}>
                Organization Name
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid #cdd', borderRadius: 3, fontSize: 13 }}
                />
                <button className="btn btn-neu btn-sm" onClick={handleSaveOrgName} disabled={savingOrg}>
                  {savingOrg ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* ── Sites & Depts tab ── */}
          {tab === 'sites' && (
            <div>
              {!sitesLoaded && <p style={{ fontSize: 12, color: '#888' }}>Loading…</p>}

              {sites.map(site => (
                <SiteRow
                  key={site.id}
                  site={site}
                  onRename={name => handleRenameSite(site.id, name)}
                  onDelete={() => handleDeleteSite(site.id)}
                  onAddDept={name => handleAddDept(site.id, name)}
                  onRenameDept={(dId, name) => handleRenameDept(site.id, dId, name)}
                  onDeleteDept={dId => handleDeleteDept(site.id, dId)}
                />
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  placeholder="New site name…"
                  value={newSiteName}
                  onChange={e => setNewSiteName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSite()}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid #cdd', borderRadius: 3, fontSize: 13 }}
                />
                <button className="btn btn-add btn-sm" onClick={handleAddSite}>+ Site</button>
              </div>
            </div>
          )}

          {/* ── Users tab ── */}
          {tab === 'users' && (
            <div>
              {!membersLoaded && <p style={{ fontSize: 12, color: '#888' }}>Loading…</p>}

              {members.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  emailMap={emailMap}
                  allDepts={allDepts}
                  currentUserId={currentUserId}
                  onUpdate={(role, deptId) => handleUpdateMember(m.id, role, deptId)}
                  onRemove={() => handleRemoveMember(m.id)}
                />
              ))}

              {/* Invite section */}
              <div style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 10 }}>Generate Invite Link</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="email" placeholder="Email address…"
                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    style={{ padding: '6px 8px', border: '1px solid #cdd', borderRadius: 3, fontSize: 13 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={inviteRole} onChange={e => setInviteRole(e.target.value as OrgMember['role'])}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid #cdd', borderRadius: 3, fontSize: 13 }}
                    >
                      <option value="estimator">Estimator</option>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select
                      value={inviteDept} onChange={e => setInviteDept(e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', border: '1px solid #cdd', borderRadius: 3, fontSize: 13 }}
                    >
                      <option value="">No dept</option>
                      {allDepts.map(d => (
                        <option key={d.id} value={d.id}>{d.siteName} / {d.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="btn btn-neu btn-sm"
                    onClick={handleGenerateInvite}
                    disabled={inviteLoading || !inviteEmail.trim()}
                  >
                    {inviteLoading ? 'Generating…' : 'Generate Link'}
                  </button>
                </div>

                {inviteLink && (
                  <div style={{ marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: 3, padding: '8px 10px', fontSize: 11.5 }}>
                    <p style={{ marginBottom: 4, fontWeight: 600, color: '#166534' }}>Invite link (expires in 7 days):</p>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        readOnly value={inviteLink}
                        style={{ flex: 1, fontSize: 11, padding: '4px 6px', border: '1px solid #cdd', borderRadius: 2 }}
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        className="btn btn-neu btn-sm"
                        onClick={() => navigator.clipboard.writeText(inviteLink)}
                      >Copy</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function SiteRow({ site, onRename, onDelete, onAddDept, onRenameDept, onDeleteDept }: {
  site: SiteWithDepts;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddDept: (name: string) => void;
  onRenameDept: (id: string, name: string) => void;
  onDeleteDept: (id: string) => void;
}) {
  const [editing, setEditing]       = useState(false);
  const [name, setName]             = useState(site.name);
  const [newDeptName, setNewDeptName] = useState('');

  function commitRename() {
    if (name.trim() && name !== site.name) onRename(name.trim());
    setEditing(false);
  }

  return (
    <div style={{ marginBottom: 14, border: '1px solid #e2e8f0', borderRadius: 4 }}>
      {/* Site header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: '#f8fafc', borderRadius: '4px 4px 0 0' }}>
        {editing ? (
          <input
            autoFocus value={name}
            onChange={e => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => e.key === 'Enter' && commitRename()}
            style={{ flex: 1, padding: '3px 6px', border: '1px solid #93c5fd', borderRadius: 2, fontSize: 13 }}
          />
        ) : (
          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }} onDoubleClick={() => setEditing(true)}>{site.name}</span>
        )}
        <button className="btn btn-neu btn-sm" onClick={() => setEditing(true)} style={{ fontSize: 11 }}>✎</button>
        <button className="btn btn-del btn-sm" onClick={onDelete} style={{ fontSize: 11 }}>✕</button>
      </div>

      {/* Departments */}
      <div style={{ padding: '6px 10px 8px' }}>
        {site.departments.map(d => (
          <DeptRow
            key={d.id} dept={d}
            onRename={name => onRenameDept(d.id, name)}
            onDelete={() => onDeleteDept(d.id)}
          />
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input
            placeholder="New department…"
            value={newDeptName}
            onChange={e => setNewDeptName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onAddDept(newDeptName); setNewDeptName(''); } }}
            style={{ flex: 1, padding: '4px 7px', border: '1px solid #cdd', borderRadius: 3, fontSize: 12 }}
          />
          <button className="btn btn-add btn-sm"
            onClick={() => { onAddDept(newDeptName); setNewDeptName(''); }}
            style={{ fontSize: 11 }}>+ Dept</button>
        </div>
      </div>
    </div>
  );
}

function DeptRow({ dept, onRename, onDelete }: {
  dept: Department;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(dept.name);

  function commit() {
    if (name.trim() && name !== dept.name) onRename(name.trim());
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', marginLeft: 12 }}>
      <span style={{ color: '#aaa', fontSize: 11 }}>└</span>
      {editing ? (
        <input
          autoFocus value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === 'Enter' && commit()}
          style={{ flex: 1, padding: '2px 5px', border: '1px solid #93c5fd', borderRadius: 2, fontSize: 12 }}
        />
      ) : (
        <span style={{ flex: 1, fontSize: 12 }} onDoubleClick={() => setEditing(true)}>{dept.name}</span>
      )}
      <button className="btn btn-neu btn-sm" onClick={() => setEditing(true)} style={{ fontSize: 10, padding: '1px 5px' }}>✎</button>
      <button className="btn btn-del btn-sm" onClick={onDelete} style={{ fontSize: 10, padding: '1px 5px' }}>✕</button>
    </div>
  );
}

function MemberRow({ member, emailMap, allDepts, currentUserId, onUpdate, onRemove }: {
  member: OrgMember;
  emailMap: Record<string, string>;
  allDepts: (Department & { siteName: string })[];
  currentUserId: string;
  onUpdate: (role: OrgMember['role'], deptId: string | null) => void;
  onRemove: () => void;
}) {
  const display = emailMap[member.userId] ?? member.userId.slice(0, 8) + '…';
  const isMe = member.userId === currentUserId;

  if (isMe) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f2f5', fontSize: 12.5 }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#555' }} title={display}>{display}</span>
        <span style={{ fontSize: 11.5, color: '#666' }}>{member.role}</span>
        <span style={{ fontSize: 11, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 10, padding: '1px 8px', fontWeight: 600 }}>you</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f2f5', fontSize: 12.5 }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={display}>{display}</span>
      <select
        value={member.role}
        onChange={e => onUpdate(e.target.value as OrgMember['role'], member.departmentId)}
        style={{ padding: '3px 5px', border: '1px solid #cdd', borderRadius: 3, fontSize: 12 }}
      >
        <option value="admin">Admin</option>
        <option value="estimator">Estimator</option>
        <option value="viewer">Viewer</option>
      </select>
      <select
        value={member.departmentId ?? ''}
        onChange={e => onUpdate(member.role, e.target.value || null)}
        style={{ padding: '3px 5px', border: '1px solid #cdd', borderRadius: 3, fontSize: 12 }}
      >
        <option value="">No dept</option>
        {allDepts.map(d => (
          <option key={d.id} value={d.id}>{d.siteName} / {d.name}</option>
        ))}
      </select>
      <button className="btn btn-del btn-sm" onClick={onRemove} style={{ fontSize: 11, padding: '2px 6px' }}>Remove</button>
    </div>
  );
}

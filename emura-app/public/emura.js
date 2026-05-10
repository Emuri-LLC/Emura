// ── Utils ────────────────────────────────────────────────────
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function num(v){const n=parseFloat(v);return isNaN(n)?0:n}
function parseFraction(v){
  const s=String(v??'').trim();
  if(s.includes('/')){const[a,b]=s.split('/');const n=parseFloat(a),d=parseFloat(b);
    if(!isNaN(n)&&!isNaN(d)&&d!==0)return Math.round(n/d*10000)/10000;}
  const n=parseFloat(s);return isNaN(n)?0:n;
}
function fmt4(n){return(isNaN(n)||n===null)?'—':Number(n).toFixed(4)}
function fmtC(n,d=2){return(isNaN(n)||n===null)?'—':'$'+Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d})}
function fmtN(n,d=0){return(isNaN(n)||n===null)?'—':Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d})}

// ── Tooltip text ─────────────────────────────────────────────
const T={
  qname:'Identifier for this estimate. Used as the default export filename.',
  customer:'Customer or prospect name.',
  date:'Quote issue date.',
  rev:'Revision identifier (e.g. A, 1.2). Increment when significant changes are made.',
  notes:'Free-text notes. Paste an image (Ctrl+V) to embed it.',
  shopRate:'Fully-loaded direct labor cost per operator-hour. Include wages, benefits, and direct overhead burden.',
  indRate:'Cost per hour for indirect/overhead labor (engineering, quality, purchasing, etc.).',
  wkHrs:'Available production hours per year per machine or cell. Used for takt time and CapEx utilization. Typical: 2,000 (1 shift) to 6,000 (3 shifts).',
  capexYrs:'Years over which capital equipment is depreciated for time-based CapEx allocation.',
  brkLabel:'Descriptive name for this volume scenario (e.g. "High Vol", "1000/yr").',
  brkBpy:'Order events per year. All FGs are built simultaneously each event.',
  brkEau:'Optional target: total EAU across all FGs at this break. Enables mix validation and auto-fill.',
  fgName:'Name or part number for this finished good.',
  fgDesc:'Description or other identifier for this finished good.',
  fgEau:'Estimated Annual Usage (units/year) for this FG at this volume break.',
  bomPn:'Supplier or internal part number.',
  bomDesc:'Material or component description.',
  bomUom:'Unit of measure (e.g. EA, LB, FT, M, KG).',
  bomQty:'Quantity consumed per finished good. Fractions accepted (e.g. 1/4 = 0.25).',
  bomFgSpec:'Check to move to FG-Specific section — each FG can then have a different quantity.',
  bomCustSup:'Check if customer-supplied. No cost is attributed; item excluded from Material Costs.',
  matCost:'Cost per unit at the shown annual purchasing volume. Enter supplier quote or estimated price.',
  matSrc:'Optional. Source of this cost (supplier name, quote #, date). Use → to copy to all breaks.',
  eqName:'Descriptive name for this equipment (e.g. "Reflow Oven", "Test Fixture").',
  eqCapex:'Total capital cost. Allocated by utilization % × (capex ÷ depreciation years).',
  eqRun:'Variable operating cost per run hour (cycle time only). Covers utilities, consumables, wear.',
  eqMaint:'Fixed annual maintenance cost. Allocated same as CapEx but over 1 year.',
  eqProj:'If checked: CapEx and maintenance are spread over EAU instead of utilization %. Use for job-dedicated tooling.',
  dlName:'Name of this work cell or operation (e.g. "SMT Assembly", "Wave Solder").',
  dlOps:'Number of operators staffing this cell during production.',
  dlCt:'Seconds to produce one unit (cell throughput rate). Must be ≤ takt time to meet demand.',
  dlOs:'Minutes to set up this operation once per order event (shared across all FGs).',
  dlLs:'Minutes to set up this operation per FG line per order event.',
  dlEq:'Equipment used by this operation. Type to search. Equipment with no defined attributes is shown in orange.',
  dlNotes:'Free-text notes for this operation.',
  subName:'Name of this outsourced operation or service.',
  subEa:'Variable cost per unit produced.',
  subLine:'Fixed cost per FG line per order event. Amortized over units on that line.',
  subOrder:'Fixed cost per full order event. Amortized over all units in the order.',
  subYr:'Fixed annual cost. Amortized over all annual units.',
  ilName:'Name of this overhead category (e.g. "Engineering", "Quality", "Purchasing").',
  ilAh:'Total sustaining support hours per year for this category, spread over all annual units.',
  ilOs:'Setup hours per order event for this category.',
  ilLs:'Setup hours per FG line per order event for this category.',
};
function ii(k){return`<span class="ii" data-tip="${esc(T[k]||'')}">ⓘ</span>`;}

// ── Undo ─────────────────────────────────────────────────────
const undoStack=[];
function pushUndo(){
  undoStack.push(JSON.stringify(state));
  if(undoStack.length>40)undoStack.shift();
  const b=document.getElementById('undo-btn');if(b)b.disabled=false;
}
function doUndo(){
  if(!undoStack.length)return;
  state=JSON.parse(undoStack.pop());saveState();render();
  const b=document.getElementById('undo-btn');if(b)b.disabled=undoStack.length===0;
}

// ── State ─────────────────────────────────────────────────────
const STORE='mce_v4';
function defaultState(){
  return{
    quote:{name:'New Quote',customer:'',date:new Date().toISOString().slice(0,10),revision:'A',notes:''},
    settings:{shopRate:45,indirectRate:30,capexYears:5,workingHoursPerYear:2000},
    breaks:[{id:uid(),label:'High Vol',buildsPerYear:12,totalEAU:0},{id:uid(),label:'Med Vol',buildsPerYear:4,totalEAU:0},{id:uid(),label:'Low Vol',buildsPerYear:1,totalEAU:0}],
    finishedGoods:[],bom:[],materialCosts:{},materialSources:{},equipment:[],
    directOps:[],indirectOps:[],subcontracts:[],margins:{}
  };
}
function migrateState(s){
  if(!s.settings)s.settings={};
  ['shopRate','indirectRate','capexYears','workingHoursPerYear'].forEach(k=>{if(s.settings[k]==null)s.settings[k]=defaultState().settings[k];});
  (s.breaks||[]).forEach(b=>{if(b.totalEAU===undefined)b.totalEAU=0;});
  (s.bom||[]).forEach(item=>{
    if(item.fgSpecific===undefined)item.fgSpecific=item.type==='fg-specific';
    delete item.type;
    if(item.customerSupplied===undefined)item.customerSupplied=false;
    if(!item.fgQtys)item.fgQtys={};
  });
  if(!s.equipment)s.equipment=[];
  if(!s.margins)s.margins={};
  if(!s.materialSources)s.materialSources={};
  (s.directOps||[]).forEach(op=>{
    delete op.lineSetupOverrides;
    if(!op.equipmentIds){
      op.equipmentIds=[];
      if(num(op.capex)>0){const eq={id:uid(),name:op.name||'Equipment',capex:num(op.capex),hourlyRunCost:0,annualMaintenance:0,projectSpecific:false};s.equipment.push(eq);op.equipmentIds=[eq.id];}
    }
    delete op.capex;
  });
  (s.indirectOps||[]).forEach(op=>delete op.lineSetupOverrides);
  return s;
}
let state=(()=>{for(const k of[STORE,'mce_v3','mce_v2','mce_v1']){try{const s=localStorage.getItem(k);if(s)return migrateState(JSON.parse(s));}catch(e){}}return defaultState();})();

let saveTimer=null;
function saveState(){clearTimeout(saveTimer);setStatus('Saving…');saveTimer=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(state));setStatus('Saved');}catch(e){setStatus('Error');}},300);}
function setStatus(t){const el=document.getElementById('save-status');if(el)el.textContent=t;}
function newQuote(){pushUndo();state=defaultState();saveState();render();}
function exportJSON(){const a=document.createElement('a');a.href='data:application/json,'+encodeURIComponent(JSON.stringify(state,null,2));a.download=(state.quote.name||'quote').replace(/[^a-z0-9_-]/gi,'_')+'.json';a.click();}
function importJSON(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{pushUndo();state=migrateState(JSON.parse(ev.target.result));saveState();render();}catch(err){}};r.readAsText(f);e.target.value='';}

// ── Calculations ─────────────────────────────────────────────
function qtyPerBuild(fgi,bki){const fg=state.finishedGoods[fgi],br=state.breaks[bki];if(!fg||!br||!br.buildsPerYear)return 0;return num((fg.breaks[bki]||{}).eau)/br.buildsPerYear;}
function totalOrderQty(bki){return state.finishedGoods.reduce((s,_,i)=>s+qtyPerBuild(i,bki),0);}
function totalAnnualUnits(bki){return state.finishedGoods.reduce((s,fg)=>s+num((fg.breaks[bki]||{}).eau),0);}
function bomQtyForFG(item,fgId){if(!item.fgSpecific)return num(item.qty);return num((item.fgQtys||{})[fgId]);}
function annualPurchQty(item,bki){if(item.customerSupplied)return 0;return state.finishedGoods.reduce((s,fg)=>s+bomQtyForFG(item,fg.id)*num((fg.breaks[bki]||{}).eau),0);}
function findCost(rmId,tq){
  const arch=state.materialCosts[rmId]||[];if(!arch.length||!tq)return null;
  const ok=arch.filter(e=>e.annualQty>=tq*0.9&&e.annualQty<=tq*10);if(!ok.length)return null;
  const best=ok.reduce((a,b)=>Math.abs(a.annualQty-tq)<Math.abs(b.annualQty-tq)?a:b);
  return{cost:best.cost,flagged:Math.abs(best.annualQty-tq)/tq>0.02,actualQty:best.annualQty};
}
function setCost(rmId,aq,cost){
  if(!state.materialCosts[rmId])state.materialCosts[rmId]=[];
  const arch=state.materialCosts[rmId];const i=arch.findIndex(e=>Math.abs(e.annualQty-aq)<0.01);
  if(i>=0)arch[i]={annualQty:aq,cost,timestamp:Date.now()};else arch.push({annualQty:aq,cost,timestamp:Date.now()});
}
function calcEquipCost(op,bki){
  const{capexYears,workingHoursPerYear}=state.settings;
  const wkHrs=num(workingHoursPerYear)||1,cyrs=num(capexYears)||1;
  const tau=totalAnnualUnits(bki),bpy=num((state.breaks[bki]||{}).buildsPerYear),nFGs=state.finishedGoods.length;
  const ct=num(op.cycleTimeSec)/3600,os=num(op.orderSetupMin)/60,ls=num(op.lineSetupMin)/60;
  const occHrs=ct*tau+os*bpy+ls*bpy*nFGs;const util=occHrs/wkHrs;
  let cost=0;
  for(const eqId of(op.equipmentIds||[])){
    const eq=state.equipment.find(e=>e.id===eqId);if(!eq)continue;
    if(eq.projectSpecific){if(tau>0){cost+=num(eq.capex)/tau;cost+=num(eq.annualMaintenance)/tau;}}
    else{if(tau>0){cost+=(num(eq.capex)/cyrs)*util/tau;cost+=num(eq.annualMaintenance)*util/tau;}}
    cost+=num(eq.hourlyRunCost)*ct;
  }
  return cost;
}
function calcCosts(fgi,bki){
  const fg=state.finishedGoods[fgi];if(!fg)return null;
  const{shopRate,indirectRate}=state.settings;
  const eau=num((fg.breaks[bki]||{}).eau),qpb=qtyPerBuild(fgi,bki),toq=totalOrderQty(bki),tau=totalAnnualUnits(bki),bpy=num((state.breaks[bki]||{}).buildsPerYear);
  let mat=0,matIncomplete=false;
  for(const item of state.bom){
    if(item.customerSupplied)continue;const bq=bomQtyForFG(item,fg.id);if(!bq)continue;
    const aq=annualPurchQty(item,bki);const found=findCost(item.id,aq);
    if(!found)matIncomplete=true;else mat+=bq*(found.cost||0);
  }
  let dlRun=0,dlLine=0,dlOrder=0,dlEquip=0;
  for(const op of state.directOps){
    const ops=num(op.operators)||1,ct=num(op.cycleTimeSec)/3600,ls=num(op.lineSetupMin)/60,os=num(op.orderSetupMin)/60;
    dlRun+=ct*shopRate*ops;if(qpb>0)dlLine+=ls*shopRate*ops/qpb;if(toq>0)dlOrder+=os*shopRate*ops/toq;
    dlEquip+=calcEquipCost(op,bki);
  }
  let ilRun=0,ilLine=0,ilOrder=0;
  for(const op of state.indirectOps){
    if(tau>0)ilRun+=num(op.annualHours)*indirectRate/tau;
    if(eau>0)ilLine+=num(op.lineSetupHrs)*bpy*indirectRate/eau;
    // FIX: divide by toq (units/order), not tau. bpy cancels: (os*bpy*rate)/(toq*bpy)=os*rate/toq
    if(toq>0)ilOrder+=num(op.orderSetupHrs)*indirectRate/toq;
  }
  let sub=0;
  for(const s of state.subcontracts){
    sub+=num(s.priceEach);if(qpb>0)sub+=num(s.pricePerLine)/qpb;if(toq>0)sub+=num(s.pricePerOrder)/toq;if(tau>0)sub+=num(s.pricePerYear)/tau;
  }
  const dl=dlRun+dlLine+dlOrder+dlEquip,il=ilRun+ilLine+ilOrder;
  return{mat,dl,dlRun,dlLine,dlOrder,dlEquip,il,ilRun,ilLine,ilOrder,sub,total:mat+dl+il+sub,matIncomplete,eau};
}
function getTaktInfo(){
  let maxTau=0,maxLabel='';
  state.breaks.forEach((b,j)=>{const t=totalAnnualUnits(j);if(t>maxTau){maxTau=t;maxLabel=b.label;}});
  const wkHrs=num(state.settings.workingHoursPerYear);if(!maxTau||!wkHrs)return null;
  const taktSec=wkHrs*3600/maxTau;
  const exceeding=state.directOps.filter(op=>num(op.cycleTimeSec)>taktSec&&num(op.cycleTimeSec)>0);
  return{taktSec,maxTau,maxLabel,exceeding};
}
function updateTaktNotice(){
  const el=document.getElementById('takt-notice');if(!el)return;
  const t=getTaktInfo();if(!t){el.innerHTML='';return;}
  const ts=t.taktSec.toFixed(2);
  if(t.exceeding.length)
    el.innerHTML=`<div class="inline-warn">Takt at <b>${esc(t.maxLabel)}</b> (${fmtN(t.maxTau)}/yr): <b>${ts} sec/unit</b>. One or more operations exceed required takt time: <b>${t.exceeding.map(o=>esc(o.name||'(unnamed)')).join(', ')}</b></div>`;
  else
    el.innerHTML=`<div class="inline-info">Takt at <b>${esc(t.maxLabel)}</b> (${fmtN(t.maxTau)}/yr): <b>${ts} sec/unit</b>. All cycle times are within takt.</div>`;
}
function applyMixToBreak(srcBki,dstBki){
  const srcTotal=totalAnnualUnits(srcBki);if(!srcTotal)return;const dstTotal=num(state.breaks[dstBki].totalEAU);if(!dstTotal)return;
  state.finishedGoods.forEach(fg=>{const pct=num((fg.breaks[srcBki]||{}).eau)/srcTotal;while(fg.breaks.length<=dstBki)fg.breaks.push({});fg.breaks[dstBki]={eau:Math.round(pct*dstTotal)};});
}
function refreshBrkSums(){
  state.breaks.forEach((brk,j)=>{
    const cell=document.getElementById('bsum-'+j);if(!cell)return;
    const sum=totalAnnualUnits(j),tgt=num(brk.totalEAU);
    if(!tgt){cell.textContent=fmtN(sum);cell.className='';return;}
    const diff=Math.abs(sum-tgt),pct=diff/tgt;
    if(diff<0.01){cell.textContent=fmtN(sum)+' ✓';cell.className='sum-ok';}
    else{cell.textContent=fmtN(sum)+' / '+fmtN(tgt);cell.className=pct>0.05?'sum-err':'sum-warn';}
  });
}

// ── Equipment dropdown helpers ────────────────────────────────
function eqIsDefined(eq){return num(eq.capex)>0||num(eq.hourlyRunCost)>0||num(eq.annualMaintenance)>0;}
function renderEqSelector(op,opi){
  const ids=op.equipmentIds||[];
  const chips=ids.map(eqId=>{
    const eq=state.equipment.find(e=>e.id===eqId);if(!eq)return'';
    const ok=eqIsDefined(eq);
    return`<span class="eq-chip${ok?'':' eq-chip-warn'}"${ok?'':' title="No attributes defined on Equipment tab"'}>${esc(eq.name)}${ok?'':' ⚠'}<button type="button" onclick="removeEqChip('${esc(eqId)}',${opi})">×</button></span>`;
  }).filter(Boolean).join('');
  const items=state.equipment.map(eq=>
    `<div class="eq-item" data-name="${esc(eq.name.toLowerCase())}"><label><input type="checkbox" value="${esc(eq.id)}"${ids.includes(eq.id)?' checked':''}> ${esc(eq.name)}</label></div>`
  ).join('');
  return`<div class="eq-dd" data-opi="${opi}">
    <div class="eq-chips">${chips}</div>
    <input type="text" class="eq-inp" placeholder="${state.equipment.length?'Search equipment…':'Type name to add…'}" autocomplete="off">
    <div class="eq-menu">${items}<div class="eq-cr" style="display:none"></div></div>
  </div>`;
}
function removeEqChip(eqId,opi){
  const op=state.directOps[opi];if(!op)return;
  op.equipmentIds=(op.equipmentIds||[]).filter(id=>id!==eqId);
  saveState();
  // Update chips without full render
  const dd=document.querySelector(`.eq-dd[data-opi="${opi}"]`);
  if(dd){
    const chips=dd.querySelector('.eq-chips');
    if(chips)chips.innerHTML=(op.equipmentIds||[]).map(id=>{
      const eq=state.equipment.find(e=>e.id===id);if(!eq)return'';
      const ok=eqIsDefined(eq);
      return`<span class="eq-chip${ok?'':' eq-chip-warn'}"${ok?'':' title="No attributes defined"'}>${esc(eq.name)}${ok?'':' ⚠'}<button type="button" onclick="removeEqChip('${esc(id)}',${opi})">×</button></span>`;
    }).filter(Boolean).join('');
    const cb=dd.querySelector(`input[value="${eqId}"]`);if(cb)cb.checked=false;
  }
}

// ── Tab: Info ─────────────────────────────────────────────────
function renderInfo(){
  const q=state.quote,s=state.settings;
  return`<div class="grid2">
<div class="card"><div class="card-hdr">Quote Information</div><div class="card-body">
  <div class="fgrp"><label>Quote Name ${ii('qname')}</label><input type="text" data-path="quote.name" value="${esc(q.name)}"></div>
  <div class="fgrp"><label>Customer ${ii('customer')}</label><input type="text" data-path="quote.customer" value="${esc(q.customer)}"></div>
  <div class="fgrp"><label>Date ${ii('date')}</label><input type="date" data-path="quote.date" value="${esc(q.date)}"></div>
  <div class="fgrp"><label>Revision ${ii('rev')}</label><input type="text" data-path="quote.revision" value="${esc(q.revision)}"></div>
  <div class="fgrp"><label>Notes ${ii('notes')}</label><div id="quote-notes-ce" contenteditable="true" class="notes-editable"></div></div>
</div></div>
<div class="card"><div class="card-hdr">Cost Rate Settings</div><div class="card-body">
  <div class="fgrp"><label>Shop Rate ($/hr) — Direct Labor ${ii('shopRate')}</label><input type="number" data-path="settings.shopRate" value="${s.shopRate}"></div>
  <div class="fgrp"><label>Indirect Rate ($/hr) — Overhead Labor ${ii('indRate')}</label><input type="number" data-path="settings.indirectRate" value="${s.indirectRate}"></div>
  <div class="fgrp"><label>Working Hours / Year ${ii('wkHrs')}</label><input type="number" data-path="settings.workingHoursPerYear" value="${s.workingHoursPerYear}"></div>
  <div class="fgrp"><label>CapEx Depreciation Period (years) ${ii('capexYrs')}</label><input type="number" data-path="settings.capexYears" value="${s.capexYears}"></div>
</div></div>
</div>`;
}

// ── Tab: Finished Goods ───────────────────────────────────────
function renderFGs(){
  const fgs=state.finishedGoods,brks=state.breaks;
  const brkRows=brks.map((b,i)=>`<tr draggable="true" data-idx="${i}">
    <td class="drag-h">&#9776;</td>
    <td><input type="text" data-type="brk-label" data-brki="${i}" value="${esc(b.label)}"></td>
    <td><input type="number" min="1" data-type="brk-bpy" data-brki="${i}" value="${esc(b.buildsPerYear)}"></td>
    <td><input type="number" min="0" data-type="brk-eau" data-brki="${i}" value="${esc(b.totalEAU||'')}" placeholder="optional"></td>
    <td><button class="btn btn-del btn-sm" data-action="del-brk" data-idx="${i}">✕</button></td>
  </tr>`).join('');
  const brkHdr=brks.map((b,j)=>{
    const hasData=fgs.some(fg=>num((fg.breaks[j]||{}).eau)>0);
    const pushBtn=hasData&&brks.length>1?`<br><button class="btn-mix" data-action="push-mix" data-brki="${j}">→ Push mix</button>`:'';
    return`<th style="text-align:center;min-width:90px">${esc(b.label)}<br><span style="font-weight:400;font-size:11px">${b.buildsPerYear}×/yr${num(b.totalEAU)>0?' | tgt: '+fmtN(num(b.totalEAU)):''}</span>${pushBtn}</th>`;
  }).join('');
  const fgRows=fgs.map((fg,i)=>{
    const eauCells=brks.map((_,j)=>`<td style="text-align:center"><input type="number" min="0" data-type="fg-eau" data-fgi="${i}" data-brki="${j}" value="${esc((fg.breaks[j]||{}).eau??'')}"></td>`).join('');
    return`<tr draggable="true" data-idx="${i}"><td class="drag-h">&#9776;</td>
      <td><input type="text" data-type="fg-name" data-fgi="${i}" value="${esc(fg.name)}"></td>
      <td><input type="text" data-type="fg-desc" data-fgi="${i}" value="${esc(fg.description??'')}"></td>
      ${eauCells}<td><button class="btn btn-del btn-sm" data-action="del-fg" data-idx="${i}">✕</button></td></tr>`;
  }).join('');
  const sumCells=brks.map((b,j)=>{
    const sum=totalAnnualUnits(j),tgt=num(b.totalEAU);let cls='',txt=fmtN(sum);
    if(tgt>0){const match=Math.abs(sum-tgt)<0.01,pct=Math.abs(sum-tgt)/tgt;if(match){cls='sum-ok';txt=fmtN(sum)+' ✓';}else{cls=pct>0.05?'sum-err':'sum-warn';txt=fmtN(sum)+' / '+fmtN(tgt);}}
    return`<td style="text-align:center"><span id="bsum-${j}" class="${cls}">${txt}</span></td>`;
  }).join('');
  return`<div class="card"><div class="card-hdr">Volume Breaks <button class="btn btn-add btn-sm" data-action="add-brk">+ Add Break</button></div><div class="card-body">
    <table style="max-width:620px"><thead><tr><th></th><th>Label ${ii('brkLabel')}</th><th>Builds/Year ${ii('brkBpy')}</th><th>Target EAU (opt.) ${ii('brkEau')}</th><th></th></tr></thead>
    <tbody id="tbody-brk">${brkRows}</tbody></table></div></div>
  <div class="card"><div class="card-hdr">Finished Goods — EAU per Break ${ii('fgEau')} <button class="btn btn-add btn-sm" data-action="add-fg">+ Add FG</button></div><div class="card-body">
    ${fgs.length===0?'<p class="empty-msg">No finished goods yet.</p>':''}
    ${fgs.length>0?`<div style="overflow-x:auto"><table>
      <thead><tr><th></th><th>FG Name ${ii('fgName')}</th><th>Description ${ii('fgDesc')}</th>${brkHdr}<th></th></tr></thead>
      <tbody id="tbody-fg">${fgRows}<tr class="sum-row"><td></td><td colspan="2" style="text-align:right;color:#555">EAU Sum →</td>${sumCells}<td></td></tr></tbody></table></div>`:''}
  </div></div>`;
}

// ── Tab: BOM ──────────────────────────────────────────────────
function renderBOM(){
  const fgs=state.finishedGoods;
  const common=state.bom.map((item,i)=>({item,i})).filter(x=>!x.item.fgSpecific);
  const fgspec=state.bom.map((item,i)=>({item,i})).filter(x=>x.item.fgSpecific);
  function chk(type,bomi,checked,title){return`<td style="text-align:center;width:52px"><input type="checkbox" data-type="${type}" data-bomi="${bomi}"${checked?' checked':''} title="${title}"></td>`;}
  const commonRows=common.map(({item,i})=>`<tr draggable="true" data-idx="${i}" class="${item.customerSupplied?'cs-row':''}">
    <td class="drag-h">&#9776;</td>
    <td><input type="text" data-type="bom-pn" data-bomi="${i}" value="${esc(item.partNumber??'')}"></td>
    <td><input type="text" data-type="bom-desc" data-bomi="${i}" value="${esc(item.description??'')}"></td>
    <td style="width:52px"><input type="text" data-type="bom-uom" data-bomi="${i}" value="${esc(item.uom??'')}"></td>
    <td style="width:80px"><input type="text" data-type="bom-qty" data-bomi="${i}" value="${esc(item.qty??'')}"></td>
    ${chk('bom-fgspec',i,false,'Check to make FG-Specific')}${chk('bom-custsup',i,item.customerSupplied,'Customer Supplied')}
    <td><button class="btn btn-del btn-sm" data-action="del-bom" data-idx="${i}">✕</button></td></tr>`).join('');
  const fgHdr=fgs.map(fg=>`<th style="text-align:center;min-width:72px">${esc(fg.name.slice(0,9))}</th>`).join('');
  const fgspecRows=fgspec.map(({item,i})=>{
    const qtyCells=fgs.length?fgs.map(fg=>`<td style="text-align:center"><input type="text" data-type="bom-fq" data-bomi="${i}" data-fgid="${esc(fg.id)}" value="${esc((item.fgQtys||{})[fg.id]??'')}"></td>`).join(''):`<td><span style="color:#aaa;font-size:11px">Add FGs first</span></td>`;
    return`<tr draggable="true" data-idx="${i}" class="${item.customerSupplied?'cs-row':''}">
      <td class="drag-h">&#9776;</td>
      <td><input type="text" data-type="bom-pn" data-bomi="${i}" value="${esc(item.partNumber??'')}"></td>
      <td><input type="text" data-type="bom-desc" data-bomi="${i}" value="${esc(item.description??'')}"></td>
      <td style="width:52px"><input type="text" data-type="bom-uom" data-bomi="${i}" value="${esc(item.uom??'')}"></td>
      ${qtyCells}
      ${chk('bom-fgspec',i,true,'Uncheck to make Common')}${chk('bom-custsup',i,item.customerSupplied,'Customer Supplied')}
      <td><button class="btn btn-del btn-sm" data-action="del-bom" data-idx="${i}">✕</button></td></tr>`;
  }).join('');
  return`<div class="card"><div class="card-hdr">Common Materials <span style="font-size:11px;color:#888;font-weight:400;margin-left:6px">Cust.Sup = customer-supplied, zero cost</span>
    <button class="btn btn-add btn-sm" data-action="add-bom-common">+ Add Common</button></div><div class="card-body">
    ${common.length===0?'<p class="empty-msg">No common materials.</p>':''}
    ${common.length>0?`<div style="overflow-x:auto"><table><thead><tr><th></th><th>Part Number ${ii('bomPn')}</th><th>Description ${ii('bomDesc')}</th><th>UOM ${ii('bomUom')}</th>
      <th>Qty/Unit ${ii('bomQty')}</th><th style="text-align:center">FG-Spec ${ii('bomFgSpec')}</th><th style="text-align:center">Cust.Sup ${ii('bomCustSup')}</th><th></th></tr></thead>
      <tbody id="tbody-bom-common">${commonRows}</tbody></table></div>`:''}
  </div></div>
  <div class="card"><div class="card-hdr">FG-Specific Materials <button class="btn btn-add btn-sm" data-action="add-bom-fgspec">+ Add FG-Specific</button></div><div class="card-body">
    <div class="inline-info" style="margin-bottom:8px">Each FG may use a different quantity. Uncheck FG-Spec to move to Common.</div>
    ${fgspec.length===0?'<p class="empty-msg">No FG-specific materials.</p>':''}
    ${fgspec.length>0?`<div style="overflow-x:auto"><table><thead><tr><th></th><th>Part Number</th><th>Description</th><th>UOM</th>
      ${fgs.length?fgHdr:'<th>Qty/Unit</th>'}<th style="text-align:center">FG-Spec</th><th style="text-align:center">Cust.Sup</th><th></th></tr></thead>
      <tbody id="tbody-bom-fgspec">${fgspecRows}</tbody></table></div>`:''}
  </div></div>`;
}

// ── Tab: Material Costs ───────────────────────────────────────
function renderMatCosts(){
  const costable=state.bom.filter(i=>!i.customerSupplied);
  if(!costable.length)return`<div class="card"><div class="card-body"><p class="empty-msg">Add non-customer-supplied BOM items first.</p></div></div>`;
  const hasMissing=costable.some(item=>state.breaks.some((_,j)=>{const aq=annualPurchQty(item,j);return aq>0&&!findCost(item.id,aq);}));
  const brkHdr=state.breaks.map((b,j)=>`<th style="text-align:center;min-width:115px">${esc(b.label)}<br><span style="font-weight:400;font-size:11px">${b.buildsPerYear}×/yr</span></th>`).join('');
  const rows=costable.map(item=>{
    const cells=state.breaks.map((_,j)=>{
      const aq=annualPurchQty(item,j);if(aq<=0)return`<td style="text-align:center;color:#aaa">—</td>`;
      const found=findCost(item.id,aq);let cls='mcell',note='';
      if(found&&found.flagged){cls+=' mc-arch';note=`<span class="arch-note">⚠ Archived @ ${fmtN(found.actualQty)}</span>`;}
      else if(!found)cls+=' mc-miss';
      const srcKey=item.id+'|'+j;const srcVal=state.materialSources?.[srcKey]||'';
      return`<td class="${cls}"><div class="mcell-qty">Ann.Qty: <b>${fmtN(aq)}</b></div>
        <input type="number" min="0" step="any" data-type="mat-cost" data-rmid="${esc(item.id)}" data-brki="${j}" data-aq="${aq}" value="${esc(found?found.cost:'')}">
        ${note}
        <div style="display:flex;gap:3px;margin-top:3px;align-items:center">
          <input type="text" class="src-inp" placeholder="source" data-type="mat-src" data-rmid="${esc(item.id)}" data-brki="${j}" value="${esc(srcVal)}" title="${T.matSrc}">
          <button class="btn-push" data-action="push-source" data-rmid="${esc(item.id)}" data-brki="${j}" title="Copy source to all breaks">→</button>
        </div></td>`;
    }).join('');
    return`<tr><td>${esc(item.partNumber||'—')}</td><td>${esc(item.description||'—')}</td><td>${esc(item.uom||'')}</td>${cells}</tr>`;
  }).join('');
  return`<div class="card"><div class="card-hdr">Material Costs — $/unit at Annual Purchasing Volume</div><div class="card-body">
    ${hasMissing?`<div class="inline-warn">Pink = missing cost. Yellow = archived cost at different volume — review before finalizing.</div>`:''}
    <div style="overflow-x:auto"><table>
      <thead><tr><th>Part Number</th><th>Description</th><th>UOM</th>${brkHdr}</tr></thead>
      <tbody>${rows}</tbody></table></div>
  </div></div>`;
}

// ── Tab: Equipment ────────────────────────────────────────────
function renderEquipment(){
  const rows=state.equipment.map((eq,i)=>`<tr draggable="true" data-idx="${i}">
    <td class="drag-h">&#9776;</td>
    <td><input type="text" data-type="eq-name" data-eqi="${i}" value="${esc(eq.name??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="eq-capex" data-eqi="${i}" value="${esc(eq.capex??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="eq-run" data-eqi="${i}" value="${esc(eq.hourlyRunCost??'')}" placeholder="0"></td>
    <td><input type="number" min="0" step="any" data-type="eq-maint" data-eqi="${i}" value="${esc(eq.annualMaintenance??'')}" placeholder="0"></td>
    <td style="text-align:center"><input type="checkbox" data-type="eq-projspec" data-eqi="${i}"${eq.projectSpecific?' checked':''}></td>
    <td><button class="btn btn-del btn-sm" data-action="del-eq" data-idx="${i}">✕</button></td>
  </tr>`).join('');
  return`<div class="card"><div class="card-hdr">Equipment <button class="btn btn-add btn-sm" data-action="add-eq">+ Add Equipment</button></div><div class="card-body">
    <div class="inline-info">Define equipment used in operations. Assign to operations on the Operations tab.<br>
      <b>Project-Specific</b>: spreads cost over EAU rather than utilization %. Use for dedicated tooling/fixtures.
      Utilization = (cycle hrs × annual units + order setup hrs × builds/yr + line setup hrs × builds/yr × FG count) ÷ working hrs/yr.</div>
    ${state.equipment.length===0?'<p class="empty-msg">No equipment defined.</p>':''}
    ${state.equipment.length>0?`<div style="overflow-x:auto"><table>
      <thead><tr><th></th><th>Name ${ii('eqName')}</th><th>CapEx ($) ${ii('eqCapex')}</th><th>Run Cost ($/hr) ${ii('eqRun')}</th>
        <th>Annual Maint. ($) ${ii('eqMaint')}</th><th style="text-align:center">Project-Specific ${ii('eqProj')}</th><th></th></tr></thead>
      <tbody id="tbody-eq">${rows}</tbody></table></div>`:''}
  </div></div>`;
}

// ── Tab: Operations ───────────────────────────────────────────
function renderOps(){
  const dlRows=state.directOps.map((op,i)=>`<tr draggable="true" data-idx="${i}">
    <td class="drag-h">&#9776;</td>
    <td class="op-name"><input type="text" data-type="dl-name" data-opi="${i}" value="${esc(op.name??'')}"></td>
    <td><input type="number" min="1" style="max-width:50px" data-type="dl-ops" data-opi="${i}" value="${esc(op.operators??1)}"></td>
    <td><input type="number" min="0" step="any" data-type="dl-ct" data-opi="${i}" value="${esc(op.cycleTimeSec??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="dl-os" data-opi="${i}" value="${esc(op.orderSetupMin??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="dl-ls" data-opi="${i}" value="${esc(op.lineSetupMin??'')}"></td>
    <td style="min-width:140px">${renderEqSelector(op,i)}</td>
    <td class="notes-col"><textarea data-type="dl-notes" data-opi="${i}" rows="1" style="min-height:28px;resize:vertical">${esc(op.notes??'')}</textarea></td>
    <td><button class="btn btn-del btn-sm" data-action="del-direct" data-idx="${i}">✕</button></td>
  </tr>`).join('');
  const subRows=state.subcontracts.map((s,i)=>`<tr draggable="true" data-idx="${i}">
    <td class="drag-h">&#9776;</td>
    <td class="op-name"><input type="text" data-type="sub-name" data-si="${i}" value="${esc(s.name??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="sub-ea" data-si="${i}" value="${esc(s.priceEach??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="sub-line" data-si="${i}" value="${esc(s.pricePerLine??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="sub-order" data-si="${i}" value="${esc(s.pricePerOrder??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="sub-yr" data-si="${i}" value="${esc(s.pricePerYear??'')}"></td>
    <td class="notes-col"><textarea data-type="sub-notes" data-si="${i}" rows="1" style="min-height:28px;resize:vertical">${esc(s.notes??'')}</textarea></td>
    <td><button class="btn btn-del btn-sm" data-action="del-sub" data-idx="${i}">✕</button></td>
  </tr>`).join('');
  const ilRows=state.indirectOps.map((op,i)=>`<tr draggable="true" data-idx="${i}">
    <td class="drag-h">&#9776;</td>
    <td class="op-name"><input type="text" data-type="il-name" data-opi="${i}" value="${esc(op.name??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="il-ah" data-opi="${i}" value="${esc(op.annualHours??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="il-os" data-opi="${i}" value="${esc(op.orderSetupHrs??'')}"></td>
    <td><input type="number" min="0" step="any" data-type="il-ls" data-opi="${i}" value="${esc(op.lineSetupHrs??'')}"></td>
    <td class="notes-col"><textarea data-type="il-notes" data-opi="${i}" rows="1" style="min-height:28px;resize:vertical">${esc(op.notes??'')}</textarea></td>
    <td><button class="btn btn-del btn-sm" data-action="del-indirect" data-idx="${i}">✕</button></td>
  </tr>`).join('');
  return`
<div class="card"><div class="card-hdr">Direct Labor Operations <button class="btn btn-add btn-sm" data-action="add-direct">+ Add Operation</button></div><div class="card-body">
  <div class="inline-info">Shop Rate: <b>$${state.settings.shopRate}/hr</b>. Equipment utilization includes cycle time + both setup types.</div>
  <div id="takt-notice"></div>
  ${state.directOps.length===0?'<p class="empty-msg">No direct labor operations.</p>':''}
  ${state.directOps.length>0?`<div style="overflow-x:auto"><table>
    <thead><tr><th></th><th class="op-name">Operation ${ii('dlName')}</th><th>Operators ${ii('dlOps')}</th>
      <th>Cycle Time<br>(sec) ${ii('dlCt')}</th><th>Order Setup<br>(min) ${ii('dlOs')}</th><th>Line Setup<br>(min) ${ii('dlLs')}</th>
      <th>Equipment ${ii('dlEq')}</th><th class="notes-col">Notes ${ii('dlNotes')}</th><th></th></tr></thead>
    <tbody id="tbody-direct">${dlRows}</tbody></table></div>`:''}
</div></div>
<div class="card"><div class="card-hdr">Subcontracts <button class="btn btn-add btn-sm" data-action="add-sub">+ Add Subcontract</button></div><div class="card-body">
  <div class="inline-info"><b>$/Each</b>: per unit. <b>$/Line</b>: per FG line/order. <b>$/Order</b>: per order event. <b>$/Year</b>: fixed annual.</div>
  ${state.subcontracts.length===0?'<p class="empty-msg">No subcontracts defined.</p>':''}
  ${state.subcontracts.length>0?`<div style="overflow-x:auto"><table>
    <thead><tr><th></th><th class="op-name">Name ${ii('subName')}</th><th>$/Each ${ii('subEa')}</th><th>$/Line ${ii('subLine')}</th>
      <th>$/Order ${ii('subOrder')}</th><th>$/Year ${ii('subYr')}</th><th class="notes-col">Notes</th><th></th></tr></thead>
    <tbody id="tbody-sub">${subRows}</tbody></table></div>`:''}
</div></div>
<div class="card"><div class="card-hdr">Indirect Labor <button class="btn btn-add btn-sm" data-action="add-indirect">+ Add Category</button></div><div class="card-body">
  <div class="inline-info">Indirect Rate: <b>$${state.settings.indirectRate}/hr</b>. Annual Hrs spread over all units. Setup hours are per event.</div>
  ${state.indirectOps.length===0?'<p class="empty-msg">No indirect labor categories.</p>':''}
  ${state.indirectOps.length>0?`<div style="overflow-x:auto"><table>
    <thead><tr><th></th><th class="op-name">Category ${ii('ilName')}</th><th>Annual Hrs ${ii('ilAh')}</th>
      <th>Order Setup (hrs) ${ii('ilOs')}</th><th>Line Setup (hrs) ${ii('ilLs')}</th><th class="notes-col">Notes</th><th></th></tr></thead>
    <tbody id="tbody-indirect">${ilRows}</tbody></table></div>`:''}
</div></div>`;
}

// ── Tab: Summary ──────────────────────────────────────────────
function renderSummary(){
  const fgs=state.finishedGoods,brks=state.breaks;
  if(!fgs.length||!brks.length)return`<div class="card"><div class="card-body"><p class="empty-msg">Add finished goods and volume breaks first.</p></div></div>`;
  const brkHdr=brks.map(b=>`<th style="text-align:right;min-width:115px">${esc(b.label)}<br><span style="font-weight:400;font-size:11px">${b.buildsPerYear}×/yr</span></th>`).join('');
  const cats=[['Material','mat',false],['Direct Labor','dl',false],['  Run','dlRun',true],['  Line Setup','dlLine',true],['  Order Setup','dlOrder',true],['  Equipment','dlEquip',true],['Indirect Labor','il',false],['  Annual Run','ilRun',true],['  Line Setup','ilLine',true],['  Order Setup','ilOrder',true],['Subcontract','sub',false]];
  let rows='';
  for(let fi=0;fi<fgs.length;fi++){
    const fg=fgs[fi];
    rows+=`<tr style="background:#e8f0fe"><td colspan="${brks.length+1}" style="padding:8px 9px 5px;font-weight:700;font-size:13px;color:#1a2940">${esc(fg.name)}${fg.description?` <span style="font-weight:400;color:#666;font-size:12px">— ${esc(fg.description)}</span>`:''}</td></tr>`;
    for(const[lbl,key,isSub] of cats){
      const cells=brks.map((_,j)=>{const c=calcCosts(fi,j);if(!c||c.eau===0)return`<td style="color:#aaa">N/A</td>`;if(c.matIncomplete&&key==='mat')return`<td class="inc">${fmt4(c[key])} ⚠</td>`;return`<td class="${isSub?'sub':''}">${fmt4(c[key])}</td>`;}).join('');
      rows+=`<tr${isSub?' class="sub"':''}><td style="padding-left:${isSub?20:9}px;${isSub?'color:#555;font-size:11.5px':''}">${lbl}</td>${cells}</tr>`;
    }
    rows+=`<tr class="tot"><td>TOTAL / UNIT</td>${brks.map((_,j)=>{const c=calcCosts(fi,j);if(!c||c.eau===0)return`<td>N/A</td>`;return`<td class="${c.matIncomplete?'inc':''}">${fmtC(c.total,4)}</td>`;}).join('')}</tr>`;
    rows+=`<tr style="font-size:11.5px;color:#666;background:#fafbfd"><td>Annual cost (×EAU)</td>${brks.map((_,j)=>{const c=calcCosts(fi,j);if(!c||!c.eau)return`<td style="color:#aaa">—</td>`;return`<td>${fmtC(c.total*c.eau,0)}</td>`;}).join('')}</tr>`;
    const mgCells=brks.map((_,j)=>{const mkey=fg.id+'|'+j,mval=state.margins?.[mkey]??'';return`<td><input type="number" min="0" max="99.9" step="0.1" data-type="margin" data-fgid="${esc(fg.id)}" data-brki="${j}" value="${esc(mval)}" style="width:55px"> %</td>`;}).join('');
    rows+=`<tr style="background:#fef9f0"><td style="color:#92400e;font-weight:600">Margin %</td>${mgCells}</tr>`;
    const spCells=brks.map((_,j)=>{const c=calcCosts(fi,j);if(!c||c.eau===0)return`<td>N/A</td>`;const m=num(state.margins?.[fg.id+'|'+j]);return`<td id="sp-${esc(fg.id)}-${j}">${m>0&&m<100?fmtC(c.total/(1-m/100),4):'—'}</td>`;}).join('');
    rows+=`<tr class="sell-row"><td>Sell Price / Unit</td>${spCells}</tr>`;
    const asCells=brks.map((_,j)=>{const c=calcCosts(fi,j);if(!c||!c.eau)return`<td style="color:#aaa">—</td>`;const m=num(state.margins?.[fg.id+'|'+j]);return`<td id="as-${esc(fg.id)}-${j}" style="color:#166534">${m>0&&m<100?fmtC(c.total/(1-m/100)*c.eau,0):'—'}</td>`;}).join('');
    rows+=`<tr style="font-size:11.5px;background:#f0fdf4;color:#166534"><td>Annual sell (×EAU)</td>${asCells}</tr>`;
    rows+=`<tr><td colspan="${brks.length+1}" style="padding:3px"></td></tr>`;
  }
  return`<div class="card"><div class="card-hdr">Cost Summary — $/unit</div><div class="card-body"><div class="sw"><table class="stbl">
    <thead><tr><th>Cost Element</th>${brkHdr}</tr></thead>
    <tbody>${rows}
      <tr style="border-top:2px solid #dde;color:#555;font-size:11.5px"><td>Units/build (total order)</td>${brks.map((_,j)=>`<td class="num">${fmtN(totalOrderQty(j),1)}</td>`).join('')}</tr>
      <tr style="color:#555;font-size:11.5px"><td>Total annual units</td>${brks.map((_,j)=>`<td class="num">${fmtN(totalAnnualUnits(j))}</td>`).join('')}</tr>
    </tbody></table></div></div></div>`;
}

// ── Drag and Drop ─────────────────────────────────────────────
let dragSrc=null,dragDropTarget=null;
function setupDrag(){
  const groups=[
    {id:'tbody-brk',arr:state.breaks},{id:'tbody-fg',arr:state.finishedGoods},
    {id:'tbody-bom-common',arr:state.bom},{id:'tbody-bom-fgspec',arr:state.bom},
    {id:'tbody-eq',arr:state.equipment},{id:'tbody-direct',arr:state.directOps},
    {id:'tbody-sub',arr:state.subcontracts},{id:'tbody-indirect',arr:state.indirectOps},
  ];
  groups.forEach(g=>{
    const tbody=document.getElementById(g.id);if(!tbody)return;
    const rows=tbody.querySelectorAll('tr[draggable]');
    rows.forEach(row=>{
      const ri=parseInt(row.dataset.idx);
      row.addEventListener('dragstart',e=>{dragSrc={id:g.id,arr:g.arr,idx:ri};e.dataTransfer.effectAllowed='move';requestAnimationFrame(()=>row.classList.add('dragging'));});
      row.addEventListener('dragend',()=>{row.classList.remove('dragging');clearDragIndicators();dragSrc=null;dragDropTarget=null;});
      row.addEventListener('dragover',e=>{
        if(!dragSrc||dragSrc.id!==g.id)return;e.preventDefault();
        clearDragIndicators();
        const rect=row.getBoundingClientRect(),before=e.clientY<rect.top+rect.height/2;
        row.classList.add(before?'drag-before':'drag-after');
        dragDropTarget={idx:ri,before};
      });
      row.addEventListener('dragleave',e=>{if(!row.contains(e.relatedTarget))row.classList.remove('drag-before','drag-after');});
      row.addEventListener('drop',e=>{
        e.preventDefault();clearDragIndicators();
        if(!dragSrc||dragSrc.id!==g.id||!dragDropTarget)return;
        const src=dragSrc.idx,dst=dragDropTarget.idx,before=dragDropTarget.before;
        let insertAt=before?dst:dst+1;
        if(src===insertAt||(src===dst&&before)||(src===dst+1&&!before))return;
        pushUndo();
        const arr=dragSrc.arr;const[item]=arr.splice(src,1);
        if(src<insertAt)insertAt--;
        arr.splice(insertAt,0,item);
        saveState();render();
      });
    });
    // Allow drop at very end of tbody (below all rows)
    tbody.addEventListener('dragover',e=>{
      if(!dragSrc||dragSrc.id!==g.id)return;
      const rows=tbody.querySelectorAll('tr[draggable]');if(!rows.length)return;
      const lastRow=rows[rows.length-1];const rect=lastRow.getBoundingClientRect();
      if(e.clientY>rect.bottom){e.preventDefault();clearDragIndicators();lastRow.classList.add('drag-after');dragDropTarget={idx:parseInt(lastRow.dataset.idx),before:false};}
    });
  });
}
function clearDragIndicators(){document.querySelectorAll('.drag-before,.drag-after').forEach(el=>{el.classList.remove('drag-before','drag-after');});}

// ── Post-render interactivity ─────────────────────────────────
function setupInteractivity(){
  // Quote notes contenteditable
  const notesEl=document.getElementById('quote-notes-ce');
  if(notesEl){
    notesEl.innerHTML=state.quote.notes||'';
    notesEl.addEventListener('input',()=>{state.quote.notes=notesEl.innerHTML;saveState();});
    notesEl.addEventListener('paste',e=>{
      const items=[...(e.clipboardData?.items||[])];
      const img=items.find(i=>i.type.startsWith('image/'));
      if(img){e.preventDefault();
        const reader=new FileReader();
        reader.onload=ev=>{document.execCommand('insertHTML',false,`<img src="${ev.target.result}" style="max-width:100%;display:block;margin:4px 0;">`);state.quote.notes=notesEl.innerHTML;saveState();};
        reader.readAsDataURL(img.getAsFile());
      }
    });
  }
  // Equipment dropdowns
  setupEqDropdowns();
  // Takt notice
  updateTaktNotice();
  // Tooltip positioning: use mousemove to position ::after via CSS custom property (simpler: just use fixed pos via JS)
  document.querySelectorAll('.ii').forEach(el=>{
    el.addEventListener('mouseenter',e=>{
      const rect=el.getBoundingClientRect();
      el.style.setProperty('--tip-top',(rect.top-8)+'px');
      el.style.setProperty('--tip-left',(rect.left+rect.width/2)+'px');
    });
  });
}
function setupEqDropdowns(){
  document.querySelectorAll('.eq-dd').forEach(container=>{
    const opi=parseInt(container.dataset.opi);
    const inp=container.querySelector('.eq-inp');
    const menu=container.querySelector('.eq-menu');
    if(!inp||!menu)return;
    function posMenu(){const r=inp.getBoundingClientRect();menu.style.top=(r.bottom+2)+'px';menu.style.left=r.left+'px';menu.style.width=Math.max(180,r.width)+'px';}
    function filterMenu(q){
      const ql=q.toLowerCase();let any=false;
      menu.querySelectorAll('.eq-item').forEach(item=>{const m=!q||item.dataset.name.includes(ql);item.style.display=m?'':'none';if(m)any=true;});
      const cr=menu.querySelector('.eq-cr');
      if(cr){const exact=state.equipment.some(e=>e.name.toLowerCase()===ql);cr.style.display=q&&!exact?'':'none';cr.textContent=q&&!exact?`Add as new: "${q}"`:'';}
    }
    inp.addEventListener('focus',()=>{posMenu();menu.style.display='block';filterMenu('');});
    inp.addEventListener('blur',()=>setTimeout(()=>{menu.style.display='none';inp.value='';},200));
    inp.addEventListener('input',()=>{posMenu();menu.style.display='block';filterMenu(inp.value);});
    menu.querySelectorAll('.eq-item input[type=checkbox]').forEach(cb=>{
      cb.addEventListener('mousedown',e=>e.preventDefault());
      cb.addEventListener('change',()=>{
        const eqId=cb.value,op=state.directOps[opi];
        if(!op.equipmentIds)op.equipmentIds=[];
        if(cb.checked){if(!op.equipmentIds.includes(eqId))op.equipmentIds.push(eqId);}
        else op.equipmentIds=op.equipmentIds.filter(id=>id!==eqId);
        saveState();
        // Update chips without closing menu
        const chips=container.querySelector('.eq-chips');
        if(chips)chips.innerHTML=(op.equipmentIds||[]).map(id=>{
          const eq=state.equipment.find(e=>e.id===id);if(!eq)return'';
          const ok=eqIsDefined(eq);
          return`<span class="eq-chip${ok?'':' eq-chip-warn'}"${ok?'':' title="No attributes defined"'}>${esc(eq.name)}${ok?'':' ⚠'}<button type="button" onclick="removeEqChip('${esc(id)}',${opi})">×</button></span>`;
        }).filter(Boolean).join('');
      });
    });
    const cr=menu.querySelector('.eq-cr');
    if(cr){
      cr.addEventListener('mousedown',e=>e.preventDefault());
      cr.addEventListener('click',()=>{
        const name=inp.value.trim();if(!name)return;
        const newEq={id:uid(),name,capex:0,hourlyRunCost:0,annualMaintenance:0,projectSpecific:false};
        state.equipment.push(newEq);
        const op=state.directOps[opi];if(!op.equipmentIds)op.equipmentIds=[];
        if(!op.equipmentIds.includes(newEq.id))op.equipmentIds.push(newEq.id);
        saveState();render();
      });
    }
  });
}

// ── Events (attached once) ────────────────────────────────────
let currentTab='info';
function initEvents(){
  const content=document.getElementById('content');
  content.addEventListener('change',e=>{
    const t=e.target,dt=t.dataset||{};
    if(dt.path){
      const parts=dt.path.split('.');let obj=state;
      for(let i=0;i<parts.length-1;i++)obj=obj[parts[i]];
      obj[parts[parts.length-1]]=t.type==='number'?num(t.value):t.value;
      saveState();if(currentTab==='summary'||currentTab==='ops')render();return;
    }
    const type=dt.type;if(!type)return;
    if(type==='brk-label'){state.breaks[+dt.brki].label=t.value;saveState();if(currentTab==='fgs')render();}
    else if(type==='brk-bpy'){state.breaks[+dt.brki].buildsPerYear=num(t.value);saveState();}
    else if(type==='brk-eau'){
      const j=+dt.brki;state.breaks[j].totalEAU=num(t.value);
      if(j>0&&num(state.breaks[j].totalEAU)>0){const st=totalAnnualUnits(0);const empty=!state.finishedGoods.some(fg=>num((fg.breaks[j]||{}).eau)>0);if(st>0&&empty){applyMixToBreak(0,j);saveState();render();return;}}
      saveState();if(currentTab==='fgs')refreshBrkSums();
    }
    else if(type==='fg-name'){state.finishedGoods[+dt.fgi].name=t.value;saveState();}
    else if(type==='fg-desc'){state.finishedGoods[+dt.fgi].description=t.value;saveState();}
    else if(type==='fg-eau'){
      const fg=state.finishedGoods[+dt.fgi];
      while((fg.breaks||[]).length<=+dt.brki)fg.breaks.push({});
      const v=num(t.value);if(v)fg.breaks[+dt.brki].eau=v;else delete fg.breaks[+dt.brki].eau;
      saveState();refreshBrkSums();
    }
    else if(type==='bom-pn'){state.bom[+dt.bomi].partNumber=t.value;saveState();}
    else if(type==='bom-desc'){state.bom[+dt.bomi].description=t.value;saveState();}
    else if(type==='bom-uom'){state.bom[+dt.bomi].uom=t.value;saveState();}
    else if(type==='bom-qty'){state.bom[+dt.bomi].qty=parseFraction(t.value);saveState();}
    else if(type==='bom-fq'){if(!state.bom[+dt.bomi].fgQtys)state.bom[+dt.bomi].fgQtys={};state.bom[+dt.bomi].fgQtys[dt.fgid]=parseFraction(t.value);saveState();}
    else if(type==='bom-fgspec'){const item=state.bom[+dt.bomi];item.fgSpecific=t.checked;if(item.fgSpecific&&!item.fgQtys)item.fgQtys={};saveState();render();}
    else if(type==='bom-custsup'){state.bom[+dt.bomi].customerSupplied=t.checked;saveState();}
    else if(type==='mat-cost'){setCost(dt.rmid,num(dt.aq),num(t.value));saveState();}
    else if(type==='mat-src'){if(!state.materialSources)state.materialSources={};state.materialSources[dt.rmid+'|'+dt.brki]=t.value;saveState();}
    else if(type==='eq-name'){state.equipment[+dt.eqi].name=t.value;saveState();}
    else if(type==='eq-capex'){state.equipment[+dt.eqi].capex=num(t.value);saveState();}
    else if(type==='eq-run'){state.equipment[+dt.eqi].hourlyRunCost=num(t.value);saveState();}
    else if(type==='eq-maint'){state.equipment[+dt.eqi].annualMaintenance=num(t.value);saveState();}
    else if(type==='eq-projspec'){state.equipment[+dt.eqi].projectSpecific=t.checked;saveState();}
    else if(type==='dl-name'){state.directOps[+dt.opi].name=t.value;saveState();}
    else if(type==='dl-ops'){state.directOps[+dt.opi].operators=num(t.value);saveState();}
    else if(type==='dl-ct'){state.directOps[+dt.opi].cycleTimeSec=num(t.value);saveState();updateTaktNotice();}
    else if(type==='dl-os'){state.directOps[+dt.opi].orderSetupMin=num(t.value);saveState();}
    else if(type==='dl-ls'){state.directOps[+dt.opi].lineSetupMin=num(t.value);saveState();}
    else if(type==='dl-notes'){state.directOps[+dt.opi].notes=t.value;saveState();}
    else if(type==='il-name'){state.indirectOps[+dt.opi].name=t.value;saveState();}
    else if(type==='il-ah'){state.indirectOps[+dt.opi].annualHours=num(t.value);saveState();}
    else if(type==='il-os'){state.indirectOps[+dt.opi].orderSetupHrs=num(t.value);saveState();}
    else if(type==='il-ls'){state.indirectOps[+dt.opi].lineSetupHrs=num(t.value);saveState();}
    else if(type==='il-notes'){state.indirectOps[+dt.opi].notes=t.value;saveState();}
    else if(type==='sub-name'){state.subcontracts[+dt.si].name=t.value;saveState();}
    else if(type==='sub-ea'){state.subcontracts[+dt.si].priceEach=num(t.value);saveState();}
    else if(type==='sub-line'){state.subcontracts[+dt.si].pricePerLine=num(t.value);saveState();}
    else if(type==='sub-order'){state.subcontracts[+dt.si].pricePerOrder=num(t.value);saveState();}
    else if(type==='sub-yr'){state.subcontracts[+dt.si].pricePerYear=num(t.value);saveState();}
    else if(type==='sub-notes'){state.subcontracts[+dt.si].notes=t.value;saveState();}
    else if(type==='margin'){
      if(!state.margins)state.margins={};
      const key=dt.fgid+'|'+dt.brki;state.margins[key]=num(t.value);saveState();
      const fgi=state.finishedGoods.findIndex(f=>f.id===dt.fgid);
      const c=calcCosts(fgi,+dt.brki);const m=num(t.value);
      const sp=document.getElementById('sp-'+dt.fgid+'-'+dt.brki);
      const as=document.getElementById('as-'+dt.fgid+'-'+dt.brki);
      if(c&&c.eau>0){const sell=m>0&&m<100?fmtC(c.total/(1-m/100),4):'—';const ann=m>0&&m<100?fmtC(c.total/(1-m/100)*c.eau,0):'—';if(sp)sp.textContent=sell;if(as)as.textContent=ann;}
    }
  });
  content.addEventListener('click',e=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action,idx=+btn.dataset.idx;
    pushUndo();
    if(action==='add-brk'){state.breaks.push({id:uid(),label:'Break '+(state.breaks.length+1),buildsPerYear:1,totalEAU:0});}
    else if(action==='del-brk'){
      if(state.breaks.length<=1){const n=document.createElement('div');n.className='inline-err';n.textContent='At least one break is required.';btn.closest('tr').lastElementChild.appendChild(n);setTimeout(()=>n.remove(),2500);undoStack.pop();return;}
      state.breaks.splice(idx,1);state.finishedGoods.forEach(fg=>{if(fg.breaks)fg.breaks.splice(idx,1);});
    }
    else if(action==='add-fg'){state.finishedGoods.push({id:uid(),name:'FG-'+(state.finishedGoods.length+1).toString().padStart(3,'0'),description:'',breaks:state.breaks.map(()=>({}))});}
    else if(action==='del-fg'){const fgId=state.finishedGoods[idx].id;state.finishedGoods.splice(idx,1);state.bom.forEach(item=>{if(item.fgQtys)delete item.fgQtys[fgId];});}
    else if(action==='add-bom-common'){state.bom.push({id:uid(),partNumber:'',description:'',uom:'EA',fgSpecific:false,customerSupplied:false,qty:1,fgQtys:{}});}
    else if(action==='add-bom-fgspec'){state.bom.push({id:uid(),partNumber:'',description:'',uom:'EA',fgSpecific:true,customerSupplied:false,qty:0,fgQtys:{}});}
    else if(action==='del-bom'){state.bom.splice(idx,1);}
    else if(action==='add-eq'){state.equipment.push({id:uid(),name:'',capex:0,hourlyRunCost:0,annualMaintenance:0,projectSpecific:false});}
    else if(action==='del-eq'){const eqId=state.equipment[idx].id;state.equipment.splice(idx,1);state.directOps.forEach(op=>{if(op.equipmentIds)op.equipmentIds=op.equipmentIds.filter(id=>id!==eqId);});}
    else if(action==='add-direct'){state.directOps.push({id:uid(),name:'',operators:1,cycleTimeSec:0,orderSetupMin:0,lineSetupMin:0,equipmentIds:[],notes:''});}
    else if(action==='del-direct'){state.directOps.splice(idx,1);}
    else if(action==='add-indirect'){state.indirectOps.push({id:uid(),name:'',annualHours:0,orderSetupHrs:0,lineSetupHrs:0,notes:''});}
    else if(action==='del-indirect'){state.indirectOps.splice(idx,1);}
    else if(action==='add-sub'){state.subcontracts.push({id:uid(),name:'',priceEach:0,pricePerLine:0,pricePerOrder:0,pricePerYear:0,notes:''});}
    else if(action==='del-sub'){state.subcontracts.splice(idx,1);}
    else if(action==='push-mix'){const src=+btn.dataset.brki;state.breaks.forEach((_,j)=>{if(j!==src&&num(state.breaks[j].totalEAU)>0)applyMixToBreak(src,j);});}
    else if(action==='push-source'){
      if(!state.materialSources)state.materialSources={};
      const rmId=btn.dataset.rmid,srcBrki=+btn.dataset.brki;
      const val=state.materialSources[rmId+'|'+srcBrki]||'';
      state.breaks.forEach((_,j)=>{state.materialSources[rmId+'|'+j]=val;});
    }
    else{undoStack.pop();return;}
    saveState();render();
  });
}

// ── Render ────────────────────────────────────────────────────
const tabRenders={info:renderInfo,fgs:renderFGs,bom:renderBOM,matcost:renderMatCosts,equip:renderEquipment,ops:renderOps,summary:renderSummary};
function render(){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));
  document.getElementById('content').innerHTML=(tabRenders[currentTab]||renderInfo)();
  setupDrag();
  setupInteractivity();
}
document.getElementById('tabs').addEventListener('click',e=>{
  const btn=e.target.closest('.tab-btn');if(!btn)return;currentTab=btn.dataset.tab;render();
});
initEvents();render();
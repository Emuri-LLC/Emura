#!/usr/bin/env python3
"""PostToolUse hook: posts a Wrike comment and updates due date/status on git commit/push.

Reads active task from .claude/current-wrike-task.json.
Reads Bearer token from .mcp.json.
Always exits 0 to avoid interrupting Claude's workflow.
"""

import sys
import json
import re
import subprocess
import datetime
import urllib.parse
import os

PROJECT_ROOT = "/Users/eohano/Emuri/Emura"
STATE_FILE   = os.path.join(PROJECT_ROOT, ".claude", "current-wrike-task.json")
MCP_FILE     = os.path.join(PROJECT_ROOT, ".mcp.json")
WRIKE_API    = "https://www.wrike.com/api/v4"
REVIEW_STATUS = "IEAG2PPMJMHLYVAE"


def main():
    try:
        payload   = json.load(sys.stdin)
        tool_name = payload.get("tool_name", "")
        command   = payload.get("tool_input", {}).get("command", "")
        tool_resp = payload.get("tool_response", "")
        output    = tool_resp.get("output", "") if isinstance(tool_resp, dict) else str(tool_resp)
    except Exception:
        sys.exit(0)

    if tool_name != "Bash":
        sys.exit(0)

    is_commit = bool(re.search(r'\bgit\b.*\bcommit\b', command))
    is_push   = bool(re.search(r'\bgit\b.*\bpush\b', command))

    if not (is_commit or is_push):
        sys.exit(0)
    if "--dry-run" in command:
        sys.exit(0)

    operation = "push" if is_push else "commit"

    if operation == "commit" and "nothing to commit" in output.lower():
        sys.exit(0)

    if not os.path.exists(STATE_FILE):
        sys.exit(0)

    try:
        with open(STATE_FILE) as f:
            state = json.load(f)
        task_id = state.get("taskId", "")
        if not task_id:
            sys.exit(0)
    except Exception:
        sys.exit(0)

    try:
        with open(MCP_FILE) as f:
            mcp = json.load(f)
        args = mcp["mcpServers"]["wrike"]["args"]
        token = None
        for i, arg in enumerate(args):
            if arg == "--header" and i + 1 < len(args):
                m = re.match(r'Authorization:Bearer\s*(\S+)', args[i + 1])
                if m:
                    token = m.group(1)
                    break
        if not token:
            print("[wrike-hook] ERROR: Bearer token not found in .mcp.json", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"[wrike-hook] ERROR reading .mcp.json: {e}", file=sys.stderr)
        sys.exit(1)

    today = datetime.date.today().isoformat()
    auth_header = f"Authorization: Bearer {token}"

    if operation == "commit":
        m = re.search(r'\[(\S+)\s+([a-f0-9]+)\]\s+(.*)', output)
        if m:
            commit_hash = m.group(2)
            commit_msg  = m.group(3).strip()
            comment = f"Git commit on {today}\nMessage: {commit_msg}\nCommit: {commit_hash}"
        else:
            comment = f"Git commit on {today}"
    else:
        m = re.search(r'(\S+)\s+->\s+(\S+)', output)
        ref = f"{m.group(1)} -> {m.group(2)}" if m else ""
        comment = f"Git push on {today}" + (f"\nRef: {ref}" if ref else "")

    comment_result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         f"{WRIKE_API}/tasks/{task_id}/comments",
         "-H", auth_header,
         "-H", "Content-Type: application/x-www-form-urlencoded",
         "-d", urllib.parse.urlencode({"text": comment})],
        capture_output=True, text=True
    )
    try:
        resp = json.loads(comment_result.stdout)
        if "errorDescription" in resp:
            print(f"[wrike-hook] comment error: {resp['errorDescription']}", file=sys.stderr)
    except Exception:
        pass

    update_params = {"dates": json.dumps({"due": today, "type": "Milestone"})}
    if operation == "push":
        update_params["customStatus"] = REVIEW_STATUS

    update_result = subprocess.run(
        ["curl", "-s", "-X", "PUT",
         f"{WRIKE_API}/tasks/{task_id}",
         "-H", auth_header,
         "-H", "Content-Type: application/x-www-form-urlencoded",
         "-d", urllib.parse.urlencode(update_params)],
        capture_output=True, text=True
    )
    try:
        resp = json.loads(update_result.stdout)
        if "errorDescription" in resp:
            print(f"[wrike-hook] update error: {resp['errorDescription']}", file=sys.stderr)
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()

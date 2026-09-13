#!/usr/bin/env python3
"""
studio.py — local studio for the portfolio.

    python studio.py                 # preview at http://localhost:5173 (+ dashboard at /studio), watches content.xlsx
    python studio.py build           # content.xlsx -> site/content.json, once
    python studio.py validate        # report problems in the workbook
    python studio.py init --remote https://github.com/<you>/<repo>.git
    python studio.py publish -m "update projects"     # build + commit + push (GitHub Actions deploys)

Standard library only. Works on Windows, macOS, Linux and WSL.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import threading
import time
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
XLSX = ROOT / "content.xlsx"
JSON_OUT = SITE / "content.json"
sys.path.insert(0, str(ROOT / "tools"))
import build_content as bc  # noqa: E402

STATE = {"version": "0", "last_build": None, "warnings": [], "error": None, "log": []}
LOCK = threading.Lock()


# ----------------------------------------------------------------------------- build / watch
def log(msg: str):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with LOCK:
        STATE["log"] = (STATE["log"] + [line])[-200:]


def rebuild() -> bool:
    try:
        content = bc.build(XLSX)
        bc.write(content, JSON_OUT)
        warns = bc.validate(content, SITE)
        with LOCK:
            STATE.update(version=str(time.time()), last_build=time.strftime("%Y-%m-%d %H:%M:%S"), warnings=warns, error=None)
        n = sum(len(v) for v in content["data"].values())
        log(f"built content.json: {len(content['sections'])} sections, {n} items" + (f", {len(warns)} warning(s)" if warns else ""))
        for w in warns:
            log("  warning: " + w)
        return True
    except PermissionError:
        log("content.xlsx is locked (Excel is saving) - will retry")
        return False
    except Exception as e:  # noqa: BLE001
        with LOCK:
            STATE["error"] = f"{type(e).__name__}: {e}"
        log(f"BUILD FAILED: {type(e).__name__}: {e}")
        return False


def watch_loop():
    last = None
    pending_since = None
    while True:
        try:
            m = XLSX.stat().st_mtime if XLSX.exists() else None
        except OSError:
            m = None
        if m != last:
            pending_since = time.time()
            last = m
        if pending_since and time.time() - pending_since > 0.6:
            pending_since = None
            if XLSX.exists():
                log("content.xlsx changed")
                if not rebuild():
                    last = None  # retry on next tick
        time.sleep(0.7)


# ----------------------------------------------------------------------------- git helpers
def run(cmd: list[str], timeout=120) -> tuple[int, str]:
    try:
        p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace")
        return p.returncode, (p.stdout + p.stderr).strip()
    except FileNotFoundError:
        return 127, f"{cmd[0]}: command not found"
    except subprocess.TimeoutExpired:
        return 124, "timed out"


def git_state() -> dict:
    code, _ = run(["git", "rev-parse", "--is-inside-work-tree"])
    info = {"is_repo": code == 0, "branch": "", "remote": "", "dirty": 0, "last_commit": "", "pages_url": "", "repo_url": "", "settings_url": "", "actions_url": ""}
    if code != 0:
        return info
    _, info["branch"] = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    if info["branch"] == "HEAD" or not info["branch"]:
        info["branch"] = "main"
    _, remote = run(["git", "remote", "get-url", "origin"])
    info["remote"] = remote if "fatal" not in remote and "error" not in remote else ""
    _, status = run(["git", "status", "--porcelain"])
    info["dirty"] = len([l for l in status.splitlines() if l.strip()])
    _, info["last_commit"] = run(["git", "log", "-1", "--pretty=%h %s (%cr)"])
    if info["last_commit"].startswith("fatal"):
        info["last_commit"] = ""
    m = re.search(r"github\.com[:/]([^/]+)/([^/.]+)(?:\.git)?/?$", info["remote"])
    if m:
        owner, repo = m.group(1), m.group(2)
        info["repo_url"] = f"https://github.com/{owner}/{repo}"
        info["settings_url"] = info["repo_url"] + "/settings/pages"
        info["actions_url"] = info["repo_url"] + "/actions"
        info["pages_url"] = f"https://{owner}.github.io/" if repo.lower() == f"{owner}.github.io".lower() else f"https://{owner}.github.io/{repo}/"
    return info


def git_init(remote: str) -> str:
    out = []
    if not (ROOT / ".git").exists():
        out.append(run(["git", "init", "-b", "main"])[1] or "initialised repository")
    if remote:
        code, _ = run(["git", "remote", "get-url", "origin"])
        cmd = ["git", "remote", "set-url", "origin", remote] if code == 0 else ["git", "remote", "add", "origin", remote]
        out.append(run(cmd)[1] or f"origin -> {remote}")
    return "\n".join(out)


def publish(message: str) -> tuple[bool, str]:
    out = []
    if not rebuild():
        return False, "build failed - fix the workbook first:\n" + (STATE.get("error") or "")
    gs = git_state()
    if not gs["is_repo"]:
        return False, "This folder is not a git repository yet. Use 'Connect GitHub' with your repository URL first."
    if not gs["remote"]:
        return False, "No 'origin' remote. Use 'Connect GitHub' with your repository URL first."
    code, o = run(["git", "add", "-A"]); out.append(o)
    code, o = run(["git", "commit", "-m", message or f"Update portfolio {time.strftime('%Y-%m-%d %H:%M')}"])
    out.append(o)
    if code != 0 and "nothing to commit" not in o:
        if "Please tell me who you are" in o or "user.name" in o:
            out.append("\nGit needs your identity once:\n  git config --global user.name \"Your Name\"\n  git config --global user.email you@example.com")
        return False, "\n".join(out)
    code, o = run(["git", "push", "-u", "origin", gs["branch"]], timeout=300); out.append(o)
    if code != 0:
        return False, "\n".join(out)
    out.append(f"\nPushed. GitHub Actions is building the site: {gs['actions_url'] or ''}\nIt will appear at: {gs['pages_url'] or '(enable Pages in repo settings)'}")
    return True, "\n".join(out)


def open_excel():
    if not XLSX.exists():
        return "content.xlsx not found"
    try:
        if sys.platform.startswith("win"):
            os.startfile(XLSX)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(XLSX)])
        elif "microsoft" in os.uname().release.lower():  # WSL
            subprocess.Popen(["cmd.exe", "/c", "start", "", str(XLSX).replace("/mnt/c", "C:")])
        else:
            subprocess.Popen(["xdg-open", str(XLSX)])
        return "opening content.xlsx"
    except Exception as e:  # noqa: BLE001
        return f"could not open: {e}"


# ----------------------------------------------------------------------------- http
DASHBOARD = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Portfolio Studio</title>
<style>
:root{--paper:#f7efe1;--paper2:#fcf8f0;--ink:#2a2622;--soft:#5b544c;--accent:#e2674a;--teal:#2f9e8f;--mustard:#e8b43a;--peri:#6b6fd6}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,Segoe UI,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:2rem 1.25rem 4rem}h1{font-size:2rem;margin:0}h1 small{font-weight:400;color:var(--soft);font-size:1rem;margin-left:.6rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.2rem;margin-top:1.5rem}
.card{background:var(--paper2);border:2px solid var(--ink);border-radius:255px 15px 225px 15px/15px 225px 15px 255px;padding:1.2rem 1.4rem}
.card h2{margin:0 0 .6rem;font-size:1.15rem}.k{color:var(--soft);font-size:.9rem}.v{font-weight:700;word-break:break-all}
.row{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.9rem}
button,.btn{font:inherit;font-weight:700;padding:.55rem 1rem;border:2px solid var(--ink);border-radius:255px 15px 225px 15px/15px 225px 15px 255px;background:#fff;cursor:pointer;text-decoration:none;color:var(--ink)}
button:hover,.btn:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 var(--ink)}button:disabled{opacity:.5;cursor:wait}
.primary{background:var(--accent);color:#fff}.teal{background:var(--teal);color:#fff}
input{font:inherit;padding:.5rem .7rem;border:2px solid var(--ink);border-radius:8px;width:100%;background:#fff}
pre{background:#fff;border:2px dashed #b9ad9a;border-radius:10px;padding:1rem;white-space:pre-wrap;font-size:.85rem;max-height:340px;overflow:auto;margin:.8rem 0 0}
.warn{color:#9a4a12}.ok{color:var(--teal)}.err{color:#b3261e}.pill{display:inline-block;padding:.1rem .6rem;border-radius:999px;border:1.5px solid var(--ink);font-size:.8rem;font-weight:700}
ol{padding-left:1.2rem}li{margin:.3rem 0}
</style></head><body><div class="wrap">
<h1>Portfolio Studio <small>edit the Excel file, preview live, publish to GitHub Pages</small></h1>
<div class="row"><a class="btn primary" href="/" target="_blank">Open preview ↗</a><a class="btn" href="/cv.html" target="_blank">CV page ↗</a><button onclick="act('open-excel')">Open content.xlsx</button><button onclick="act('build')">Rebuild now</button></div>
<div class="grid">
 <div class="card"><h2>Content</h2>
  <div class="k">Workbook</div><div class="v" id="xlsx"></div>
  <div class="k" style="margin-top:.5rem">Last build</div><div class="v" id="last"></div>
  <div class="k" style="margin-top:.5rem">Status</div><div id="status"></div>
  <p class="k">Save the workbook in Excel and the preview reloads by itself.</p>
 </div>
 <div class="card"><h2>GitHub</h2>
  <div id="git"></div>
  <div class="row"><input id="remote" placeholder="https://github.com/you/your-portfolio.git"><button onclick="connect()">Connect GitHub</button></div>
  <p class="k">Create an empty repository on GitHub, paste its URL, click Connect. Then enable Pages once: repo → Settings → Pages → Source: <b>GitHub Actions</b>.</p>
 </div>
 <div class="card"><h2>Publish</h2>
  <p class="k">Builds content.json, commits everything and pushes. The included workflow then deploys to GitHub Pages (about a minute).</p>
  <input id="msg" placeholder="Commit message (optional)">
  <div class="row"><button class="teal" id="pub" onclick="publish()">Publish to GitHub</button></div>
 </div>
</div>
<h2 style="margin-top:2rem">Log</h2><pre id="log"></pre>
<script>
const $=s=>document.querySelector(s);
async function refresh(){const r=await fetch('/__studio/state');const s=await r.json();
$('#xlsx').textContent=s.xlsx+(s.exists?'':'  (missing!)');$('#last').textContent=s.last_build||'not built yet';
$('#status').innerHTML=s.error?`<span class="err">✖ ${esc(s.error)}</span>`:(s.warnings.length?`<span class="warn">⚠ ${s.warnings.length} warning(s)</span><ol>${s.warnings.map(w=>`<li class="warn">${esc(w)}</li>`).join('')}</ol>`:'<span class="ok">✔ all good</span>');
const g=s.git;$('#git').innerHTML=!g.is_repo?'<span class="pill">not a git repo yet</span>':`<div class="k">Remote</div><div class="v">${esc(g.remote)||'<span class="warn">none</span>'}</div><div class="k">Branch · changes</div><div class="v">${esc(g.branch)} · ${g.dirty} file(s) changed</div><div class="k">Last commit</div><div class="v">${esc(g.last_commit)||'—'}</div>${g.pages_url?`<div class="k">Live site</div><div class="v"><a href="${g.pages_url}" target="_blank">${g.pages_url}</a></div><div class="row"><a class="btn" href="${g.actions_url}" target="_blank">Actions</a><a class="btn" href="${g.settings_url}" target="_blank">Pages settings</a></div>`:''}`;
if(g.remote&&!$('#remote').value)$('#remote').value=g.remote;$('#log').textContent=s.log.join('\\n');$('#log').scrollTop=1e9;}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
async function act(name,body){const r=await fetch('/__studio/'+name,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});const j=await r.json();await refresh();return j}
async function connect(){const remote=$('#remote').value.trim();if(!remote)return alert('Paste the repository URL first');await act('git-init',{remote})}
async function publish(){if(!confirm('Commit and push everything to GitHub now?'))return;const b=$('#pub');b.disabled=true;b.textContent='Publishing…';try{const j=await act('publish',{message:$('#msg').value});alert(j.ok?'Pushed! GitHub Actions is deploying the site.':'Publish failed - see the log.')}finally{b.disabled=false;b.textContent='Publish to GitHub'}}
refresh();setInterval(refresh,2500);
</script></div></body></html>"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(SITE), **kw)

    def log_message(self, fmt, *args):  # quieter
        if "__studio" in (args[0] if args else ""):
            return
        sys.stderr.write("  " + (fmt % args) + "\n")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, obj, status=HTTPStatus.OK):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/studio", "/studio/"):
            data = DASHBOARD.encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/__studio/version":
            return self._json({"version": STATE["version"]})
        if path == "/__studio/state":
            with LOCK:
                st = dict(STATE)
            st.update(xlsx=str(XLSX), exists=XLSX.exists(), git=git_state())
            return self._json(st)
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            body = {}
        if path == "/__studio/build":
            return self._json({"ok": rebuild()})
        if path == "/__studio/open-excel":
            log(open_excel())
            return self._json({"ok": True})
        if path == "/__studio/git-init":
            out = git_init(str(body.get("remote", "")).strip())
            log(out)
            return self._json({"ok": True, "out": out})
        if path == "/__studio/publish":
            ok, out = publish(str(body.get("message", "")).strip())
            for line in out.splitlines():
                log(line)
            return self._json({"ok": ok, "out": out})
        self._json({"error": "unknown action"}, HTTPStatus.NOT_FOUND)


def serve(port: int, open_browser: bool):
    if not JSON_OUT.exists() or (XLSX.exists() and XLSX.stat().st_mtime > JSON_OUT.stat().st_mtime):
        rebuild()
    else:
        with LOCK:
            STATE.update(version=str(JSON_OUT.stat().st_mtime), last_build=time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(JSON_OUT.stat().st_mtime)))
        try:
            STATE["warnings"] = bc.validate(json.loads(JSON_OUT.read_text(encoding="utf-8")), SITE)
        except Exception:  # noqa: BLE001
            pass
    threading.Thread(target=watch_loop, daemon=True).start()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://localhost:{port}"
    log(f"preview   {url}")
    log(f"studio    {url}/studio")
    log("watching  content.xlsx  (Ctrl+C to stop)")
    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url + "/studio")).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")
    s = sub.add_parser("serve", help="preview + dashboard (default)")
    s.add_argument("--port", type=int, default=5173)
    s.add_argument("--no-open", action="store_true")
    sub.add_parser("build", help="content.xlsx -> site/content.json")
    sub.add_parser("validate", help="check the workbook")
    i = sub.add_parser("init", help="git init + set the GitHub remote")
    i.add_argument("--remote", required=True)
    p = sub.add_parser("publish", help="build, commit, push")
    p.add_argument("-m", "--message", default="")
    args = ap.parse_args()

    if args.cmd in (None, "serve"):
        serve(getattr(args, "port", 5173), not getattr(args, "no_open", False))
    elif args.cmd == "build":
        sys.exit(0 if rebuild() else 1)
    elif args.cmd == "validate":
        content = bc.build(XLSX)
        warns = bc.validate(content, SITE)
        print("\n".join(warns) if warns else "no problems found")
        sys.exit(1 if warns else 0)
    elif args.cmd == "init":
        print(git_init(args.remote))
    elif args.cmd == "publish":
        ok, out = publish(args.message)
        print(out)
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

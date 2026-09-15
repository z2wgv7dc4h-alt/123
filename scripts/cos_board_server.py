#!/usr/bin/env python3
"""CoS board — status, logs, FCC inbox chat. http://127.0.0.1:8787/
Paid is NEVER messaged or launched from this board.
"""
from __future__ import annotations
import json, os, time, subprocess, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime

ROOT = Path(r"C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio")
RUNS = ROOT / "_cos-runs"
PORT = int(os.environ.get("COS_BOARD_PORT", "8787"))
INBOX = RUNS / "BOARD-INBOX-fcc.md"
REPLIES = RUNS / "BOARD-REPLIES-fcc.md"
CHAT_BRIEF = "_cos-runs\\BRIEF-fcc-board-chat.md"
COS = ROOT / "scripts" / "cos.ps1"

HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>CoS board</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#0b0d10;color:#e6e8eb;font:14px/1.4 system-ui,sans-serif;padding:12px}
h1{font-size:16px;margin:0 0 8px}#tick{opacity:.5;font-size:12px}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.pill{padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700}
.on{background:#0f3d2e;color:#3ddc97}.off{background:#3a1520;color:#ff7b8a}.idle{background:#2a2f38;color:#9aa3ad}
.meta{opacity:.75;font-size:12px;margin:0 0 8px;word-break:break-all}
.panel{background:#151a21;border:1px solid #2a3340;border-radius:10px;padding:10px;margin:0 0 10px}
label{display:block;font-size:11px;opacity:.6;margin:0 0 6px;text-transform:uppercase;letter-spacing:.04em}
.log{
  height:32vh;min-height:140px;max-height:420px;overflow:auto;
  -webkit-overflow-scrolling:touch;background:#0a0c0f;border:1px solid #232a34;
  border-radius:8px;padding:10px;font:12.5px/1.45 ui-monospace,Consolas,monospace;
  white-space:pre-wrap;word-break:break-word;color:#c9d1d9;
}
.chatlog{height:28vh;min-height:120px}
.hl-exit{color:#3ddc97;font-weight:700}
.hl-fail{color:#ff7b8a;font-weight:700}
.hl-live{color:#7dd3fc}
.hl-brief{color:#fbbf24}
.err{color:#ff7b8a}
.ok{color:#3ddc97}
.row{display:flex;gap:8px;margin-top:8px}
textarea{
  flex:1;min-height:72px;resize:vertical;background:#0a0c0f;color:#e6e8eb;
  border:1px solid #2a3340;border-radius:8px;padding:10px;font:14px/1.4 system-ui,sans-serif
}
button{
  padding:10px 14px;border-radius:8px;border:0;font-weight:700;cursor:pointer;
  background:#3ddc97;color:#0b0d10
}
button:disabled{opacity:.5;cursor:wait}
.hint{font-size:12px;opacity:.65;margin:6px 0 0}
</style>
</head>
<body>
<h1>CoS board <span id="tick"></span></h1>
<div class="bar" id="pills"></div>
<div class="meta" id="meta"></div>

<div class="panel">
  <label>Message FCC (free) — paid never receives board chat</label>
  <div class="log chatlog" id="clog"></div>
  <div class="row">
    <textarea id="msg" placeholder="Message FCC… (STOP on its own line to end FCC session)"></textarea>
    <button id="send">Send to FCC</button>
  </div>
  <div class="hint" id="chatHint">Queues FCC inbox. Starts one free FCC poller if idle. Paid is never messaged or launched from here.</div>
</div>

<div class="panel">
  <label>Live / writer log</label>
  <div class="log" id="wlog"></div>
</div>
<div class="panel">
  <label>TASK-LOG (finished runs)</label>
  <div class="log" id="tlog"></div>
</div>
<div class="panel">
  <label>ACE</label>
  <div class="meta" id="ace" style="margin:0"></div>
</div>

<script>
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function paintLog(el, text){
  var nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 48;
  var keep = el.scrollTop;
  el.innerHTML = text;
  if(nearBottom) el.scrollTop = el.scrollHeight;
  else el.scrollTop = keep;
}
function fmtWriter(j){
  var lines=[];
  (j.writers||[]).forEach(function(w){
    var a=w.active||{};
    var brief=a.brief?String(a.brief).split(/[/\\]/).pop():'-';
    lines.push('=== '+String(w.which||'').toUpperCase()+' '+(w.live?'LIVE':'idle')+' ===');
    lines.push((a.route||'-')+' | '+brief+' | log '+w.logLen+'B'+(w.modelHint?' | '+w.modelHint:''));
    if(a.started) lines.push('started '+a.started);
    if(a.log) lines.push(a.log);
    lines.push('');
    var tail=w.tail||[];
    if(!tail.length){ lines.push('(empty mid-run)'); }
    else {
      tail.forEach(function(raw){
        var s=String(raw);
        if(s.indexOf('EXIT=0')===0) lines.push('[[EXITOK]]'+s);
        else if(s.indexOf('EXIT=')===0) lines.push('[[EXITBAD]]'+s);
        else if(s.length>20 && s.trim()[0]==='{'){
          try{
            var o=JSON.parse(s), bits=[];
            if(o.type) bits.push(o.type);
            if(o.subtype) bits.push(o.subtype);
            if(o.message && o.message.content){
              var c=o.message.content;
              if(Array.isArray(c)) c.forEach(function(p){
                if(p.type==='text'&&p.text) bits.push(String(p.text).slice(0,240));
                if(p.type==='tool_use') bits.push('tool:'+(p.name||''));
                if(p.type==='thinking'&&p.thinking) bits.push('think:'+String(p.thinking).slice(0,160));
              });
            }
            if(o.tool_name) bits.push('tool:'+o.tool_name);
            if(o.result) bits.push(String(o.result).slice(0,220));
            if(o.content) bits.push(String(o.content).slice(0,220));
            lines.push(bits.join(' | ')||s.slice(0,280));
          }catch(e){ lines.push(s.slice(0,280)+'...'); }
        } else lines.push(s);
      });
    }
    lines.push('');
  });
  return lines.map(function(l){
    var e=esc(l);
    if(l.indexOf('[[EXITOK]]')===0) return '<span class="hl-exit">'+esc(l.replace('[[EXITOK]]',''))+'</span>';
    if(l.indexOf('[[EXITBAD]]')===0) return '<span class="hl-fail">'+esc(l.replace('[[EXITBAD]]',''))+'</span>';
    if(/^=== .* LIVE ===$/.test(l)) return '<span class="hl-live">'+e+'</span>';
    if(/BRIEF-/.test(l)) return e.replace(/(BRIEF-[A-Za-z0-9._-]+)/g,'<span class="hl-brief">$1</span>');
    return e;
  }).join('\n');
}
function fmtTasks(rows){
  return (rows||[]).map(esc).join('\n') || '(no finished tasks yet)';
}
function fmtChat(j){
  var parts=[];
  if(j.inbox) parts.push('<span class="hl-brief">— FCC inbox —</span>\n'+esc(j.inbox));
  if(j.replies) parts.push('\n<span class="hl-exit">— FCC replies —</span>\n'+esc(j.replies));
  return parts.join('\n') || '(no FCC chat yet — send a message)';
}
async function pull(){
  try{
    var c=new AbortController();
    var t=setTimeout(function(){c.abort();},7000);
    var r=await fetch('/api.json?'+Date.now(),{cache:'no-store',signal:c.signal});
    clearTimeout(t);
    if(!r.ok) throw new Error('HTTP '+r.status);
    var j=await r.json();
    tick.textContent=j.t;
    var pills='';
    (j.writers||[]).forEach(function(w){
      var st=w.live?'on':(w.active?'idle':'off');
      var lab=w.live?'LIVE':(w.active?'ACTIVE?':'none');
      pills+='<span class="pill '+st+'">'+(w.which||'').toUpperCase()+' '+lab+'</span>';
      if(w.exit) pills+='<span class="pill idle">'+esc(w.exit)+'</span>';
    });
    var ace=j.ace||{};
    pills+='<span class="pill '+(ace.hasGpu?'on':'off')+'">ACE '+(ace.hasGpu?'GPU':'down')+'</span>';
    document.getElementById('pills').innerHTML=pills;
    var m=[];
    (j.writers||[]).forEach(function(w){
      var a=w.active||{};
      if(a.brief) m.push((w.which||'')+': '+String(a.brief).split(/[/\\]/).pop());
    });
    document.getElementById('meta').textContent=m.join(' · ')||'no active briefs';
    document.getElementById('ace').textContent=(ace.device||ace.error||'-')+' | '+(ace.checkpoint||'')+' | upstream '+ace.upstreamUp;
    paintLog(document.getElementById('wlog'), fmtWriter(j));
    paintLog(document.getElementById('tlog'), fmtTasks(j.tasks));
    paintLog(document.getElementById('clog'), fmtChat(j.chat||{}));
    var fcc=(j.writers||[]).find(function(w){return w.which==='fcc';});
    document.getElementById('chatHint').textContent = fcc && fcc.live
      ? 'FCC LIVE — Send queues inbox only (no relaunch). Paid never gets board messages.'
      : 'FCC idle — Send queues inbox and starts one free FCC poller. Paid never gets board messages.';
  }catch(e){
    document.getElementById('meta').innerHTML='<span class="err">'+esc(e)+'</span>';
  }
}
async function postChat(){
  var btn=document.getElementById('send');
  btn.disabled=true;
  try{
    var body={text:document.getElementById('msg').value||'', which:'fcc'};
    var r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var j=await r.json();
    if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
    document.getElementById('msg').value='';
    document.getElementById('chatHint').innerHTML='<span class="ok">'+esc(j.ok||'queued')+'</span>';
    await pull();
  }catch(e){
    document.getElementById('chatHint').innerHTML='<span class="err">'+esc(e)+'</span>';
  }finally{
    btn.disabled=false;
  }
}
document.getElementById('send').onclick=function(){ postChat(); };
document.getElementById('msg').addEventListener('keydown',function(e){
  if(e.key==='Enter' && (e.metaKey||e.ctrlKey)){ e.preventDefault(); postChat(); }
});
pull(); setInterval(pull,2500);
</script>
</body></html>
"""


def read_active(which: str):
    p = RUNS / f"ACTIVE-{which}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def process_live(which: str) -> bool:
    pat = "DnB-Paid" if which == "paid" else "DnB-FCC"
    try:
        out = subprocess.check_output(
            [
                "powershell", "-NoProfile", "-Command",
                f"(Get-CimInstance Win32_Process | Where-Object {{ $_.CommandLine -match '{pat}' }} | Measure-Object).Count",
            ],
            text=True, timeout=8,
        ).strip()
        return int(out or "0") > 0
    except Exception:
        return bool(read_active(which))


def tail_lines(path, n=60):
    if not path:
        return []
    fp = Path(path)
    if not fp.exists():
        return []
    try:
        return fp.read_bytes().decode("utf-8", errors="replace").splitlines()[-n:]
    except Exception:
        return []


def read_tail_text(path: Path, n=80) -> str:
    if not path.exists():
        return ""
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(lines[-n:])
    except Exception:
        return ""


def ace_probe():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8766/probe", timeout=0.7) as r:
            return json.loads(r.read().decode("utf-8", errors="replace"))
    except Exception as e:
        return {"error": str(e)[:120]}


def ensure_chat_files():
    RUNS.mkdir(parents=True, exist_ok=True)
    if not INBOX.exists():
        INBOX.write_text("# Board inbox (Wyatt → FCC)\n", encoding="utf-8")
    if not REPLIES.exists():
        REPLIES.write_text("# Board replies (FCC → Wyatt)\n", encoding="utf-8")


def launch_fcc_chat():
    """Free FCC only. Never launch paid from the board."""
    if process_live("fcc"):
        return "FCC already LIVE — message queued in inbox only"
    stop = RUNS / "BOARD-STOP-fcc"
    if stop.exists():
        stop.unlink()
    cmd = [
        "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", str(COS), "run", "-Which", "fcc", "-Brief", CHAT_BRIEF, "-MaxTurns", "120",
    ]
    flags = 0
    if hasattr(subprocess, "CREATE_NO_WINDOW"):
        flags |= subprocess.CREATE_NO_WINDOW
    if hasattr(subprocess, "DETACHED_PROCESS"):
        flags |= subprocess.DETACHED_PROCESS
    subprocess.Popen(
        cmd,
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=flags,
    )
    return "started free FCC board-chat (polls FCC inbox)"


def status_obj():
    ensure_chat_files()
    writers = []
    for which in ("fcc", "paid"):
        active = read_active(which)
        live = bool(active) or process_live(which)
        log = (active or {}).get("log")
        if not log:
            pattern = "DnB-Paid-*.log" if which == "paid" else "DnB-FCC-*.log"
            logs = sorted(RUNS.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
            log = str(logs[0]) if logs else None
        log_len = Path(log).stat().st_size if log and Path(log).exists() else 0
        tail = tail_lines(log, 80)
        blob = "\n".join(tail)
        exit_line = next((ln for ln in reversed(tail) if ln.startswith("EXIT=")), None)
        model = None
        if "nemotron" in blob:
            model = "nemotron"
        elif "sonnet" in blob.lower() or "claude" in blob.lower():
            model = "sonnet"
        writers.append({
            "which": which,
            "live": live,
            "active": active,
            "logLen": log_len,
            "exit": None if active else exit_line,
            "modelHint": model,
            "tail": tail,
        })
    tasks = []
    tp = RUNS / "TASK-LOG.md"
    if tp.exists():
        try:
            tasks = tp.read_text(encoding="utf-8", errors="replace").splitlines()[-40:]
        except Exception:
            pass
    return {
        "t": time.strftime("%H:%M:%S"),
        "writers": writers,
        "ace": ace_probe(),
        "tasks": tasks,
        "chat": {
            "inbox": read_tail_text(INBOX, 60),
            "replies": read_tail_text(REPLIES, 80),
            "target": "fcc",
        },
    }


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        return

    def _send(self, code, ctype, body: bytes):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api.json"):
            try:
                body = json.dumps(status_obj(), separators=(",", ":")).encode()
                self._send(200, "application/json; charset=utf-8", body)
            except Exception as e:
                self._send(500, "application/json", json.dumps({"error": str(e)}).encode())
        else:
            self._send(200, "text/html; charset=utf-8", HTML.encode())

    def do_POST(self):
        if not self.path.startswith("/api/chat"):
            self._send(404, "application/json", b'{"error":"not found"}')
            return
        try:
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b"{}"
            data = json.loads(raw.decode("utf-8", errors="replace") or "{}")
            which = (data.get("which") or "fcc").lower().strip()
            # Hard lock: board chat is FCC-only. Never message or launch paid.
            if which != "fcc":
                self._send(
                    400,
                    "application/json; charset=utf-8",
                    json.dumps({"error": "board chat is FCC-only; paid is disabled"}).encode(),
                )
                return
            text = (data.get("text") or "").strip()
            ensure_chat_files()
            msg_bits = []
            if text:
                stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                block = f"\n## {stamp} PT — Wyatt\n{text}\n"
                with INBOX.open("a", encoding="utf-8") as f:
                    f.write(block)
                msg_bits.append("queued in FCC inbox")
            # Free FCC poller only — never paid
            msg_bits.append(launch_fcc_chat())
            ok = "; ".join(msg_bits) or "noop"
            self._send(200, "application/json; charset=utf-8", json.dumps({"ok": ok}).encode())
        except Exception as e:
            self._send(500, "application/json", json.dumps({"error": str(e)}).encode())


def main():
    class S(ThreadingHTTPServer):
        allow_reuse_address = True
    httpd = S(("0.0.0.0", PORT), H)
    print(f"CoS board http://127.0.0.1:{PORT}/", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()

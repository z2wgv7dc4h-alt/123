from pathlib import Path
import re
p = Path(r"C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\sidecar\ace_bridge_server.py")
t = p.read_text(encoding="utf-8")
good = (
    "CORS_ORIGINS = (\n"
    '    "http://127.0.0.1:5173",\n'
    '    "http://localhost:5173",\n'
    '    "http://192.168.68.55:5173",\n'
    '    "http://127.0.0.1:4173",\n'
    '    "http://localhost:4173",\n'
    ")"
)
t2 = re.sub(r"CORS_ORIGINS = \([\s\S]*?\)", good, t, count=1)
t2 = t2.replace('HOST = "127.0.0.1"', 'HOST = "0.0.0.0"')
p.write_text(t2, encoding="utf-8")
for l in t2.splitlines():
    if l.startswith("HOST") or "5173" in l or l.startswith("CORS"):
        print(l)

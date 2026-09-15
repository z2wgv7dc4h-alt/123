from pathlib import Path
p = Path(r"C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\sidecar\ace_bridge_server.py")
t = p.read_text(encoding="utf-8")
if "CORS_ORIGINS" not in t:
    insert = '''HOST = "0.0.0.0"
PORT = 8766
ACE_API = "http://127.0.0.1:8001"
CORS_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://192.168.68.55:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
)

'''
    t = t.replace(
        'HOST = "0.0.0.0"\nPORT = 8766\nACE_API = "http://127.0.0.1:8001"\n',
        insert,
    )
    p.write_text(t, encoding="utf-8")
    print("restored CORS_ORIGINS")
else:
    print("CORS already present")
for i,l in enumerate(p.read_text(encoding="utf-8").splitlines()[17:35], start=18):
    print(f"{i}:{l}")

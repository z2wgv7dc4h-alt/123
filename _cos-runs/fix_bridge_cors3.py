from pathlib import Path
p = Path(r"C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\sidecar\ace_bridge_server.py")
lines = p.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
inserted = False
for line in lines:
    if line.startswith("CORS_ORIGINS"):
        # skip until closing paren line of a broken leftover
        continue
    out.append(line)
    if (not inserted) and line.startswith('ACE_API = '):
        out.append("CORS_ORIGINS = (\n")
        out.append('    "http://127.0.0.1:5173",\n')
        out.append('    "http://localhost:5173",\n')
        out.append('    "http://192.168.68.55:5173",\n')
        out.append('    "http://127.0.0.1:4173",\n')
        out.append('    "http://localhost:4173",\n')
        out.append(")\n")
        out.append("\n")
        inserted = True
text = "".join(out)
# remove accidental duplicate blank issues
p.write_text(text, encoding="utf-8")
print("inserted", inserted)
print("CORS count", text.count("CORS_ORIGINS"))
for i,l in enumerate(text.splitlines()[17:36], start=18):
    print(f"{i}:{l}")

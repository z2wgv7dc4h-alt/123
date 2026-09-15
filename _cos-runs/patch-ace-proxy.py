from pathlib import Path
p = Path(r"C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\src\core\backends\AceStepBackend.ts")
t = p.read_text(encoding="utf-8")
old = """function aceSidecarBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:8766`;
  }
  return 'http://127.0.0.1:8766';
}
export const ACE_SIDECAR_BASE = aceSidecarBase();"""
new = """function aceSidecarBase(): string {
  // Browser (incl. phone on LAN): same-origin Vite proxy -> PC localhost:8766 (avoids firewall/CORS).
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/ace-bridge`;
  }
  return 'http://127.0.0.1:8766';
}
export const ACE_SIDECAR_BASE = aceSidecarBase();"""
if old not in t:
    raise SystemExit('old aceSidecarBase block not found')
p.write_text(t.replace(old, new), encoding='utf-8')
print('AceStepBackend patched')

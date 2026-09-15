from pathlib import Path

# --- AceStepBackend: dynamic URLs + longer probe timeout ---
p = Path(r"C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\src\core\backends\AceStepBackend.ts")
t = p.read_text(encoding="utf-8")
t = t.replace("export const ACE_PROBE_TIMEOUT_MS = 2000;", "export const ACE_PROBE_TIMEOUT_MS = 12000;")
# Make PROBE/RENDER URLs getters used at call time
old_exports = """export const ACE_SIDECAR_BASE = aceSidecarBase();
export const ACE_SIDECAR_PROBE_URL = `${ACE_SIDECAR_BASE}/probe`;
export const ACE_SIDECAR_RENDER_URL = `${ACE_SIDECAR_BASE}/render`;
export const ACE_PROBE_TIMEOUT_MS = 12000;
export const ACE_RENDER_TIMEOUT_MS = 240_000;"""
new_exports = """export const ACE_PROBE_TIMEOUT_MS = 12000;
export const ACE_RENDER_TIMEOUT_MS = 240_000;
export function getAceSidecarBase(): string {
  return aceSidecarBase();
}
/** @deprecated prefer getAceSidecarProbeUrl() — kept for tests */
export const ACE_SIDECAR_BASE = typeof window !== "undefined" ? `${window.location.origin}/ace-bridge` : "http://127.0.0.1:8766";
export const ACE_SIDECAR_PROBE_URL = `${ACE_SIDECAR_BASE}/probe`;
export const ACE_SIDECAR_RENDER_URL = `${ACE_SIDECAR_BASE}/render`;
export function getAceSidecarProbeUrl(): string {
  return `${aceSidecarBase()}/probe`;
}
export function getAceSidecarRenderUrl(): string {
  return `${aceSidecarBase()}/render`;
}"""
if "getAceSidecarProbeUrl" not in t:
    if old_exports not in t:
        # try without timeout already replaced
        old_exports = old_exports.replace("12000", "2000")
    if old_exports not in t:
        raise SystemExit("export block not found:\n" + t[t.find("export const ACE_"):t.find("export const ACE_")+400])
    t = t.replace(old_exports, new_exports)
# probe/render fetch use dynamic URLs
t = t.replace(
    "const res = await fetch(ACE_SIDECAR_PROBE_URL, {",
    "const res = await fetch(getAceSidecarProbeUrl(), {",
)
# render fetch - find ACE_SIDECAR_RENDER_URL in fetch
t = t.replace(
    "fetch(ACE_SIDECAR_RENDER_URL,",
    "fetch(getAceSidecarRenderUrl(),",
)
p.write_text(t, encoding="utf-8")
print("AceStepBackend OK")

# --- useStudioStore: re-probe on generate so phone recovers from failed init ---
sp = Path(r"C:\Users\RIGGUSPIG\Downloads\dnb-studio-app\dnb-studio\src\ui\hooks\useStudioStore.ts")
st = sp.read_text(encoding="utf-8")
needle = """    const s = get();
    // Studio/ACE without GPU: fail-soft to Sketch audio"""
insert = """    const sPre = get();
    // Phone/LAN: re-probe ACE every Generate so a failed init probe doesn't stick on Sketch.
    try {
      const aceBe = backendRegistry.get('ace-step-1.5');
      if (aceBe) {
        const probe = await aceBe.probe();
        if (probe.hasGpu) {
          set({
            aceHasGpu: true,
            productTier: 'studio',
            backendId: 'ace-step-1.5',
            warnings: [],
          });
          backendRegistry.setActive('ace-step-1.5');
        } else {
          set({ aceHasGpu: false });
        }
      }
    } catch {
      /* keep prior aceHasGpu */
    }
    const s = get();
    // Studio/ACE without GPU: fail-soft to Sketch audio"""
if "re-probe ACE every Generate" not in st:
    if needle not in st:
        raise SystemExit("store needle not found")
    st = st.replace(needle, insert, 1)
    sp.write_text(st, encoding="utf-8")
    print("useStudioStore re-probe OK")
else:
    print("store already patched")

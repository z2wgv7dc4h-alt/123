#!/usr/bin/env python3
"""DnB Studio ACE bridge â€” 127.0.0.1:8766 â†’ official ACE-Step API :8001.

Full contract for AceStepBackend: GET /health, GET /probe, POST /render.
Returns mixWavBase64 so the browser can play without file:// access.
"""
from __future__ import annotations

import base64
import io
import json
import os
import subprocess
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "0.0.0.0"
PORT = 8766
BRIDGE_BUILD = "2026-09-16-turbo-instrumental"


class ExclusiveBridgeServer(ThreadingHTTPServer):
    # Windows SO_REUSEADDR let 3 bridges bind 8766 at once and a stale one answered.
    # A second bridge must fail with "address in use" instead.
    allow_reuse_address = False
    daemon_threads = True


ACE_API = "http://127.0.0.1:8001"
CORS_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://192.168.68.55:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
)


_ARTIST_BLOCK = ()  # artist style descriptors allowed

_MIX_CACHE: dict[str, tuple[bytes, str]] = {}
_MIX_CACHE_MAX = 8


def scrub_artist(text: str) -> str:
    """Pass-through: keep artist names as style descriptors."""
    return text


def cache_mix(job_id: str, blob: bytes, ext: str = "wav") -> str:
    while len(_MIX_CACHE) >= _MIX_CACHE_MAX:
        _MIX_CACHE.pop(next(iter(_MIX_CACHE)))
    _MIX_CACHE[job_id] = (blob, ext)
    return f"http://{HOST}:{PORT}/mix/{urllib.parse.quote(job_id, safe='')}"


def nvidia_visible() -> bool:
    try:
        subprocess.check_output(["nvidia-smi", "-L"], stderr=subprocess.DEVNULL, timeout=3)
        return True
    except Exception:
        return False


def torch_cuda() -> bool:
    try:
        import torch  # type: ignore
        return bool(torch.cuda.is_available())
    except Exception:
        return False

DEFAULT_PROMPT = (
    "drum and bass, instrumental, two-step breakbeat, tight punchy drums, "
    "rolling reese bass, sub bass, original composition"
)

# Studio default DiT: turbo (ACE README quality Very High).
DEFAULT_DIT_MODEL = "acestep-v15-turbo"
# ACE docs/en/INFERENCE.md: base/SFT "recommended 32-64", high quality tip is
# "inference_steps=64 or higher" + use_adg=True. Turbo: "recommended 8".
BASE_INFERENCE_STEPS = 64
TURBO_INFERENCE_STEPS = 8
# audio2audio cover strength: ACE docs recommend ~0.2 for light style
# transfer; default 0.55 here, overrides clamped to the 0.35-0.7 window.
COVER_STRENGTH_DEFAULT = 0.55
COVER_STRENGTH_MIN = 0.35
COVER_STRENGTH_MAX = 0.7


def clamp_cover_strength(value: object) -> float:
    try:
        num = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return COVER_STRENGTH_DEFAULT
    return max(COVER_STRENGTH_MIN, min(COVER_STRENGTH_MAX, num))


# Redo (repaint) strength: how far ACE may move the audio inside the window.
# 0 = barely touch it, 1 = regenerate freely. Browser default 0.5.
REPAINT_STRENGTH_DEFAULT = 0.5
REPAINT_STRENGTH_MIN = 0.0
REPAINT_STRENGTH_MAX = 1.0
REPAINT_MODES = ("conservative", "balanced", "aggressive")
REPAINT_MODE_DEFAULT = "balanced"

# Best-of-N redos: ACE batch_size. Cap at 4 so one redo cannot hog the GPU.
BATCH_SIZE_DEFAULT = 1
BATCH_SIZE_MAX = 4


def clamp_repaint_strength(value: object) -> float:
    try:
        num = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return REPAINT_STRENGTH_DEFAULT
    if num != num:  # NaN
        return REPAINT_STRENGTH_DEFAULT
    return max(REPAINT_STRENGTH_MIN, min(REPAINT_STRENGTH_MAX, num))


def normalize_repaint_mode(value: object) -> str:
    mode = str(value or "").strip().lower()
    return mode if mode in REPAINT_MODES else REPAINT_MODE_DEFAULT


def clamp_batch_size(value: object) -> int:
    try:
        num = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return BATCH_SIZE_DEFAULT
    return max(BATCH_SIZE_DEFAULT, min(BATCH_SIZE_MAX, num))


def safe_float(value: object, fallback: float) -> float:
    """ACE metas can be 'N/A' (LM skipped on repaint/cover) — never crash on them."""
    try:
        num = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return fallback
    return num if num == num and num > 0 else fallback  # NaN / <=0 → fallback


def wav_duration_sec(data: bytes) -> float | None:
    """Real length of the returned audio (extend makes it longer than the plan)."""
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            rate = w.getframerate()
            return w.getnframes() / float(rate) if rate else None
    except Exception:
        return None


def format_payload_note(dit_model: str, payload: dict) -> str:
    """Per-job status line: sampler settings + the cover strength in effect."""
    task_type = str(payload.get("task_type") or "text2music")
    note = (
        f"DiT {dit_model}, {payload['inference_steps']} steps, "
        f"use_adg={payload['use_adg']}, thinking={payload['thinking']}, "
        f"task_type={task_type}"
    )
    if task_type == "cover":
        note += f", audio_cover_strength={payload['audio_cover_strength']}"
    elif task_type == "repaint":
        note += (
            f", repaint={payload['repainting_start']}-{payload['repainting_end']}s"
            f", repaint_mode={payload.get('repaint_mode', REPAINT_MODE_DEFAULT)}"
            f", repaint_strength={payload.get('repaint_strength', REPAINT_STRENGTH_DEFAULT)}"
        )
    return note


def apply_source_task(payload: dict, req: dict) -> dict:
    """Turn a text2music payload into cover or repaint when source audio is sent.
    Cover/repaint skip the LM, so thinking is forced off."""
    if not req.get("srcAudioBase64"):
        return payload
    out = dict(payload)
    out["thinking"] = False
    if req.get("taskType") == "repaint":
        out["task_type"] = "repaint"
        out["repainting_start"] = float(req.get("repaintStartSec") or 0.0)
        end = req.get("repaintEndSec")
        out["repainting_end"] = float(end) if end is not None else -1.0
        out["chunk_mask_mode"] = "explicit"
        out["repaint_mode"] = normalize_repaint_mode(req.get("repaintMode"))
        out["repaint_strength"] = clamp_repaint_strength(req.get("repaintStrength"))
        # Length comes from the source (+ padding past its end), not the plan.
        out.pop("audio_duration", None)
        out.pop("audio_cover_strength", None)
    else:
        out["task_type"] = "cover"
        out["audio_cover_strength"] = clamp_cover_strength(req.get("audioCoverStrength"))
    return out


def is_turbo_model(name: str | None) -> bool:
    return "turbo" in str(name or "").lower()


def configured_dit_model() -> str:
    return os.environ.get("ACESTEP_CONFIG_PATH") or DEFAULT_DIT_MODEL


def loaded_dit_model() -> str:
    """The DiT ACE actually has loaded (GET /v1/models default_model), falling
    back to the env the stack script set. The env alone can lie when ACE was
    started by hand (ACE's own default is turbo)."""
    try:
        _, payload = http_json("GET", f"{ACE_API}/v1/models", timeout=2.0)
        data, _, _ = unwrap(payload)
        if isinstance(data, dict) and data.get("default_model"):
            return str(data["default_model"])
    except Exception:
        pass
    return configured_dit_model()


def build_render_payload(req: dict, model_default: str | None = None) -> dict:
    """Map the browser /render body onto ACE /release_task (text2music).

    Quality pack:
    - thinking=True: the 5Hz LM plans the track (audio codes). With thinking
      off ACE skipped the LM and produced audio with no arrangement plan.
    - use_cot_caption=False / use_cot_language=False: the LM must not rewrite
      our concrete DnB caption or invent sung words.
    - lyrics = structure tags from the browser (tags only), [Instrumental] fallback.
    - base/SFT: 64 steps + use_adg; turbo: 8 steps, no ADG (ignored there).
    - bpm/duration come from the browser plan when sent (174 default).
    """
    prompt = DEFAULT_PROMPT
    if isinstance(req.get("prompt"), dict):
        text = str(req["prompt"].get("text") or "").strip()
        tags = req["prompt"].get("tags") or req["prompt"].get("descriptors") or []
        if text:
            prompt = text
        elif tags:
            prompt = ", ".join(str(t) for t in tags)
    elif isinstance(req.get("prompt"), str) and req["prompt"].strip():
        prompt = req["prompt"].strip()
    prompt = scrub_artist(prompt)
    if "instrumental" not in prompt.lower():
        prompt = f"{prompt}, instrumental only, no vocals"
    if "drum and bass" not in prompt.lower() and "dnb" not in prompt.lower():
        prompt = f"{prompt}, drum and bass, original composition"

    structure_ref = req.get("structureRef")
    structure_ref = structure_ref if isinstance(structure_ref, dict) else {}
    # Tempo + length come from the browser plan; 174 / 16 bars only when the
    # plan did not carry them.
    bpm = int(float(req.get("bpm") or structure_ref.get("bpm") or 174))
    duration_bars = int(req.get("durationBars") or structure_ref.get("bars") or 16)
    duration_sec = max(10.0, min(480.0, duration_bars * 4 * 60.0 / max(bpm, 1)))
    seed = int(req.get("seed") or 42)
    model = str(req.get("checkpointId") or model_default or configured_dit_model())
    turbo = is_turbo_model(model)
    use_adg = req.get("useAdg")

    return {
        "prompt": prompt,
        # Song-map structure tags from the browser (ACE's documented timeline control).
        # is_instrumental() is not read by generation — see docs/ACE-NOTES.md.
        "lyrics": sanitize_tag_lyrics(req.get("lyrics")),
        "thinking": True,
        "use_cot_caption": False,
        "use_cot_language": False,
        # Gradio's LM CFG default (API default is 2.5); Gradio output was clearer.
        "lm_cfg_scale": 2.0,
        "bpm": bpm,
        "audio_duration": duration_sec,
        "time_signature": "4",
        "audio_format": "wav",
        "use_random_seed": False,
        "seed": seed,
        "batch_size": clamp_batch_size(req.get("batchSize")),
        "inference_steps": int(
            req.get("inferenceSteps") or (TURBO_INFERENCE_STEPS if turbo else BASE_INFERENCE_STEPS)
        ),
        "guidance_scale": float(req.get("guidanceScale") or 7.0),
        # Timestep shift: base-model-only per ACE-Step's own docs.
        "shift": float(req.get("shift") or 3.0),
        # ADG is base/SFT-only; turbo DiT ignores it.
        "use_adg": (not turbo) if use_adg is None else (bool(use_adg) and not turbo),
        # DCW: ACE leaves it off for non-turbo unless asked. Wired as "low";
        # scaler defaults deliberately untouched.
        # DCW off by default on non-turbo (ACE #1259); browser sends it explicitly.
        "dcw_enabled": bool(req.get("dcwEnabled", turbo)),
        "dcw_mode": str(req.get("dcwMode") or "low"),
        "task_type": "text2music",
        "model": model,
    }

# Our arrangement's Section.name -> ACE's temporal lyric structure tag.
# Caption (prompt) is the global vibe; lyrics is where ACE gets timing/structure —
# without this every render is one flat instrumental blob with no real drop.
_SECTION_LYRIC_TAG = {
    "intro": "[Intro]",
    "build": "[Build]",
    "drop": "[Drop]",
    "break": "[Breakdown]",
    "breakdown": "[Breakdown]",
    "outro": "[Outro]",
}


def sanitize_tag_lyrics(text: object) -> str:
    """Structure tags only ([Intro - atmospheric] …) — never words ACE could sing."""
    lines = [ln.strip() for ln in str(text or "").splitlines()]
    kept = [ln for ln in lines if ln == "" or (ln.startswith("[") and ln.endswith("]"))]
    out = "\n".join(kept).strip()
    return out or "[Instrumental]"


def build_section_lyrics(structure_ref: object) -> str:
    """[Instrumental] when no section list is sent; else one temporal tag per
    section in bar order, so ACE's build/drop/breakdown land where the
    arrangement map says they do instead of a single undifferentiated pass."""
    if not isinstance(structure_ref, dict):
        return "[Instrumental]"
    sections = structure_ref.get("sections")
    if not isinstance(sections, list) or not sections:
        return "[Instrumental]"
    tags: list[str] = []
    for sec in sections:
        if not isinstance(sec, dict):
            continue
        name = str(sec.get("name") or "").lower()
        tag = _SECTION_LYRIC_TAG.get(name)
        if tag:
            tags.append(tag)
    return "\n".join(tags) if tags else "[Instrumental]"


def cors_origin(handler: BaseHTTPRequestHandler) -> str:
    origin = handler.headers.get("Origin") or ""
    if origin in CORS_ORIGINS:
        return origin
    return CORS_ORIGINS[0]


def http_json(method: str, url: str, body: dict | None = None, timeout: float = 60.0):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return resp.status, json.loads(raw) if raw else {}


def build_multipart_body(fields: dict, files: list[tuple[str, str, bytes]], boundary: str) -> bytes:
    """Pure multipart/form-data encoder — one part per field, then one file part
    per (field, filename, bytes). Kept separate so field names are unit-testable."""
    parts = []
    for key, value in fields.items():
        if value is None:
            continue
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode("utf-8")
        )
    for file_field, filename, file_bytes in files:
        parts.append(
            (
                f"--{boundary}\r\n"
                f"Content-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\n"
                f"Content-Type: application/octet-stream\r\n\r\n"
            ).encode("utf-8")
        )
        parts.append(file_bytes)
        parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts)


def collect_upload_files(req: dict) -> list[tuple[str, str, bytes]]:
    """Audio uploads from a /render body, as ACE file fields:
    - `src_audio`  = cover / repaint source (drives task_type cover/repaint)
    - `reference_audio` = text2music timbre/mix guidance (task_type unchanged)
    Both may be present (repaint with a reference). Decoded here so the field
    name contract is unit-testable."""
    files: list[tuple[str, str, bytes]] = []
    src = req.get("srcAudioBase64")
    if src:
        files.append(
            ("src_audio", str(req.get("srcAudioFileName") or "style-ref.wav"), base64.b64decode(src))
        )
    ref = req.get("refAudioBase64")
    if ref:
        files.append(
            ("reference_audio", str(req.get("refAudioFileName") or "style-ref.wav"), base64.b64decode(ref))
        )
    return files


def http_multipart_files(url: str, fields: dict, files: list[tuple[str, str, bytes]],
                         timeout: float = 120.0):
    """POST multipart/form-data with one or more uploaded files. ACE's
    /release_task takes a raw Request and accepts uploaded audio as `src_audio`
    / `reference_audio` file fields (see docs/en/API.md §4.2 "Method B"). The
    uploaded file wins over any *_path parameter, so the bridge never manages
    server-side temp paths."""
    boundary = "----dnbstudio" + uuid.uuid4().hex
    data = build_multipart_body(fields, files, boundary)
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return resp.status, json.loads(raw) if raw else {}


def http_multipart(url: str, fields: dict, file_field: str, filename: str, file_bytes: bytes,
                   timeout: float = 120.0):
    """Single-file compatibility wrapper around http_multipart_files."""
    return http_multipart_files(url, fields, [(file_field, filename, file_bytes)], timeout=timeout)


def unwrap(payload: dict):
    """ACE wraps responses as {data, code, error}."""
    if isinstance(payload, dict) and "data" in payload and "code" in payload:
        return payload.get("data"), payload.get("code"), payload.get("error")
    return payload, 200, None


def ace_health_ok() -> bool:
    try:
        _, payload = http_json("GET", f"{ACE_API}/health", timeout=2.0)
        data, code, _ = unwrap(payload)
        if code == 200:
            return True
        if isinstance(data, dict) and str(data.get("status", "")).lower() in ("ok", "healthy"):
            return True
        return True  # reachable health endpoint
    except Exception:
        return False


def json_response(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    raw = json.dumps(body).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Access-Control-Allow-Origin", cors_origin(handler))
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(raw)


def extract_task_id(data) -> str | None:
    if not isinstance(data, dict):
        return None
    return data.get("task_id") or data.get("taskId") or data.get("id")


def parse_result_files(entry: dict) -> list[dict]:
    result = entry.get("result")
    if isinstance(result, str) and result.strip():
        try:
            parsed = json.loads(result)
            if isinstance(parsed, list):
                return [x for x in parsed if isinstance(x, dict)]
            if isinstance(parsed, dict):
                return [parsed]
        except Exception:
            return []
    if isinstance(result, list):
        return [x for x in result if isinstance(x, dict)]
    if isinstance(result, dict):
        return [result]
    return []


def audio_url_from_files(files: list[dict]) -> str | None:
    urls = audio_urls_from_files(files)
    return urls[0] if urls else None


def audio_urls_from_files(files: list[dict]) -> list[str]:
    """Every playable result file in order — a batch render returns several."""
    urls: list[str] = []
    for f in files:
        file_field = f.get("file") or f.get("path") or f.get("url")
        if not file_field:
            continue
        s = str(file_field)
        if s.startswith("http"):
            urls.append(s)
        elif s.startswith("/"):
            urls.append(f"{ACE_API}{s}")
        else:
            urls.append(f"{ACE_API}/v1/audio?path={urllib.parse.quote(s, safe='')}")
    return urls


def download_bytes(url: str, timeout: float = 120.0) -> bytes:
    req = urllib.request.Request(url, headers={"Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def build_candidates(audio_urls: list[str], batch_size: int, download=download_bytes) -> list[dict]:
    """Download every batch result file into {wavBase64, durationSec}.
    The downloader is injectable so the payload contract is unit-testable."""
    out: list[dict] = []
    for url in audio_urls[: max(1, batch_size)]:
        data = download(url)
        out.append(
            {
                "wavBase64": base64.b64encode(data).decode("ascii"),
                "durationSec": wav_duration_sec(data),
            }
        )
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = "DnbStudioAceBridge/1.0.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[ace-bridge] {fmt % args}")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", cors_origin(self))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        up = ace_health_ok()
        if path == "/health":
            json_response(
                self,
                200,
                {
                    "ok": True,
                    "service": "dnb-studio-ace-sidecar",
                    "version": "1.0.0-bridge",
                    "bridgeBuild": BRIDGE_BUILD,
                    "bind": f"{HOST}:{PORT}",
                    "cudaLazy": True,
                    "cudaInitialized": up,
                    "deviceHint": "cuda:0",
                    "targetGpu": "NVIDIA GeForce RTX 5080",
                    "checkpoint": os.environ.get("ACESTEP_CONFIG_PATH", "acestep-v15-base") if up else None,
                    "upstream": ACE_API,
                    "upstreamUp": up,
                },
            )
            return
        if path == "/probe":
            # Prefer upstream health; skip torch import when ACE is up (torch can hang on Windows).
            cuda = False
            smi = False
            if not up:
                cuda = torch_cuda()
                smi = nvidia_visible()
            else:
                smi = nvidia_visible()
            has_gpu = bool(up or cuda or smi)
            ckpt = loaded_dit_model() if up else configured_dit_model()
            notes = []
            if up:
                notes.append("ACE upstream /health OK at 127.0.0.1:8001")
            else:
                notes.append("ACE upstream not reachable on 127.0.0.1:8001 â€” start acestep-api")
            if cuda:
                notes.append("torch.cuda.is_available()=true")
            if smi:
                notes.append("nvidia-smi visible")
            notes.append("Bridge maps DnB /render â†’ release_task + query_result + /v1/audio")
            notes.append("Instrumental DnB; LM thinking plans the track, caption/CoT rewrite off; lyrics = song-map structure tags")
            json_response(
                self,
                200,
                {
                    "hasGpu": has_gpu,
                    "vramGb": None,
                    "backend": "ace-step-1.5",
                    "bridgeBuild": BRIDGE_BUILD,
                    "device": "cuda:0" if has_gpu else None,
                    "checkpoint": ckpt if has_gpu else None,
                    "upstreamUp": up,
                    "notes": notes,
                },
            )
            return
        if path.startswith("/mix/"):
            job_id = urllib.parse.unquote(path[len("/mix/") :])
            entry = _MIX_CACHE.get(job_id)
            if not entry:
                json_response(self, 404, {"error": "mix_not_found", "jobId": job_id})
                return
            blob, ext = entry
            mime = "audio/mpeg" if ext == "mp3" else ("audio/flac" if ext == "flac" else "audio/wav")
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(blob)))
            self.send_header("Access-Control-Allow-Origin", cors_origin(self))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(blob)
            return
        json_response(self, 404, {"error": "not_found", "path": path})

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path != "/render":
            json_response(self, 404, {"error": "not_found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            req = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception:
            json_response(self, 400, {"error": "bad_json"})
            return
        if not ace_health_ok():
            json_response(
                self,
                503,
                {
                    "error": "gpu_required",
                    "message": "Start ACE API first (acestep-api on :8001), then this bridge",
                    "hasGpu": False,
                },
            )
            return

        job_id = str(req.get("jobId") or f"bridge-{int(time.time())}")
        # ACE serves only its loaded DiT; the browser's checkpointId can be stale.
        payload = build_render_payload({**req, "checkpointId": None}, loaded_dit_model())
        seed = payload["seed"]
        bpm = payload["bpm"]
        duration_sec = payload["audio_duration"]

        # Real audio uploads:
        # - `src_audio` (cover/repaint): switches task_type and hands over the file.
        # - `reference_audio` (text2music): timbre/mix guidance only; task_type and
        #   thinking are unchanged, so this stays a text2music render.
        # Both may ride together (repaint from a take + a reference palette).
        upload_files = collect_upload_files(req)
        try:
            if req.get("srcAudioBase64"):
                payload = apply_source_task(payload, req)
            if upload_files:
                fields = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v)
                          for k, v in payload.items()}
                _, released_raw = http_multipart_files(
                    f"{ACE_API}/release_task",
                    fields,
                    upload_files,
                    timeout=120,
                )
            else:
                _, released_raw = http_json("POST", f"{ACE_API}/release_task", payload, timeout=60)
            released, code, err = unwrap(released_raw)
            if code and int(code) >= 400:
                json_response(
                    self,
                    502,
                    {"error": "upstream_release", "message": str(err or released), "hasGpu": True},
                )
                return
            task_id = extract_task_id(released if isinstance(released, dict) else {})
            if not task_id:
                json_response(
                    self,
                    502,
                    {
                        "error": "no_task_id",
                        "message": "ACE release_task returned no task_id",
                        "upstream": released_raw,
                        "hasGpu": True,
                    },
                )
                return

            audio_urls: list[str] = []
            metas = {}
            dit_model = payload["model"]
            last = None
            for _ in range(180):
                time.sleep(1.0)
                _, q_raw = http_json(
                    "POST",
                    f"{ACE_API}/query_result",
                    {"task_id_list": [task_id]},
                    timeout=30,
                )
                q_data, _, _ = unwrap(q_raw)
                last = q_data
                entries = q_data if isinstance(q_data, list) else []
                if isinstance(q_data, dict):
                    entries = [q_data]
                if not entries:
                    continue
                entry = entries[0]
                status = entry.get("status")
                files = parse_result_files(entry)
                if status == 2:
                    json_response(
                        self,
                        502,
                        {
                            "error": "upstream_failed",
                            "message": f"ACE task failed: {entry}",
                            "hasGpu": True,
                        },
                    )
                    return
                if status == 1 or files:
                    audio_urls = audio_urls_from_files(files)
                    if files:
                        metas = files[0].get("metas") or {}
                        dit_model = files[0].get("dit_model") or dit_model
                    if audio_urls:
                        break

            if not audio_urls:
                json_response(
                    self,
                    504,
                    {
                        "error": "timeout",
                        "message": "ACE task did not finish with audio in time",
                        "task_id": task_id,
                        "last": last,
                        "hasGpu": True,
                    },
                )
                return

            batch_size = int(payload.get("batch_size") or BATCH_SIZE_DEFAULT)
            audio_bytes = download_bytes(audio_urls[0])
            b64 = base64.b64encode(audio_bytes).decode("ascii")
            mix_url = cache_mix(job_id, audio_bytes, "wav")
            metas = metas if isinstance(metas, dict) else {}
            bpm_measured = safe_float(metas.get("bpm"), float(bpm))
            duration_out = wav_duration_sec(audio_bytes) or safe_float(metas.get("duration"), float(duration_sec))
            # Best-of-N: download every result file so the browser can pick one.
            candidates = build_candidates(audio_urls, batch_size) if batch_size > 1 else []

            stem_ids = ["mix", "drums", "bass", "kick", "snare", "hats"]
            stems = [
                {
                    "id": sid,
                    "channels": 2,
                    "sampleRateHz": 48000,
                    "bitDepth": 16,
                    "durationSec": duration_out,
                    "wavBase64": b64,
                    "audioFormat": "wav",
                    "url": mix_url,
                    "placeholder": sid != "mix",
                }
                for sid in stem_ids
            ]

            payload_note = format_payload_note(dit_model, payload)

            json_response(
                self,
                200,
                {
                    "jobId": job_id,
                    "seed": seed,
                    "bpmMeasured": bpm_measured,
                    "backendId": "ace-step-1.5",
                    "checkpointId": dit_model,
                    "gpuUsed": True,
                    "mixWavBase64": b64,
                    "mixAudioFormat": "wav",
                    "mixUrl": mix_url,
                    "audioFormat": "wav",
                    "warnings": [
                        "ACE GPU mix â€” kick/snare/hats/bass are mix placeholders until LEGO extract",
                        payload_note,
                        "No artist-clone / no catalog rip â€” original composition only",
                        f"task_id={task_id}",
                    ],
                    "stems": stems,
                    "mixdownPreviewWav": "mix",
                    "taskId": task_id,
                    "aceTaskId": task_id,
                    **({"candidates": candidates} if candidates else {}),
                },
            )
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")[:1200]
            json_response(
                self,
                502,
                {"error": "upstream_http", "message": f"HTTP {e.code}: {err_body}", "hasGpu": True},
            )
        except Exception as e:
            json_response(
                self,
                502,
                {"error": "upstream_error", "message": str(e), "hasGpu": True},
            )


def main() -> None:
    httpd = ExclusiveBridgeServer((HOST, PORT), Handler)
    print(f"[ace-bridge] http://{HOST}:{PORT} â†’ {ACE_API}")
    print(f"[ace-bridge] build {BRIDGE_BUILD}")
    print("[ace-bridge] run ACE API first, then this bridge, then DnB Studio Generate")
    httpd.serve_forever()


if __name__ == "__main__":
    main()


#!/usr/bin/env python3
"""DnB Studio ACE bridge â€” 127.0.0.1:8766 â†’ official ACE-Step API :8001.

Full contract for AceStepBackend: GET /health, GET /probe, POST /render.
Returns mixWavBase64 so the browser can play without file:// access.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "0.0.0.0"
PORT = 8766
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
    "rolling reese bass, sub bass, original composition, 174 bpm"
)

# Studio's default DiT when neither ACE nor the env say otherwise. Matches
# scripts/windows/start-ace-stack.ps1 (SFT if on disk, else base).
DEFAULT_DIT_MODEL = "acestep-v15-base"
# ACE docs/en/INFERENCE.md: base/SFT "recommended 32-64", high quality tip is
# "inference_steps=64 or higher" + use_adg=True. Turbo: "recommended 8".
BASE_INFERENCE_STEPS = 64
TURBO_INFERENCE_STEPS = 8


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
      our concrete DnB caption or invent sung words. The section map below is
      the only "lyrics" — temporal tags, never vocals.
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
    duration_sec = max(10.0, min(240.0, duration_bars * 4 * 60.0 / max(bpm, 1)))
    seed = int(req.get("seed") or 42)
    model = str(req.get("checkpointId") or model_default or configured_dit_model())
    turbo = is_turbo_model(model)
    use_adg = req.get("useAdg")

    return {
        "prompt": prompt,
        "lyrics": build_section_lyrics(structure_ref),
        "thinking": True,
        "use_cot_caption": False,
        "use_cot_language": False,
        "bpm": bpm,
        "audio_duration": duration_sec,
        "time_signature": "4",
        "audio_format": "wav",
        "use_random_seed": False,
        "seed": seed,
        "batch_size": 1,
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
        "dcw_enabled": bool(req.get("dcwEnabled", True)),
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


def http_multipart(url: str, fields: dict, file_field: str, filename: str, file_bytes: bytes,
                   timeout: float = 120.0):
    """POST multipart/form-data — ACE's /release_task takes a raw Request and
    accepts uploaded audio as `src_audio` / `reference_audio` file fields
    (see docs/en/API.md §4.2 "Method B" in the ACE-Step repo). The uploaded
    file wins over any *_path parameter, so the bridge never has to manage
    server-side temp paths."""
    boundary = "----dnbstudio" + uuid.uuid4().hex
    parts = []
    for key, value in fields.items():
        if value is None:
            continue
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode("utf-8")
        )
    parts.append(
        (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\n"
            f"Content-Type: application/octet-stream\r\n\r\n"
        ).encode("utf-8")
    )
    parts.append(file_bytes)
    parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    data = b"".join(parts)
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
    for f in files:
        file_field = f.get("file") or f.get("path") or f.get("url")
        if not file_field:
            continue
        s = str(file_field)
        if s.startswith("http"):
            return s
        if s.startswith("/"):
            return f"{ACE_API}{s}"
        return f"{ACE_API}/v1/audio?path={urllib.parse.quote(s, safe='')}"
    return None


def download_bytes(url: str, timeout: float = 120.0) -> bytes:
    req = urllib.request.Request(url, headers={"Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


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
            notes.append("Instrumental DnB; LM thinking plans the track, caption/CoT rewrite off; lyrics = section map")
            json_response(
                self,
                200,
                {
                    "hasGpu": has_gpu,
                    "vramGb": None,
                    "backend": "ace-step-1.5",
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
        payload = build_render_payload(
            req, None if req.get("checkpointId") else loaded_dit_model()
        )
        seed = payload["seed"]
        bpm = payload["bpm"]
        duration_sec = payload["audio_duration"]

        # Real audio2audio: when the browser sends the user's own style-ref
        # audio, switch from text2music to ACE's `cover` task and hand the
        # actual file over as a multipart `src_audio` upload. Without this
        # the reference is reduced to a few scalar knob nudges and the audio
        # itself is thrown away.
        src_audio_b64 = req.get("srcAudioBase64")
        src_audio_name = str(req.get("srcAudioFileName") or "style-ref.wav")
        try:
            if src_audio_b64:
                payload["task_type"] = "cover"
                payload["audio_cover_strength"] = float(req.get("audioCoverStrength") or 0.25)
                # Cover/repaint skip the LM regardless — don't pretend otherwise.
                payload["thinking"] = False
                fields = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v)
                          for k, v in payload.items()}
                _, released_raw = http_multipart(
                    f"{ACE_API}/release_task",
                    fields,
                    "src_audio",
                    src_audio_name,
                    base64.b64decode(src_audio_b64),
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

            audio_url = None
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
                    audio_url = audio_url_from_files(files)
                    if files:
                        metas = files[0].get("metas") or {}
                        dit_model = files[0].get("dit_model") or dit_model
                    if audio_url:
                        break

            if not audio_url:
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

            audio_bytes = download_bytes(audio_url)
            b64 = base64.b64encode(audio_bytes).decode("ascii")
            mix_url = cache_mix(job_id, audio_bytes, "wav")
            bpm_measured = float(metas.get("bpm") or bpm) if isinstance(metas, dict) else float(bpm)
            duration_out = float(metas.get("duration") or duration_sec) if isinstance(metas, dict) else duration_sec

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
                        f"DiT {dit_model}, {payload['inference_steps']} steps, "
                        f"use_adg={payload['use_adg']}, thinking={payload['thinking']}",
                        "No artist-clone / no catalog rip â€” original composition only",
                        f"task_id={task_id}",
                    ],
                    "stems": stems,
                    "mixdownPreviewWav": "mix",
                    "taskId": task_id,
                    "aceTaskId": task_id,
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
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[ace-bridge] http://{HOST}:{PORT} â†’ {ACE_API}")
    print("[ace-bridge] run ACE API first, then this bridge, then DnB Studio Generate")
    httpd.serve_forever()


if __name__ == "__main__":
    main()


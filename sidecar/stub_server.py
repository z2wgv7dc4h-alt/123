#!/usr/bin/env python3
"""
Optional localhost stub for the ACE-Step sidecar API sketch.

Stdlib only — no FastAPI, no PyTorch, no CUDA.
Binds 127.0.0.1:8766. Implements GET /health, GET /probe, POST /render
with stub JSON (hasGpu=false; render returns 503).

Docs: sidecar/README.md
Run:  python3 sidecar/stub_server.py
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8766


def _json(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    raw = json.dumps(body, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(raw)


class StubHandler(BaseHTTPRequestHandler):
    server_version = "DnbStudioSidecarStub/0.0.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[sidecar-stub] {self.address_string()} {fmt % args}")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/health":
            _json(
                self,
                200,
                {
                    "ok": True,
                    "service": "dnb-studio-ace-sidecar",
                    "version": "0.0.0-stub",
                    "bind": f"{HOST}:{PORT}",
                    "cudaLazy": True,
                    "cudaInitialized": False,
                    "deviceHint": "cuda:0",
                    "targetGpu": "NVIDIA GeForce RTX 5080",
                    "checkpoint": None,
                },
            )
            return
        if path == "/probe":
            _json(
                self,
                200,
                {
                    "hasGpu": False,
                    "vramGb": None,
                    "backend": "ace-step-1.5",
                    "device": None,
                    "checkpoint": None,
                    "notes": [
                        "Stub server — no PyTorch/CUDA loaded",
                        "Wyatt path: RTX 5080 via localhost FastAPI sidecar",
                        "Fail-soft: AceStepBackend keeps hasGpu=false until real worker reports true",
                    ],
                },
            )
            return
        _json(self, 404, {"error": "not_found", "path": path})

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length:
            _ = self.rfile.read(length)  # accept body; stub ignores it
        if path == "/render":
            _json(
                self,
                503,
                {
                    "error": "gpu_required",
                    "message": (
                        "ACE-Step 1.5 requires CUDA sidecar (RTX 5080). "
                        "Stub has no weights. Structure stays in the browser."
                    ),
                    "hasGpu": False,
                },
            )
            return
        _json(self, 404, {"error": "not_found", "path": path})


def main() -> None:
    httpd = ThreadingHTTPServer((HOST, PORT), StubHandler)
    print(
        f"dnb-studio sidecar stub on http://{HOST}:{PORT} "
        f"(GET /health /probe, POST /render) — Ctrl+C to stop"
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()

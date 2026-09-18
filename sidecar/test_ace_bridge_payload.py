"""Bridge -> ACE /release_task payload (quality pack). Run from repo root:

    python -m unittest sidecar/test_ace_bridge_payload.py
"""
import base64
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ace_bridge_server as bridge  # noqa: E402


class BuildRenderPayloadTest(unittest.TestCase):
    def test_base_is_high_quality_path_with_lm_plan_on(self):
        p = bridge.build_render_payload(
            {"prompt": {"text": "drum and bass, instrumental"}, "checkpointId": "acestep-v15-base"}
        )
        self.assertIs(p["thinking"], True)
        self.assertIs(p["use_cot_caption"], False)
        self.assertIs(p["use_cot_language"], False)
        self.assertEqual(p["lm_cfg_scale"], 2.0)
        self.assertEqual(p["inference_steps"], 64)
        self.assertIs(p["use_adg"], True)
        self.assertEqual(p["model"], "acestep-v15-base")
        self.assertEqual(p["dcw_mode"], "low")
        self.assertEqual(p["prompt"], "drum and bass, instrumental")

    def test_text2music_thinking_is_on_and_caption_stays_locked(self):
        p = bridge.build_render_payload({"thinking": False, "checkpointId": "acestep-v15-base"})
        self.assertIs(p["thinking"], True)
        self.assertIs(p["use_cot_caption"], False)
        self.assertIs(p["use_cot_language"], False)

    def test_lyrics_are_structure_tags_only(self):
        p = bridge.build_render_payload({"lyrics": "[Intro - atmospheric]\n\nsing this line\n[Drop - explosive]"})
        self.assertEqual(p["lyrics"], "[Intro - atmospheric]\n\n[Drop - explosive]")
        self.assertEqual(bridge.build_render_payload({})["lyrics"], "[Instrumental]")
        self.assertEqual(bridge.build_render_payload({"lyrics": "only words"})["lyrics"], "[Instrumental]")

    def test_bpm_and_duration_come_from_the_plan(self):
        p = bridge.build_render_payload(
            {
                "structureRef": {"bpm": 174, "bars": 8},
                "prompt": {"text": "drum and bass, instrumental"},
            }
        )
        self.assertEqual(p["bpm"], 174)
        self.assertEqual(p["audio_duration"], 8 * 4 * 60.0 / 174)

    def test_missing_steps_default_to_64_not_32(self):
        p = bridge.build_render_payload({}, "acestep-v15-sft")
        self.assertEqual(p["model"], "acestep-v15-sft")
        self.assertEqual(p["inference_steps"], 64)
        self.assertIs(p["use_adg"], True)

    def test_turbo_gets_8_steps_and_no_adg(self):
        p = bridge.build_render_payload({"checkpointId": "acestep-v15-turbo", "useAdg": True})
        self.assertEqual(p["inference_steps"], 8)
        self.assertIs(p["use_adg"], False)

    def test_xl_turbo_is_a_turbo_variant(self):
        # is_turbo_model must match "xl-turbo" (8 steps, no ADG) and the bridge
        # default DiT is now the 2B turbo (ACE issue #1063).
        self.assertTrue(bridge.is_turbo_model("acestep-v15-xl-turbo"))
        self.assertTrue(bridge.is_turbo_model("ACESTEP-V15-XL-TURBO"))
        self.assertFalse(bridge.is_turbo_model("acestep-v15-base"))
        self.assertEqual(bridge.DEFAULT_DIT_MODEL, "acestep-v15-turbo")
        p = bridge.build_render_payload({"checkpointId": "acestep-v15-xl-turbo", "useAdg": True})
        self.assertEqual(p["inference_steps"], 8)
        self.assertIs(p["use_adg"], False)
        self.assertIs(p["dcw_enabled"], True)

    def test_cover_strength_default_and_clamp(self):
        self.assertEqual(bridge.clamp_cover_strength(None), 0.55)
        self.assertEqual(bridge.clamp_cover_strength(0.45), 0.45)
        self.assertEqual(bridge.clamp_cover_strength(0.1), 0.35)
        self.assertEqual(bridge.clamp_cover_strength(0.9), 0.7)
        self.assertEqual(bridge.clamp_cover_strength("0.5"), 0.5)

    def test_status_note_reports_cover_strength_in_effect(self):
        cover = bridge.format_payload_note(
            "acestep-v15-base",
            {
                "inference_steps": 64,
                "use_adg": True,
                "thinking": False,
                "task_type": "cover",
                "audio_cover_strength": 0.55,
            },
        )
        self.assertIn("task_type=cover", cover)
        self.assertIn("audio_cover_strength=0.55", cover)
        self.assertIn("thinking=False", cover)
        plain = bridge.format_payload_note(
            "acestep-v15-base",
            {"inference_steps": 64, "use_adg": True, "thinking": True},
        )
        self.assertIn("task_type=text2music", plain)
        self.assertNotIn("audio_cover_strength", plain)

    def test_source_task_repaint_extend(self):
        base = bridge.build_render_payload({"checkpointId": "acestep-v15-turbo"})
        p = bridge.apply_source_task(base, {"srcAudioBase64": "AAAA", "taskType": "repaint", "repaintStartSec": 80.0, "repaintEndSec": 102.0})
        self.assertEqual(p["task_type"], "repaint")
        self.assertEqual(p["repainting_start"], 80.0)
        self.assertEqual(p["repainting_end"], 102.0)
        self.assertEqual(p["chunk_mask_mode"], "explicit")
        self.assertIs(p["thinking"], False)
        self.assertNotIn("audio_duration", p)
        self.assertNotIn("audio_cover_strength", p)
        self.assertIn("repaint=80.0-102.0s", bridge.format_payload_note("acestep-v15-turbo", p))

    def test_repaint_mode_defaults_balanced_and_rejects_junk(self):
        base = bridge.build_render_payload({"checkpointId": "acestep-v15-turbo"})
        default = bridge.apply_source_task(
            base, {"srcAudioBase64": "AAAA", "taskType": "repaint"}
        )
        self.assertEqual(default["repaint_mode"], "balanced")
        aggressive = bridge.apply_source_task(
            base,
            {"srcAudioBase64": "AAAA", "taskType": "repaint", "repaintMode": "aggressive"},
        )
        self.assertEqual(aggressive["repaint_mode"], "aggressive")
        self.assertEqual(bridge.normalize_repaint_mode("CONSERVATIVE"), "conservative")
        self.assertEqual(bridge.normalize_repaint_mode("nope"), "balanced")
        self.assertEqual(bridge.normalize_repaint_mode(None), "balanced")
        self.assertIn("repaint_mode=aggressive", bridge.format_payload_note("m", aggressive))

    def test_repaint_strength_default_and_clamp(self):
        self.assertEqual(bridge.clamp_repaint_strength(None), 0.5)
        self.assertEqual(bridge.clamp_repaint_strength(0.7), 0.7)
        self.assertEqual(bridge.clamp_repaint_strength("0.3"), 0.3)
        self.assertEqual(bridge.clamp_repaint_strength(-1), 0.0)
        self.assertEqual(bridge.clamp_repaint_strength(9), 1.0)
        self.assertEqual(bridge.clamp_repaint_strength(float("nan")), 0.5)
        base = bridge.build_render_payload({"checkpointId": "acestep-v15-turbo"})
        req = {
            "srcAudioBase64": "AAAA",
            "taskType": "repaint",
            "repaintStrength": 0.8,
        }
        self.assertEqual(bridge.apply_source_task(base, req)["repaint_strength"], 0.8)
        self.assertEqual(bridge.apply_source_task(base, {**req, "repaintStrength": 5})["repaint_strength"], 1.0)
        self.assertEqual(bridge.apply_source_task(base, {**req, "repaintStrength": -5})["repaint_strength"], 0.0)

    def test_batch_size_default_and_clamp(self):
        self.assertEqual(bridge.clamp_batch_size(None), 1)
        self.assertEqual(bridge.clamp_batch_size("3"), 3)
        self.assertEqual(bridge.clamp_batch_size(0), 1)
        self.assertEqual(bridge.clamp_batch_size(9), 4)
        self.assertEqual(bridge.clamp_batch_size("junk"), 1)
        self.assertEqual(bridge.build_render_payload({"batchSize": 3})["batch_size"], 3)
        self.assertEqual(bridge.build_render_payload({})["batch_size"], 1)
        self.assertEqual(bridge.build_render_payload({"batchSize": 99})["batch_size"], 4)
        # Best-of-4 generated takes: the browser sends batchSize 4.
        self.assertEqual(bridge.build_render_payload({"batchSize": 4})["batch_size"], 4)

    def test_lm_temperature_default_and_clamp(self):
        self.assertEqual(bridge.clamp_lm_temperature(None), 0.7)
        self.assertEqual(bridge.clamp_lm_temperature("0.9"), 0.9)
        self.assertEqual(bridge.clamp_lm_temperature(0.1), 0.3)
        self.assertEqual(bridge.clamp_lm_temperature(9), 1.0)
        self.assertEqual(bridge.clamp_lm_temperature("junk"), 0.7)
        self.assertEqual(bridge.clamp_lm_temperature(float("nan")), 0.7)
        self.assertEqual(bridge.build_render_payload({})["lm_temperature"], 0.7)
        self.assertEqual(bridge.build_render_payload({"lmTemperature": 0.9})["lm_temperature"], 0.9)
        self.assertEqual(bridge.build_render_payload({"lmTemperature": 0.0})["lm_temperature"], 0.3)
        self.assertEqual(bridge.build_render_payload({"lmTemperature": 5})["lm_temperature"], 1.0)

    def test_lm_negative_prompt_default_and_override(self):
        p = bridge.build_render_payload({})
        self.assertEqual(p["lm_negative_prompt"], bridge.LM_NEGATIVE_PROMPT_DEFAULT)
        self.assertIn("vocals", p["lm_negative_prompt"])
        self.assertIn("clipping", p["lm_negative_prompt"])
        override = bridge.build_render_payload({"negativePrompt": "vocals, autotune"})
        self.assertEqual(override["lm_negative_prompt"], "vocals, autotune")
        # Empty override falls back to the instrumental guardrail.
        self.assertEqual(
            bridge.build_render_payload({"negativePrompt": ""})["lm_negative_prompt"],
            bridge.LM_NEGATIVE_PROMPT_DEFAULT,
        )

    def test_vocal_language_is_unknown(self):
        self.assertEqual(bridge.build_render_payload({})["vocal_language"], "unknown")
        self.assertEqual(
            bridge.build_render_payload({"vocalLanguage": "en"})["vocal_language"], "unknown"
        )

    def test_infer_method_default_sde_and_clamp(self):
        self.assertEqual(bridge.normalize_infer_method(None), "ode")
        self.assertEqual(bridge.normalize_infer_method(""), "ode")
        self.assertEqual(bridge.normalize_infer_method("SDE"), "sde")
        self.assertEqual(bridge.normalize_infer_method("ode"), "ode")
        self.assertEqual(bridge.normalize_infer_method("junk"), "ode")
        self.assertEqual(bridge.build_render_payload({})["infer_method"], "ode")
        self.assertEqual(bridge.build_render_payload({"sampler": "sde"})["infer_method"], "sde")
        self.assertEqual(bridge.build_render_payload({"sampler": "nope"})["infer_method"], "ode")

    def test_build_candidates_returns_every_result_file(self):
        import io, wave

        def wav_bytes(seconds: int) -> bytes:
            buf = io.BytesIO()
            with wave.open(buf, "wb") as w:
                w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000)
                w.writeframes(b"\x00\x00\x00\x00" * 48000 * seconds)
            return buf.getvalue()

        blobs = {"u1": wav_bytes(1), "u2": wav_bytes(2), "u3": wav_bytes(3)}
        candidates = bridge.build_candidates(
            ["u1", "u2", "u3"], 3, download=lambda url: blobs[url]
        )
        self.assertEqual(len(candidates), 3)
        self.assertEqual(candidates[0]["durationSec"], 1.0)
        self.assertAlmostEqual(candidates[1]["durationSec"], 2.0, places=3)
        self.assertAlmostEqual(candidates[2]["durationSec"], 3.0, places=3)
        self.assertTrue(candidates[0]["wavBase64"])
        # Batch size caps how many files get downloaded.
        self.assertEqual(len(bridge.build_candidates(["u1", "u2", "u3"], 1, download=lambda u: blobs[u])), 1)

    def test_audio_urls_from_files_keeps_order(self):
        files = [
            {"file": "/a.wav"},
            {"path": "b_abs.wav"},
            {"url": "http://x/c.wav"},
            {"nothing": True},
        ]
        self.assertEqual(
            bridge.audio_urls_from_files(files),
            [
                f"{bridge.ACE_API}/a.wav",
                f"{bridge.ACE_API}/v1/audio?path=b_abs.wav",
                "http://x/c.wav",
            ],
        )
        self.assertEqual(bridge.audio_url_from_files(files), f"{bridge.ACE_API}/a.wav")
        self.assertEqual(bridge.audio_urls_from_files([]), [])

    def test_source_task_cover_unchanged_and_text2music_passthrough(self):
        base = bridge.build_render_payload({"checkpointId": "acestep-v15-turbo"})
        c = bridge.apply_source_task(base, {"srcAudioBase64": "AAAA"})
        self.assertEqual(c["task_type"], "cover")
        self.assertEqual(c["audio_cover_strength"], 0.55)
        self.assertIs(c["thinking"], False)
        self.assertIs(bridge.apply_source_task(base, {}), base)

    def test_safe_float_handles_na_from_repaint_metas(self):
        self.assertEqual(bridge.safe_float("N/A", 174.0), 174.0)
        self.assertEqual(bridge.safe_float(None, 88.0), 88.0)
        self.assertEqual(bridge.safe_float("140", 174.0), 140.0)
        self.assertEqual(bridge.safe_float(float("nan"), 1.0), 1.0)

    def test_wav_duration_reads_real_length(self):
        import io, wave
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(48000)
            w.writeframes(b"\x00\x00\x00\x00" * 48000 * 3)
        self.assertAlmostEqual(bridge.wav_duration_sec(buf.getvalue()), 3.0, places=3)
        self.assertIsNone(bridge.wav_duration_sec(b"not a wav"))

    def test_fallback_prompt_has_no_guitar_or_rock(self):
        p = bridge.build_render_payload({"checkpointId": "acestep-v15-base"})
        self.assertNotIn("guitar", p["prompt"].lower())
        self.assertNotIn("rock", p["prompt"].lower())

    def test_bridge_server_refuses_port_sharing(self):
        self.assertIs(bridge.ExclusiveBridgeServer.allow_reuse_address, False)
        self.assertTrue(bridge.BRIDGE_BUILD)

    def test_explicit_model_default_wins_when_checkpoint_cleared(self):
        p = bridge.build_render_payload({"checkpointId": None}, "acestep-v15-turbo")
        self.assertEqual(p["model"], "acestep-v15-turbo")
        self.assertEqual(p["inference_steps"], 8)
        self.assertEqual(p["lyrics"], "[Instrumental]")
        self.assertIs(p["use_cot_caption"], False)

    def test_collect_upload_files_uses_reference_audio_field(self):
        ref_b64 = base64.b64encode(b"REF-AUDIO").decode("ascii")
        # Reference only → text2music timbre/mix guidance, no src_audio.
        ref_only = bridge.collect_upload_files(
            {"refAudioBase64": ref_b64, "refAudioFileName": "mine.wav"}
        )
        self.assertEqual(len(ref_only), 1)
        self.assertEqual(ref_only[0][0], "reference_audio")
        self.assertEqual(ref_only[0][1], "mine.wav")
        self.assertEqual(ref_only[0][2], b"REF-AUDIO")
        # Reference + repaint source → both fields, src_audio first.
        src_b64 = base64.b64encode(b"TAKE").decode("ascii")
        both = bridge.collect_upload_files(
            {
                "srcAudioBase64": src_b64,
                "srcAudioFileName": "take.wav",
                "refAudioBase64": ref_b64,
                "refAudioFileName": "mine.wav",
            }
        )
        self.assertEqual([f[0] for f in both], ["src_audio", "reference_audio"])
        self.assertEqual(both[1][2], b"REF-AUDIO")
        self.assertEqual(bridge.collect_upload_files({}), [])

    def test_build_multipart_body_names_reference_audio_field(self):
        ref_b64 = base64.b64encode(b"REFBYTES").decode("ascii")
        files = bridge.collect_upload_files(
            {"refAudioBase64": ref_b64, "refAudioFileName": "mine.wav"}
        )
        body = bridge.build_multipart_body(
            {"task_type": "text2music", "thinking": "True"}, files, "----testboundary"
        )
        self.assertIn(b'name="task_type"', body)
        self.assertIn(b'name="reference_audio"; filename="mine.wav"', body)
        self.assertIn(b"REFBYTES", body)
        # A single-file body still closes correctly.
        single = bridge.build_multipart_body(
            {"a": "1"}, [("src_audio", "t.wav", b"X")], "----b"
        )
        self.assertTrue(single.endswith(b"------b--\r\n"))
        self.assertIn(b'name="src_audio"', single)


class StemsEndpointTest(unittest.TestCase):
    def test_stems_returns_501_when_demucs_missing(self):
        with mock.patch.object(bridge, "demucs_available", return_value=False):
            status, body = bridge.build_stems_response({"mixWavBase64": "AAAA"})
        self.assertEqual(status, 501)
        self.assertEqual(body["error"], "demucs_not_installed")
        self.assertEqual(body["installHint"], "pip install demucs")

    def test_stems_requires_mix(self):
        status, body = bridge.build_stems_response({})
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "missing_mix")

    def test_stems_returns_every_demucs_stem(self):
        fake = [
            {"id": "drums", "wavBase64": "AAA", "durationSec": 1.0},
            {"id": "bass", "wavBase64": "BBB", "durationSec": 1.0},
            {"id": "other", "wavBase64": "CCC", "durationSec": 1.0},
        ]
        with mock.patch.object(bridge, "demucs_available", return_value=True), mock.patch.object(
            bridge, "separate_stems_demucs", return_value=fake
        ):
            status, body = bridge.build_stems_response({"mixWavBase64": "AAAA"})
        self.assertEqual(status, 200)
        self.assertEqual(body["stems"], fake)
        self.assertEqual(body["model"], bridge.DEMUCS_MODEL)


class LoraEndpointsTest(unittest.TestCase):
    @staticmethod
    def _make_adapter(root: str, name: str, base: str | None = None) -> str:
        path = os.path.join(root, name)
        os.makedirs(path, exist_ok=True)
        if base is not None:
            with open(os.path.join(path, "adapter_config.json"), "w", encoding="utf-8") as fh:
                json.dump({"base_model_name_or_path": base}, fh)
        return path

    @staticmethod
    def _recorder():
        calls: list[tuple[str, dict]] = []

        def post(path: str, body: dict) -> None:
            calls.append((path, body))

        return calls, post

    def test_list_loras_reads_adapter_config_base(self):
        with tempfile.TemporaryDirectory() as root:
            self._make_adapter(root, "dnb-a", "acestep-v15-turbo")
            self._make_adapter(root, "dnb-b")
            with open(os.path.join(root, "notes.txt"), "w", encoding="utf-8") as fh:
                fh.write("not an adapter")
            loras = bridge.list_loras(root)
            self.assertEqual([x["id"] for x in loras], ["dnb-a", "dnb-b"])
            self.assertEqual(loras[0]["baseModel"], "acestep-v15-turbo")
            self.assertIsNone(loras[1]["baseModel"])
            status, body = bridge.build_loras_response(root)
            self.assertEqual(status, 200)
            self.assertEqual(body["dir"], root)
            self.assertEqual(len(body["loras"]), 2)

    def test_lora_family_and_mismatch(self):
        self.assertEqual(bridge.lora_family("acestep-v15-xl-turbo"), "xl")
        self.assertEqual(bridge.lora_family("acestep-v15-turbo"), "2b")
        self.assertIsNone(bridge.lora_family(None))
        self.assertIsNone(
            bridge.lora_model_mismatch("acestep-v15-turbo", "acestep-v15-base")
        )
        self.assertEqual(
            bridge.lora_model_mismatch("acestep-v15-base", "acestep-v15-xl-turbo"),
            "switch Studio model to acestep-v15-base first",
        )

    def test_lora_load_calls_ace_load_and_scale(self):
        with tempfile.TemporaryDirectory() as root:
            adapter = self._make_adapter(root, "dnb-a", "acestep-v15-turbo")
            calls, post = self._recorder()
            status, body = bridge.build_lora_load(
                {"path": adapter, "scale": 0.8}, "acestep-v15-turbo", root, post
            )
            self.assertEqual(status, 200)
            self.assertTrue(body["ok"])
            self.assertEqual(body["scale"], 0.8)
            self.assertEqual(calls[0][0], "/v1/lora/load")
            self.assertTrue(calls[0][1]["lora_path"].endswith("dnb-a"))
            self.assertEqual(calls[1], ("/v1/lora/scale", {"lora_scale": 0.8}))

    def test_lora_load_409_on_family_mismatch_and_no_ace_calls(self):
        with tempfile.TemporaryDirectory() as root:
            adapter = self._make_adapter(root, "dnb-xl", "acestep-v15-xl-base")
            calls, post = self._recorder()
            status, body = bridge.build_lora_load(
                {"path": adapter, "scale": 0.7}, "acestep-v15-turbo", root, post
            )
            self.assertEqual(status, 409)
            self.assertEqual(body["error"], "lora_model_mismatch")
            self.assertEqual(body["message"], "switch Studio model to acestep-v15-xl-base first")
            self.assertEqual(calls, [])

    def test_lora_load_rejects_path_outside_dir(self):
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as other:
            adapter = self._make_adapter(other, "evil", "acestep-v15-turbo")
            status, body = bridge.build_lora_load(
                {"path": adapter}, "acestep-v15-turbo", root, lambda p, b: None
            )
            self.assertEqual(status, 400)
            self.assertEqual(body["error"], "lora_not_found")

    def test_lora_off_calls_unload(self):
        calls, post = self._recorder()
        status, body = bridge.build_lora_off(post)
        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(calls, [("/v1/lora/unload", {})])

    def test_clamp_lora_scale_default_and_clamp(self):
        self.assertEqual(bridge.clamp_lora_scale(None), 0.7)
        self.assertEqual(bridge.clamp_lora_scale(0.5), 0.5)
        self.assertEqual(bridge.clamp_lora_scale(-1), 0.0)
        self.assertEqual(bridge.clamp_lora_scale(9), 1.0)
        self.assertEqual(bridge.clamp_lora_scale(float("nan")), 0.7)

    def test_render_payload_never_sends_cover_noise_strength(self):
        self.assertNotIn("cover_noise_strength", bridge.build_render_payload({}))
        self.assertNotIn(
            "cover_noise_strength",
            bridge.build_render_payload({"coverNoiseStrength": 0.5}),
        )


class JsonResponseDisconnectTest(unittest.TestCase):
    class _BrokenWFile:
        def __init__(self, exc):
            self._exc = exc

        def write(self, _data):
            raise self._exc

    class _Handler:
        headers = {}

        def __init__(self, exc):
            self.wfile = JsonResponseDisconnectTest._BrokenWFile(exc)

        def send_response(self, *_a):
            pass

        def send_header(self, *_a):
            pass

        def end_headers(self):
            pass

    def test_client_disconnect_is_logged_once_not_raised(self):
        for exc in (BrokenPipeError(), ConnectionResetError(), ConnectionAbortedError()):
            with mock.patch("builtins.print") as printed:
                bridge.json_response(self._Handler(exc), 200, {"ok": True})
            lines = [str(c.args[0]) for c in printed.call_args_list if c.args]
            self.assertIn("[ace-bridge] client disconnected before response", lines)
            self.assertEqual(len(lines), 1)


class ProgressEndpointTest(unittest.TestCase):
    def setUp(self):
        bridge._PROGRESS.clear()

    def test_progress_stage_mapping(self):
        self.assertEqual(bridge.progress_stage(0, False), "LM planning")
        self.assertEqual(bridge.progress_stage(1, False), "diffusion")
        self.assertEqual(bridge.progress_stage(1, True), "decode")
        self.assertEqual(bridge.progress_stage(2, False), "failed")
        self.assertEqual(bridge.progress_stage("n/a", False), "LM planning")

    def test_set_and_build_progress(self):
        with mock.patch.object(bridge.time, "time", return_value=100.0):
            rec = bridge.set_progress(
                "j1", task_id="t1", status=1, started_at=90.0, entry={"progress": 0.5}
            )
        self.assertEqual(rec["jobId"], "j1")
        self.assertEqual(rec["taskId"], "t1")
        self.assertEqual(rec["stage"], "diffusion")
        self.assertEqual(rec["elapsedSec"], 10.0)
        self.assertEqual(rec["progress"], 0.5)

        status, body = bridge.build_progress_response("j1")
        self.assertEqual(status, 200)
        self.assertEqual(body["stage"], "diffusion")
        self.assertTrue(body["hasGpu"])

        status2, body2 = bridge.build_progress_response("missing")
        self.assertEqual(status2, 404)
        self.assertEqual(body2["error"], "progress_not_found")

    def test_progress_records_stage_from_entries(self):
        started = 100.0
        bridge.set_progress("j2", task_id="t2", status=0, started_at=started, entry={"status": 0})
        self.assertEqual(bridge.build_progress_response("j2")[1]["stage"], "LM planning")

        files = bridge.parse_result_files({"result": '[{"file": "/out.wav", "metas": {}}]'})
        bridge.set_progress(
            "j2", task_id="t2", status=1, has_files=bool(files), entry={"status": 1}, started_at=started
        )
        self.assertEqual(bridge.build_progress_response("j2")[1]["stage"], "decode")


class FinishChainTest(unittest.TestCase):
    def test_genre_target_lufs(self):
        self.assertEqual(bridge.genre_target_lufs("dnb"), -9.5)
        self.assertEqual(bridge.genre_target_lufs("liquid"), -12.0)
        self.assertEqual(bridge.genre_target_lufs("nope"), -9.5)
        self.assertEqual(bridge.genre_target_lufs("dnb", -11.0), -11.0)

    def test_mono_below_cutoff_collapses_low_band(self):
        import numpy as np

        sr = 4000
        n = 4000
        left = np.full(n, 0.8)
        right = np.full(n, -0.2)
        ol, orr = bridge.mono_below_cutoff(left, right, sr, cutoff_hz=200.0)
        # Steady state both channels carry the same mono low band (~0.3).
        self.assertAlmostEqual(float(ol[-1]), 0.3, places=2)
        self.assertAlmostEqual(float(orr[-1]), 0.3, places=2)
        self.assertAlmostEqual(float(ol[-1]), float(orr[-1]), places=4)

    def test_sidechain_envelope_attacks_and_releases(self):
        import numpy as np

        sr = 1000
        key = np.concatenate([np.ones(100), np.zeros(400)])
        env = bridge.sidechain_envelope(key, sr, attack_ms=5.0, release_ms=80.0)
        self.assertGreater(float(env[0]), 0.0)
        self.assertGreater(float(env[99]), 0.5)
        self.assertLess(float(env[-1]), float(env[99]))  # released back down
        self.assertGreaterEqual(float(env.min()), 0.0)

    def test_finish_requires_mix(self):
        status, body = bridge.build_finish_response({})
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "missing_mix")

    def test_finish_missing_deps_501(self):
        with mock.patch.object(bridge, "finish_missing_deps", return_value=["pedalboard"]):
            status, body = bridge.build_finish_response({"mixWavBase64": "AAAA"})
        self.assertEqual(status, 501)
        self.assertEqual(body["installHint"], bridge.FINISH_DEPS_HINT)
        self.assertEqual(body["missing"], ["pedalboard"])

    def test_finish_response_mocked(self):
        canned = {
            "wavBase64": "AAA",
            "report": {
                "lufs": -9.5,
                "truePeak": -1.0,
                "crest": 6.0,
                "stagesApplied": ["demucs_ft", "pedalboard_master"],
            },
        }
        calls = {}

        def fake_process(mix, genre, target, ref):
            calls.update({"mix": mix, "genre": genre, "target": target, "ref": ref})
            return canned

        with mock.patch.object(bridge, "finish_missing_deps", return_value=[]):
            status, body = bridge.build_finish_response(
                {"mixWavBase64": "AAAA", "genre": "dnb", "targetLufs": -8, "refWavBase64": "REF"},
                process=fake_process,
            )
        self.assertEqual(status, 200)
        self.assertEqual(body["report"]["lufs"], -9.5)
        self.assertEqual(body["report"]["stagesApplied"][-1], "pedalboard_master")
        self.assertEqual(calls["genre"], "dnb")
        self.assertEqual(calls["target"], -8)
        self.assertEqual(calls["ref"], "REF")


if __name__ == "__main__":
    unittest.main()
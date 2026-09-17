"""Bridge -> ACE /release_task payload (quality pack). Run from repo root:

    python -m unittest sidecar/test_ace_bridge_payload.py
"""
import os
import sys
import unittest

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

    def test_lyrics_are_exactly_instrumental(self):
        p = bridge.build_render_payload(
            {
                "structureRef": {
                    "sections": [
                        {"name": "intro"},
                        {"name": "build"},
                        {"name": "drop"},
                        {"name": "breakdown"},
                        {"name": "outro"},
                    ]
                }
            }
        )
        self.assertEqual(p["lyrics"], "[Instrumental]")
        for word in ("sing", "vocal", "lyric", "la "):
            self.assertNotIn(word, p["lyrics"].lower())
        self.assertEqual(bridge.build_render_payload({})["lyrics"], "[Instrumental]")

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

    def test_source_task_cover_unchanged_and_text2music_passthrough(self):
        base = bridge.build_render_payload({"checkpointId": "acestep-v15-turbo"})
        c = bridge.apply_source_task(base, {"srcAudioBase64": "AAAA"})
        self.assertEqual(c["task_type"], "cover")
        self.assertEqual(c["audio_cover_strength"], 0.55)
        self.assertIs(c["thinking"], False)
        self.assertIs(bridge.apply_source_task(base, {}), base)

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


if __name__ == "__main__":
    unittest.main()

"""Bridge -> ACE /release_task payload (quality pack). Run from repo root:

    python -m unittest sidecar/test_ace_bridge_payload.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ace_bridge_server as bridge  # noqa: E402


class BuildRenderPayloadTest(unittest.TestCase):
    def test_base_is_high_quality_path_with_llm_off(self):
        p = bridge.build_render_payload(
            {"prompt": {"text": "drum and bass, instrumental"}, "checkpointId": "acestep-v15-base"}
        )
        self.assertIs(p["thinking"], False)
        self.assertIs(p["use_cot_caption"], False)
        self.assertIs(p["use_cot_language"], False)
        self.assertEqual(p["inference_steps"], 64)
        self.assertIs(p["use_adg"], True)
        self.assertEqual(p["model"], "acestep-v15-base")
        self.assertEqual(p["dcw_mode"], "low")
        self.assertEqual(p["prompt"], "drum and bass, instrumental")

    def test_thinking_true_in_request_cannot_turn_the_lm_back_on(self):
        p = bridge.build_render_payload({"thinking": True, "checkpointId": "acestep-v15-base"})
        self.assertIs(p["thinking"], False)

    def test_missing_steps_default_to_64_not_32(self):
        p = bridge.build_render_payload({}, "acestep-v15-sft")
        self.assertEqual(p["model"], "acestep-v15-sft")
        self.assertEqual(p["inference_steps"], 64)
        self.assertIs(p["use_adg"], True)

    def test_turbo_gets_8_steps_and_no_adg(self):
        p = bridge.build_render_payload({"checkpointId": "acestep-v15-turbo", "useAdg": True})
        self.assertEqual(p["inference_steps"], 8)
        self.assertIs(p["use_adg"], False)

    def test_fallback_prompt_has_no_guitar_or_rock(self):
        p = bridge.build_render_payload({"checkpointId": "acestep-v15-base"})
        self.assertNotIn("guitar", p["prompt"].lower())
        self.assertNotIn("rock", p["prompt"].lower())


if __name__ == "__main__":
    unittest.main()

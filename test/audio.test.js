import test from "node:test";
import assert from "node:assert/strict";

import { SoundBoard, normalizeAudioSettings } from "../src/audio.js";

test("audio settings default to effects on and voice off", () => {
  assert.deepEqual(normalizeAudioSettings(), {
    effectsEnabled: true,
    voiceEnabled: false,
    volume: 0.6,
  });
});

test("audio settings are clamped at the storage boundary", () => {
  assert.deepEqual(normalizeAudioSettings({
    effectsEnabled: "no",
    voiceEnabled: 1,
    volume: 4,
  }), {
    effectsEnabled: false,
    voiceEnabled: true,
    volume: 1,
  });
});

test("sound board degrades safely when browser audio APIs are unavailable", () => {
  const board = new SoundBoard({ effectsEnabled: true, voiceEnabled: true }, {});

  assert.doesNotThrow(() => {
    board.unlock();
    board.correct();
    board.wrong();
    board.launch();
    board.explode();
    board.station();
    board.complete();
    board.speak("完成");
  });
});

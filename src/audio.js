export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  effectsEnabled: true,
  voiceEnabled: false,
  volume: 0.6,
});

function readBoolean(value, fallback) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    if (["true", "yes", "1"].includes(value.toLowerCase())) return true;
    if (["false", "no", "0"].includes(value.toLowerCase())) return false;
  }
  return fallback;
}

export function normalizeAudioSettings(value = {}) {
  const volume = Number(value.volume);
  return {
    effectsEnabled: readBoolean(value.effectsEnabled, DEFAULT_AUDIO_SETTINGS.effectsEnabled),
    voiceEnabled: readBoolean(value.voiceEnabled, DEFAULT_AUDIO_SETTINGS.voiceEnabled),
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_AUDIO_SETTINGS.volume,
  };
}

export class SoundBoard {
  constructor(settings = {}, environment = globalThis) {
    this.settings = normalizeAudioSettings(settings);
    this.environment = environment;
    this.context = null;
  }

  update(settings) {
    this.settings = normalizeAudioSettings(settings);
  }

  unlock() {
    if (!this.settings.effectsEnabled) return null;
    const AudioContext = this.environment.AudioContext ?? this.environment.webkitAudioContext;
    if (!AudioContext) return null;
    try {
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === "suspended") {
        const resumeResult = this.context.resume?.();
        resumeResult?.catch?.(() => {});
      }
      return this.context;
    } catch {
      return null;
    }
  }

  playTone(frequency, duration = 0.08, type = "sine", offset = 0) {
    const context = this.unlock();
    if (!context) return;
    try {
      const start = context.currentTime + offset;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const peak = Math.max(0.01, this.settings.volume * 0.16);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // Audio is an enhancement; an unavailable device must not break typing.
    }
  }

  playSequence(notes, duration = 0.08, gap = 0.08) {
    notes.forEach((frequency, index) => this.playTone(frequency, duration, "sine", index * gap));
  }

  correct() {
    this.playTone(660, 0.07, "sine");
  }

  wrong() {
    this.playTone(180, 0.12, "triangle");
  }

  launch() {
    this.playSequence([220, 330, 520], 0.045, 0.035);
  }

  explode() {
    this.playSequence([880, 520, 260], 0.06, 0.04);
  }

  station() {
    this.playSequence([523, 659], 0.08, 0.09);
  }

  complete() {
    this.playSequence([523, 659, 784, 1046], 0.1, 0.1);
  }

  speak(message) {
    if (!this.settings.voiceEnabled || !message) return false;
    const synth = this.environment.speechSynthesis;
    const Utterance = this.environment.SpeechSynthesisUtterance;
    if (!synth || !Utterance) return false;
    try {
      synth.cancel();
      const utterance = new Utterance(String(message));
      utterance.lang = "zh-CN";
      utterance.rate = 0.9;
      utterance.pitch = 1.08;
      utterance.volume = this.settings.volume;
      synth.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }

  stopVoice() {
    try {
      this.environment.speechSynthesis?.cancel?.();
    } catch {
      // Speech cancellation is best effort.
    }
  }
}

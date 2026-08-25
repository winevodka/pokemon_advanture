// Lightweight synthesized audio (Web Audio API) so the game works with zero
// external asset files. Drop real files into assets/audio/ and wire them in
// here if you want richer sound later.
class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.musicNodes = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playTone(freq, duration, type = 'sine', delay = 0, gainValue = 0.15) {
    try {
      const ctx = this.ensureContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = gainValue;
      osc.connect(gain).connect(ctx.destination);
      const startTime = ctx.currentTime + delay;
      osc.start(startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.stop(startTime + duration + 0.05);
    } catch {
      /* Audio not available in this environment; fail silently */
    }
  }

  playCorrect() {
    this.playTone(523, 0.12, 'sine', 0);
    this.playTone(659, 0.12, 'sine', 0.12);
    this.playTone(784, 0.18, 'sine', 0.24);
  }

  playWrong() {
    this.playTone(220, 0.25, 'sawtooth', 0, 0.12);
    this.playTone(160, 0.3, 'sawtooth', 0.15, 0.12);
  }

  playVictory() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      this.playTone(freq, 0.2, 'triangle', i * 0.15, 0.15);
    });
  }

  startMusic() {
    if (!this.musicOn || this.musicNodes) return;
    try {
      const ctx = this.ensureContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 330;
      gain.gain.value = 0.02;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      this.musicNodes = { osc, gain };
    } catch {
      /* ignore */
    }
  }

  stopMusic() {
    if (this.musicNodes) {
      try {
        this.musicNodes.osc.stop();
      } catch {
        /* already stopped */
      }
      this.musicNodes = null;
    }
  }

  setMusicOn(on) {
    this.musicOn = on;
    if (on) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }
}

export const audioManager = new AudioManager();

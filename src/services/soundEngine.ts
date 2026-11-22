/**
 * Zero-dependency Web Audio API sound engine for tactile roulette & prize feedback.
 */
class RouletteSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.75;

  public configure(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Explicitly unlock Web Audio on user interaction (e.g. viewer clicking "Enter Live Room").
   */
  public unlock(): void {
    this.ensureContext();
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || this.volume <= 0) return null;
    if (typeof window === 'undefined') return null;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Physical wheel peg click as each slice boundary crosses the top flapper.
   * `speedRatio` (0..1) subtly raises pitch when spinning faster.
   */
  public playPegTick(speedRatio = 0.5): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clampedSpeed = Math.max(0, Math.min(1, speedRatio));
    const isSlowSuspense = clampedSpeed < 0.22;

    // Crisp percussive wood/acrylic click (deeper & more resonant during final slow crawl)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 520 + clampedSpeed * 420;
    const decay = isSlowSuspense ? 0.058 : 0.036;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(isSlowSuspense ? 125 : 165, now + decay);

    const peakGain = (isSlowSuspense ? 0.3 : 0.23) * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + decay + 0.006);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + decay + 0.01);

    // Subtle heartbeat-like low thump on the final agonizing ticks
    if (isSlowSuspense) {
      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(115, now);
      thump.frequency.exponentialRampToValueAtTime(52, now + 0.075);
      thumpGain.gain.setValueAtTime(0.16 * this.volume, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.08);
      thump.connect(thumpGain);
      thumpGain.connect(ctx.destination);
      thump.start(now);
      thump.stop(now + 0.085);
    }

    // Tiny metallic transient snap
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'sine';
    snap.frequency.setValueAtTime(1850 + clampedSpeed * 550, now);
    snap.frequency.exponentialRampToValueAtTime(680, now + 0.016);
    snapGain.gain.setValueAtTime((isSlowSuspense ? 0.1 : 0.075) * this.volume, now);
    snapGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.02);

    snap.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(now);
    snap.stop(now + 0.024);
  }

  /**
   * Mechanical launch whoosh when spinning begins.
   */
  public playSpinStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.16);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14 * this.volume, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Stage 1 lock-in chime when participant ID is selected.
   */
  public playParticipantLocked(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2 * this.volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }

  /**
   * MINIMUM AMOUNT (Lucky cheapest deal!): Sparkling victorious arcade fanfare.
   */
  public playLuckyMinFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const melody = [
      { freq: 523.25, delay: 0.0, dur: 0.16 }, // C5
      { freq: 659.25, delay: 0.09, dur: 0.16 }, // E5
      { freq: 783.99, delay: 0.18, dur: 0.16 }, // G5
      { freq: 1046.5, delay: 0.27, dur: 0.22 }, // C6
      { freq: 987.77, delay: 0.42, dur: 0.15 }, // B5
      { freq: 1046.5, delay: 0.54, dur: 0.55 }, // C6 triumph hold
      { freq: 1318.5, delay: 0.54, dur: 0.55 }, // E6 harmony
      { freq: 1567.98, delay: 0.54, dur: 0.6 }, // G6 sparkle
    ];

    for (const note of melody) {
      const start = now + note.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.22 * this.volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.dur + 0.04);
    }
  }

  /**
   * MAXIMUM AMOUNT (Highest price to pay!): Dramatic sub-bass hit + comical sad trombone descent.
   */
  public playMaxPriceDrama(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Dramatic sub-bass shock impact
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(125, now);
    sub.frequency.exponentialRampToValueAtTime(38, now + 0.42);
    subGain.gain.setValueAtTime(0.36 * this.volume, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.5);

    // Humorous dramatic descending brass ("wah - wah - wah - waaaah")
    const brassNotes = [
      { freq: 293.66, delay: 0.14, dur: 0.24, bendTo: 286 }, // D4
      { freq: 277.18, delay: 0.4, dur: 0.24, bendTo: 270 }, // C#4
      { freq: 261.63, delay: 0.66, dur: 0.24, bendTo: 254 }, // C4
      { freq: 246.94, delay: 0.92, dur: 0.68, bendTo: 218 }, // B3 sliding down
    ];

    for (const note of brassNotes) {
      const start = now + note.delay;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note.freq, start);
      osc.frequency.linearRampToValueAtTime(note.bendTo, start + note.dur);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, start);
      filter.frequency.exponentialRampToValueAtTime(420, start + note.dur);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2 * this.volume, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.dur + 0.05);
    }
  }

  /**
   * Standard amount reveal chime.
   */
  public playNormalResult(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 -> A5
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.22 * this.volume, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }
}

export const soundEngine = new RouletteSoundEngine();


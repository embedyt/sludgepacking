export class SoundSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private riverSource: AudioBufferSourceNode | null = null;
  private riverFilter: BiquadFilterNode | null = null;
  private riverGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private masterVol = 0.45;
  private sfxVol = 0.85;
  private ambientVol = 0.55;
  private active = false;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVol;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVol;
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.ambientVol;
      this.ambientGain.connect(this.masterGain);

      this.noiseBuffer = this.createNoiseBuffer(3.0);
      this.startAmbientWind();
      this.startRiverAmbience();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVol, this.ctx.currentTime, 0.04);
    }
  }

  public setVolumes(master: number, sfx: number, ambient: number): void {
    this.masterVol = Math.max(0, Math.min(1, master));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    this.ambientVol = Math.max(0, Math.min(1, ambient));
    if (this.ctx) {
      const t = this.ctx.currentTime;
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, t, 0.04);
      }
      if (this.sfxGain) {
        this.sfxGain.gain.setTargetAtTime(this.sfxVol, t, 0.04);
      }
      if (this.ambientGain) {
        this.ambientGain.gain.setTargetAtTime(this.ambientVol, t, 0.04);
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setActive(active: boolean): void {
    this.active = active;
    if (!this.ctx) return;
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(active ? 0.065 : 0.0, this.ctx.currentTime, 0.2);
    }
    if (this.riverGain && !active) {
      this.riverGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.2);
    }
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Slightly pink-filtered organic noise so ambient/impacts sound warmer & less harsh
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.42) * 0.65));
    }
    return buffer;
  }

  private startAmbientWind(): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer || this.windSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 1.25;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    src.start();

    this.windSource = src;
    this.windFilter = filter;
    this.windGain = gain;
  }

  private startRiverAmbience(): void {
    if (!this.ctx || !this.ambientGain || !this.noiseBuffer || this.riverSource) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 1.22;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 760;
    filter.Q.value = 0.65;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    src.start();

    this.riverSource = src;
    this.riverFilter = filter;
    this.riverGain = gain;
  }

  public updateWind(nightFactor: number, waterProximity = 0): void {
    if (!this.ctx) return;
    if (this.windFilter) {
      const targetFreq = 280 + nightFactor * 210 + Math.sin(performance.now() * 0.0012) * 50;
      this.windFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.25);
    }
    if (this.riverGain && this.riverFilter) {
      const prox = this.active ? Math.max(0, Math.min(1, waterProximity)) : 0;
      this.riverGain.gain.setTargetAtTime(prox * 0.14, this.ctx.currentTime, 0.18);
      this.riverFilter.frequency.setTargetAtTime(
        640 + prox * 380 + Math.sin(performance.now() * 0.0024) * 90,
        this.ctx.currentTime,
        0.2,
      );
    }
  }

  private pitchJitter(base: number, pct = 0.09): number {
    return base * (1 + (Math.random() * 2 - 1) * pct);
  }

  private get outNode(): GainNode | null {
    return this.sfxGain ?? this.masterGain;
  }

  public playChopWood(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;

    // Low hollow timber thump
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(this.pitchJitter(142), now);
    bodyOsc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    bodyGain.gain.setValueAtTime(0.42, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.outNode);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.14);

    // Woody bark crack & fibrous snap
    this.playNoiseBurst(0.055, this.pitchJitter(1350, 0.14), 0.34, 1.4);
    this.playNoiseBurst(0.09, this.pitchJitter(680, 0.12), 0.22, 0.8, 0.014);
  }

  public playMineStone(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;

    // Pickaxe metallic ring (dual detuned partials)
    for (const ratio of [1.0, 1.47]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const f = this.pitchJitter(1120 * ratio, 0.08);
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.82, now + 0.22);
      gain.gain.setValueAtTime(ratio === 1 ? 0.24 : 0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
      osc.connect(gain);
      gain.connect(this.outNode);
      osc.start(now);
      osc.stop(now + 0.24);
    }

    // Crushed gravel burst
    this.playNoiseBurst(0.095, this.pitchJitter(2300, 0.12), 0.34, 1.1);
    this.playNoiseBurst(0.06, 460, 0.24, 0.9, 0.01);
  }

  public playSwing(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    this.playNoiseBurst(0.095, this.pitchJitter(640, 0.12), 0.16, 1.5);
  }

  public playFootstep(surface: boolean | 'grass' | 'wood' | 'water' = false): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const kind = surface === true ? 'wood' : surface === false ? 'grass' : surface;

    if (kind === 'water') {
      this.playNoiseBurst(0.11, this.pitchJitter(1250, 0.18), 0.18, 0.85);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.pitchJitter(320, 0.15), now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.outNode);
      osc.start(now);
      osc.stop(now + 0.1);
      return;
    }

    if (kind === 'wood') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.pitchJitter(128, 0.12), now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.065);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      osc.connect(gain);
      gain.connect(this.outNode);
      osc.start(now);
      osc.stop(now + 0.085);
      this.playNoiseBurst(0.04, 880, 0.08, 1.2);
    } else {
      this.playNoiseBurst(0.06, this.pitchJitter(490, 0.16), 0.13, 0.9);
    }
  }

  public playBuild(tier: 'twig' | 'wood' | 'stone' = 'twig'): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = tier === 'stone' ? 'triangle' : 'triangle';
    const base = tier === 'twig' ? 250 : tier === 'wood' ? 165 : 108;
    osc.frequency.setValueAtTime(this.pitchJitter(base), now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.44, now + 0.12);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.15);

    this.playNoiseBurst(0.08, tier === 'stone' ? 920 : 1550, 0.22, 1.1);
  }

  public playDoorToggle(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.13);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.17);
    this.playNoiseBurst(0.06, 720, 0.12, 1.4, 0.04);
  }

  public playChestToggle(opening = true): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(opening ? 190 : 250, now);
    osc.frequency.exponentialRampToValueAtTime(opening ? 310 : 140, now + 0.11);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.14);
    this.playNoiseBurst(0.05, 1450, 0.12, 1.2, 0.02);
  }

  public playBowRelease(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.pitchJitter(240), now);
    osc.frequency.exponentialRampToValueAtTime(86, now + 0.15);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.18);
    this.playNoiseBurst(0.09, 2100, 0.18, 1.4);
  }

  public playGunshot(kind: 'revolver' | 'shotgun' | 'sniper'): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const isShotgun = kind === 'shotgun';
    const isSniper = kind === 'sniper';

    // Sub-bass chamber thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isSniper ? 260 : isShotgun ? 135 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(
      isSniper ? 28 : 36,
      now + (isSniper ? 0.32 : isShotgun ? 0.24 : 0.14),
    );
    gain.gain.setValueAtTime(isSniper ? 0.65 : isShotgun ? 0.58 : 0.44, now);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + (isSniper ? 0.34 : isShotgun ? 0.26 : 0.16),
    );
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + (isSniper ? 0.36 : isShotgun ? 0.28 : 0.18));

    // Initial muzzle crack + delayed valley echo reflections
    this.playNoiseBurst(
      isSniper ? 0.26 : isShotgun ? 0.22 : 0.13,
      isSniper ? 2500 : isShotgun ? 1250 : 2100,
      isSniper ? 0.72 : isShotgun ? 0.66 : 0.48,
      0.65,
    );
    this.playNoiseBurst(0.18, 900, isSniper ? 0.22 : 0.14, 0.8, 0.065);
    this.playNoiseBurst(0.24, 620, isSniper ? 0.12 : 0.07, 1.0, 0.15);
  }

  public playExplosion(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.55);
    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.62);

    this.playNoiseBurst(0.45, 580, 0.78, 0.55);
    this.playNoiseBurst(0.32, 1650, 0.42, 0.8, 0.03);
  }

  public playFishCast(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    this.playNoiseBurst(0.12, 1800, 0.16, 1.5);
    this.playNoiseBurst(0.1, 950, 0.2, 0.9, 0.18);
  }

  public playFishBite(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.09);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.13);
    this.playNoiseBurst(0.08, 1300, 0.18, 0.9, 0.02);
  }

  public playFishCatch(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    [540, 720, 960].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(gain);
      gain.connect(this.outNode!);
      osc.start(t);
      osc.stop(t + 0.14);
    });
    this.playNoiseBurst(0.11, 1450, 0.22, 0.9);
  }

  public playHitmarker(crit = false): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(crit ? 1520 : 1080, now);
    osc.frequency.exponentialRampToValueAtTime(crit ? 1960 : 880, now + 0.065);
    gain.gain.setValueAtTime(crit ? 0.26 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playPlayerHurt(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.18);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playLoot(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    [520, 740].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(gain);
      gain.connect(this.outNode!);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  public playUiClick(): void {
    if (!this.ctx || !this.outNode || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.outNode);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  private playNoiseBurst(
    duration: number,
    filterFreq: number,
    volume: number,
    q = 0.9,
    delay = 0,
  ): void {
    if (!this.ctx || !this.outNode || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.outNode);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public dispose(): void {
    try {
      this.windSource?.stop();
      this.riverSource?.stop();
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.windSource = null;
    this.riverSource = null;
    this.ctx = null;
  }
}

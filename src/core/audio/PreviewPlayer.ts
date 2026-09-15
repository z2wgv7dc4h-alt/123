/**
 * Preview of rendered mix ONLY — Tone.Player (flat mix) or live stem graph.
 * Tone is NOT the synth engine; OfflineStub / ACE produce the buffers.
 *
 * Live tweaks (P0): Tone.Player per elemental stem → Tone.Channel.
 * mute / solo / volume update Channel params mid-play (no remux-on-Play).
 * Export-as-heard keeps renderRemixedWavBlob sum+glue path.
 */
import * as Tone from 'tone';
import type { StemId } from '../types';
import { duckEnvelopeStep, duckGainFromEnvelope, computeDuckShapeParams } from './ducking';
import { encodeWav } from '../export/wav';
import { applyMixBusGlue } from '../backends';

export type PreviewState = 'idle' | 'loading' | 'ready' | 'playing' | 'stopped';

type StemInput = { id: string; blob?: Blob; url: string };

type StemLane = {
  id: string;
  player: Tone.Player;
  channel: Tone.Channel;
  /** Bass lane only — pre-Channel duck stage driven by live kick→bass sidechain. */
  duckGain: Tone.Gain | null;
  objectUrl: string | null;
};

function stemCacheKey(s: StemInput): string {
  if (s.blob) return `${s.id}:blob:${s.blob.size}:${s.blob.type}`;
  return `${s.id}:url:${s.url}`;
}

function dbToLin(db: number): number {
  if (!Number.isFinite(db) || db <= -60) return 0;
  return Math.pow(10, db / 20);
}

/**
 * Apply kick→bass sidechain ducking to bassMono using kickMono as the follower.
 * Returns a new Float32Array with duck applied to bassMono.
 * Pure function - does not modify inputs.
 */
function applyKickBassDuck(
  kickMono: Float32Array,
  bassMono: Float32Array,
  sampleRate: number,
  energy: number = 0.5, // Typical energy value
  hyped: boolean = false // Whether the song shape is hyped
): Float32Array {
  const { duckDb, attackMs, releaseMs } = computeDuckShapeParams(energy, hyped);
  const duckLin = Math.pow(10, -duckDb / 20);
  const frameRateHz = sampleRate; // For sample-accurate processing
  const atkCoef = Math.exp(-1 / Math.max(1, (attackMs / 1000) * frameRateHz));
  const relCoef = Math.exp(-1 / Math.max(1, (releaseMs / 1000) * frameRateHz));

  // Normalize kick follower so solid hits approach 1
  let kickPeak = 0;
  for (let i = 0; i < kickMono.length; i++) {
    kickPeak = Math.max(kickPeak, Math.abs(kickMono[i]));
  }
  const invPeak = kickPeak > 1e-8 ? 1 / kickPeak : 1;

  const result = new Float32Array(bassMono);
  let env = 0;

  for (let i = 0; i < bassMono.length; i++) {
    const k = Math.abs(kickMono[i]) * invPeak;
    if (k > env) {
      env = env * atkCoef + k * (1 - atkCoef);
    } else {
      env = env * relCoef + k * (1 - relCoef);
    }
    const amount = Math.min(1, env * 1.15);
    const g = 1 - amount * (1 - duckLin);
    result[i] = bassMono[i] * g;
  }

  return result;
}

export class PreviewPlayer {
  /** Flat-mixer glued mix (Tone.Player → destination). */
  private player: Tone.Player | null = null;
  private nativeCtx: AudioContext | null = null;
  private nativeSource: AudioBufferSourceNode | null = null;
  private nativeBuffer: AudioBuffer | null = null;
  private useTone = true;
  private _state: PreviewState = 'idle';
  private objectUrl: string | null = null;
  /** Decoded stems for bake/export cache — survives remix rebuilds. */
  private stemCache = new Map<string, AudioBuffer>();
  private playGeneration = 0;
  private playheadRatio = 0;
  private playOriginMs = 0;
  private playOriginRatio = 0;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private loopStart: number | null = null;
  private loopEnd: number | null = null;
  onState?: (s: PreviewState) => void;

  /** Live: Tone.Player per stem → Tone.Channel (mute/solo/volume mid-play). */
  private liveMode = false;
  private liveLanes = new Map<string, StemLane>();
  private liveStemOrder: string[] = [];
  /** Shared glue bus so live remix punch matches export (Compressor+Limiter), not per-lane toDestination. */
  private liveMasterBus: Tone.Gain | null = null;
  private liveGlueComp: Tone.Compressor | null = null;
  private liveLimiter: Tone.Limiter | null = null;
  /** Kick→bass live sidechain duck (rAF envelope follower, see duckEnvelopeStep). */
  private liveKickAnalyser: Tone.Analyser | null = null;
  private duckRafId: number | null = null;
  private duckEnv = 0;
  /** Mix WAV duration — clocks must not drift to live-graph max. */
  private authoritativeDurationSec = 0;

  setAuthoritativeDuration(sec: number | null | undefined) {
    this.authoritativeDurationSec =
      sec != null && Number.isFinite(sec) && sec > 0 ? sec : 0;
  }

  get state(): PreviewState {
    return this._state;
  }

  private setState(s: PreviewState) {
    this._state = s;
    this.onState?.(s);
  }

  getDurationSec(): number {
    if (this.authoritativeDurationSec > 0) return this.authoritativeDurationSec;
    if (this.liveMode && this.liveLanes.size) {
      let max = 0;
      for (const lane of this.liveLanes.values()) {
        const d = lane.player.loaded ? lane.player.buffer?.duration ?? 0 : 0;
        if (d > max) max = d;
      }
      return max;
    }
    if (this.useTone && this.player?.loaded && this.player.buffer) {
      const d = this.player.buffer.duration;
      return Number.isFinite(d) && d > 0 ? d : 0;
    }
    if (this.nativeBuffer) {
      const d = this.nativeBuffer.duration;
      return Number.isFinite(d) && d > 0 ? d : 0;
    }
    return 0;
  }

  getProgress(): number {
    const dur = this.getDurationSec();
    if (this._state === 'playing' && dur > 0) {
      const elapsed = (performance.now() - this.playOriginMs) / 1000;
      return Math.min(1, Math.max(0, this.playOriginRatio + elapsed / dur));
    }
    return Math.min(1, Math.max(0, this.playheadRatio));
  }

  seek(ratio01: number): void {
    const r = Math.min(1, Math.max(0, Number.isFinite(ratio01) ? ratio01 : 0));
    this.playheadRatio = r;
    if (this._state === 'playing') {
      this.startPlaybackAt(r);
    }
  }

  setLoop(a: number, b: number): void {
    const x = Math.min(1, Math.max(0, Number.isFinite(a) ? a : 0));
    const y = Math.min(1, Math.max(0, Number.isFinite(b) ? b : 0));
    if (Math.abs(y - x) < 0.01) {
      this.clearLoop();
      return;
    }
    this.loopStart = Math.min(x, y);
    this.loopEnd = Math.max(x, y);
  }

  clearLoop(): void {
    this.loopStart = null;
    this.loopEnd = null;
  }

  getLoop(): { start: number; end: number } | null {
    if (this.loopStart == null || this.loopEnd == null) return null;
    return { start: this.loopStart, end: this.loopEnd };
  }

  /** Sync unlock from user gesture (Play / mute / gain) before await gaps. */
  unlockAudioSync(): void {
    try {
      void Tone.start();
    } catch {
      /* */
    }
    if (!this.nativeCtx || this.nativeCtx.state === 'closed') {
      try {
        this.nativeCtx = new AudioContext();
      } catch {
        return;
      }
    }
    if (this.nativeCtx.state === 'suspended') {
      void this.nativeCtx.resume();
    }
  }

  /** True when Tone stem lanes are armed for instant Channel mute/solo/gain. */
  hasLiveGraph(): boolean {
    return this.liveMode && this.liveLanes.size > 0;
  }

  /** Test/QA: lane ids currently on the live Tone graph. */
  liveStemIds(): string[] {
    return [...this.liveStemOrder];
  }

  /** Test/QA: read Channel strip state for a stem. */
  getLiveChannelState(
    id: string,
  ): { mute: boolean; solo: boolean; volumeDb: number } | null {
    const lane = this.liveLanes.get(id);
    if (!lane) return null;
    return {
      mute: !!lane.channel.mute,
      solo: !!lane.channel.solo,
      volumeDb: lane.channel.volume.value,
    };
  }

  private clearEndTimer(): void {
    if (this.endTimer != null) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }

  private scheduleEnd(gen: number, remainingSec: number): void {
    this.clearEndTimer();
    if (!(remainingSec > 0) || !Number.isFinite(remainingSec)) return;
    this.endTimer = setTimeout(() => {
      if (gen !== this.playGeneration) return;
      if (this._state !== 'playing') return;
      if (this.loopStart != null && this.loopEnd != null) {
        this.startPlaybackAt(this.loopStart);
        return;
      }
      this.playheadRatio = 0;
      this.setState('stopped');
    }, remainingSec * 1000 + 50);
  }

  private stopLivePlayers(): void {
    for (const lane of this.liveLanes.values()) {
      try {
        lane.player.stop();
      } catch {
        /* */
      }
    }
  }

  private teardownLiveGraph(): void {
    if (this.duckRafId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.duckRafId);
    }
    this.duckRafId = null;
    this.duckEnv = 0;
    this.stopLivePlayers();
    for (const lane of this.liveLanes.values()) {
      try {
        lane.player.dispose();
      } catch {
        /* */
      }
      try {
        lane.duckGain?.dispose();
      } catch {
        /* */
      }
      try {
        lane.channel.dispose();
      } catch {
        /* */
      }
      if (lane.objectUrl) {
        try {
          URL.revokeObjectURL(lane.objectUrl);
        } catch {
          /* */
        }
      }
    }
    this.liveLanes.clear();
    this.liveStemOrder = [];
    this.liveMode = false;
    try {
      this.liveKickAnalyser?.dispose();
    } catch {
      /* */
    }
    this.liveKickAnalyser = null;
    try {
      this.liveGlueComp?.dispose();
    } catch {
      /* */
    }
    this.liveGlueComp = null;
    try {
      this.liveLimiter?.dispose();
    } catch {
      /* */
    }
    this.liveLimiter = null;
    try {
      this.liveMasterBus?.dispose();
    } catch {
      /* */
    }
    this.liveMasterBus = null;
  }

  private startPlaybackAt(ratio01: number): void {
    let r = Math.min(1, Math.max(0, ratio01));
    if (r >= 0.999) r = 0;
    if (this.loopStart != null && this.loopEnd != null) {
      if (r < this.loopStart || r >= this.loopEnd) r = this.loopStart;
    }
    const dur = this.getDurationSec();
    const offset = dur > 0 ? r * dur : 0;
    let remaining = dur > 0 ? Math.max(0, dur - offset) : 0;
    if (this.loopStart != null && this.loopEnd != null && dur > 0) {
      remaining = Math.max(0.05, (this.loopEnd - r) * dur);
    }
    const gen = ++this.playGeneration;
    this.clearEndTimer();

    // Live stem graph: sync-start every Tone.Player into its Channel
    if (this.liveMode && this.liveLanes.size) {
      this.stopLivePlayers();
      const t = Tone.now();
      const playDur =
        this.loopStart != null && this.loopEnd != null ? remaining : undefined;
      for (const id of this.liveStemOrder) {
        const lane = this.liveLanes.get(id);
        if (!lane?.player.loaded) continue;
        try {
          if (playDur != null) lane.player.start(t, offset, playDur);
          else lane.player.start(t, offset);
        } catch {
          /* */
        }
      }
      this.playOriginMs = performance.now();
      this.playOriginRatio = r;
      this.playheadRatio = r;
      this.setState('playing');
      this.scheduleEnd(gen, remaining);
      return;
    }

    if (this.useTone && this.player) {
      try {
        this.player.stop();
      } catch {
        /* not started yet */
      }
      const playDur =
        this.loopStart != null && this.loopEnd != null ? remaining : undefined;
      this.player.start(undefined, offset, playDur);
      this.playOriginMs = performance.now();
      this.playOriginRatio = r;
      this.playheadRatio = r;
      this.setState('playing');
      this.scheduleEnd(gen, remaining);
      return;
    }
    if (this.nativeCtx && this.nativeBuffer) {
      try {
        this.nativeSource?.stop();
      } catch {
        /* */
      }
      const node = this.nativeCtx.createBufferSource();
      node.buffer = this.nativeBuffer;
      node.connect(this.nativeCtx.destination);
      node.onended = () => {
        if (gen !== this.playGeneration) return;
        if (this._state === 'playing') {
          if (this.loopStart != null && this.loopEnd != null) {
            this.startPlaybackAt(this.loopStart);
            return;
          }
          this.playheadRatio = 0;
          this.setState('stopped');
        }
      };
      this.nativeSource = node;
      if (this.nativeCtx.state === 'suspended') {
        void this.nativeCtx.resume();
      }
      if (this.loopStart != null && this.loopEnd != null) {
        node.start(0, offset, remaining);
      } else {
        node.start(0, offset);
      }
      this.playOriginMs = performance.now();
      this.playOriginRatio = r;
      this.playheadRatio = r;
      this.setState('playing');
      this.scheduleEnd(gen, remaining);
    }
  }

  private async ensureCtx(): Promise<AudioContext> {
    if (this.nativeCtx && this.nativeCtx.state !== 'closed') return this.nativeCtx;
    this.nativeCtx = new AudioContext();
    return this.nativeCtx;
  }

  clearStemCache(): void {
    this.stemCache.clear();
    this.teardownLiveGraph();
    this.playheadRatio = 0;
    this.clearLoop();
  }

  private async decodeStem(ctx: AudioContext, s: StemInput): Promise<AudioBuffer> {
    const key = stemCacheKey(s);
    const hit = this.stemCache.get(key);
    if (hit) return hit;
    const src = s.blob ?? s.url;
    const ab =
      typeof src === 'string' ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    this.stemCache.set(key, buf);
    return buf;
  }

  private stemUrl(s: StemInput): { url: string; owned: boolean } {
    if (s.blob) {
      return { url: URL.createObjectURL(s.blob), owned: true };
    }
    return { url: s.url, owned: false };
  }

  /** Flat mixer: glued mix stem only. */
  async loadMix(urlOrBlob: string | Blob): Promise<void> {
    await this.disposePlayback();
    this.teardownLiveGraph();
    this.setState('loading');

    const url =
      typeof urlOrBlob === 'string' ? urlOrBlob : URL.createObjectURL(urlOrBlob);
    if (typeof urlOrBlob !== 'string') this.objectUrl = url;

    try {
      await Tone.start();
      this.player = new Tone.Player({
        url,
        autostart: false,
        onload: () => {
          if (this._state === 'loading' || this._state === 'idle') this.setState('ready');
        },
      }).toDestination();
      await new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const tick = () => {
          if (this.player?.loaded) {
            if (this._state === 'loading' || this._state === 'idle' || this._state === 'stopped') {
              this.setState('ready');
            }
            resolve();
            return;
          }
          if (performance.now() - start > 30_000) {
            reject(new Error('Preview load timeout'));
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
      this.useTone = true;
    } catch {
      this.useTone = false;
      const ctx = await this.ensureCtx();
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      this.nativeBuffer = await ctx.decodeAudioData(ab.slice(0));
      this.setState('ready');
    }
  }

  /**
   * Arm Tone.Player → Tone.Channel lanes for every elemental stem.
   * Subsequent mute/solo/gain = Channel params mid-play (applyLiveMixer).
   */
  async loadLiveFromStems(
    stems: StemInput[],
    mixer?: {
      mute?: Partial<Record<string, boolean>>;
      solo?: Partial<Record<string, boolean>>;
      gainDb?: Partial<Record<string, number>>;
    },
  ): Promise<void> {
    const usable = stems.filter((s) => s.blob || s.url);
    if (!usable.length) throw new Error('No stem blobs for live preview');

    const wasPlaying = this._state === 'playing';
    const progress = this.getProgress();

    await this.disposePlayback();
    this.teardownLiveGraph();
    this.setState('loading');
    this.useTone = true;

    await Tone.start();

    this.liveMasterBus = new Tone.Gain(1);
    this.liveGlueComp = new Tone.Compressor({
      threshold: -20,
      ratio: 4,
      attack: 0.003,
      release: 0.06,
    });
    this.liveLimiter = new Tone.Limiter(-0.3);
    const masterBus = this.liveMasterBus;
    masterBus.chain(this.liveGlueComp, this.liveLimiter, Tone.getDestination());

    this.liveStemOrder = [];
    for (const s of usable) {
      const { url, owned } = this.stemUrl(s);
      const channel = new Tone.Channel({
        volume: mixer?.gainDb?.[s.id] ?? 0,
        mute: !!mixer?.mute?.[s.id],
        solo: !!mixer?.solo?.[s.id],
        pan: 0,
      });
      channel.connect(masterBus);

      const player = new Tone.Player({
        url,
        autostart: false,
      });
      let duckGain: Tone.Gain | null = null;
      if (s.id === 'bass') {
        duckGain = new Tone.Gain(1);
        player.connect(duckGain);
        duckGain.connect(channel);
      } else {
        player.connect(channel);
      }

      await new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const tick = () => {
          if (player.loaded) {
            resolve();
            return;
          }
          if (performance.now() - start > 30_000) {
            reject(new Error(`Live stem load timeout: ${s.id}`));
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });

      this.liveLanes.set(s.id, {
        id: s.id,
        player,
        channel,
        duckGain,
        objectUrl: owned ? url : null,
      });
      this.liveStemOrder.push(s.id);
    }

    this.liveMode = true;
    this.nativeBuffer = null;
    this.player = null;
    this.playheadRatio = progress;

    const kickLane = this.liveLanes.get('kick');
    const bassLane = this.liveLanes.get('bass');
    if (kickLane && bassLane?.duckGain) {
      this.liveKickAnalyser = new Tone.Analyser('waveform', 256);
      kickLane.channel.connect(this.liveKickAnalyser);
      this.startDuckLoop(bassLane);
    }

    if (mixer) this.applyLiveMixer(mixer);
    this.setState('ready');
    if (wasPlaying) {
      this.startPlaybackAt(progress);
    }
  }

  /**
   * rAF envelope follower: reads the live kick channel level each frame and
   * ducks the bass lane's pre-Channel gain stage, so mute/solo/gain tweaks
   * keep the same punch as the flat/export mix (which ducks via
   * OfflineStubBackend.sidechainDuckBass at render time). Not scheduled
   * against Tone.Transport because live playback doesn't use one — see
   * PreviewPlayer's live graph notes in loadLiveFromStems.
   */
  private startDuckLoop(bassLane: StemLane): void {
    const duckGain = bassLane.duckGain;
    const analyser = this.liveKickAnalyser;
    if (!duckGain || !analyser || typeof requestAnimationFrame !== 'function') return;
    // Estimate effective frame rate for RAF (60fps typical when visible)
    const frameRateHz = 60;
    // Target time constants: attack ~3-8ms, release ~40-80ms
    // Using values consistent with OfflineStubBackend.sidechainDuckBass defaults
    const attackMs = 5;
    const releaseMs = 55;
    // Use same formula as OfflineStubBackend.sidechainDuckBass but with frame rate instead of audio sample rate
    const atkCoef = Math.exp(-1 / Math.max(1, (attackMs / 1000) * frameRateHz));
    const relCoef = Math.exp(-1 / Math.max(1, (releaseMs / 1000) * frameRateHz));
    const duckDb = 3.2;
    this.duckEnv = 0;
    const tick = (): void => {
      if (!this.liveMode || this.liveLanes.get('bass') !== bassLane) return;
      if (this._state === 'playing') {
        const values = analyser.getValue();
        const frame = Array.isArray(values) ? values[0] : values;
        let peak = 0;
        if (frame) {
          for (let i = 0; i < frame.length; i++) {
            const a = Math.abs(frame[i]!);
            if (a > peak) peak = a;
          }
        }
        this.duckEnv = duckEnvelopeStep(peak, this.duckEnv, atkCoef, relCoef);
        try {
          duckGain.gain.value = duckGainFromEnvelope(this.duckEnv, duckDb);
        } catch {
          /* */
        }
      }
      this.duckRafId = requestAnimationFrame(tick);
    };
    this.duckRafId = requestAnimationFrame(tick);
  }

  /**
   * Instant mid-play mute/solo/gain via Tone.Channel (Critic bar).
   * Does not stop or rebuild Players.
   */
  applyLiveMixer(mixer: {
    mute?: Partial<Record<string, boolean>>;
    solo?: Partial<Record<string, boolean>>;
    gainDb?: Partial<Record<string, number>>;
  }): void {
    if (!this.liveMode) return;
    for (const [id, lane] of this.liveLanes) {
      lane.channel.mute = !!mixer.mute?.[id];
      lane.channel.solo = !!mixer.solo?.[id];
      const db = mixer.gainDb?.[id] ?? 0;
      try {
        lane.channel.volume.value = db;
      } catch {
        /* */
      }
    }
  }

  /**
   * @deprecated Prefer applyLiveMixer — kept for store transition / tests.
   * Maps gainsDb + muted set onto Channel mute + volume.
   */
  applyLiveGains(
    gainsDb: Partial<Record<string, number>>,
    mutedIds?: ReadonlySet<string>,
  ): void {
    if (!this.liveMode) return;
    for (const [id, lane] of this.liveLanes) {
      const muted = mutedIds?.has(id) ?? false;
      lane.channel.mute = muted;
      try {
        lane.channel.volume.value = muted ? -120 : (gainsDb[id] ?? 0);
      } catch {
        /* */
      }
    }
  }

  /**
   * Offline sum+glue into one buffer (fallback / non-Tone). Export uses renderRemixedWavBlob.
   */
  async loadMixFromStems(
    stems: StemInput[],
    gainsDb?: Partial<Record<string, number>>,
  ): Promise<void> {
    const usable = stems.filter((s) => s.blob || s.url);
    if (!usable.length) throw new Error('No stem blobs to remix for muted preview');

    await this.disposePlayback();
    this.teardownLiveGraph();
    this.setState('loading');
    this.useTone = false;
    const ctx = await this.ensureCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    const decoded: AudioBuffer[] = [];
    const gainsLin: number[] = [];
    for (const s of usable) {
      decoded.push(await this.decodeStem(ctx, s));
      gainsLin.push(dbToLin(gainsDb?.[s.id] ?? 0));
    }

    const sr = decoded[0]!.sampleRate;
    const len = Math.max(...decoded.map((d) => d.length));
    const chCount = Math.max(...decoded.map((d) => d.numberOfChannels));
    const channels: Float32Array[] = Array.from({ length: chCount }, () => new Float32Array(len));

    // Find kick and bass stems for ducking BEFORE summing
    let kickMono: Float32Array | null = null;
    let bassMono: Float32Array | null = null;
    let kickIndex = -1;
    let bassIndex = -1;

    for (let i = 0; i < usable.length; i++) {
      if (usable[i].id === 'kick') {
        kickIndex = i;
        // Get mono kick signal (first channel)
        kickMono = decoded[i].getChannelData(0);
      }
      if (usable[i].id === 'bass') {
        bassIndex = i;
        // Get mono bass signal (first channel)
        bassMono = decoded[i].getChannelData(0);
      }
    }

    // Apply kick→bass sidechain ducking if we have both stems
    let duckAppliedBass: Float32Array | null = null;
    if (kickMono !== null && bassMono !== null && kickIndex !== -1 && bassIndex !== -1) {
      duckAppliedBass = applyKickBassDuck(kickMono, bassMono, sr);
    }

    // Sum all stems into channels
    for (let bi = 0; bi < decoded.length; bi++) {
      const buf = decoded[bi]!;
      const g = gainsLin[bi]!;

      // Use duck-applied bass for bass stem if available
      const useDuckedBass = duckAppliedBass !== null && bi === bassIndex;

      for (let c = 0; c < chCount; c++) {
        const dst = channels[c]!;
        const srcCh = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));

        for (let i = 0; i < srcCh.length; i++) {
          // For bass stem, use duck-applied signal if available
          if (useDuckedBass && c === 0) {
            // Apply gain to duck-applied bass
            dst[i]! += duckAppliedBass![i] * g;
          } else {
            // Normal processing for all other stems/channels
            dst[i]! += srcCh[i]! * g;
          }
        }
      }
    }

    for (let c = 0; c < chCount; c++) {
      applyMixBusGlue(channels[c], sr);
    }
    // Merge channels back into a single buffer for compatibility with existing code
    const mixed = ctx.createBuffer(2, len, sr);
    if (chCount >= 1) {
      mixed.getChannelData(0).set(channels[0]);
    }
    if (chCount >= 2) {
      mixed.getChannelData(1).set(channels[1] || channels[0]);
    }
    this.nativeBuffer = mixed;
    this.setState('ready');
  }

  async play(): Promise<void> {
    this.unlockAudioSync();
    const hasLive = this.liveMode && this.liveLanes.size > 0;
    const hasTone = !!(this.useTone && this.player && this.player.loaded);
    const hasNative = !!this.nativeBuffer;
    if (this._state === 'loading' || this._state === 'playing') return;
    if (!hasLive && !hasTone && !hasNative) {
      return;
    }
    if (this._state === 'idle' || this._state === 'stopped') {
      this.setState('ready');
    }
    if (this._state !== 'ready') return;

    if (this.nativeCtx && this.nativeCtx.state === 'suspended') {
      await this.nativeCtx.resume();
    }
    try {
      await Tone.start();
    } catch {
      /* */
    }
    this.startPlaybackAt(this.playheadRatio);
  }

  stop(): void {
    if (this._state === 'playing') {
      this.playheadRatio = this.getProgress();
    }
    this.playGeneration += 1;
    this.clearEndTimer();
    this.stopLivePlayers();
    if (this.useTone && this.player) {
      try {
        this.player.stop();
      } catch {
        /* */
      }
      this.setState('stopped');
      return;
    }
    try {
      this.nativeSource?.stop();
    } catch {
      /* */
    }
    this.nativeSource = null;
    this.setState('stopped');
  }

  private async disposePlayback(): Promise<void> {
    this.stop();
    this.player?.dispose();
    this.player = null;
    this.nativeSource = null;
    this.nativeBuffer = null;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  async dispose(): Promise<void> {
    await this.disposePlayback();
    this.clearStemCache();
    await this.nativeCtx?.close().catch(() => undefined);
    this.nativeCtx = null;
    this.setState('idle');
  }
}

/** Resolve which stem ids are audible given mute/solo. */
export function audibleStemIds(
  mute: Partial<Record<StemId, boolean>>,
  solo: Partial<Record<StemId, boolean>>,
  ids: StemId[],
): StemId[] {
  const anySolo = ids.some((id) => solo[id]);
  return ids.filter((id) => {
    if (mute[id]) return false;
    if (anySolo) return !!solo[id];
    return true;
  });
}

/** Remixed WAV + pre-glue peak (soft-limit can hide true hotness — #51). */
export type RemixedWavResult = { blob: Blob; preGluePeak: number };

/** Same summing+glue path as export-as-heard (NOT the live Tone graph). Applies live-style ducking so as-heard preview matches export. */
export async function renderRemixedWavBlob(
  stems: Array<{ id: string; blob?: Blob; url: string }>,
  gainsDb?: Partial<Record<string, number>>,
  bitDepth: 16 | 24 = 16,
): Promise<RemixedWavResult> {
  const usable = stems.filter((s) => s.blob || s.url);
  if (!usable.length) throw new Error('No stems to render as-heard mix');

  const ctx = new AudioContext();
  try {
    const decoded: AudioBuffer[] = [];
    const gainsLin: number[] = [];
    for (const s of usable) {
      const src = s.blob ?? s.url;
      const ab =
        typeof src === 'string' ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer();
      decoded.push(await ctx.decodeAudioData(ab.slice(0)));
      gainsLin.push(Math.pow(10, (gainsDb?.[s.id] ?? 0) / 20));
    }
    const sr = decoded[0]!.sampleRate;
    const len = Math.max(...decoded.map((d) => d.length));
    const chCount = Math.max(...decoded.map((d) => d.numberOfChannels));
    const channels: Float32Array[] = Array.from({ length: chCount }, () => new Float32Array(len));

    // Find kick and bass stems for ducking BEFORE summing
    let kickMono: Float32Array | null = null;
    let bassMono: Float32Array | null = null;
    let kickIndex = -1;
    let bassIndex = -1;

    for (let i = 0; i < usable.length; i++) {
      if (usable[i].id === 'kick') {
        kickIndex = i;
        // Get mono kick signal (first channel for ducking analysis)
        kickMono = decoded[i].getChannelData(0);
      }
      if (usable[i].id === 'bass') {
        bassIndex = i;
        // Get mono bass signal (first channel for ducking analysis)
        bassMono = decoded[i].getChannelData(0);
      }
    }

    // Apply kick→bass sidechain ducking if we have both stems
    let duckAppliedBass: Float32Array | null = null;
    if (kickMono !== null && bassMono !== null && kickIndex !== -1 && bassIndex !== -1) {
      duckAppliedBass = applyKickBassDuck(kickMono, bassMono, sr);
    }

    for (let bi = 0; bi < decoded.length; bi++) {
      const buf = decoded[bi]!;
      const g = gainsLin[bi]!;
      for (let c = 0; c < chCount; c++) {
        const dst = channels[c]!;
        // Use duck-applied bass for bass stem (first channel) if available
        const useDuckedBass = duckAppliedBass !== null && bi === bassIndex && c === 0;

        const srcCh = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
        for (let i = 0; i < srcCh.length; i++) {
          if (useDuckedBass) {
            // For bass stem first channel, use duck-applied signal
            dst[i]! += duckAppliedBass[i] * g;
          } else {
            // Normal processing
            dst[i]! += srcCh[i]! * g;
          }
        }
      }
    }

    // Mix all channels together
    const mixedChannels: Float32Array[] = Array.from({ length: chCount }, () => new Float32Array(len));
    for (let c = 0; c < chCount; c++) {
      for (let bi = 0; bi < decoded.length; bi++) {
        const buf = decoded[bi]!;
        const g = gainsLin[bi]!;
        const dst = mixedChannels[c]!;

        // Use duck-applied bass for bass stem (first channel) if available
        const useDuckedBass = duckAppliedBass !== null && bi === bassIndex && c === 0;

        const srcCh = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1));
        for (let i = 0; i < srcCh.length; i++) {
          if (useDuckedBass) {
            // For bass stem first channel, use duck-applied signal
            dst[i]! += duckAppliedBass[i] * g;
          } else {
            // Normal processing
            dst[i]! += srcCh[i]! * g;
          }
        }
      }
    }

    // Measure pre-glue peak
    let preGluePeak = 0;
    for (const ch of mixedChannels) {
      for (let i = 0; i < ch.length; i++) {
        const a = Math.abs(ch[i]!);
        if (a > preGluePeak) preGluePeak = a;
      }
    }

    // Apply mix bus glue to the mixed channels
    for (const c of mixedChannels) applyMixBusGlue(c, sr);

    return { blob: encodeWav(mixedChannels, sr, bitDepth), preGluePeak };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export const previewPlayer = new PreviewPlayer();
// Sons sintetizados com WebAudio (sem arquivos de áudio): curtos, baixos e de timbre suave.
import type { SoundKind } from './scheduler';

export interface VoiceOpts {
  /** Ganho final (já com o volume mestre). */
  gain: number;
  /** -1 .. 1 (esquerda .. direita). */
  pan?: number;
  /** Teclado: teclas na rajada. */
  count?: number;
  rng: () => number;
  /** Ruído branco curto (teclas). */
  noise: AudioBuffer | null;
}

/** Envelope percussivo: ataque curto e queda exponencial. */
function env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(ac: AudioContext, out: AudioNode, type: OscillatorType, freq: number, t: number, peak: number, attack: number, decay: number, toFreq?: number): void {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + Math.min(decay, 0.08));
  env(g, t, peak, attack, decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

/** Cria um buffer de ruído branco (base das teclas). */
export function makeNoise(ac: AudioContext): AudioBuffer | null {
  try {
    const len = Math.floor(ac.sampleRate * 0.06);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  } catch {
    return null;
  }
}

/** Toca `kind` em `t` (tempo do AudioContext) na saída `dest`. */
export function playVoice(ac: AudioContext, dest: AudioNode, kind: SoundKind, t: number, o: VoiceOpts): void {
  let out: AudioNode = dest;
  if (o.pan && typeof ac.createStereoPanner === 'function') {
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    p.connect(dest);
    out = p;
  }
  const g = o.gain;
  switch (kind) {
    case 'chime':
      // sino suave: duas parciais e uma terceira nota logo depois, com decaimento longo
      tone(ac, out, 'sine', 880, t, 0.16 * g, 0.012, 1.1);
      tone(ac, out, 'sine', 1318.5, t, 0.08 * g, 0.012, 1.1);
      tone(ac, out, 'sine', 1174.7, t + 0.14, 0.1 * g, 0.012, 1.1);
      return;
    case 'pop':
      // "pop": varredura curta para baixo
      tone(ac, out, 'triangle', 740, t, 0.14 * g, 0.008, 0.15, 330);
      return;
    case 'elevator':
      // "ding" de elevador: uma nota redonda com o brilho de sino sumindo antes
      tone(ac, out, 'sine', 784, t, 0.11 * g, 0.004, 1.5);
      tone(ac, out, 'sine', 1568, t, 0.025 * g, 0.004, 0.7);
      tone(ac, out, 'sine', 2164, t, 0.012 * g, 0.004, 0.25);
      return;
    case 'keys':
      keys(ac, out, t, o);
      return;
    case 'pingpong':
      // raquetada: "tok" agudo com a altura caindo
      tone(ac, out, 'sine', 1250, t, 0.09 * g, 0.002, 0.06, 880);
      return;
    case 'table':
      // quique na mesa: mais grave e mais curto
      tone(ac, out, 'sine', 760, t, 0.06 * g, 0.002, 0.045, 520);
      return;
    case 'arcade': {
      // fliperama: arpejo de três notas em onda quadrada, filtrado para não ferir
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      lp.connect(out);
      const scale = [1046.5, 1318.5, 1568, 1760, 2093];
      for (let i = 0; i < 3; i++) {
        const f = scale[Math.floor(o.rng() * scale.length)];
        tone(ac, lp, 'square', f, t + i * 0.055, 0.03 * g, 0.003, 0.05);
      }
      return;
    }
    case 'ninja_clink': {
      // Tiếng va chạm kim loại kunai/shuriken đanh gọn (metallic clink)
      tone(ac, out, 'triangle', 2800 + o.rng() * 400, t, 0.12 * g, 0.001, 0.06, 1600);
      tone(ac, out, 'sine', 4200 + o.rng() * 500, t, 0.08 * g, 0.001, 0.04);
      return;
    }
    case 'ninja_chidori': {
      // Tiếng sấm sét Lôi Độn Chidori rít chói tai (high frequency lightning crackle)
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 3;
      bp.connect(out);
      for (let i = 0; i < 4; i++) {
        tone(ac, bp, 'sawtooth', 1400 + o.rng() * 1800, t + i * 0.02, 0.08 * g, 0.002, 0.035);
      }
      return;
    }
    case 'ninja_rasengan': {
      // Tiếng gió xoáy Chakra Rasengan nén áp suất (spinning chakra swirl)
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, t);
      lp.frequency.linearRampToValueAtTime(1400, t + 0.18);
      lp.connect(out);
      tone(ac, lp, 'sawtooth', 180, t, 0.15 * g, 0.02, 0.22, 520);
      tone(ac, lp, 'triangle', 260, t + 0.04, 0.1 * g, 0.02, 0.18, 640);
      return;
    }
    case 'ninja_boom': {
      // Tiếng nổ bùa bộc phá Kibaku Fuda (explosion blast)
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(800, t);
      lp.frequency.exponentialRampToValueAtTime(100, t + 0.35);
      lp.connect(out);
      tone(ac, lp, 'sawtooth', 120, t, 0.22 * g, 0.005, 0.35, 45);
      tone(ac, out, 'triangle', 65, t, 0.18 * g, 0.008, 0.4, 30);
      return;
    }
    case 'ninja_gong': {
      // Tiếng chuông mõ võ quán khai chiến ngân vang (temple war gong)
      tone(ac, out, 'sine', 261.6, t, 0.2 * g, 0.005, 1.8); // C4
      tone(ac, out, 'sine', 523.2, t, 0.12 * g, 0.004, 1.2); // C5
      tone(ac, out, 'triangle', 392.0, t, 0.08 * g, 0.005, 1.4); // G4
      return;
    }
  }
}

/** Rajada de teclas: estalos de ruído filtrado com intervalos irregulares, como digitação de verdade. */
function keys(ac: AudioContext, out: AudioNode, t: number, o: VoiceOpts): void {
  if (!o.noise) return;
  const n = Math.max(1, Math.min(8, o.count ?? 4));
  let at = t;
  for (let i = 0; i < n; i++) {
    const src = ac.createBufferSource();
    src.buffer = o.noise;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900 + o.rng() * 1500;
    bp.Q.value = 1.4;
    const g = ac.createGain();
    env(g, at, 0.08 * o.gain * (0.6 + o.rng() * 0.4), 0.0015, 0.022 + o.rng() * 0.012);
    src.connect(bp).connect(g).connect(out);
    src.start(at, o.rng() * 0.02, 0.04);
    at += 0.06 + o.rng() * 0.08 + (o.rng() < 0.15 ? 0.12 : 0);
  }
}

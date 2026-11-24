export type QuantumMode = 'spacetime' | 'lqg' | 'holography';

export type CameraPreset = 'default' | 'top' | 'closeup';

export interface SimulationParams {
  // Mode 1: Spacetime Foam & Metric Curvature
  /** Observation length scale log10(L / l_P): 0 = Planck scale (1 l_P), 6 = 10^6 l_P (smooth GR) */
  scaleLogPlanck: number;
  /** Compact mass M in Planck masses (normalized for visual curvature 0.2 .. 3.0) */
  massEnergy: number;
  /** Quantum fluctuation amplitude multiplier (0 .. 1.5) */
  quantumFluctuation: number;

  // Mode 2: Loop Quantum Gravity (Spin Network)
  /** Barbero-Immirzi parameter gamma (standard ~0.2375) */
  immirziGamma: number;
  /** Average excitation / spin energy level */
  spinExcitation: number;

  // Mode 3: Holography AdS/CFT & ER=EPR
  /** Boundary entanglement density / thread count factor (0.2 .. 1.0) */
  entanglementDensity: number;
  /** Bulk black hole horizon radius ratio (0.0 .. 0.65) */
  bulkHorizonRadius: number;
}

export interface PhysicsMetrics {
  // Spacetime mode
  lengthScaleMeters: string;
  lengthScalePlanck: string;
  metricUncertainty: string; // Δg ~ l_P / L
  schwarzschildRadiusPlanck: string;
  hawkingTempPlanck: string;
  bekensteinEntropy: string;
  activePhotons: number;

  // LQG mode
  totalQuantizedArea: string; // in l_P^2
  totalQuantizedVolume: string; // in l_P^3
  meanSpinJ: string;
  bouncePhaseLabel: string;
  nodeCount: number;
  linkCount: number;

  // Holography mode
  rtEntropy: string; // S_A = Area / 4 G hbar
  geodesicCount: number;
  centralChargeC: string;
  horizonEntropyRatio: string;
}

export const PLANCK_CONSTANTS = {
  lengthMeters: 1.616255e-35, // m
  timeSeconds: 5.391247e-44, // s
  massKg: 2.176434e-8, // kg
  tempKelvin: 1.416784e32, // K
  energyGeV: 1.22089e19, // GeV
};

/**
 * Formats a value in scientific notation with clean Unicode superscripts or standard e-notation.
 */
export function formatSci(value: number, digits = 2): string {
  if (!Number.isFinite(value) || value === 0) return '0.00';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp <= 3) {
    return value.toFixed(digits);
  }
  const mantissa = value / Math.pow(10, exp);
  return `${mantissa.toFixed(digits)}×10^${exp}`;
}

/**
 * Compute real theoretical physics readouts for Spacetime Foam / Black Hole regime.
 */
export function computeSpacetimeMetrics(
  params: SimulationParams,
  activePhotons: number,
): Pick<
  PhysicsMetrics,
  | 'lengthScaleMeters'
  | 'lengthScalePlanck'
  | 'metricUncertainty'
  | 'schwarzschildRadiusPlanck'
  | 'hawkingTempPlanck'
  | 'bekensteinEntropy'
  | 'activePhotons'
> {
  const ratioL = Math.pow(10, params.scaleLogPlanck); // L / l_P
  const lengthMeters = ratioL * PLANCK_CONSTANTS.lengthMeters;

  // Wheeler metric fluctuation estimate: Δg_μν ~ (l_P / L) * fluctuation_coupling
  const deltaG = Math.min(1.5, (1 / Math.max(1, Math.pow(ratioL, 0.45))) * Math.max(0.05, params.quantumFluctuation));

  // Mass M in Planck mass units (scaled cleanly for black hole thermodynamics)
  const mPlanck = Math.max(0.25, params.massEnergy * 2.5);
  // r_s = 2 G M / c^2 = 2 (M / m_P) l_P
  const rS = 2 * mPlanck;
  // Hawking Temperature T_H = T_P / (8 π M/m_P)
  const tempH = 1 / (8 * Math.PI * mPlanck);
  // Bekenstein-Hawking Entropy S_BH = 4 π (M / m_P)^2 k_B
  const entropyBH = 4 * Math.PI * mPlanck * mPlanck;

  return {
    lengthScaleMeters: `${formatSci(lengthMeters, 2)} m`,
    lengthScalePlanck: ratioL < 1000 ? `${ratioL.toFixed(1)} ℓ_P` : `${formatSci(ratioL, 2)} ℓ_P`,
    metricUncertainty: deltaG >= 0.01 ? `${(deltaG * 100).toFixed(1)} %` : `${formatSci(deltaG * 100, 1)} %`,
    schwarzschildRadiusPlanck: `${rS.toFixed(2)} ℓ_P`,
    hawkingTempPlanck: `${tempH.toFixed(4)} T_P`,
    bekensteinEntropy: `${entropyBH.toFixed(1)} k_B`,
    activePhotons,
  };
}

/**
 * LQG Area eigenvalue contribution for a single SU(2) spin link j:
 * A_j = 8 π γ l_P^2 sqrt(j(j+1))
 */
export function lqgLinkArea(j: number, gamma: number): number {
  return 8 * Math.PI * gamma * Math.sqrt(j * (j + 1));
}

/**
 * Compute LQG discrete geometry metrics from the active spin list.
 */
export function computeLqgMetrics(
  spins: number[],
  nodeCount: number,
  gamma: number,
  bouncePhase: 'equilibrium' | 'contracting' | 'bouncing',
): Pick<
  PhysicsMetrics,
  | 'totalQuantizedArea'
  | 'totalQuantizedVolume'
  | 'meanSpinJ'
  | 'bouncePhaseLabel'
  | 'nodeCount'
  | 'linkCount'
> {
  let totalArea = 0;
  let sumJ = 0;
  for (let i = 0; i < spins.length; i++) {
    const j = spins[i];
    totalArea += lqgLinkArea(j, gamma);
    sumJ += j;
  }
  const meanJ = spins.length > 0 ? sumJ / spins.length : 0.5;
  // Volume eigenvalue scales approximately as (8πγ)^(3/2) * sqrt(j^3) per intertwiner node
  const totalVolume = nodeCount * Math.pow(8 * Math.PI * gamma, 1.5) * Math.pow(meanJ * (meanJ + 0.5), 0.75) * 0.18;

  const phaseMap = {
    equilibrium: '양자 평형 (이산 격자)',
    contracting: '플랑크 밀도 수축 중',
    bouncing: '양자 반발 (빅 바운스)',
  };

  return {
    totalQuantizedArea: `${totalArea.toFixed(1)} ℓ_P²`,
    totalQuantizedVolume: `${totalVolume.toFixed(1)} ℓ_P³`,
    meanSpinJ: meanJ.toFixed(2),
    bouncePhaseLabel: phaseMap[bouncePhase],
    nodeCount,
    linkCount: spins.length,
  };
}

/**
 * Compute Ryu-Takayanagi holographic entanglement metrics.
 */
export function computeHolographyMetrics(
  params: SimulationParams,
  geodesicCount: number,
  totalArcLength: number,
): Pick<
  PhysicsMetrics,
  'rtEntropy' | 'geodesicCount' | 'centralChargeC' | 'horizonEntropyRatio'
> {
  // AdS3/CFT2 Brown-Henneaux central charge c = 3L / (2G_N)
  const centralCharge = 12.0 + params.entanglementDensity * 24.0;
  // Ryu-Takayanagi: S_A = Area(gamma_A) / (4 G_N hbar)
  const horizonTerm = 4 * Math.PI * params.bulkHorizonRadius * params.bulkHorizonRadius * 18.0;
  const rtEntropy = (totalArcLength * 0.42 + horizonTerm) * (centralCharge / 24.0);
  const ratio = Math.min(99.9, (horizonTerm / Math.max(1, rtEntropy)) * 100);

  return {
    rtEntropy: `${rtEntropy.toFixed(1)} bits`,
    geodesicCount,
    centralChargeC: centralCharge.toFixed(1),
    horizonEntropyRatio: `${ratio.toFixed(1)} %`,
  };
}

/**
 * Procedural Web Audio synthesizer for subtle scientific feedback (zero external audio files).
 */
export class QuantumAudioFeedback {
  private ctx: AudioContext | null = null;
  public enabled = false;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playChime(freqHz: number, durationSec = 0.22, gainPeak = 0.06): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqHz, now);
    osc.frequency.exponentialRampToValueAtTime(freqHz * 1.015, now + durationSec);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freqHz * 1.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + durationSec + 0.02);
    osc2.stop(now + durationSec + 0.02);
  }

  public playBouncePulse(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.45);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.85);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.42);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.92);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.95);
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

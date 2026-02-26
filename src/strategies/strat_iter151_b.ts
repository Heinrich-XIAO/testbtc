import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter151BParams extends StrategyParams {
  dft_lookback: number;
  phase_lookback: number;
  trough_threshold: number;
  min_period: number;
  max_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter151BParams = {
  dft_lookback: 60,
  phase_lookback: 20,
  trough_threshold: 0.15,
  min_period: 8,
  max_period: 40,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 24,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter151BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter151_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter151BStrategy implements Strategy {
  params: StratIter151BParams;
  private priceHistory: Map<string, number[]> = new Map();
  private dominantPeriod: Map<string, number> = new Map();
  private phaseHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter151BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter151BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private computeDFT(data: number[], period: number): { amplitude: number; phase: number } {
    const n = data.length;
    let real = 0;
    let imag = 0;
    const angle = (2 * Math.PI * n) / period;
    
    for (let i = 0; i < n; i++) {
      const angle_i = -angle * i;
      real += data[i] * Math.cos(angle_i);
      imag += data[i] * Math.sin(angle_i);
    }
    
    const amplitude = Math.sqrt(real * real + imag * imag) / n;
    let phase = Math.atan2(imag, real);
    
    return { amplitude, phase };
  }

  private findDominantPeriod(history: number[], minP: number, maxP: number): number {
    const lookback = Math.min(history.length, this.params.dft_lookback);
    const slice = history.slice(-lookback);
    
    if (slice.length < minP) return 20;
    
    let maxAmplitude = 0;
    let bestPeriod = 20;
    
    for (let p = minP; p <= maxP && p <= slice.length / 2; p++) {
      const { amplitude } = this.computeDFT(slice, p);
      if (amplitude > maxAmplitude) {
        maxAmplitude = amplitude;
        bestPeriod = p;
      }
    }
    
    return bestPeriod;
  }

  private computePhaseAtPoint(history: number[], period: number, pointIdx: number): number {
    const lookback = Math.min(pointIdx + 1, this.params.dft_lookback);
    const slice = history.slice(pointIdx - lookback + 1, pointIdx + 1);
    
    if (slice.length < period / 2) return 0;
    
    const { phase } = this.computeDFT(slice, period);
    return phase;
  }

  private normalizePhase(phase: number): number {
    let normalized = phase % (2 * Math.PI);
    if (normalized < 0) normalized += 2 * Math.PI;
    return normalized;
  }

  private isAtTrough(phase: number): boolean {
    const normalized = this.normalizePhase(phase);
    const trough1 = Math.abs(normalized - 0) < this.params.trough_threshold;
    const trough2 = Math.abs(normalized - 2 * Math.PI) < this.params.trough_threshold;
    const trough3 = Math.abs(normalized - Math.PI * 2) < this.params.trough_threshold;
    return trough1 || trough2 || trough3;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.phaseHistory.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const phaseHist = this.phaseHistory.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    if (history.length > 150) history.shift();

    if (history.length >= this.params.min_period * 2) {
      const period = this.findDominantPeriod(history, this.params.min_period, this.params.max_period);
      this.dominantPeriod.set(bar.tokenId, period);

      const phase = this.computePhaseAtPoint(history, period, history.length - 1);
      phaseHist.push(phase);
      if (phaseHist.length > 50) phaseHist.shift();
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);

      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.close <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const period = this.dominantPeriod.get(bar.tokenId);
      
      if (period && phaseHist.length >= 2) {
        const currentPhase = phaseHist[phaseHist.length - 1];
        
        if (this.isAtTrough(currentPhase)) {
          const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
          const size = cash / bar.close;
          if (size > 0 && cash <= ctx.getCapital()) {
            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, bar.close);
              this.entryBar.set(bar.tokenId, barNum);
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

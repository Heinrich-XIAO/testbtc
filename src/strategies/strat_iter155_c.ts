import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
};

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function capPush(values: number[], value: number, max = 500): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function calculateVolumeRatio(volumes: number[], lookback: number): number | null {
  if (volumes.length < lookback + 1) return null;
  const current = volumes[volumes.length - 1];
  const recentAvg = mean(volumes.slice(-lookback));
  if (recentAvg === 0) return null;
  return current / recentAvg;
}

function calculatePriceChange(closes: number[]): number | null {
  if (closes.length < 2) return null;
  const current = closes[closes.length - 1];
  const prior = closes[closes.length - 2];
  return Math.abs((current - prior) / prior);
}

function detectAbsorption(volumes: number[], closes: number[], highs: number[], lows: number[], volLookback: number, threshold: number): boolean {
  if (volumes.length < volLookback + 1 || closes.length < 2) return false;
  
  const volRatio = calculateVolumeRatio(volumes, volLookback);
  const priceChange = calculatePriceChange(closes);
  
  if (volRatio === null || priceChange === null) return false;
  
  const highVolume = volRatio >= threshold;
  const lowMovement = priceChange < 0.02;
  
  return highVolume && lowMovement;
}

export interface StratIter155CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  vol_lookback: number;
  vol_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter155CParams = {
  sr_lookback: 50,
  stoch_k_period: 14,
  stoch_oversold: 18,
  vol_lookback: 20,
  vol_threshold: 2.0,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 20,
  risk_percent: 0.25,
};

export class StratIter155CStrategy implements Strategy {
  params: StratIter155CParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private absorptionDetected: Map<string, boolean> = new Map();

  constructor(params: Partial<StratIter155CParams> = {}) {
    const saved = loadSavedParams<StratIter155CParams>('strat_iter155_c.params.json');
    this.params = { ...defaultParams, ...saved, ...params } as StratIter155CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], volumes: [] });
      this.bars.set(bar.tokenId, 0);
      this.kVals.set(bar.tokenId, []);
      this.absorptionDetected.set(bar.tokenId, false);
    }

    const s = this.series.get(bar.tokenId)!;
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    
    const vol = (bar as any).volume;
    capPush(s.volumes, typeof vol === 'number' && vol > 0 ? vol : 0.001);

    if (s.closes.length >= this.params.stoch_k_period) {
      const k = stochK(s.closes, s.highs, s.lows, this.params.stoch_k_period);
      if (k !== null) {
        const kArr = this.kVals.get(bar.tokenId)!;
        capPush(kArr, k);
      }
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
          this.absorptionDetected.set(bar.tokenId, false);
          return;
        }

        if (bar.close >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          this.absorptionDetected.set(bar.tokenId, false);
          return;
        }

        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          this.absorptionDetected.set(bar.tokenId, false);
          return;
        }
      }
    } else if (!shouldSkipPrice(bar.close)) {
      const absorption = detectAbsorption(
        s.volumes,
        s.closes,
        s.highs,
        s.lows,
        this.params.vol_lookback,
        this.params.vol_threshold
      );

      if (absorption) {
        this.absorptionDetected.set(bar.tokenId, true);
      }

      const hasAbsorption = this.absorptionDetected.get(bar.tokenId) || false;
      
      if (hasAbsorption && s.closes.length >= this.params.stoch_k_period) {
        const kArr = this.kVals.get(bar.tokenId)!;
        
        if (kArr.length >= 2) {
          const prevK = kArr[kArr.length - 2];
          const currK = kArr[kArr.length - 1];
          
          const oversoldCross = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
          
          if (oversoldCross) {
            const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
            
            if (sr) {
              const nearSupport = (bar.close - sr.support) / sr.support < 0.02;
              
              if (nearSupport) {
                const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                  const result = ctx.buy(bar.tokenId, size);
                  if (result.success) {
                    this.entryPrice.set(bar.tokenId, bar.close);
                    this.entryBar.set(bar.tokenId, barNum);
                    this.absorptionDetected.set(bar.tokenId, false);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

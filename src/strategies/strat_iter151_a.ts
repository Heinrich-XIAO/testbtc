import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
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

function haarWaveletDenoise(data: number[], threshold: number): number[] {
  if (data.length < 4) return [...data];
  
  let result = [...data];
  const maxLevel = Math.floor(Math.log2(data.length)) - 1;
  
  for (let level = 0; level < maxLevel; level++) {
    const n = result.length;
    if (n < 4) break;
    
    const approx: number[] = [];
    const detail: number[] = [];
    
    for (let i = 0; i < n - 1; i += 2) {
      approx.push((result[i] + result[i + 1]) / 2);
      detail.push((result[i] - result[i + 1]) / 2);
    }
    
    const thresholdedDetail = detail.map(d => {
      const mag = Math.abs(d);
      if (mag < threshold) return 0;
      return Math.sign(d) * (mag - threshold);
    });
    
    const reconstructed: number[] = [];
    for (let i = 0; i < approx.length; i++) {
      const a = approx[i];
      const d = thresholdedDetail[i] || 0;
      reconstructed.push(a + d / 2);
      reconstructed.push(a - d / 2);
    }
    
    result = reconstructed.slice(0, n);
  }
  
  return result;
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
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

export interface StratIter151AParams extends StrategyParams {
  sr_lookback: number;
  wavelet_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  crossover_lookback: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter151AStrategy implements Strategy {
  params: StratIter151AParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private denoisedCache: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter151AParams> = {}) {
    const saved = loadSavedParams<StratIter151AParams>('strat_iter151_a.params.json');
    this.params = {
      sr_lookback: 50,
      wavelet_threshold: 0.001,
      stoch_k_period: 14,
      stoch_oversold: 18,
      crossover_lookback: 3,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter151AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
      this.kVals.set(bar.tokenId, []);
      this.denoisedCache.set(bar.tokenId, []);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      return true;
    }
    return false;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId)!;
      const ebar = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= entry * (1 - this.params.stop_loss) || bar.high >= entry * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - ebar >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || series.closes.length < 10) return;

    const denoised = haarWaveletDenoise(series.closes, this.params.wavelet_threshold);
    const dc = this.denoisedCache.get(bar.tokenId)!;
    capPush(dc, denoised[denoised.length - 1]);
    
    if (dc.length < this.params.crossover_lookback + 2) return;
    
    const orig = series.closes[series.closes.length - 2];
    const origPrev = series.closes[series.closes.length - 1 - this.params.crossover_lookback];
    const den = denoised[denoised.length - 1];
    const denPrev = dc[dc.length - 1 - this.params.crossover_lookback];
    
    const wasBelow = origPrev < denPrev * 0.995;
    const nowAbove = orig >= den;
    
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    
    if (wasBelow && nowAbove && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

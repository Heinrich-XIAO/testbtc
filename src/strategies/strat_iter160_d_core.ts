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

function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function rollingMean(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function rollingStd(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const m = slice.reduce((s, v) => s + v, 0) / slice.length;
  const v = slice.reduce((s, x) => s + (x - m) * (x - m), 0) / slice.length;
  return Math.sqrt(v);
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

export interface StratIter160DParams extends StrategyParams {
  rsi_period: number;
  rsi_regime_lookback: number;
  rsi_regime_low_threshold: number;
  rsi_regime_high_threshold: number;
  rsi_rising_bars: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter160DStrategy implements Strategy {
  params: StratIter160DParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private rsiVals: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter160DParams> = {}) {
    const defaults: StratIter160DParams = {
      rsi_period: 14,
      rsi_regime_lookback: 40,
      rsi_regime_low_threshold: 0.7,
      rsi_regime_high_threshold: 1.3,
      rsi_rising_bars: 2,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    };
    const saved = loadSavedParams<StratIter160DParams>('strat_iter160_d.params.json');
    this.params = { ...defaults, ...saved, ...params } as StratIter160DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
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

  onComplete(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.rsiVals.has(bar.tokenId)) this.rsiVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const r = rsi(series.closes, this.params.rsi_period);
    if (r !== null) capPush(this.rsiVals.get(bar.tokenId)!, r);
    const rs = this.rsiVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.rsi_regime_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || rs.length < this.params.rsi_regime_lookback + this.params.rsi_rising_bars) return;

    const rsiMean = rollingMean(rs, this.params.rsi_regime_lookback);
    const rsiStd = rollingStd(rs, this.params.rsi_regime_lookback);
    if (rsiMean === null || rsiStd === null || rsiStd === 0) return;

    const normalizedRsi = (rs[rs.length - 1] - rsiMean) / rsiStd;
    const inLowRegime = normalizedRsi < this.params.rsi_regime_low_threshold;
    if (!inLowRegime) return;

    let rsiRising = true;
    for (let i = 1; i <= this.params.rsi_rising_bars; i++) {
      if (rs[rs.length - i] <= rs[rs.length - i - 1]) {
        rsiRising = false;
        break;
      }
    }
    if (!rsiRising) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (nearSupport) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

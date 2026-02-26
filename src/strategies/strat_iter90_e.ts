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

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function normalizePrices(prices: number[]): number[] {
  if (prices.length === 0) return [];
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const std = Math.sqrt(prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length);
  if (std < 1e-10) return prices.map(() => 0);
  return prices.map(p => (p - mean) / std);
}

function crossCorrelation(template: number[], history: number[]): number {
  if (template.length === 0 || history.length < template.length) return 0;
  
  const normTemplate = normalizePrices(template);
  const normHistory = normalizePrices(history.slice(-template.length));
  
  let sum = 0;
  for (let i = 0; i < template.length; i++) {
    sum += normTemplate[i] * normHistory[i];
  }
  
  return sum / template.length;
}

function buildReversalTemplate(length: number): number[] {
  const template: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    template.push(-1 + 2 * t * t);
  }
  return template;
}

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { 
        closes: [], highs: [], lows: []
      });
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

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
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

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter90EParams extends StrategyParams {
  template_length: number;
  correlation_threshold: number;
  stoch_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter90EStrategy extends BaseIterStrategy<StratIter90EParams> {
  private templates: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter90EParams> = {}) {
    super('strat_iter90_e.params.json', {
      template_length: 8,
      correlation_threshold: 0.7,
      stoch_period: 14,
      stoch_oversold: 16,
      stoch_overbought: 84,
      stop_loss: 0.08,
      profit_target: 0.16,
      max_hold_bars: 24,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);

    if (!this.templates.has(bar.tokenId)) {
      this.templates.set(bar.tokenId, buildReversalTemplate(this.params.template_length));
    }
    const template = this.templates.get(bar.tokenId)!;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          barNum - eb >= this.params.max_hold_bars ||
          (k !== null && k > this.params.stoch_overbought)) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || k === null) return;
    if (series.closes.length < this.params.template_length + 10) return;

    const currentWindow = series.closes.slice(-this.params.template_length);
    const historicalWindow = series.closes.slice(-this.params.template_length * 3);
    
    const correlation = crossCorrelation(template, currentWindow);
    const historicalCorrelation = crossCorrelation(template, historicalWindow.slice(-this.params.template_length * 2, -this.params.template_length));
    
    const correlationIncreasing = correlation > historicalCorrelation;
    const highCorrelation = correlation > this.params.correlation_threshold;
    const stochOversold = k < this.params.stoch_oversold;

    if (highCorrelation && correlationIncreasing && stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

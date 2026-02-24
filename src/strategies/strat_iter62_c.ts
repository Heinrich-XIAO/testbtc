import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  symbols: string[];
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

function capPush(values: number[], value: number, max = 1200): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function capPushSymbol(values: string[], value: string, max = 1200): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function symbolFromReturn(ret: number, step: number): string {
  const t = Math.max(0.0005, step);
  if (ret <= -2 * t) return 'A';
  if (ret <= -t) return 'B';
  if (ret < t) return 'C';
  if (ret < 2 * t) return 'D';
  return 'E';
}

function isBullSymbol(symbol: string): boolean {
  return symbol === 'D' || symbol === 'E';
}

function isBearSymbol(symbol: string): boolean {
  return symbol === 'A' || symbol === 'B';
}

export interface StratIter62CParams extends StrategyParams {
  sr_lookback: number;
  motif_lookback: number;
  symbol_step: number;
  support_buffer: number;
  support_hold_buffer: number;
  bullish_lr_threshold: number;
  bearish_dom_threshold: number;
  resistance_exit_buffer: number;
  motif_smoothing: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter62CStrategy implements Strategy {
  params: StratIter62CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter62CParams> = {}) {
    const saved = loadSavedParams<StratIter62CParams>('strat_iter62_c.params.json');
    this.params = {
      sr_lookback: 50,
      motif_lookback: 220,
      symbol_step: 0.0035,
      support_buffer: 0.015,
      support_hold_buffer: 0.005,
      bullish_lr_threshold: 1.22,
      bearish_dom_threshold: 1.18,
      resistance_exit_buffer: 0.985,
      motif_smoothing: 0.8,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter62CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getSeries(tokenId: string): TokenSeries {
    let tokenSeries = this.series.get(tokenId);
    if (tokenSeries) return tokenSeries;

    tokenSeries = { closes: [], highs: [], lows: [], symbols: [] };
    this.series.set(tokenId, tokenSeries);
    this.bars.set(tokenId, 0);
    return tokenSeries;
  }

  private nextBar(bar: Bar): { s: TokenSeries; barNum: number } {
    const s = this.getSeries(bar.tokenId);
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    if (prevClose !== null && prevClose > 0) {
      const ret = (bar.close - prevClose) / prevClose;
      capPushSymbol(s.symbols, symbolFromReturn(ret, this.params.symbol_step));
    }

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { s, barNum };
  }

  private motifLikelihoods(symbols: string[]): { bullish: number; bearish: number; lr: number } | null {
    const need = 24;
    if (symbols.length < need) return null;

    const lookback = Math.max(30, Math.floor(this.params.motif_lookback));
    const hist = symbols.slice(-lookback);
    if (hist.length < need) return null;

    const smooth = Math.max(0.05, this.params.motif_smoothing);
    const alphabetSize = 5;

    const uniCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    const biBase: Record<string, number> = {};
    const biBull: Record<string, number> = {};
    const biBear: Record<string, number> = {};
    const triBase: Record<string, number> = {};
    const triBull: Record<string, number> = {};
    const triBear: Record<string, number> = {};

    for (let i = 0; i < hist.length; i += 1) {
      uniCount[hist[i]] += 1;

      if (i >= 1) {
        const prev = hist[i - 1];
        const cur = hist[i];
        biBase[prev] = (biBase[prev] || 0) + 1;
        if (isBullSymbol(cur)) biBull[prev] = (biBull[prev] || 0) + 1;
        if (isBearSymbol(cur)) biBear[prev] = (biBear[prev] || 0) + 1;
      }

      if (i >= 2) {
        const key = `${hist[i - 2]}${hist[i - 1]}`;
        const cur = hist[i];
        triBase[key] = (triBase[key] || 0) + 1;
        if (isBullSymbol(cur)) triBull[key] = (triBull[key] || 0) + 1;
        if (isBearSymbol(cur)) triBear[key] = (triBear[key] || 0) + 1;
      }
    }

    const last = hist[hist.length - 1];
    const prev2 = hist[hist.length - 2];
    const triKey = `${prev2}${last}`;

    const pUniBull = (uniCount.D + uniCount.E + smooth) / (hist.length + smooth * alphabetSize);
    const pUniBear = (uniCount.A + uniCount.B + smooth) / (hist.length + smooth * alphabetSize);

    const pBiBull = ((biBull[last] || 0) + smooth) / ((biBase[last] || 0) + 2 * smooth);
    const pBiBear = ((biBear[last] || 0) + smooth) / ((biBase[last] || 0) + 2 * smooth);

    const pTriBull = ((triBull[triKey] || 0) + smooth) / ((triBase[triKey] || 0) + 2 * smooth);
    const pTriBear = ((triBear[triKey] || 0) + smooth) / ((triBase[triKey] || 0) + 2 * smooth);

    const bullish = 0.25 * pUniBull + 0.35 * pBiBull + 0.4 * pTriBull;
    const bearish = 0.25 * pUniBear + 0.35 * pBiBear + 0.4 * pTriBear;
    const lr = bullish / Math.max(1e-6, bearish);
    return { bullish, bearish, lr };
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { s, barNum } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
    const motif = this.motifLikelihoods(s.symbols);
    if (!sr || !motif) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportHold = bar.close >= sr.support * (1 - this.params.support_hold_buffer);
    const bullishEntry = motif.lr >= this.params.bullish_lr_threshold;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const bearishDominates = (motif.bearish / Math.max(1e-6, motif.bullish)) >= this.params.bearish_dom_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || bearishDominates) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (nearSupport && supportHold && bullishEntry) {
      this.open(ctx, bar, barNum);
    }
  }
}

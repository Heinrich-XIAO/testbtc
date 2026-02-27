import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter165AParams extends StrategyParams {
  stoch_oversold: number;
  stoch_overbought: number;
  sr_lookback_weeks: number;
  stop_loss: number;
  profit_target: number;
  risk_percent: number;
  max_hold_bars: number;
}

const defaultParams: StratIter165AParams = {
  stoch_oversold: 20,
  stoch_overbought: 80,
  sr_lookback_weeks: 8,
  stop_loss: 0.08,
  profit_target: 0.15,
  risk_percent: 0.25,
  max_hold_bars: 28,
};

function loadSavedParams(): Partial<StratIter165AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter165_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

interface WeeklyCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  weekStart: Date;
  weekEnd: Date;
}

export class StratIter165AStrategy implements Strategy {
  params: StratIter165AParams;
  private dailyBars: Map<string, Bar[]> = new Map();
  private weeklyCandles: Map<string, WeeklyCandle[]> = new Map();
  private currentWeekBars: Map<string, Bar[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter165AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter165AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private getWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    return weekStart.toISOString().split('T')[0];
  }

  private isWeekBoundary(bar: Bar): boolean {
    const date = new Date(bar.timestamp);
    const day = date.getUTCDay();
    const hour = date.getUTCHours();
    return day === 5 || (day === 1 && hour < 4);
  }

  private aggregateWeeklyCandle(bars: Bar[]): WeeklyCandle | null {
    if (bars.length === 0) return null;
    const firstBar = bars[0];
    const lastBar = bars[bars.length - 1];
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);
    
    return {
      open: firstBar.open,
      high: Math.max(...highs),
      low: Math.min(...lows),
      close: lastBar.close,
      timestamp: lastBar.timestamp,
      weekStart: new Date(firstBar.timestamp),
      weekEnd: new Date(lastBar.timestamp),
    };
  }

  private calculateStochasticK(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number | null {
    if (closes.length < period) return null;
    const sliceHighs = highs.slice(-period);
    const sliceLows = lows.slice(-period);
    const highest = Math.max(...sliceHighs);
    const lowest = Math.min(...sliceLows);
    const close = closes[closes.length - 1];
    if (highest === lowest) return 50;
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private calculateSupportResistance(
    weeklyCandles: WeeklyCandle[],
    lookbackWeeks: number
  ): { support: number; resistance: number } | null {
    if (weeklyCandles.length < lookbackWeeks) return null;
    const slice = weeklyCandles.slice(-lookbackWeeks);
    const lows = slice.map(c => c.low);
    const highs = slice.map(c => c.high);
    return {
      support: Math.min(...lows),
      resistance: Math.max(...highs),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const tokenId = bar.tokenId;
    
    if (!this.dailyBars.has(tokenId)) {
      this.dailyBars.set(tokenId, []);
      this.weeklyCandles.set(tokenId, []);
      this.currentWeekBars.set(tokenId, []);
      this.barCount.set(tokenId, 0);
    }

    const dailyBars = this.dailyBars.get(tokenId)!;
    const weeklyCandles = this.weeklyCandles.get(tokenId)!;
    const currentWeekBars = this.currentWeekBars.get(tokenId)!;
    let barNum = (this.barCount.get(tokenId) || 0) + 1;
    this.barCount.set(tokenId, barNum);

    dailyBars.push(bar);
    if (dailyBars.length > 500) dailyBars.shift();

    const currentWeekKey = this.getWeekKey(new Date(bar.timestamp));
    const prevWeekKey = currentWeekBars.length > 0 
      ? this.getWeekKey(new Date(currentWeekBars[0].timestamp)) 
      : null;

    if (prevWeekKey !== null && prevWeekKey !== currentWeekKey) {
      const completedCandle = this.aggregateWeeklyCandle(currentWeekBars);
      if (completedCandle) {
        weeklyCandles.push(completedCandle);
        if (weeklyCandles.length > 52) weeklyCandles.shift();
      }
      currentWeekBars.length = 0;
    }

    currentWeekBars.push(bar);

    const position = ctx.getPosition(tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(tokenId);
      const entryBarNum = this.entryBar.get(tokenId);

      if (entry !== undefined && entryBarNum !== undefined) {
        const sr = this.calculateSupportResistance(weeklyCandles, this.params.sr_lookback_weeks);

        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(tokenId);
          this.entryPrice.delete(tokenId);
          this.entryBar.delete(tokenId);
          return;
        }

        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(tokenId);
          this.entryPrice.delete(tokenId);
          this.entryBar.delete(tokenId);
          return;
        }

        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(tokenId);
          this.entryPrice.delete(tokenId);
          this.entryBar.delete(tokenId);
          return;
        }

        if (sr && bar.high >= sr.resistance) {
          ctx.close(tokenId);
          this.entryPrice.delete(tokenId);
          this.entryBar.delete(tokenId);
          return;
        }

        const stochK = this.calculateStochasticK(
          weeklyCandles.map(c => c.high),
          weeklyCandles.map(c => c.low),
          weeklyCandles.map(c => c.close),
          14
        );

        if (stochK !== null && stochK > this.params.stoch_overbought) {
          ctx.close(tokenId);
          this.entryPrice.delete(tokenId);
          this.entryBar.delete(tokenId);
          return;
        }
      }
    } else {
      if (bar.close <= 0.05 || bar.close >= 0.95) return;
      if (!this.isWeekBoundary(bar)) return;

      const sr = this.calculateSupportResistance(weeklyCandles, this.params.sr_lookback_weeks);
      if (!sr) return;

      if (weeklyCandles.length < 14) return;

      const stochK = this.calculateStochasticK(
        weeklyCandles.map(c => c.high),
        weeklyCandles.map(c => c.low),
        weeklyCandles.map(c => c.close),
        14
      );

      if (stochK === null) return;

      const nearSupport = bar.close <= sr.support * 1.05;
      const oversold = stochK < this.params.stoch_oversold;

      if (oversold && nearSupport) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(tokenId, size);
          if (result.success) {
            this.entryPrice.set(tokenId, bar.close);
            this.entryBar.set(tokenId, barNum);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

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

export interface StratIter90BParams extends StrategyParams {
  stoch_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  min_train_trades: number;
  performance_threshold: number;
}

interface TrainStats {
  trades: number;
  wins: number;
  totalPnl: number;
}

export class StratIter90BStrategy extends BaseIterStrategy<StratIter90BParams> {
  private totalBars: number = 0;
  private splitPoint: number = 0;
  private isTraining: boolean = true;
  private trainStats: TrainStats = { trades: 0, wins: 0, totalPnl: 0 };
  private trainEntryPrice: Map<string, number> = new Map();
  private trainEntryBar: Map<string, number> = new Map();
  private validated: boolean = false;
  private allowTrading: boolean = false;
  private allTimestamps: number[] = [];
  
  constructor(params: Partial<StratIter90BParams> = {}) {
    super('strat_iter90_b.params.json', {
      stoch_period: 14,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      min_train_trades: 5,
      performance_threshold: 0.0,
    }, params);
  }

  onInit(ctx: BacktestContext): void {
    this.totalBars = 0;
    this.splitPoint = 0;
    this.isTraining = true;
    this.trainStats = { trades: 0, wins: 0, totalPnl: 0 };
    this.trainEntryPrice.clear();
    this.trainEntryBar.clear();
    this.validated = false;
    this.allowTrading = false;
    this.allTimestamps = [];
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    
    this.allTimestamps.push(bar.timestamp);
    this.totalBars++;
    
    if (this.totalBars === 1) {
      const history = ctx.data.getHistory(bar.tokenId);
      if (history && history.length > 0) {
        this.splitPoint = Math.floor(history.length / 2);
      }
    }
    
    const tokenId = bar.tokenId;
    const close = bar.close;
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);
    
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.isTraining ? this.trainEntryPrice.get(tokenId)! : this.entryPrice.get(tokenId)!;
      const eb = this.isTraining ? this.trainEntryBar.get(tokenId)! : this.entryBar.get(tokenId)!;
      
      let shouldClose = false;
      let pnl = 0;
      
      if (bar.low <= e * (1 - this.params.stop_loss)) {
        shouldClose = true;
        pnl = -this.params.stop_loss;
      } else if (bar.high >= e * (1 + this.params.profit_target)) {
        shouldClose = true;
        pnl = this.params.profit_target;
      } else if (barNum - eb >= this.params.max_hold_bars) {
        shouldClose = true;
        pnl = (close - e) / e;
      }
      
      if (shouldClose) {
        if (this.isTraining) {
          this.trainStats.trades++;
          if (pnl > 0) this.trainStats.wins++;
          this.trainStats.totalPnl += pnl;
          this.trainEntryPrice.delete(tokenId);
          this.trainEntryBar.delete(tokenId);
        }
        this.close(ctx, tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || k === null) return;
    
    if (this.isTraining) {
      const stochOversold = k < this.params.stoch_oversold;
      
      if (stochOversold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.trainEntryPrice.set(tokenId, bar.close);
          this.trainEntryBar.set(tokenId, barNum);
        }
      }
      
      if (this.totalBars >= this.splitPoint && !this.validated) {
        this.validated = true;
        this.isTraining = false;
        
        const avgPnl = this.trainStats.trades > 0 
          ? this.trainStats.totalPnl / this.trainStats.trades 
          : 0;
        
        if (this.trainStats.trades >= this.params.min_train_trades && 
            avgPnl > this.params.performance_threshold) {
          this.allowTrading = true;
        }
      }
    } else {
      if (!this.allowTrading) return;
      
      const stochOversold = k < this.params.stoch_oversold;
      
      if (stochOversold) {
        this.open(ctx, bar, barNum, this.params.risk_percent);
      }
    }
  }

  onComplete(ctx: BacktestContext): void {
    if (this.trainStats.trades > 0) {
      const avgPnl = this.trainStats.totalPnl / this.trainStats.trades;
      console.log(`[strat_iter90_b] Training stats: trades=${this.trainStats.trades}, winRate=${(this.trainStats.wins/this.trainStats.trades*100).toFixed(1)}%, avgPnl=${(avgPnl*100).toFixed(2)}%, allowTrading=${this.allowTrading}`);
    }
  }
}

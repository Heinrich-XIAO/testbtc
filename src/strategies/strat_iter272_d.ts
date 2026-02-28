import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Grid: 3.0% drop, 15% stop, 45% profit, 25 hold, 50% risk

type TokenSeries = { closes: number[]; highs: number[]; lows: number[]; };

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try { return JSON.parse(fs.readFileSync(paramsPath, 'utf-8')); } catch { return null; }
}

function capPush(values: number[], value: number, max = 500): void { values.push(value); if (values.length > max) values.shift(); }

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();
  protected highestPrice: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) { this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] }); this.bars.set(bar.tokenId, 0); }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close); capPush(s.highs, bar.high); capPush(s.lows, bar.low);
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
      this.highestPrice.set(bar.tokenId, bar.close);
      return true; 
    }
    return false;
  }

  protected close(ctx: BacktestContext, tokenId: string): void { 
    ctx.close(tokenId); 
    this.entryPrice.delete(tokenId); 
    this.entryBar.delete(tokenId);
    this.highestPrice.delete(tokenId);
  }
  
  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter272DParams extends StrategyParams { drop_pct: number; stop_loss: number; profit_target: number; max_hold: number; risk: number; }

export class StratIter272DStrategy extends BaseIterStrategy<StratIter272DParams> {
  constructor(params: Partial<StratIter272DParams> = {}) {
    super('strat_iter272_d.params.json', { drop_pct: 0.03, stop_loss: 0.15, profit_target: 0.45, max_hold: 25, risk: 0.5 }, params);
  }
  
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 3) return;
    
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; 
      const eb = this.entryBar.get(bar.tokenId)!;
      
      // Update highest price for trailing stop
      const hp = this.highestPrice.get(bar.tokenId)!;
      if (bar.high > hp) this.highestPrice.set(bar.tokenId, bar.high);
      const newHp = this.highestPrice.get(bar.tokenId)!;
      
      // Exit conditions
      const stopHit = bar.low <= e * (1 - this.params.stop_loss);
      const profitHit = bar.high >= e * (1 + this.params.profit_target);
      const holdExpired = barNum - eb >= this.params.max_hold;
      
      if (stopHit || profitHit || holdExpired) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    
    // Entry: price drop
    const curr = series.closes[series.closes.length - 1]; 
    const prev = series.closes[series.closes.length - 2];
    const drop = prev - curr; 
    if (drop > 0 && drop / prev > this.params.drop_pct) {
      this.open(ctx, bar, barNum, this.params.risk);
    }
  }
}

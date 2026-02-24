import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter31CParams extends StrategyParams {
  mean_period: number;
  rsi_period: number;
  entry_std_multiplier: number;
  rsi_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  history_limit: number;
}

const defaultParams: StratIter31CParams = {
  mean_period: 20,
  rsi_period: 14,
  entry_std_multiplier: 2,
  rsi_threshold: 30,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  history_limit: 250,
};

function loadSavedParams(): Partial<StratIter31CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter31_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter31CStrategy implements Strategy {
  params: StratIter31CParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private prevClose: Map<string, number | null> = new Map();
  private gainHistory: Map<string, number[]> = new Map();
  private lossHistory: Map<string, number[]> = new Map();
  private avgGain: Map<string, number | null> = new Map();
  private avgLoss: Map<string, number | null> = new Map();
  private currentRsi: Map<string, number | null> = new Map();

  constructor(params: Partial<StratIter31CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter31CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateSMA(history: number[], period: number): number | null {
    if (history.length < period) return null;
    const window = history.slice(-period);
    return window.reduce((sum, value) => sum + value, 0) / period;
  }

  private calculateStdDev(history: number[], period: number, mean: number): number | null {
    if (history.length < period) return null;
    const window = history.slice(-period);
    const variance = window.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period;
    return Math.sqrt(variance);
  }

  private updateRsi(tokenId: string, close: number): void {
    const prev = this.prevClose.get(tokenId);
    if (prev === null || prev === undefined) {
      this.prevClose.set(tokenId, close);
      this.currentRsi.set(tokenId, null);
      return;
    }

    const change = close - prev;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    const gains = this.gainHistory.get(tokenId)!;
    const losses = this.lossHistory.get(tokenId)!;

    gains.push(gain);
    losses.push(loss);
    if (gains.length > this.params.rsi_period) gains.shift();
    if (losses.length > this.params.rsi_period) losses.shift();

    const storedAvgGain = this.avgGain.get(tokenId);
    const storedAvgLoss = this.avgLoss.get(tokenId);

    if ((storedAvgGain === null || storedAvgGain === undefined) && gains.length === this.params.rsi_period) {
      const initialGain = gains.reduce((sum, value) => sum + value, 0) / this.params.rsi_period;
      const initialLoss = losses.reduce((sum, value) => sum + value, 0) / this.params.rsi_period;
      this.avgGain.set(tokenId, initialGain);
      this.avgLoss.set(tokenId, initialLoss);
    } else if (storedAvgGain !== null && storedAvgGain !== undefined && storedAvgLoss !== null && storedAvgLoss !== undefined) {
      const nextAvgGain = (storedAvgGain * (this.params.rsi_period - 1) + gain) / this.params.rsi_period;
      const nextAvgLoss = (storedAvgLoss * (this.params.rsi_period - 1) + loss) / this.params.rsi_period;
      this.avgGain.set(tokenId, nextAvgGain);
      this.avgLoss.set(tokenId, nextAvgLoss);
    }

    const avgGain = this.avgGain.get(tokenId);
    const avgLoss = this.avgLoss.get(tokenId);
    if (avgGain === null || avgGain === undefined || avgLoss === null || avgLoss === undefined) {
      this.currentRsi.set(tokenId, null);
    } else if (avgLoss === 0) {
      this.currentRsi.set(tokenId, avgGain === 0 ? 50 : 100);
    } else {
      const rs = avgGain / avgLoss;
      this.currentRsi.set(tokenId, 100 - 100 / (1 + rs));
    }

    this.prevClose.set(tokenId, close);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.gainHistory.set(bar.tokenId, []);
      this.lossHistory.set(bar.tokenId, []);
      this.avgGain.set(bar.tokenId, null);
      this.avgLoss.set(bar.tokenId, null);
      this.currentRsi.set(bar.tokenId, null);
      this.prevClose.set(bar.tokenId, null);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.history_limit) history.shift();

    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    this.updateRsi(bar.tokenId, bar.close);

    const mean = this.calculateSMA(history, this.params.mean_period);
    const stdDev = mean !== null ? this.calculateStdDev(history, this.params.mean_period, mean) : null;
    const rsi = this.currentRsi.get(bar.tokenId);

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);

      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (mean !== null && bar.close >= mean) {
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
      if (mean !== null && stdDev !== null && stdDev > 0) {
        const priceSignal = bar.close <= mean - this.params.entry_std_multiplier * stdDev;
        const rsiSignal = typeof rsi === 'number' && rsi < this.params.rsi_threshold;

        if (priceSignal && rsiSignal) {
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

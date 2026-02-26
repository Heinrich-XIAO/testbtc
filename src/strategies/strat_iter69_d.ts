import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter69DParams extends StrategyParams {
  simulations: number;
  depth: number;
  exploration_constant: number;
  score_threshold: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter69DParams = {
  simulations: 50,
  depth: 8,
  exploration_constant: 1.414,
  score_threshold: 0.55,
  stoch_oversold: 16,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter69DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter69_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

interface MCTSNode {
  price: number;
  visits: number;
  value: number;
  children: MCTSNode[];
  parent: MCTSNode | null;
}

function simulateTrajectory(currentPrice: number, volatility: number, direction: number, depth: number): number {
  let price = currentPrice;
  for (let i = 0; i < depth; i++) {
    const change = (Math.random() - 0.5 + direction * 0.1) * volatility;
    price *= (1 + change);
  }
  return price;
}

function mctsScore(
  closes: number[],
  currentPrice: number,
  simulations: number,
  depth: number,
  exploration: number
): number {
  if (closes.length < 10) return 0.5;
  
  const recentReturns: number[] = [];
  for (let i = Math.max(0, closes.length - 20); i < closes.length - 1; i++) {
    recentReturns.push((closes[i + 1] - closes[i]) / closes[i]);
  }
  
  if (recentReturns.length < 5) return 0.5;
  
  const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
  const volatility = Math.sqrt(variance);
  
  const root: MCTSNode = {
    price: currentPrice,
    visits: 0,
    value: 0,
    children: [],
    parent: null,
  };
  
  for (let sim = 0; sim < simulations; sim++) {
    let node: MCTSNode = root;
    const direction = mean > 0 ? 1 : -1;
    
    for (let d = 0; d < depth; d++) {
      if (node.children.length === 0) {
        const newPrice = simulateTrajectory(node.price, volatility, direction, 3);
        const child: MCTSNode = {
          price: newPrice,
          visits: 0,
          value: 0,
          children: [],
          parent: node,
        };
        node.children.push(child);
      }
      
      let bestUCT = -Infinity;
      let bestChild = node.children[0];
      
      for (const child of node.children) {
        const uct = child.value / (child.visits + 1) + 
                    exploration * Math.sqrt(Math.log(node.visits + 1) / (child.visits + 1));
        if (uct > bestUCT) {
          bestUCT = uct;
          bestChild = child;
        }
      }
      
      node = bestChild;
    }
    
    const finalReturn = (node.price - currentPrice) / currentPrice;
    let reward = 0;
    if (finalReturn > 0.05) reward = 1;
    else if (finalReturn > 0) reward = 0.6;
    else if (finalReturn > -0.05) reward = 0.3;
    else reward = 0;
    
    let backprop: MCTSNode | null = node;
    while (backprop) {
      backprop.visits++;
      backprop.value += reward;
      backprop = backprop.parent;
    }
  }
  
  let totalValue = 0;
  let totalVisits = 0;
  for (const child of root.children) {
    totalValue += child.value;
    totalVisits += child.visits;
  }
  
  if (totalVisits === 0) return 0.5;
  return (totalValue / totalVisits);
}

function stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period) return null;
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const highest = Math.max(...highSlice);
  const lowest = Math.min(...lowSlice);
  if (highest === lowest) return 50;
  return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
}

function supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function capPush<T>(arr: T[], val: T, max = 500): void {
  arr.push(val);
  if (arr.length > max) arr.shift();
}

export class StratIter69DStrategy implements Strategy {
  params: StratIter69DParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private mctsScores: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter69DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter69DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.mctsScores.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const mctsScores = this.mctsScores.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    if (closes.length > 30) {
      const score = mctsScore(closes, bar.close, this.params.simulations, this.params.depth, this.params.exploration_constant);
      capPush(mctsScores, score);
    }

    const k = stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      capPush(kVals, k);
    }

    const sr = supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

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
        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (kVals.length < 3 || mctsScores.length < 1) return;

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const oversold = currK <= this.params.stoch_oversold;

    const mcts = mctsScores[mctsScores.length - 1];
    const positiveOutlook = mcts > this.params.score_threshold;

    const nearSupport = bar.close <= sr.support * 1.02;

    if (kRising && oversold && positiveOutlook && nearSupport) {
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

  onComplete(_ctx: BacktestContext): void {}
}

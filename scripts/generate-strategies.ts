#!/usr/bin/env bun
/**
 * Strategy Generator
 * 
 * Generates strategy .ts files and .params.json files from templates.
 * Also updates run-optimization.ts with the new strategies.
 * 
 * Usage: bun run scripts/generate-strategies.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const strategiesDir = path.join(process.cwd(), 'src', 'strategies');

interface StrategyRecipe {
  id: number;
  name: string;       // e.g., "ema_cross"
  className: string;  // e.g., "EMACrossStrategy"
  description: string;
  params: { name: string; type: 'number' | 'boolean'; default: number | boolean }[];
  optimizerParams: Record<string, { min: number; max: number; stepSize: number }>;
  // The strategy body will be generated from the template type
  templateType: string;
}

// ============================================================
// STRATEGY TEMPLATES
// Each template generates a complete strategy implementation
// ============================================================

function generateStrategy(recipe: StrategyRecipe): string {
  const fileName = `strat_${recipe.name}_${String(recipe.id).padStart(2, '0')}`;
  const interfaceName = `${recipe.className}Params`;
  
  const paramFields = recipe.params.map(p => {
    return `  ${p.name}: ${p.type === 'boolean' ? 'boolean' : 'number'};`;
  }).join('\n');
  
  const defaultParamValues = recipe.params.map(p => {
    if (p.type === 'boolean') {
      return `  ${p.name}: ${p.default},`;
    }
    return `  ${p.name}: ${p.default},`;
  }).join('\n');

  const booleanParams = recipe.params.filter(p => p.type === 'boolean').map(p => `'${p.name}'`);
  const booleanParamsArray = booleanParams.length > 0 ? `\n    const booleanParams = [${booleanParams.join(', ')}];` : '';
  
  const loadParamBody = booleanParams.length > 0 ? `
    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (booleanParams.includes(key)) {
          if (typeof value === 'number') {
            params[key as keyof ${interfaceName}] = value === 1;
          } else if (typeof value === 'boolean') {
            params[key as keyof ${interfaceName}] = value;
          }
        } else if (typeof value === 'number') {
          params[key as keyof ${interfaceName}] = value;
        }
      }
    }` : `
    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof ${interfaceName}] = value;
        }
      }
    }`;

  // Get strategy body based on template type
  const strategyBody = getStrategyBody(recipe);

  return `import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ${recipe.description}
 */

export interface ${interfaceName} extends StrategyParams {
${paramFields}
}

const defaultParams: ${interfaceName} = {
${defaultParamValues}
};

function loadSavedParams(): Partial<${interfaceName}> | null {
  const paramsPath = path.join(__dirname, '${fileName}.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<${interfaceName}> = {};${booleanParamsArray}
${loadParamBody}

    return params;
  } catch {
    return null;
  }
}

${strategyBody}
`;
}

function getStrategyBody(recipe: StrategyRecipe): string {
  switch (recipe.templateType) {
    case 'ema_cross': return emaTemplate(recipe);
    case 'roc': return rocTemplate(recipe);
    case 'donchian': return donchianTemplate(recipe);
    case 'stochastic': return stochasticTemplate(recipe);
    case 'williams_r': return williamsRTemplate(recipe);
    case 'price_accel': return priceAccelTemplate(recipe);
    case 'vol_breakout': return volBreakoutTemplate(recipe);
    case 'ma_ribbon': return maRibbonTemplate(recipe);
    case 'rsi_divergence': return rsiDivergenceTemplate(recipe);
    case 'mean_revert_rsi': return meanRevertRsiTemplate(recipe);
    case 'adaptive_ma': return adaptiveMaTemplate(recipe);
    case 'triple_ma': return tripleMATemplate(recipe);
    case 'ma_envelope': return maEnvelopeTemplate(recipe);
    case 'price_pattern': return pricePatternTemplate(recipe);
    case 'combo_rsi_bb': return comboRsiBbTemplate(recipe);
    case 'trend_strength': return trendStrengthTemplate(recipe);
    case 'swing': return swingTemplate(recipe);
    case 'reversal': return reversalTemplate(recipe);
    case 'channel_follow': return channelFollowTemplate(recipe);
    case 'mean_cross': return meanCrossTemplate(recipe);
    default: return emaTemplate(recipe);
  }
}

// ---- EMA Crossover Template ----
function emaTemplate(recipe: StrategyRecipe): string {
  return `
class ExponentialMA {
  private period: number;
  private multiplier: number;
  private value: number | undefined;
  private values: number[] = [];
  
  constructor(period: number) {
    this.period = period;
    this.multiplier = 2 / (period + 1);
  }
  
  update(price: number): void {
    if (this.value === undefined) {
      this.values.push(price);
      if (this.values.length >= this.period) {
        this.value = this.values.reduce((a, b) => a + b, 0) / this.period;
      }
    } else {
      this.value = (price - this.value) * this.multiplier + this.value;
    }
  }
  
  get(): number | undefined { return this.value; }
}

export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private fastEMAs: Map<string, ExponentialMA> = new Map();
  private slowEMAs: Map<string, ExponentialMA> = new Map();
  private prevDiff: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };
    let fast = Math.max(2, Math.floor(mergedParams.fast_period));
    let slow = Math.max(3, Math.floor(mergedParams.slow_period));
    if (fast >= slow) [fast, slow] = [slow, fast];
    this.params = { ...mergedParams, fast_period: fast, slow_period: slow };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.fastEMAs.has(bar.tokenId)) {
      this.fastEMAs.set(bar.tokenId, new ExponentialMA(this.params.fast_period));
      this.slowEMAs.set(bar.tokenId, new ExponentialMA(this.params.slow_period));
    }
    const fastEMA = this.fastEMAs.get(bar.tokenId)!;
    const slowEMA = this.slowEMAs.get(bar.tokenId)!;
    fastEMA.update(bar.close);
    slowEMA.update(bar.close);

    const fastVal = fastEMA.get();
    const slowVal = slowEMA.get();
    if (fastVal === undefined || slowVal === undefined) return;

    const diff = fastVal - slowVal;
    const prev = this.prevDiff.get(bar.tokenId);
    this.prevDiff.set(bar.tokenId, diff);

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry !== undefined) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (prev !== undefined && prev >= 0 && diff < 0) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (prev !== undefined && prev <= 0 && diff > 0) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Rate of Change Template ----
function rocTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();
  private barsHeld: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.lookback = Math.max(2, Math.floor(this.params.lookback));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.lookback + 2) history.shift();

    if (history.length <= this.params.lookback) return;

    const roc = (bar.close - history[history.length - 1 - this.params.lookback]) / history[history.length - 1 - this.params.lookback];
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const held = (this.barsHeld.get(bar.tokenId) ?? 0) + 1;
      this.barsHeld.set(bar.tokenId, held);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          this.barsHeld.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (held >= this.params.min_hold && roc < -this.params.exit_threshold) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          this.barsHeld.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (roc >= this.params.entry_threshold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
            this.barsHeld.set(bar.tokenId, 0);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Donchian Channel Template ----
function donchianTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.channel_period = Math.max(3, Math.floor(this.params.channel_period));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.channel_period + 1) history.shift();

    if (history.length < this.params.channel_period) return;

    const lookback = history.slice(0, -1);
    const channelHigh = Math.max(...lookback);
    const channelLow = Math.min(...lookback);
    const channelMid = (channelHigh + channelLow) / 2;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        // Exit at mid-channel for mean reversion, or at low for trend following
        if (bar.close <= channelMid && this.params.exit_at_mid > 0.5) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (bar.close > channelHigh) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Stochastic Oscillator Template ----
function stochasticTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.k_period = Math.max(3, Math.floor(this.params.k_period));
    this.params.d_period = Math.max(2, Math.floor(this.params.d_period));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
    }
    const history = this.priceHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.k_period) history.shift();

    if (history.length < this.params.k_period) return;

    const highest = Math.max(...history);
    const lowest = Math.min(...history);
    const k = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
    kVals.push(k);
    if (kVals.length > this.params.d_period) kVals.shift();

    if (kVals.length < this.params.d_period) return;

    const d = kVals.reduce((a, b) => a + b, 0) / kVals.length;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (k >= this.params.overbought && k < d) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (k <= this.params.oversold && k > d) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Williams %R Template ----
function williamsRTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.period = Math.max(3, Math.floor(this.params.period));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.period) history.shift();

    if (history.length < this.params.period) return;

    const highest = Math.max(...history);
    const lowest = Math.min(...history);
    const wr = highest === lowest ? -50 : ((highest - bar.close) / (highest - lowest)) * -100;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const high = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, high);
        if (bar.close < high * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (wr >= this.params.overbought_level) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (wr <= this.params.oversold_level) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Price Acceleration Template ----
function priceAccelTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.lookback = Math.max(3, Math.floor(this.params.lookback));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.lookback + 2) history.shift();

    if (history.length < this.params.lookback + 1) return;

    // Compute velocity (first derivative) and acceleration (second derivative)
    const n = history.length;
    const vel1 = history[n - 1] - history[n - 2];
    const vel0 = history[n - 2] - history[n - 3];
    const accel = vel1 - vel0;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (accel < -this.params.exit_threshold && vel1 < 0) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (accel > this.params.entry_threshold && vel1 > 0) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Volatility Breakout Template ----
function volBreakoutTemplate(recipe: StrategyRecipe): string {
  return `
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private volHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.vol_period = Math.max(3, Math.floor(this.params.vol_period));
    this.params.lookback = Math.max(3, Math.floor(this.params.lookback));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.volHistory.set(bar.tokenId, []);
    }
    const history = this.priceHistory.get(bar.tokenId)!;
    const volHist = this.volHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > Math.max(this.params.vol_period, this.params.lookback) + 2) history.shift();

    if (history.length < this.params.vol_period) return;

    const currentVol = stddev(history.slice(-this.params.vol_period));
    volHist.push(currentVol);
    if (volHist.length > this.params.lookback) volHist.shift();

    if (volHist.length < this.params.lookback) return;

    const avgVol = volHist.reduce((a, b) => a + b, 0) / volHist.length;
    const isContraction = currentVol < avgVol * this.params.contraction_ratio;
    const priceChange = history.length >= 2 ? (bar.close - history[history.length - 2]) / history[history.length - 2] : 0;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Buy on breakout after volatility contraction
      if (isContraction && priceChange > this.params.breakout_threshold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- MA Ribbon Template ----
function maRibbonTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private maArrays: Map<string, SimpleMovingAverage[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  private getMAs(tokenId: string): SimpleMovingAverage[] {
    if (!this.maArrays.has(tokenId)) {
      const periods = [];
      const base = Math.max(3, Math.floor(this.params.shortest_period));
      const step = Math.max(1, Math.floor(this.params.period_step));
      const count = Math.max(3, Math.floor(this.params.num_mas));
      for (let i = 0; i < count; i++) {
        periods.push(base + i * step);
      }
      this.maArrays.set(tokenId, periods.map(p => new SimpleMovingAverage(p)));
    }
    return this.maArrays.get(tokenId)!;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    const mas = this.getMAs(bar.tokenId);
    for (const ma of mas) ma.update(bar.close);

    const values = mas.map(ma => ma.get(0)).filter((v): v is number => v !== undefined);
    if (values.length < mas.length) return;

    // Check if MAs are aligned (all in order = strong trend)
    let bullishAligned = true;
    let bearishAligned = true;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] <= values[i]) bullishAligned = false;
      if (values[i - 1] >= values[i]) bearishAligned = false;
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (bearishAligned || bar.close < values[values.length - 1]) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (bullishAligned && bar.close > values[0]) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- RSI Divergence Template ----
function rsiDivergenceTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private rsiMap: Map<string, RSI> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private rsiHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.rsi_period = Math.max(3, Math.floor(this.params.rsi_period));
    this.params.divergence_lookback = Math.max(3, Math.floor(this.params.divergence_lookback));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.rsiMap.has(bar.tokenId)) {
      this.rsiMap.set(bar.tokenId, new RSI(this.params.rsi_period));
      this.priceHistory.set(bar.tokenId, []);
      this.rsiHistory.set(bar.tokenId, []);
    }
    const rsi = this.rsiMap.get(bar.tokenId)!;
    rsi.update(bar.close);
    const rsiVal = rsi.get(0);
    if (rsiVal === undefined) return;

    const prices = this.priceHistory.get(bar.tokenId)!;
    const rsis = this.rsiHistory.get(bar.tokenId)!;
    prices.push(bar.close);
    rsis.push(rsiVal);
    if (prices.length > this.params.divergence_lookback) {
      prices.shift();
      rsis.shift();
    }

    if (prices.length < this.params.divergence_lookback) return;

    // Bullish divergence: price makes lower low but RSI makes higher low
    const priceLow = Math.min(...prices.slice(0, -1));
    const rsiLow = Math.min(...rsis.slice(0, -1));
    const bullishDiv = bar.close <= priceLow && rsiVal > rsiLow && rsiVal < this.params.oversold;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (rsiVal >= this.params.overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (bullishDiv) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Mean Revert + RSI Combo Template ----
function meanRevertRsiTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private rsiMap: Map<string, RSI> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(Math.max(3, Math.floor(this.params.ma_period))));
      this.rsiMap.set(bar.tokenId, new RSI(Math.max(3, Math.floor(this.params.rsi_period))));
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    const rsi = this.rsiMap.get(bar.tokenId)!;
    sma.update(bar.close);
    rsi.update(bar.close);

    const maVal = sma.get(0);
    const rsiVal = rsi.get(0);
    if (maVal === undefined || rsiVal === undefined) return;

    const deviation = (maVal - bar.close) / maVal;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= maVal || rsiVal >= this.params.rsi_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (deviation >= this.params.deviation_threshold && rsiVal <= this.params.rsi_oversold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Adaptive MA Template ----
function adaptiveMaTemplate(recipe: StrategyRecipe): string {
  return `
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private adaptiveMA: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const maxLen = Math.max(Math.floor(this.params.max_period), 20);
    if (history.length > maxLen + 2) history.shift();

    if (history.length < Math.floor(this.params.min_period) + 2) return;

    // Adaptive period: use shorter MA in high vol, longer in low vol
    const vol = stddev(history.slice(-Math.min(history.length, 10)));
    const avgPrice = history.reduce((a, b) => a + b, 0) / history.length;
    const relVol = avgPrice > 0 ? vol / avgPrice : 0;
    
    // Map volatility to period: high vol = short period, low vol = long period
    const volScale = Math.min(1, relVol * this.params.vol_sensitivity);
    const period = Math.max(
      Math.floor(this.params.min_period),
      Math.floor(this.params.max_period - (this.params.max_period - this.params.min_period) * volScale)
    );

    const slice = history.slice(-Math.min(history.length, period));
    const maVal = slice.reduce((a, b) => a + b, 0) / slice.length;
    const prevMA = this.adaptiveMA.get(bar.tokenId);
    this.adaptiveMA.set(bar.tokenId, maVal);

    if (prevMA === undefined) return;

    const position = ctx.getPosition(bar.tokenId);
    const crossUp = bar.close > maVal && history[history.length - 2] <= prevMA;
    const crossDown = bar.close < maVal && history[history.length - 2] >= prevMA;

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (crossDown) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (crossUp) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Triple MA Template ----
function tripleMATemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private fastMAs: Map<string, SimpleMovingAverage> = new Map();
  private midMAs: Map<string, SimpleMovingAverage> = new Map();
  private slowMAs: Map<string, SimpleMovingAverage> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    const sorted = [this.params.fast_period, this.params.mid_period, this.params.slow_period].sort((a, b) => a - b);
    this.params.fast_period = Math.max(2, Math.floor(sorted[0]));
    this.params.mid_period = Math.max(3, Math.floor(sorted[1]));
    this.params.slow_period = Math.max(4, Math.floor(sorted[2]));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.fastMAs.has(bar.tokenId)) {
      this.fastMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.fast_period));
      this.midMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.mid_period));
      this.slowMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.slow_period));
    }
    const fast = this.fastMAs.get(bar.tokenId)!;
    const mid = this.midMAs.get(bar.tokenId)!;
    const slow = this.slowMAs.get(bar.tokenId)!;
    fast.update(bar.close);
    mid.update(bar.close);
    slow.update(bar.close);

    const fv = fast.get(0), mv = mid.get(0), sv = slow.get(0);
    if (fv === undefined || mv === undefined || sv === undefined) return;

    const bullish = fv > mv && mv > sv;
    const bearish = fv < mv && mv < sv;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (bearish) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (bullish) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- MA Envelope Template ----
function maEnvelopeTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(Math.max(3, Math.floor(this.params.ma_period))));
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    sma.update(bar.close);
    const maVal = sma.get(0);
    if (maVal === undefined) return;

    const upperEnv = maVal * (1 + this.params.envelope_pct);
    const lowerEnv = maVal * (1 - this.params.envelope_pct);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= upperEnv || bar.close >= maVal) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (bar.close <= lowerEnv) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Price Pattern (consecutive bars) Template ----
function pricePatternTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const required = Math.max(3, Math.floor(this.params.consec_bars)) + 1;
    if (history.length > required + 2) history.shift();

    if (history.length < required) return;

    // Count consecutive up or down bars
    let consecUp = 0, consecDown = 0;
    for (let i = history.length - 1; i > 0; i--) {
      if (history[i] > history[i - 1]) {
        if (consecDown > 0) break;
        consecUp++;
      } else if (history[i] < history[i - 1]) {
        if (consecUp > 0) break;
        consecDown++;
      } else break;
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (consecDown >= Math.floor(this.params.exit_bars)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Buy after consecutive down bars (reversal bet) or consecutive up bars (momentum)
      const buySignal = this.params.buy_on_dip > 0.5 
        ? consecDown >= Math.floor(this.params.consec_bars)
        : consecUp >= Math.floor(this.params.consec_bars);
      if (buySignal) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Combo RSI + Bollinger Template ----
function comboRsiBbTemplate(recipe: StrategyRecipe): string {
  return `
class StdDev {
  private prices: number[] = [];
  private period: number;
  constructor(period: number) { this.period = period; }
  update(price: number): void {
    this.prices.push(price);
    if (this.prices.length > this.period) this.prices.shift();
  }
  get(): number | undefined {
    if (this.prices.length < this.period) return undefined;
    const mean = this.prices.reduce((a, b) => a + b, 0) / this.prices.length;
    return Math.sqrt(this.prices.reduce((s, p) => s + (p - mean) ** 2, 0) / this.prices.length);
  }
}

export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private stdMap: Map<string, StdDev> = new Map();
  private rsiMap: Map<string, RSI> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    const period = Math.max(3, Math.floor(this.params.bb_period));
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(period));
      this.stdMap.set(bar.tokenId, new StdDev(period));
      this.rsiMap.set(bar.tokenId, new RSI(Math.max(3, Math.floor(this.params.rsi_period))));
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    const std = this.stdMap.get(bar.tokenId)!;
    const rsi = this.rsiMap.get(bar.tokenId)!;
    sma.update(bar.close);
    std.update(bar.close);
    rsi.update(bar.close);

    const maVal = sma.get(0);
    const stdVal = std.get();
    const rsiVal = rsi.get(0);
    if (maVal === undefined || stdVal === undefined || rsiVal === undefined) return;

    const lowerBand = maVal - this.params.std_mult * stdVal;
    const upperBand = maVal + this.params.std_mult * stdVal;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= upperBand || rsiVal >= this.params.rsi_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (bar.close <= lowerBand && rsiVal <= this.params.rsi_oversold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Trend Strength Template ----
function trendStrengthTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  private trendStrength(history: number[]): number {
    // Percentage of bars that were positive
    let ups = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i] > history[i - 1]) ups++;
    }
    return ups / (history.length - 1);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const period = Math.max(3, Math.floor(this.params.lookback));
    if (history.length > period + 2) history.shift();

    if (history.length < period) return;

    const strength = this.trendStrength(history);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (strength < this.params.exit_strength) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (strength >= this.params.entry_strength) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Swing Trading Template ----
function swingTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  private findSwingLow(history: number[], window: number): boolean {
    if (history.length < window * 2 + 1) return false;
    const idx = history.length - 1 - window;
    const val = history[idx];
    for (let i = idx - window; i <= idx + window; i++) {
      if (i !== idx && history[i] <= val) return false;
    }
    return true;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const window = Math.max(2, Math.floor(this.params.swing_window));
    if (history.length > window * 3 + 2) history.shift();

    const isSwingLow = this.findSwingLow(history, window);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= entry * (1 + this.params.take_profit)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (isSwingLow) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Reversal Template ----
function reversalTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const lookback = Math.max(3, Math.floor(this.params.lookback));
    if (history.length > lookback + 2) history.shift();

    if (history.length < lookback) return;

    // Check for reversal: price dropped significantly then bounced
    const recentMin = Math.min(...history.slice(0, -1));
    const dropFromStart = (history[0] - recentMin) / history[0];
    const bounceFromMin = recentMin > 0 ? (bar.close - recentMin) / recentMin : 0;
    
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= entry * (1 + this.params.take_profit)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (dropFromStart >= this.params.drop_threshold && bounceFromMin >= this.params.bounce_threshold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Channel Follow Template ----
function channelFollowTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    const period = Math.max(3, Math.floor(this.params.channel_period));
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(period));
      this.priceHistory.set(bar.tokenId, []);
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    const history = this.priceHistory.get(bar.tokenId)!;
    sma.update(bar.close);
    history.push(bar.close);
    if (history.length > period) history.shift();

    const maVal = sma.get(0);
    if (maVal === undefined || history.length < period) return;

    // Channel = MA +/- channel_width * price_range
    const high = Math.max(...history);
    const low = Math.min(...history);
    const range = high - low;
    const upperChannel = maVal + range * this.params.channel_width;
    const lowerChannel = maVal - range * this.params.channel_width;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= upperChannel) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (bar.close <= lowerChannel) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ---- Mean Cross Template (price crosses MA) ----
function meanCrossTemplate(recipe: StrategyRecipe): string {
  return `
export class ${recipe.className} implements Strategy {
  params: ${recipe.className}Params;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private prevPrice: Map<string, number> = new Map();
  private prevMA: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<${recipe.className}Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(Math.max(3, Math.floor(this.params.ma_period))));
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    sma.update(bar.close);
    const maVal = sma.get(0);
    if (maVal === undefined) {
      this.prevPrice.set(bar.tokenId, bar.close);
      return;
    }

    const pp = this.prevPrice.get(bar.tokenId);
    const pm = this.prevMA.get(bar.tokenId);
    this.prevPrice.set(bar.tokenId, bar.close);
    this.prevMA.set(bar.tokenId, maVal);
    if (pp === undefined || pm === undefined) return;

    const crossUp = pp <= pm && bar.close > maVal;
    const crossDown = pp >= pm && bar.close < maVal;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (crossDown) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (crossUp) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
`;
}

// ============================================================
// STRATEGY RECIPES - Define all 200 strategies here
// ============================================================

const recipes: StrategyRecipe[] = [];

function addRecipe(
  id: number, name: string, className: string, description: string,
  templateType: string,
  params: { name: string; type: 'number' | 'boolean'; default: number | boolean }[],
  optimizerParams: Record<string, { min: number; max: number; stepSize: number }>
) {
  recipes.push({ id, name, className, description, templateType, params, optimizerParams });
}

// --- Batch 1: EMA Crossover Variants (11-15) ---
addRecipe(11, 'ema_fast', 'EMAFastCrossStrategy', 'Fast EMA crossover with tight stops', 'ema_cross',
  [{ name: 'fast_period', type: 'number', default: 3 }, { name: 'slow_period', type: 'number', default: 8 },
   { name: 'stop_loss', type: 'number', default: 0.04 }, { name: 'trailing_stop', type: 'number', default: 0.03 },
   { name: 'risk_percent', type: 'number', default: 0.10 }],
  { fast_period: { min: 2, max: 5, stepSize: 1 }, slow_period: { min: 6, max: 15, stepSize: 1 },
    stop_loss: { min: 0.02, max: 0.08, stepSize: 0.01 }, trailing_stop: { min: 0.02, max: 0.06, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(12, 'ema_med', 'EMAMedCrossStrategy', 'Medium EMA crossover with balanced risk', 'ema_cross',
  [{ name: 'fast_period', type: 'number', default: 5 }, { name: 'slow_period', type: 'number', default: 15 },
   { name: 'stop_loss', type: 'number', default: 0.05 }, { name: 'trailing_stop', type: 'number', default: 0.04 },
   { name: 'risk_percent', type: 'number', default: 0.15 }],
  { fast_period: { min: 3, max: 8, stepSize: 1 }, slow_period: { min: 10, max: 25, stepSize: 2 },
    stop_loss: { min: 0.03, max: 0.10, stepSize: 0.01 }, trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

addRecipe(13, 'ema_slow', 'EMASlowCrossStrategy', 'Slow EMA crossover for longer trends', 'ema_cross',
  [{ name: 'fast_period', type: 'number', default: 8 }, { name: 'slow_period', type: 'number', default: 20 },
   { name: 'stop_loss', type: 'number', default: 0.06 }, { name: 'trailing_stop', type: 'number', default: 0.05 },
   { name: 'risk_percent', type: 'number', default: 0.12 }],
  { fast_period: { min: 5, max: 12, stepSize: 1 }, slow_period: { min: 15, max: 35, stepSize: 2 },
    stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 }, trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(14, 'ema_tight', 'EMATightStopStrategy', 'EMA cross with very tight trailing stop', 'ema_cross',
  [{ name: 'fast_period', type: 'number', default: 4 }, { name: 'slow_period', type: 'number', default: 10 },
   { name: 'stop_loss', type: 'number', default: 0.03 }, { name: 'trailing_stop', type: 'number', default: 0.02 },
   { name: 'risk_percent', type: 'number', default: 0.08 }],
  { fast_period: { min: 2, max: 6, stepSize: 1 }, slow_period: { min: 8, max: 18, stepSize: 1 },
    stop_loss: { min: 0.01, max: 0.05, stepSize: 0.005 }, trailing_stop: { min: 0.01, max: 0.04, stepSize: 0.005 },
    risk_percent: { min: 0.05, max: 0.20, stepSize: 0.05 } });

addRecipe(15, 'ema_wide', 'EMAWideStopStrategy', 'EMA cross with wide stops for volatile markets', 'ema_cross',
  [{ name: 'fast_period', type: 'number', default: 5 }, { name: 'slow_period', type: 'number', default: 12 },
   { name: 'stop_loss', type: 'number', default: 0.10 }, { name: 'trailing_stop', type: 'number', default: 0.08 },
   { name: 'risk_percent', type: 'number', default: 0.20 }],
  { fast_period: { min: 3, max: 8, stepSize: 1 }, slow_period: { min: 8, max: 20, stepSize: 2 },
    stop_loss: { min: 0.06, max: 0.15, stepSize: 0.01 }, trailing_stop: { min: 0.04, max: 0.12, stepSize: 0.01 },
    risk_percent: { min: 0.10, max: 0.40, stepSize: 0.05 } });

// --- Batch 2: Rate of Change Variants (16-20) ---
addRecipe(16, 'roc_fast', 'ROCFastStrategy', 'Fast rate of change momentum', 'roc',
  [{ name: 'lookback', type: 'number', default: 3 }, { name: 'entry_threshold', type: 'number', default: 0.03 },
   { name: 'exit_threshold', type: 'number', default: 0.02 }, { name: 'min_hold', type: 'number', default: 2 },
   { name: 'stop_loss', type: 'number', default: 0.05 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { lookback: { min: 2, max: 5, stepSize: 1 }, entry_threshold: { min: 0.01, max: 0.08, stepSize: 0.01 },
    exit_threshold: { min: 0.01, max: 0.06, stepSize: 0.01 }, min_hold: { min: 1, max: 5, stepSize: 1 },
    stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(17, 'roc_slow', 'ROCSlowStrategy', 'Slow rate of change for trend detection', 'roc',
  [{ name: 'lookback', type: 'number', default: 8 }, { name: 'entry_threshold', type: 'number', default: 0.05 },
   { name: 'exit_threshold', type: 'number', default: 0.03 }, { name: 'min_hold', type: 'number', default: 3 },
   { name: 'stop_loss', type: 'number', default: 0.08 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { lookback: { min: 5, max: 15, stepSize: 1 }, entry_threshold: { min: 0.02, max: 0.10, stepSize: 0.01 },
    exit_threshold: { min: 0.01, max: 0.08, stepSize: 0.01 }, min_hold: { min: 2, max: 8, stepSize: 1 },
    stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 3: Donchian Channel (18-19) ---
addRecipe(18, 'donchian_short', 'DonchianShortStrategy', 'Short Donchian channel breakout', 'donchian',
  [{ name: 'channel_period', type: 'number', default: 8 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'exit_at_mid', type: 'number', default: 0 },
   { name: 'risk_percent', type: 'number', default: 0.10 }],
  { channel_period: { min: 5, max: 15, stepSize: 1 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, exit_at_mid: { min: 0, max: 1, stepSize: 1 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(19, 'donchian_long', 'DonchianLongStrategy', 'Long Donchian channel breakout', 'donchian',
  [{ name: 'channel_period', type: 'number', default: 15 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'trailing_stop', type: 'number', default: 0.06 }, { name: 'exit_at_mid', type: 'number', default: 1 },
   { name: 'risk_percent', type: 'number', default: 0.15 }],
  { channel_period: { min: 10, max: 25, stepSize: 2 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 }, exit_at_mid: { min: 0, max: 1, stepSize: 1 },
    risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 4: Stochastic (20-21) ---
addRecipe(20, 'stoch_fast', 'StochFastStrategy', 'Fast stochastic oscillator', 'stochastic',
  [{ name: 'k_period', type: 'number', default: 5 }, { name: 'd_period', type: 'number', default: 3 },
   { name: 'oversold', type: 'number', default: 20 }, { name: 'overbought', type: 'number', default: 80 },
   { name: 'stop_loss', type: 'number', default: 0.05 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { k_period: { min: 3, max: 8, stepSize: 1 }, d_period: { min: 2, max: 5, stepSize: 1 },
    oversold: { min: 10, max: 30, stepSize: 5 }, overbought: { min: 70, max: 90, stepSize: 5 },
    stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(21, 'stoch_slow', 'StochSlowStrategy', 'Slow stochastic oscillator', 'stochastic',
  [{ name: 'k_period', type: 'number', default: 10 }, { name: 'd_period', type: 'number', default: 5 },
   { name: 'oversold', type: 'number', default: 25 }, { name: 'overbought', type: 'number', default: 75 },
   { name: 'stop_loss', type: 'number', default: 0.08 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { k_period: { min: 8, max: 15, stepSize: 1 }, d_period: { min: 3, max: 8, stepSize: 1 },
    oversold: { min: 15, max: 35, stepSize: 5 }, overbought: { min: 65, max: 85, stepSize: 5 },
    stop_loss: { min: 0.04, max: 0.12, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 5: Williams %R (22-23) ---
addRecipe(22, 'willr_short', 'WillRShortStrategy', 'Short-period Williams %R', 'williams_r',
  [{ name: 'period', type: 'number', default: 7 }, { name: 'oversold_level', type: 'number', default: -80 },
   { name: 'overbought_level', type: 'number', default: -20 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { period: { min: 5, max: 12, stepSize: 1 }, oversold_level: { min: -95, max: -70, stepSize: 5 },
    overbought_level: { min: -30, max: -5, stepSize: 5 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(23, 'willr_long', 'WillRLongStrategy', 'Long-period Williams %R', 'williams_r',
  [{ name: 'period', type: 'number', default: 14 }, { name: 'oversold_level', type: 'number', default: -85 },
   { name: 'overbought_level', type: 'number', default: -15 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'trailing_stop', type: 'number', default: 0.06 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { period: { min: 10, max: 20, stepSize: 1 }, oversold_level: { min: -95, max: -75, stepSize: 5 },
    overbought_level: { min: -25, max: -5, stepSize: 5 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 6: Price Acceleration (24-25) ---
addRecipe(24, 'accel_fast', 'AccelFastStrategy', 'Fast price acceleration detector', 'price_accel',
  [{ name: 'lookback', type: 'number', default: 4 }, { name: 'entry_threshold', type: 'number', default: 0.005 },
   { name: 'exit_threshold', type: 'number', default: 0.003 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { lookback: { min: 3, max: 6, stepSize: 1 }, entry_threshold: { min: 0.001, max: 0.015, stepSize: 0.002 },
    exit_threshold: { min: 0.001, max: 0.010, stepSize: 0.001 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(25, 'accel_slow', 'AccelSlowStrategy', 'Slow price acceleration for trend shifts', 'price_accel',
  [{ name: 'lookback', type: 'number', default: 8 }, { name: 'entry_threshold', type: 'number', default: 0.003 },
   { name: 'exit_threshold', type: 'number', default: 0.002 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'trailing_stop', type: 'number', default: 0.06 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { lookback: { min: 5, max: 12, stepSize: 1 }, entry_threshold: { min: 0.001, max: 0.010, stepSize: 0.001 },
    exit_threshold: { min: 0.001, max: 0.008, stepSize: 0.001 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 7: Volatility Breakout (26-27) ---
addRecipe(26, 'vbreak_tight', 'VolBreakTightStrategy', 'Volatility breakout with tight contraction', 'vol_breakout',
  [{ name: 'vol_period', type: 'number', default: 8 }, { name: 'lookback', type: 'number', default: 12 },
   { name: 'contraction_ratio', type: 'number', default: 0.5 }, { name: 'breakout_threshold', type: 'number', default: 0.02 },
   { name: 'stop_loss', type: 'number', default: 0.05 }, { name: 'trailing_stop', type: 'number', default: 0.04 },
   { name: 'risk_percent', type: 'number', default: 0.10 }],
  { vol_period: { min: 5, max: 12, stepSize: 1 }, lookback: { min: 8, max: 20, stepSize: 2 },
    contraction_ratio: { min: 0.3, max: 0.7, stepSize: 0.1 }, breakout_threshold: { min: 0.01, max: 0.05, stepSize: 0.005 },
    stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 }, trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(27, 'vbreak_wide', 'VolBreakWideStrategy', 'Volatility breakout with wide parameters', 'vol_breakout',
  [{ name: 'vol_period', type: 'number', default: 12 }, { name: 'lookback', type: 'number', default: 18 },
   { name: 'contraction_ratio', type: 'number', default: 0.6 }, { name: 'breakout_threshold', type: 'number', default: 0.03 },
   { name: 'stop_loss', type: 'number', default: 0.08 }, { name: 'trailing_stop', type: 'number', default: 0.06 },
   { name: 'risk_percent', type: 'number', default: 0.15 }],
  { vol_period: { min: 8, max: 18, stepSize: 2 }, lookback: { min: 12, max: 25, stepSize: 2 },
    contraction_ratio: { min: 0.4, max: 0.8, stepSize: 0.1 }, breakout_threshold: { min: 0.015, max: 0.06, stepSize: 0.005 },
    stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 }, trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 8: MA Ribbon (28-29) ---
addRecipe(28, 'ribbon_tight', 'RibbonTightStrategy', 'Tight MA ribbon for trend detection', 'ma_ribbon',
  [{ name: 'shortest_period', type: 'number', default: 3 }, { name: 'period_step', type: 'number', default: 2 },
   { name: 'num_mas', type: 'number', default: 4 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { shortest_period: { min: 2, max: 5, stepSize: 1 }, period_step: { min: 1, max: 4, stepSize: 1 },
    num_mas: { min: 3, max: 6, stepSize: 1 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(29, 'ribbon_wide', 'RibbonWideStrategy', 'Wide MA ribbon for strong trends', 'ma_ribbon',
  [{ name: 'shortest_period', type: 'number', default: 5 }, { name: 'period_step', type: 'number', default: 4 },
   { name: 'num_mas', type: 'number', default: 5 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'trailing_stop', type: 'number', default: 0.06 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { shortest_period: { min: 3, max: 8, stepSize: 1 }, period_step: { min: 2, max: 6, stepSize: 1 },
    num_mas: { min: 3, max: 7, stepSize: 1 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 9: RSI Divergence (30-31) ---
addRecipe(30, 'rsi_div_fast', 'RSIDivFastStrategy', 'Fast RSI divergence detector', 'rsi_divergence',
  [{ name: 'rsi_period', type: 'number', default: 5 }, { name: 'divergence_lookback', type: 'number', default: 6 },
   { name: 'oversold', type: 'number', default: 30 }, { name: 'overbought', type: 'number', default: 70 },
   { name: 'stop_loss', type: 'number', default: 0.05 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { rsi_period: { min: 3, max: 8, stepSize: 1 }, divergence_lookback: { min: 4, max: 10, stepSize: 1 },
    oversold: { min: 20, max: 40, stepSize: 5 }, overbought: { min: 60, max: 80, stepSize: 5 },
    stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(31, 'rsi_div_slow', 'RSIDivSlowStrategy', 'Slow RSI divergence for longer trends', 'rsi_divergence',
  [{ name: 'rsi_period', type: 'number', default: 8 }, { name: 'divergence_lookback', type: 'number', default: 10 },
   { name: 'oversold', type: 'number', default: 25 }, { name: 'overbought', type: 'number', default: 75 },
   { name: 'stop_loss', type: 'number', default: 0.08 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { rsi_period: { min: 5, max: 12, stepSize: 1 }, divergence_lookback: { min: 8, max: 15, stepSize: 1 },
    oversold: { min: 15, max: 35, stepSize: 5 }, overbought: { min: 65, max: 85, stepSize: 5 },
    stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 10: Mean Revert + RSI Combo (32-33) ---
addRecipe(32, 'mr_rsi_tight', 'MRRSITightStrategy', 'Mean reversion + RSI with tight thresholds', 'mean_revert_rsi',
  [{ name: 'ma_period', type: 'number', default: 6 }, { name: 'rsi_period', type: 'number', default: 5 },
   { name: 'deviation_threshold', type: 'number', default: 0.02 }, { name: 'rsi_oversold', type: 'number', default: 30 },
   { name: 'rsi_overbought', type: 'number', default: 70 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'risk_percent', type: 'number', default: 0.10 }],
  { ma_period: { min: 4, max: 10, stepSize: 1 }, rsi_period: { min: 3, max: 8, stepSize: 1 },
    deviation_threshold: { min: 0.01, max: 0.05, stepSize: 0.005 }, rsi_oversold: { min: 20, max: 40, stepSize: 5 },
    rsi_overbought: { min: 60, max: 80, stepSize: 5 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(33, 'mr_rsi_wide', 'MRRSIWideStrategy', 'Mean reversion + RSI with wide thresholds', 'mean_revert_rsi',
  [{ name: 'ma_period', type: 'number', default: 10 }, { name: 'rsi_period', type: 'number', default: 7 },
   { name: 'deviation_threshold', type: 'number', default: 0.04 }, { name: 'rsi_oversold', type: 'number', default: 25 },
   { name: 'rsi_overbought', type: 'number', default: 75 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'risk_percent', type: 'number', default: 0.15 }],
  { ma_period: { min: 6, max: 15, stepSize: 1 }, rsi_period: { min: 5, max: 10, stepSize: 1 },
    deviation_threshold: { min: 0.02, max: 0.08, stepSize: 0.01 }, rsi_oversold: { min: 15, max: 35, stepSize: 5 },
    rsi_overbought: { min: 65, max: 85, stepSize: 5 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 11: Adaptive MA (34-35) ---
addRecipe(34, 'adapt_fast', 'AdaptFastStrategy', 'Fast adaptive MA crossover', 'adaptive_ma',
  [{ name: 'min_period', type: 'number', default: 3 }, { name: 'max_period', type: 'number', default: 12 },
   { name: 'vol_sensitivity', type: 'number', default: 50 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { min_period: { min: 2, max: 5, stepSize: 1 }, max_period: { min: 8, max: 20, stepSize: 2 },
    vol_sensitivity: { min: 20, max: 100, stepSize: 10 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(35, 'adapt_slow', 'AdaptSlowStrategy', 'Slow adaptive MA crossover', 'adaptive_ma',
  [{ name: 'min_period', type: 'number', default: 5 }, { name: 'max_period', type: 'number', default: 25 },
   { name: 'vol_sensitivity', type: 'number', default: 30 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'trailing_stop', type: 'number', default: 0.06 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { min_period: { min: 3, max: 8, stepSize: 1 }, max_period: { min: 15, max: 35, stepSize: 5 },
    vol_sensitivity: { min: 10, max: 80, stepSize: 10 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 12: Triple MA (36-37) ---
addRecipe(36, 'tri_ma_fast', 'TriMAFastStrategy', 'Fast triple MA alignment', 'triple_ma',
  [{ name: 'fast_period', type: 'number', default: 3 }, { name: 'mid_period', type: 'number', default: 6 },
   { name: 'slow_period', type: 'number', default: 12 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { fast_period: { min: 2, max: 5, stepSize: 1 }, mid_period: { min: 4, max: 10, stepSize: 1 },
    slow_period: { min: 8, max: 18, stepSize: 2 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(37, 'tri_ma_slow', 'TriMASlowStrategy', 'Slow triple MA alignment', 'triple_ma',
  [{ name: 'fast_period', type: 'number', default: 5 }, { name: 'mid_period', type: 'number', default: 12 },
   { name: 'slow_period', type: 'number', default: 20 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'trailing_stop', type: 'number', default: 0.06 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { fast_period: { min: 3, max: 8, stepSize: 1 }, mid_period: { min: 8, max: 16, stepSize: 2 },
    slow_period: { min: 15, max: 30, stepSize: 2 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 13: MA Envelope (38-39) ---
addRecipe(38, 'env_tight', 'EnvTightStrategy', 'Tight MA envelope mean reversion', 'ma_envelope',
  [{ name: 'ma_period', type: 'number', default: 8 }, { name: 'envelope_pct', type: 'number', default: 0.03 },
   { name: 'stop_loss', type: 'number', default: 0.06 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { ma_period: { min: 5, max: 15, stepSize: 1 }, envelope_pct: { min: 0.01, max: 0.06, stepSize: 0.005 },
    stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(39, 'env_wide', 'EnvWideStrategy', 'Wide MA envelope for larger moves', 'ma_envelope',
  [{ name: 'ma_period', type: 'number', default: 12 }, { name: 'envelope_pct', type: 'number', default: 0.05 },
   { name: 'stop_loss', type: 'number', default: 0.10 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { ma_period: { min: 8, max: 20, stepSize: 2 }, envelope_pct: { min: 0.03, max: 0.10, stepSize: 0.01 },
    stop_loss: { min: 0.05, max: 0.15, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 14: Price Pattern (40-42) ---
addRecipe(40, 'pat_dip', 'PatDipStrategy', 'Buy on consecutive dips (reversal)', 'price_pattern',
  [{ name: 'consec_bars', type: 'number', default: 3 }, { name: 'buy_on_dip', type: 'number', default: 1 },
   { name: 'exit_bars', type: 'number', default: 2 }, { name: 'stop_loss', type: 'number', default: 0.06 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { consec_bars: { min: 2, max: 5, stepSize: 1 }, exit_bars: { min: 1, max: 4, stepSize: 1 },
    stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 }, trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(41, 'pat_mom', 'PatMomStrategy', 'Buy on consecutive ups (momentum)', 'price_pattern',
  [{ name: 'consec_bars', type: 'number', default: 3 }, { name: 'buy_on_dip', type: 'number', default: 0 },
   { name: 'exit_bars', type: 'number', default: 2 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { consec_bars: { min: 2, max: 5, stepSize: 1 }, exit_bars: { min: 1, max: 4, stepSize: 1 },
    stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 }, trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

// --- Batch 15: RSI + Bollinger Combo (42-43) ---
addRecipe(42, 'combo_tight', 'ComboTightStrategy', 'RSI + BB combo with tight thresholds', 'combo_rsi_bb',
  [{ name: 'bb_period', type: 'number', default: 8 }, { name: 'rsi_period', type: 'number', default: 5 },
   { name: 'std_mult', type: 'number', default: 1.8 }, { name: 'rsi_oversold', type: 'number', default: 30 },
   { name: 'rsi_overbought', type: 'number', default: 70 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'risk_percent', type: 'number', default: 0.10 }],
  { bb_period: { min: 5, max: 12, stepSize: 1 }, rsi_period: { min: 3, max: 8, stepSize: 1 },
    std_mult: { min: 1.2, max: 2.5, stepSize: 0.1 }, rsi_oversold: { min: 20, max: 40, stepSize: 5 },
    rsi_overbought: { min: 60, max: 80, stepSize: 5 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(43, 'combo_wide', 'ComboWideStrategy', 'RSI + BB combo with wide thresholds', 'combo_rsi_bb',
  [{ name: 'bb_period', type: 'number', default: 12 }, { name: 'rsi_period', type: 'number', default: 7 },
   { name: 'std_mult', type: 'number', default: 2.2 }, { name: 'rsi_oversold', type: 'number', default: 25 },
   { name: 'rsi_overbought', type: 'number', default: 75 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'risk_percent', type: 'number', default: 0.15 }],
  { bb_period: { min: 8, max: 18, stepSize: 2 }, rsi_period: { min: 5, max: 10, stepSize: 1 },
    std_mult: { min: 1.5, max: 3.0, stepSize: 0.2 }, rsi_oversold: { min: 15, max: 35, stepSize: 5 },
    rsi_overbought: { min: 65, max: 85, stepSize: 5 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 16: Trend Strength (44-45) ---
addRecipe(44, 'tstr_fast', 'TStrFastStrategy', 'Fast trend strength filter', 'trend_strength',
  [{ name: 'lookback', type: 'number', default: 6 }, { name: 'entry_strength', type: 'number', default: 0.7 },
   { name: 'exit_strength', type: 'number', default: 0.3 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { lookback: { min: 4, max: 10, stepSize: 1 }, entry_strength: { min: 0.5, max: 0.9, stepSize: 0.05 },
    exit_strength: { min: 0.1, max: 0.5, stepSize: 0.05 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(45, 'tstr_slow', 'TStrSlowStrategy', 'Slow trend strength filter', 'trend_strength',
  [{ name: 'lookback', type: 'number', default: 12 }, { name: 'entry_strength', type: 'number', default: 0.65 },
   { name: 'exit_strength', type: 'number', default: 0.35 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'trailing_stop', type: 'number', default: 0.06 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { lookback: { min: 8, max: 18, stepSize: 2 }, entry_strength: { min: 0.5, max: 0.85, stepSize: 0.05 },
    exit_strength: { min: 0.15, max: 0.5, stepSize: 0.05 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 17: Swing Trading (46-47) ---
addRecipe(46, 'swing_short', 'SwingShortStrategy', 'Short swing trading at lows', 'swing',
  [{ name: 'swing_window', type: 'number', default: 3 }, { name: 'stop_loss', type: 'number', default: 0.05 },
   { name: 'trailing_stop', type: 'number', default: 0.04 }, { name: 'take_profit', type: 'number', default: 0.08 },
   { name: 'risk_percent', type: 'number', default: 0.10 }],
  { swing_window: { min: 2, max: 5, stepSize: 1 }, stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, take_profit: { min: 0.04, max: 0.15, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(47, 'swing_long', 'SwingLongStrategy', 'Long swing trading at lows', 'swing',
  [{ name: 'swing_window', type: 'number', default: 5 }, { name: 'stop_loss', type: 'number', default: 0.08 },
   { name: 'trailing_stop', type: 'number', default: 0.06 }, { name: 'take_profit', type: 'number', default: 0.12 },
   { name: 'risk_percent', type: 'number', default: 0.15 }],
  { swing_window: { min: 3, max: 8, stepSize: 1 }, stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
    trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 }, take_profit: { min: 0.06, max: 0.20, stepSize: 0.02 },
    risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 18: Reversal (48-49) ---
addRecipe(48, 'rev_fast', 'RevFastStrategy', 'Fast reversal detector', 'reversal',
  [{ name: 'lookback', type: 'number', default: 5 }, { name: 'drop_threshold', type: 'number', default: 0.05 },
   { name: 'bounce_threshold', type: 'number', default: 0.02 }, { name: 'stop_loss', type: 'number', default: 0.06 },
   { name: 'take_profit', type: 'number', default: 0.08 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { lookback: { min: 3, max: 8, stepSize: 1 }, drop_threshold: { min: 0.02, max: 0.10, stepSize: 0.01 },
    bounce_threshold: { min: 0.01, max: 0.05, stepSize: 0.005 }, stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 },
    take_profit: { min: 0.04, max: 0.15, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(49, 'rev_slow', 'RevSlowStrategy', 'Slow reversal detector', 'reversal',
  [{ name: 'lookback', type: 'number', default: 10 }, { name: 'drop_threshold', type: 'number', default: 0.08 },
   { name: 'bounce_threshold', type: 'number', default: 0.03 }, { name: 'stop_loss', type: 'number', default: 0.10 },
   { name: 'take_profit', type: 'number', default: 0.12 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { lookback: { min: 6, max: 15, stepSize: 1 }, drop_threshold: { min: 0.04, max: 0.15, stepSize: 0.01 },
    bounce_threshold: { min: 0.01, max: 0.06, stepSize: 0.005 }, stop_loss: { min: 0.05, max: 0.15, stepSize: 0.01 },
    take_profit: { min: 0.06, max: 0.20, stepSize: 0.02 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 19: Channel Follow (50-51) ---
addRecipe(50, 'chan_tight', 'ChanTightStrategy', 'Tight channel mean reversion', 'channel_follow',
  [{ name: 'channel_period', type: 'number', default: 8 }, { name: 'channel_width', type: 'number', default: 0.5 },
   { name: 'stop_loss', type: 'number', default: 0.05 }, { name: 'trailing_stop', type: 'number', default: 0.04 },
   { name: 'risk_percent', type: 'number', default: 0.10 }],
  { channel_period: { min: 5, max: 12, stepSize: 1 }, channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
    stop_loss: { min: 0.02, max: 0.10, stepSize: 0.01 }, trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(51, 'chan_wide', 'ChanWideStrategy', 'Wide channel mean reversion', 'channel_follow',
  [{ name: 'channel_period', type: 'number', default: 15 }, { name: 'channel_width', type: 'number', default: 0.7 },
   { name: 'stop_loss', type: 'number', default: 0.08 }, { name: 'trailing_stop', type: 'number', default: 0.06 },
   { name: 'risk_percent', type: 'number', default: 0.15 }],
  { channel_period: { min: 10, max: 20, stepSize: 2 }, channel_width: { min: 0.3, max: 1.0, stepSize: 0.1 },
    stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 }, trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.01 },
    risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// --- Batch 20: Mean Cross (52-53) ---
addRecipe(52, 'mcross_fast', 'MCrossFastStrategy', 'Fast price-MA crossover', 'mean_cross',
  [{ name: 'ma_period', type: 'number', default: 5 }, { name: 'stop_loss', type: 'number', default: 0.04 },
   { name: 'trailing_stop', type: 'number', default: 0.03 }, { name: 'risk_percent', type: 'number', default: 0.10 }],
  { ma_period: { min: 3, max: 10, stepSize: 1 }, stop_loss: { min: 0.02, max: 0.08, stepSize: 0.01 },
    trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 } });

addRecipe(53, 'mcross_slow', 'MCrossSlowStrategy', 'Slow price-MA crossover', 'mean_cross',
  [{ name: 'ma_period', type: 'number', default: 12 }, { name: 'stop_loss', type: 'number', default: 0.07 },
   { name: 'trailing_stop', type: 'number', default: 0.05 }, { name: 'risk_percent', type: 'number', default: 0.15 }],
  { ma_period: { min: 8, max: 20, stepSize: 2 }, stop_loss: { min: 0.04, max: 0.12, stepSize: 0.01 },
    trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 }, risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 } });

// ============================================================
// WAVE 2: Strategies 54-200
// Based on winning templates: mean_revert_rsi, williams_r, ma_envelope,
// channel_follow, combo_rsi_bb, stochastic, price_pattern
// ============================================================

// Helper to generate variants with different parameter ranges

let id = 54;

// ---- Mean Reversion RSI variants (20 strategies) ----
const mrRsiVariants = [
  { suffix: 'v01', desc: 'Ultra-fast MR+RSI', ma: 3, rsi: 3, dev: 0.015, rsiOS: 25, rsiOB: 75, sl: 0.04, rp: 0.1 },
  { suffix: 'v02', desc: 'Fast MR+RSI tight', ma: 4, rsi: 4, dev: 0.02, rsiOS: 30, rsiOB: 70, sl: 0.03, rp: 0.08 },
  { suffix: 'v03', desc: 'Fast MR+RSI wide', ma: 4, rsi: 5, dev: 0.03, rsiOS: 25, rsiOB: 75, sl: 0.06, rp: 0.15 },
  { suffix: 'v04', desc: 'Med MR+RSI tight', ma: 6, rsi: 5, dev: 0.02, rsiOS: 30, rsiOB: 70, sl: 0.04, rp: 0.1 },
  { suffix: 'v05', desc: 'Med MR+RSI std', ma: 7, rsi: 6, dev: 0.03, rsiOS: 28, rsiOB: 72, sl: 0.05, rp: 0.12 },
  { suffix: 'v06', desc: 'Med MR+RSI wide', ma: 8, rsi: 7, dev: 0.04, rsiOS: 25, rsiOB: 75, sl: 0.07, rp: 0.18 },
  { suffix: 'v07', desc: 'Slow MR+RSI tight', ma: 10, rsi: 8, dev: 0.03, rsiOS: 30, rsiOB: 70, sl: 0.05, rp: 0.1 },
  { suffix: 'v08', desc: 'Slow MR+RSI wide', ma: 12, rsi: 9, dev: 0.05, rsiOS: 22, rsiOB: 78, sl: 0.08, rp: 0.2 },
  { suffix: 'v09', desc: 'Deep MR+RSI', ma: 5, rsi: 4, dev: 0.05, rsiOS: 20, rsiOB: 80, sl: 0.08, rp: 0.15 },
  { suffix: 'v10', desc: 'Shallow MR+RSI', ma: 5, rsi: 5, dev: 0.01, rsiOS: 35, rsiOB: 65, sl: 0.03, rp: 0.08 },
  { suffix: 'v11', desc: 'Aggressive MR+RSI', ma: 3, rsi: 3, dev: 0.01, rsiOS: 35, rsiOB: 65, sl: 0.06, rp: 0.25 },
  { suffix: 'v12', desc: 'Conservative MR+RSI', ma: 10, rsi: 8, dev: 0.04, rsiOS: 20, rsiOB: 80, sl: 0.04, rp: 0.05 },
  { suffix: 'v13', desc: 'Balanced MR+RSI 1', ma: 6, rsi: 5, dev: 0.025, rsiOS: 28, rsiOB: 72, sl: 0.05, rp: 0.12 },
  { suffix: 'v14', desc: 'Balanced MR+RSI 2', ma: 7, rsi: 6, dev: 0.035, rsiOS: 26, rsiOB: 74, sl: 0.06, rp: 0.14 },
  { suffix: 'v15', desc: 'Tight SL MR+RSI', ma: 5, rsi: 4, dev: 0.02, rsiOS: 30, rsiOB: 70, sl: 0.02, rp: 0.1 },
  { suffix: 'v16', desc: 'Wide SL MR+RSI', ma: 5, rsi: 4, dev: 0.02, rsiOS: 30, rsiOB: 70, sl: 0.1, rp: 0.1 },
  { suffix: 'v17', desc: 'High risk MR+RSI', ma: 6, rsi: 5, dev: 0.03, rsiOS: 25, rsiOB: 75, sl: 0.06, rp: 0.3 },
  { suffix: 'v18', desc: 'Low risk MR+RSI', ma: 6, rsi: 5, dev: 0.03, rsiOS: 25, rsiOB: 75, sl: 0.06, rp: 0.05 },
  { suffix: 'v19', desc: 'Quick cycle MR+RSI', ma: 3, rsi: 3, dev: 0.02, rsiOS: 30, rsiOB: 70, sl: 0.04, rp: 0.12 },
  { suffix: 'v20', desc: 'Long cycle MR+RSI', ma: 14, rsi: 10, dev: 0.06, rsiOS: 20, rsiOB: 80, sl: 0.1, rp: 0.15 },
];

for (const v of mrRsiVariants) {
  addRecipe(id++, `mr_rsi_${v.suffix}`, `MRRsi${v.suffix.toUpperCase()}Strategy`, v.desc, 'mean_revert_rsi',
    [{ name: 'ma_period', type: 'number', default: v.ma }, { name: 'rsi_period', type: 'number', default: v.rsi },
     { name: 'deviation_threshold', type: 'number', default: v.dev },
     { name: 'rsi_oversold', type: 'number', default: v.rsiOS }, { name: 'rsi_overbought', type: 'number', default: v.rsiOB },
     { name: 'stop_loss', type: 'number', default: v.sl }, { name: 'risk_percent', type: 'number', default: v.rp }],
    { ma_period: { min: Math.max(2, v.ma - 3), max: v.ma + 5, stepSize: 1 },
      rsi_period: { min: Math.max(2, v.rsi - 2), max: v.rsi + 4, stepSize: 1 },
      deviation_threshold: { min: Math.max(0.005, v.dev - 0.02), max: v.dev + 0.03, stepSize: 0.005 },
      rsi_oversold: { min: Math.max(10, v.rsiOS - 10), max: v.rsiOS + 10, stepSize: 5 },
      rsi_overbought: { min: v.rsiOB - 10, max: Math.min(90, v.rsiOB + 10), stepSize: 5 },
      stop_loss: { min: Math.max(0.01, v.sl - 0.03), max: v.sl + 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: Math.min(0.4, v.rp + 0.15), stepSize: 0.05 } });
}

// ---- Williams %R variants (20 strategies) ----
const willrVariants = [
  { suffix: 'v01', desc: 'Ultra-fast WillR', per: 4, os: -85, ob: -15, sl: 0.03, ts: 0.02, rp: 0.1 },
  { suffix: 'v02', desc: 'Fast WillR tight', per: 5, os: -80, ob: -20, sl: 0.04, ts: 0.03, rp: 0.08 },
  { suffix: 'v03', desc: 'Fast WillR wide', per: 5, os: -90, ob: -10, sl: 0.06, ts: 0.05, rp: 0.15 },
  { suffix: 'v04', desc: 'Med WillR std', per: 8, os: -80, ob: -20, sl: 0.05, ts: 0.04, rp: 0.1 },
  { suffix: 'v05', desc: 'Med WillR wide', per: 8, os: -85, ob: -15, sl: 0.07, ts: 0.05, rp: 0.15 },
  { suffix: 'v06', desc: 'Med WillR extreme', per: 8, os: -95, ob: -5, sl: 0.08, ts: 0.06, rp: 0.2 },
  { suffix: 'v07', desc: 'Slow WillR tight', per: 12, os: -80, ob: -20, sl: 0.05, ts: 0.04, rp: 0.1 },
  { suffix: 'v08', desc: 'Slow WillR wide', per: 12, os: -90, ob: -10, sl: 0.08, ts: 0.06, rp: 0.18 },
  { suffix: 'v09', desc: 'Deep oversold WillR', per: 7, os: -95, ob: -25, sl: 0.06, ts: 0.04, rp: 0.12 },
  { suffix: 'v10', desc: 'Shallow WillR', per: 6, os: -70, ob: -30, sl: 0.04, ts: 0.03, rp: 0.08 },
  { suffix: 'v11', desc: 'Aggressive WillR', per: 4, os: -75, ob: -25, sl: 0.06, ts: 0.04, rp: 0.25 },
  { suffix: 'v12', desc: 'Conservative WillR', per: 14, os: -90, ob: -10, sl: 0.04, ts: 0.03, rp: 0.05 },
  { suffix: 'v13', desc: 'Balanced WillR 1', per: 7, os: -82, ob: -18, sl: 0.05, ts: 0.04, rp: 0.12 },
  { suffix: 'v14', desc: 'Balanced WillR 2', per: 9, os: -78, ob: -22, sl: 0.06, ts: 0.05, rp: 0.14 },
  { suffix: 'v15', desc: 'Tight SL WillR', per: 7, os: -80, ob: -20, sl: 0.02, ts: 0.02, rp: 0.1 },
  { suffix: 'v16', desc: 'Wide SL WillR', per: 7, os: -80, ob: -20, sl: 0.12, ts: 0.08, rp: 0.1 },
  { suffix: 'v17', desc: 'High risk WillR', per: 6, os: -85, ob: -15, sl: 0.06, ts: 0.04, rp: 0.3 },
  { suffix: 'v18', desc: 'Low risk WillR', per: 6, os: -85, ob: -15, sl: 0.06, ts: 0.04, rp: 0.05 },
  { suffix: 'v19', desc: 'Quick cycle WillR', per: 3, os: -80, ob: -20, sl: 0.04, ts: 0.03, rp: 0.1 },
  { suffix: 'v20', desc: 'Long cycle WillR', per: 18, os: -85, ob: -15, sl: 0.08, ts: 0.06, rp: 0.15 },
];

for (const w of willrVariants) {
  addRecipe(id++, `willr_${w.suffix}`, `WillR${w.suffix.toUpperCase()}Strategy`, w.desc, 'williams_r',
    [{ name: 'period', type: 'number', default: w.per }, { name: 'oversold_level', type: 'number', default: w.os },
     { name: 'overbought_level', type: 'number', default: w.ob },
     { name: 'stop_loss', type: 'number', default: w.sl }, { name: 'trailing_stop', type: 'number', default: w.ts },
     { name: 'risk_percent', type: 'number', default: w.rp }],
    { period: { min: Math.max(3, w.per - 3), max: w.per + 5, stepSize: 1 },
      oversold_level: { min: Math.max(-98, w.os - 10), max: Math.min(-60, w.os + 10), stepSize: 5 },
      overbought_level: { min: Math.max(-40, w.ob - 10), max: Math.min(-2, w.ob + 10), stepSize: 5 },
      stop_loss: { min: Math.max(0.01, w.sl - 0.03), max: w.sl + 0.05, stepSize: 0.01 },
      trailing_stop: { min: Math.max(0.01, w.ts - 0.02), max: w.ts + 0.04, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: Math.min(0.4, w.rp + 0.15), stepSize: 0.05 } });
}

// ---- MA Envelope variants (20 strategies) ----
const envVariants = [
  { suffix: 'v01', desc: 'Ultra-tight envelope', ma: 4, env: 0.01, sl: 0.03, rp: 0.08 },
  { suffix: 'v02', desc: 'Fast tight envelope', ma: 5, env: 0.015, sl: 0.04, rp: 0.1 },
  { suffix: 'v03', desc: 'Fast std envelope', ma: 5, env: 0.025, sl: 0.05, rp: 0.12 },
  { suffix: 'v04', desc: 'Fast wide envelope', ma: 5, env: 0.04, sl: 0.07, rp: 0.15 },
  { suffix: 'v05', desc: 'Med tight envelope', ma: 8, env: 0.02, sl: 0.04, rp: 0.1 },
  { suffix: 'v06', desc: 'Med std envelope', ma: 8, env: 0.03, sl: 0.05, rp: 0.12 },
  { suffix: 'v07', desc: 'Med wide envelope', ma: 8, env: 0.05, sl: 0.08, rp: 0.18 },
  { suffix: 'v08', desc: 'Slow tight envelope', ma: 12, env: 0.02, sl: 0.05, rp: 0.1 },
  { suffix: 'v09', desc: 'Slow std envelope', ma: 12, env: 0.04, sl: 0.07, rp: 0.15 },
  { suffix: 'v10', desc: 'Slow wide envelope', ma: 12, env: 0.06, sl: 0.1, rp: 0.2 },
  { suffix: 'v11', desc: 'Aggressive envelope', ma: 4, env: 0.015, sl: 0.06, rp: 0.25 },
  { suffix: 'v12', desc: 'Conservative envelope', ma: 15, env: 0.05, sl: 0.04, rp: 0.05 },
  { suffix: 'v13', desc: 'Balanced envelope 1', ma: 7, env: 0.025, sl: 0.05, rp: 0.12 },
  { suffix: 'v14', desc: 'Balanced envelope 2', ma: 9, env: 0.035, sl: 0.06, rp: 0.14 },
  { suffix: 'v15', desc: 'Tight SL envelope', ma: 6, env: 0.02, sl: 0.02, rp: 0.1 },
  { suffix: 'v16', desc: 'Wide SL envelope', ma: 6, env: 0.02, sl: 0.12, rp: 0.1 },
  { suffix: 'v17', desc: 'High risk envelope', ma: 7, env: 0.03, sl: 0.06, rp: 0.3 },
  { suffix: 'v18', desc: 'Low risk envelope', ma: 7, env: 0.03, sl: 0.06, rp: 0.05 },
  { suffix: 'v19', desc: 'Micro envelope', ma: 3, env: 0.008, sl: 0.03, rp: 0.08 },
  { suffix: 'v20', desc: 'Wide period envelope', ma: 18, env: 0.06, sl: 0.1, rp: 0.15 },
];

for (const e of envVariants) {
  addRecipe(id++, `env_${e.suffix}`, `Env${e.suffix.toUpperCase()}Strategy`, e.desc, 'ma_envelope',
    [{ name: 'ma_period', type: 'number', default: e.ma }, { name: 'envelope_pct', type: 'number', default: e.env },
     { name: 'stop_loss', type: 'number', default: e.sl }, { name: 'risk_percent', type: 'number', default: e.rp }],
    { ma_period: { min: Math.max(2, e.ma - 3), max: e.ma + 5, stepSize: 1 },
      envelope_pct: { min: Math.max(0.005, e.env - 0.015), max: e.env + 0.03, stepSize: 0.005 },
      stop_loss: { min: Math.max(0.01, e.sl - 0.03), max: e.sl + 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: Math.min(0.4, e.rp + 0.15), stepSize: 0.05 } });
}

// ---- Channel Follow variants (20 strategies) ----
const chanVariants = [
  { suffix: 'v01', desc: 'Ultra-tight channel', per: 4, wid: 0.3, sl: 0.03, ts: 0.02, rp: 0.08 },
  { suffix: 'v02', desc: 'Fast tight channel', per: 5, wid: 0.4, sl: 0.04, ts: 0.03, rp: 0.1 },
  { suffix: 'v03', desc: 'Fast std channel', per: 5, wid: 0.5, sl: 0.05, ts: 0.04, rp: 0.12 },
  { suffix: 'v04', desc: 'Fast wide channel', per: 5, wid: 0.7, sl: 0.07, ts: 0.05, rp: 0.15 },
  { suffix: 'v05', desc: 'Med tight channel', per: 8, wid: 0.4, sl: 0.04, ts: 0.03, rp: 0.1 },
  { suffix: 'v06', desc: 'Med std channel', per: 8, wid: 0.5, sl: 0.05, ts: 0.04, rp: 0.12 },
  { suffix: 'v07', desc: 'Med wide channel', per: 8, wid: 0.8, sl: 0.08, ts: 0.06, rp: 0.18 },
  { suffix: 'v08', desc: 'Slow tight channel', per: 12, wid: 0.4, sl: 0.05, ts: 0.04, rp: 0.1 },
  { suffix: 'v09', desc: 'Slow std channel', per: 12, wid: 0.6, sl: 0.07, ts: 0.05, rp: 0.15 },
  { suffix: 'v10', desc: 'Slow wide channel', per: 12, wid: 0.9, sl: 0.1, ts: 0.07, rp: 0.2 },
  { suffix: 'v11', desc: 'Aggressive channel', per: 4, wid: 0.3, sl: 0.06, ts: 0.04, rp: 0.25 },
  { suffix: 'v12', desc: 'Conservative channel', per: 15, wid: 0.7, sl: 0.04, ts: 0.03, rp: 0.05 },
  { suffix: 'v13', desc: 'Balanced channel 1', per: 7, wid: 0.5, sl: 0.05, ts: 0.04, rp: 0.12 },
  { suffix: 'v14', desc: 'Balanced channel 2', per: 9, wid: 0.6, sl: 0.06, ts: 0.05, rp: 0.14 },
  { suffix: 'v15', desc: 'Tight SL channel', per: 7, wid: 0.5, sl: 0.02, ts: 0.02, rp: 0.1 },
  { suffix: 'v16', desc: 'Wide SL channel', per: 7, wid: 0.5, sl: 0.12, ts: 0.08, rp: 0.1 },
  { suffix: 'v17', desc: 'High risk channel', per: 6, wid: 0.5, sl: 0.06, ts: 0.04, rp: 0.3 },
  { suffix: 'v18', desc: 'Low risk channel', per: 6, wid: 0.5, sl: 0.06, ts: 0.04, rp: 0.05 },
  { suffix: 'v19', desc: 'Narrow channel', per: 3, wid: 0.2, sl: 0.03, ts: 0.02, rp: 0.08 },
  { suffix: 'v20', desc: 'Very wide channel', per: 18, wid: 1.0, sl: 0.1, ts: 0.07, rp: 0.15 },
];

for (const c of chanVariants) {
  addRecipe(id++, `chan_${c.suffix}`, `Chan${c.suffix.toUpperCase()}Strategy`, c.desc, 'channel_follow',
    [{ name: 'channel_period', type: 'number', default: c.per }, { name: 'channel_width', type: 'number', default: c.wid },
     { name: 'stop_loss', type: 'number', default: c.sl }, { name: 'trailing_stop', type: 'number', default: c.ts },
     { name: 'risk_percent', type: 'number', default: c.rp }],
    { channel_period: { min: Math.max(3, c.per - 3), max: c.per + 5, stepSize: 1 },
      channel_width: { min: Math.max(0.1, c.wid - 0.3), max: Math.min(1.5, c.wid + 0.3), stepSize: 0.1 },
      stop_loss: { min: Math.max(0.01, c.sl - 0.03), max: c.sl + 0.05, stepSize: 0.01 },
      trailing_stop: { min: Math.max(0.01, c.ts - 0.02), max: c.ts + 0.04, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: Math.min(0.4, c.rp + 0.15), stepSize: 0.05 } });
}

// ---- Combo RSI+BB variants (20 strategies) ----
const comboVariants = [
  { suffix: 'v01', desc: 'Ultra-fast combo', bb: 4, rsi: 3, std: 1.5, rOS: 25, rOB: 75, sl: 0.03, rp: 0.08 },
  { suffix: 'v02', desc: 'Fast tight combo', bb: 5, rsi: 3, std: 1.8, rOS: 30, rOB: 70, sl: 0.04, rp: 0.1 },
  { suffix: 'v03', desc: 'Fast std combo', bb: 6, rsi: 4, std: 2.0, rOS: 25, rOB: 75, sl: 0.05, rp: 0.12 },
  { suffix: 'v04', desc: 'Fast wide combo', bb: 6, rsi: 5, std: 2.5, rOS: 20, rOB: 80, sl: 0.07, rp: 0.15 },
  { suffix: 'v05', desc: 'Med tight combo', bb: 8, rsi: 5, std: 1.5, rOS: 30, rOB: 70, sl: 0.04, rp: 0.1 },
  { suffix: 'v06', desc: 'Med std combo', bb: 8, rsi: 6, std: 2.0, rOS: 25, rOB: 75, sl: 0.05, rp: 0.12 },
  { suffix: 'v07', desc: 'Med wide combo', bb: 10, rsi: 7, std: 2.5, rOS: 20, rOB: 80, sl: 0.08, rp: 0.18 },
  { suffix: 'v08', desc: 'Slow tight combo', bb: 12, rsi: 7, std: 1.5, rOS: 30, rOB: 70, sl: 0.05, rp: 0.1 },
  { suffix: 'v09', desc: 'Slow std combo', bb: 12, rsi: 8, std: 2.0, rOS: 25, rOB: 75, sl: 0.07, rp: 0.15 },
  { suffix: 'v10', desc: 'Slow wide combo', bb: 15, rsi: 9, std: 2.5, rOS: 20, rOB: 80, sl: 0.1, rp: 0.2 },
  { suffix: 'v11', desc: 'Aggressive combo', bb: 4, rsi: 3, std: 1.3, rOS: 35, rOB: 65, sl: 0.06, rp: 0.25 },
  { suffix: 'v12', desc: 'Conservative combo', bb: 14, rsi: 8, std: 2.8, rOS: 18, rOB: 82, sl: 0.04, rp: 0.05 },
  { suffix: 'v13', desc: 'Balanced combo 1', bb: 7, rsi: 5, std: 1.8, rOS: 28, rOB: 72, sl: 0.05, rp: 0.12 },
  { suffix: 'v14', desc: 'Balanced combo 2', bb: 9, rsi: 6, std: 2.2, rOS: 26, rOB: 74, sl: 0.06, rp: 0.14 },
  { suffix: 'v15', desc: 'Tight SL combo', bb: 6, rsi: 4, std: 2.0, rOS: 25, rOB: 75, sl: 0.02, rp: 0.1 },
  { suffix: 'v16', desc: 'Wide SL combo', bb: 6, rsi: 4, std: 2.0, rOS: 25, rOB: 75, sl: 0.12, rp: 0.1 },
  { suffix: 'v17', desc: 'High risk combo', bb: 7, rsi: 5, std: 2.0, rOS: 25, rOB: 75, sl: 0.06, rp: 0.3 },
  { suffix: 'v18', desc: 'Low risk combo', bb: 7, rsi: 5, std: 2.0, rOS: 25, rOB: 75, sl: 0.06, rp: 0.05 },
  { suffix: 'v19', desc: 'Micro combo', bb: 3, rsi: 3, std: 1.2, rOS: 30, rOB: 70, sl: 0.03, rp: 0.08 },
  { suffix: 'v20', desc: 'Wide period combo', bb: 18, rsi: 10, std: 3.0, rOS: 15, rOB: 85, sl: 0.1, rp: 0.15 },
];

for (const co of comboVariants) {
  addRecipe(id++, `combo_${co.suffix}`, `Combo${co.suffix.toUpperCase()}Strategy`, co.desc, 'combo_rsi_bb',
    [{ name: 'bb_period', type: 'number', default: co.bb }, { name: 'rsi_period', type: 'number', default: co.rsi },
     { name: 'std_mult', type: 'number', default: co.std },
     { name: 'rsi_oversold', type: 'number', default: co.rOS }, { name: 'rsi_overbought', type: 'number', default: co.rOB },
     { name: 'stop_loss', type: 'number', default: co.sl }, { name: 'risk_percent', type: 'number', default: co.rp }],
    { bb_period: { min: Math.max(2, co.bb - 3), max: co.bb + 5, stepSize: 1 },
      rsi_period: { min: Math.max(2, co.rsi - 2), max: co.rsi + 4, stepSize: 1 },
      std_mult: { min: Math.max(0.8, co.std - 0.5), max: co.std + 0.8, stepSize: 0.1 },
      rsi_oversold: { min: Math.max(10, co.rOS - 10), max: co.rOS + 10, stepSize: 5 },
      rsi_overbought: { min: co.rOB - 10, max: Math.min(90, co.rOB + 10), stepSize: 5 },
      stop_loss: { min: Math.max(0.01, co.sl - 0.03), max: co.sl + 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: Math.min(0.4, co.rp + 0.15), stepSize: 0.05 } });
}

// ---- Stochastic variants (20 strategies) ----
const stochVariants = [
  { suffix: 'v01', desc: 'Ultra-fast stoch', k: 3, d: 2, os: 15, ob: 85, sl: 0.03, rp: 0.08 },
  { suffix: 'v02', desc: 'Fast tight stoch', k: 4, d: 2, os: 20, ob: 80, sl: 0.04, rp: 0.1 },
  { suffix: 'v03', desc: 'Fast std stoch', k: 5, d: 3, os: 20, ob: 80, sl: 0.05, rp: 0.12 },
  { suffix: 'v04', desc: 'Fast wide stoch', k: 5, d: 3, os: 15, ob: 85, sl: 0.07, rp: 0.15 },
  { suffix: 'v05', desc: 'Med tight stoch', k: 7, d: 3, os: 25, ob: 75, sl: 0.04, rp: 0.1 },
  { suffix: 'v06', desc: 'Med std stoch', k: 8, d: 4, os: 20, ob: 80, sl: 0.05, rp: 0.12 },
  { suffix: 'v07', desc: 'Med wide stoch', k: 10, d: 4, os: 15, ob: 85, sl: 0.08, rp: 0.18 },
  { suffix: 'v08', desc: 'Slow tight stoch', k: 12, d: 5, os: 25, ob: 75, sl: 0.05, rp: 0.1 },
  { suffix: 'v09', desc: 'Slow std stoch', k: 12, d: 5, os: 20, ob: 80, sl: 0.07, rp: 0.15 },
  { suffix: 'v10', desc: 'Slow wide stoch', k: 14, d: 6, os: 15, ob: 85, sl: 0.1, rp: 0.2 },
  { suffix: 'v11', desc: 'Aggressive stoch', k: 3, d: 2, os: 25, ob: 75, sl: 0.06, rp: 0.25 },
  { suffix: 'v12', desc: 'Conservative stoch', k: 14, d: 6, os: 10, ob: 90, sl: 0.04, rp: 0.05 },
  { suffix: 'v13', desc: 'Balanced stoch 1', k: 6, d: 3, os: 22, ob: 78, sl: 0.05, rp: 0.12 },
  { suffix: 'v14', desc: 'Balanced stoch 2', k: 9, d: 4, os: 18, ob: 82, sl: 0.06, rp: 0.14 },
  { suffix: 'v15', desc: 'Tight SL stoch', k: 6, d: 3, os: 20, ob: 80, sl: 0.02, rp: 0.1 },
  { suffix: 'v16', desc: 'Wide SL stoch', k: 6, d: 3, os: 20, ob: 80, sl: 0.12, rp: 0.1 },
  { suffix: 'v17', desc: 'High risk stoch', k: 7, d: 3, os: 20, ob: 80, sl: 0.06, rp: 0.3 },
  { suffix: 'v18', desc: 'Low risk stoch', k: 7, d: 3, os: 20, ob: 80, sl: 0.06, rp: 0.05 },
  { suffix: 'v19', desc: 'Quick cycle stoch', k: 3, d: 2, os: 20, ob: 80, sl: 0.04, rp: 0.1 },
  { suffix: 'v20', desc: 'Long cycle stoch', k: 18, d: 7, os: 20, ob: 80, sl: 0.08, rp: 0.15 },
];

for (const s of stochVariants) {
  addRecipe(id++, `stoch_${s.suffix}`, `Stoch${s.suffix.toUpperCase()}Strategy`, s.desc, 'stochastic',
    [{ name: 'k_period', type: 'number', default: s.k }, { name: 'd_period', type: 'number', default: s.d },
     { name: 'oversold', type: 'number', default: s.os }, { name: 'overbought', type: 'number', default: s.ob },
     { name: 'stop_loss', type: 'number', default: s.sl }, { name: 'risk_percent', type: 'number', default: s.rp }],
    { k_period: { min: Math.max(2, s.k - 3), max: s.k + 5, stepSize: 1 },
      d_period: { min: Math.max(2, s.d - 1), max: s.d + 3, stepSize: 1 },
      oversold: { min: Math.max(5, s.os - 10), max: s.os + 10, stepSize: 5 },
      overbought: { min: s.ob - 10, max: Math.min(95, s.ob + 10), stepSize: 5 },
      stop_loss: { min: Math.max(0.01, s.sl - 0.03), max: s.sl + 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: Math.min(0.4, s.rp + 0.15), stepSize: 0.05 } });
}

// ---- Price Pattern (dip buy) variants (20 strategies) ----
const patVariants = [
  { suffix: 'v01', desc: 'Quick dip 2bar', bars: 2, exit: 1, sl: 0.03, ts: 0.02, rp: 0.08 },
  { suffix: 'v02', desc: 'Quick dip 2bar wide', bars: 2, exit: 2, sl: 0.05, ts: 0.04, rp: 0.12 },
  { suffix: 'v03', desc: 'Med dip 3bar', bars: 3, exit: 1, sl: 0.04, ts: 0.03, rp: 0.1 },
  { suffix: 'v04', desc: 'Med dip 3bar wide', bars: 3, exit: 2, sl: 0.06, ts: 0.05, rp: 0.15 },
  { suffix: 'v05', desc: 'Med dip 3bar long', bars: 3, exit: 3, sl: 0.07, ts: 0.05, rp: 0.15 },
  { suffix: 'v06', desc: 'Deep dip 4bar', bars: 4, exit: 1, sl: 0.05, ts: 0.04, rp: 0.12 },
  { suffix: 'v07', desc: 'Deep dip 4bar wide', bars: 4, exit: 2, sl: 0.07, ts: 0.05, rp: 0.18 },
  { suffix: 'v08', desc: 'Deep dip 4bar long', bars: 4, exit: 3, sl: 0.08, ts: 0.06, rp: 0.18 },
  { suffix: 'v09', desc: 'Very deep dip 5bar', bars: 5, exit: 2, sl: 0.08, ts: 0.06, rp: 0.15 },
  { suffix: 'v10', desc: 'Very deep dip 5bar long', bars: 5, exit: 3, sl: 0.1, ts: 0.07, rp: 0.2 },
  { suffix: 'v11', desc: 'Aggressive dip', bars: 2, exit: 1, sl: 0.06, ts: 0.04, rp: 0.25 },
  { suffix: 'v12', desc: 'Conservative dip', bars: 4, exit: 3, sl: 0.04, ts: 0.03, rp: 0.05 },
  { suffix: 'v13', desc: 'Balanced dip 1', bars: 3, exit: 2, sl: 0.05, ts: 0.04, rp: 0.12 },
  { suffix: 'v14', desc: 'Balanced dip 2', bars: 3, exit: 1, sl: 0.06, ts: 0.04, rp: 0.14 },
  { suffix: 'v15', desc: 'Tight SL dip', bars: 3, exit: 2, sl: 0.02, ts: 0.02, rp: 0.1 },
  { suffix: 'v16', desc: 'Wide SL dip', bars: 3, exit: 2, sl: 0.12, ts: 0.08, rp: 0.1 },
  { suffix: 'v17', desc: 'High risk dip', bars: 2, exit: 1, sl: 0.05, ts: 0.04, rp: 0.3 },
  { suffix: 'v18', desc: 'Low risk dip', bars: 2, exit: 1, sl: 0.05, ts: 0.04, rp: 0.05 },
  { suffix: 'v19', desc: 'Ultra-quick dip', bars: 2, exit: 1, sl: 0.03, ts: 0.02, rp: 0.1 },
  { suffix: 'v20', desc: 'Extended dip', bars: 5, exit: 4, sl: 0.1, ts: 0.08, rp: 0.15 },
];

for (const p of patVariants) {
  addRecipe(id++, `pat_${p.suffix}`, `Pat${p.suffix.toUpperCase()}Strategy`, p.desc, 'price_pattern',
    [{ name: 'consec_bars', type: 'number', default: p.bars }, { name: 'exit_bars', type: 'number', default: p.exit },
     { name: 'stop_loss', type: 'number', default: p.sl }, { name: 'trailing_stop', type: 'number', default: p.ts },
     { name: 'risk_percent', type: 'number', default: p.rp }],
    { consec_bars: { min: Math.max(2, p.bars - 1), max: p.bars + 2, stepSize: 1 },
      exit_bars: { min: 1, max: p.exit + 2, stepSize: 1 },
      stop_loss: { min: Math.max(0.01, p.sl - 0.03), max: p.sl + 0.05, stepSize: 0.01 },
      trailing_stop: { min: Math.max(0.01, p.ts - 0.02), max: p.ts + 0.04, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: Math.min(0.4, p.rp + 0.15), stepSize: 0.05 } });
}

// ---- RSI Divergence variants (7 strategies to reach exactly 200) ----
const rsiDivVariants = [
  { suffix: 'v01', desc: 'Ultra-fast RSI div', rsi: 3, div: 4, os: 25, ob: 75, sl: 0.03, rp: 0.08 },
  { suffix: 'v02', desc: 'Fast tight RSI div', rsi: 4, div: 5, os: 30, ob: 70, sl: 0.04, rp: 0.1 },
  { suffix: 'v03', desc: 'Med RSI div', rsi: 6, div: 7, os: 25, ob: 75, sl: 0.05, rp: 0.12 },
  { suffix: 'v04', desc: 'Slow RSI div', rsi: 8, div: 10, os: 20, ob: 80, sl: 0.07, rp: 0.15 },
  { suffix: 'v05', desc: 'Aggressive RSI div', rsi: 4, div: 5, os: 30, ob: 70, sl: 0.06, rp: 0.25 },
  { suffix: 'v06', desc: 'Conservative RSI div', rsi: 10, div: 12, os: 18, ob: 82, sl: 0.04, rp: 0.05 },
  { suffix: 'v07', desc: 'Balanced RSI div', rsi: 6, div: 8, os: 25, ob: 75, sl: 0.05, rp: 0.12 },
];

for (const rd of rsiDivVariants) {
  addRecipe(id++, `rsi_d_${rd.suffix}`, `RsiD${rd.suffix.toUpperCase()}Strategy`, rd.desc, 'rsi_divergence',
    [{ name: 'rsi_period', type: 'number', default: rd.rsi }, { name: 'divergence_lookback', type: 'number', default: rd.div },
     { name: 'oversold', type: 'number', default: rd.os }, { name: 'overbought', type: 'number', default: rd.ob },
     { name: 'stop_loss', type: 'number', default: rd.sl }, { name: 'risk_percent', type: 'number', default: rd.rp }],
    { rsi_period: { min: Math.max(2, rd.rsi - 2), max: rd.rsi + 4, stepSize: 1 },
      divergence_lookback: { min: Math.max(3, rd.div - 3), max: rd.div + 5, stepSize: 1 },
      oversold: { min: Math.max(10, rd.os - 10), max: rd.os + 10, stepSize: 5 },
      overbought: { min: rd.ob - 10, max: Math.min(90, rd.ob + 10), stepSize: 5 },
      stop_loss: { min: Math.max(0.01, rd.sl - 0.03), max: rd.sl + 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: Math.min(0.4, rd.rp + 0.15), stepSize: 0.05 } });
}

console.log(`Wave 2: Added strategies ${54} through ${id - 1} (${id - 54} strategies)`);
console.log(`Total recipes: ${recipes.length}`);

// ============================================================
// GENERATION
// ============================================================

let generatedCount = 0;
let skippedCount = 0;

for (const recipe of recipes) {
  const fileName = `strat_${recipe.name}_${String(recipe.id).padStart(2, '0')}`;
  const tsPath = path.join(strategiesDir, `${fileName}.ts`);
  const paramsPath = path.join(strategiesDir, `${fileName}.params.json`);

  // Skip if already exists
  if (fs.existsSync(tsPath)) {
    skippedCount++;
    continue;
  }

  // Generate strategy file
  const content = generateStrategy(recipe);
  fs.writeFileSync(tsPath, content);

  // Generate default params.json
  const paramsObj: Record<string, any> = {};
  for (const p of recipe.params) {
    paramsObj[p.name] = p.default;
  }
  paramsObj.metadata = { optimized_at: new Date().toISOString(), best_test_return: 0 };
  fs.writeFileSync(paramsPath, JSON.stringify(paramsObj, null, 2));

  generatedCount++;
}

console.log(`Generated ${generatedCount} new strategies, skipped ${skippedCount} existing (IDs ${recipes[0].id}-${recipes[recipes.length - 1].id})`);
console.log(`\nTo register them in the optimizer, run: bun run scripts/register-strategies.ts`);

// Also output the optimizer registry entries
const registryEntries: string[] = [];
const importLines: string[] = [];

for (const recipe of recipes) {
  const fileName = `strat_${recipe.name}_${String(recipe.id).padStart(2, '0')}`;
  const importName = recipe.className;
  importLines.push(`import { ${importName} } from '../src/strategies/${fileName}';`);
  
  const paramsEntries = Object.entries(recipe.optimizerParams).map(([key, config]) => {
    return `      ${key}: { min: ${config.min}, max: ${config.max}, stepSize: ${config.stepSize} },`;
  }).join('\n');
  
  registryEntries.push(`  ${recipe.name}: {
    class: ${importName},
    params: {
${paramsEntries}
    },
    outputFile: '${fileName}.params.json',
  },`);
}

// Write registry file for easy copy-paste
const registryPath = path.join(process.cwd(), 'data', 'generated-registry.ts');
fs.writeFileSync(registryPath, `// AUTO-GENERATED: Copy these into run-optimization.ts
// Imports:
${importLines.join('\n')}

// Registry entries:
${registryEntries.join('\n')}
`);

console.log(`\nRegistry template written to data/generated-registry.ts`);

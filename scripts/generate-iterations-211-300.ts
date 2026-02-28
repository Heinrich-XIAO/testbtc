import * as fs from 'fs';
import * as path from 'path';

const strategiesDir = path.join(__dirname, '../src/strategies');

// Template for strategy file
function generateStrategyFile(iteration: number, suffix: string, params: any, description: string): string {
  const className = `StratIter${iteration}${suffix.toUpperCase()}Strategy`;
  const interfaceName = `StratIter${iteration}${suffix.toUpperCase()}Params`;
  const fileName = `strat_iter${iteration}_${suffix}.ts`;
  const paramsFileName = `strat_iter${iteration}_${suffix}.params.json`;
  
  // Build default params object
  const defaults = Object.entries(params)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`)
    .join(', ');
  
  // Check if trailing stop variant
  const isTrailing = params.trailing_stop !== undefined;
  
  return `import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// ${description}

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

export interface ${interfaceName} extends StrategyParams { drop_pct: number; stop_loss: number; ${isTrailing ? 'trailing_stop: number;' : 'profit_target: number;'} max_hold: number; risk: number; }

export class ${className} extends BaseIterStrategy<${interfaceName}> {
  constructor(params: Partial<${interfaceName}> = {}) {
    super('${paramsFileName}', { ${defaults} }, params);
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
      ${isTrailing 
        ? `const trailingHit = bar.low <= newHp * (1 - this.params.trailing_stop);`
        : `const profitHit = bar.high >= e * (1 + this.params.profit_target);`
      }
      const holdExpired = barNum - eb >= this.params.max_hold;
      
      if (stopHit || ${isTrailing ? 'trailingHit' : 'profitHit'} || holdExpired) {
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
`;
}

// Generate all 450 strategies
const strategies: { iteration: number; suffix: string; params: any; desc: string }[] = [];

// ============ ITERATION 211-220: Higher Profit Targets (35-50%) ============
const stops = [0.04, 0.06, 0.08, 0.10, 0.12];
const profits = [0.35, 0.40, 0.45, 0.50];

// 211: 35% profit + various stops
stops.forEach((stop, i) => {
  strategies.push({
    iteration: 211,
    suffix: String.fromCharCode(97 + i), // a, b, c, d, e
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: 0.35, max_hold: 25, risk: 0.30 },
    desc: `35% profit target with ${(stop*100).toFixed(0)}% stop loss`
  });
});

// 212: 40% profit + various stops
stops.forEach((stop, i) => {
  strategies.push({
    iteration: 212,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: 0.40, max_hold: 25, risk: 0.30 },
    desc: `40% profit target with ${(stop*100).toFixed(0)}% stop loss`
  });
});

// 213: 45% profit + various stops
stops.forEach((stop, i) => {
  strategies.push({
    iteration: 213,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: 0.45, max_hold: 25, risk: 0.30 },
    desc: `45% profit target with ${(stop*100).toFixed(0)}% stop loss`
  });
});

// 214: 50% profit + various stops
stops.forEach((stop, i) => {
  strategies.push({
    iteration: 214,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: 0.50, max_hold: 25, risk: 0.30 },
    desc: `50% profit target with ${(stop*100).toFixed(0)}% stop loss`
  });
});

// 215-220: Combinations of best performers (testing different combinations)
const comboConfigs = [
  { iter: 215, profit: 0.35, stop: 0.08, hold: 30 },
  { iter: 216, profit: 0.40, stop: 0.08, hold: 30 },
  { iter: 217, profit: 0.45, stop: 0.10, hold: 30 },
  { iter: 218, profit: 0.50, stop: 0.10, hold: 35 },
  { iter: 219, profit: 0.40, stop: 0.12, hold: 35 },
  { iter: 220, profit: 0.50, stop: 0.12, hold: 40 },
];

comboConfigs.forEach(cfg => {
  ['a', 'b', 'c', 'd', 'e'].forEach((suffix, i) => {
    const risk = 0.30 + (i * 0.05); // 0.30, 0.35, 0.40, 0.45, 0.50
    strategies.push({
      iteration: cfg.iter,
      suffix,
      params: { drop_pct: 0.02, stop_loss: cfg.stop, profit_target: cfg.profit, max_hold: cfg.hold, risk },
      desc: `${(cfg.profit*100).toFixed(0)}% profit, ${(cfg.stop*100).toFixed(0)}% stop, ${cfg.hold} hold, ${(risk*100).toFixed(0)}% risk`
    });
  });
});

// ============ ITERATION 221-230: Drop % vs High Profit ============
const drops = [0.01, 0.02, 0.03];

// 221: 1% drop + 35-50% profit (4 variants + 1 combo)
[0.35, 0.40, 0.45, 0.50, 0.45].forEach((profit, i) => {
  const stop = i === 4 ? 0.10 : 0.12;
  const hold = i === 4 ? 30 : 25;
  strategies.push({
    iteration: 221,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.01, stop_loss: stop, profit_target: profit, max_hold: hold, risk: 0.30 },
    desc: `1% drop entry with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 222: 2% drop + 35-50% profit (baseline optimized)
[0.35, 0.40, 0.45, 0.50, 0.40].forEach((profit, i) => {
  const stop = i === 4 ? 0.08 : 0.12;
  strategies.push({
    iteration: 222,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: 25, risk: 0.30 },
    desc: `2% drop entry with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 223: 3% drop + 35-50% profit
[0.35, 0.40, 0.45, 0.50, 0.50].forEach((profit, i) => {
  const stop = i === 4 ? 0.12 : 0.12;
  const hold = i === 4 ? 35 : 25;
  strategies.push({
    iteration: 223,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.03, stop_loss: stop, profit_target: profit, max_hold: hold, risk: 0.30 },
    desc: `3% drop entry with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 224-230: Best combinations testing different drop/profit/stop combos
const dropProfitConfigs = [
  { iter: 224, drop: 0.01, profit: 0.40, stop: 0.08 },
  { iter: 225, drop: 0.01, profit: 0.45, stop: 0.10 },
  { iter: 226, drop: 0.02, profit: 0.35, stop: 0.06 },
  { iter: 227, drop: 0.02, profit: 0.50, stop: 0.10 },
  { iter: 228, drop: 0.03, profit: 0.40, stop: 0.08 },
  { iter: 229, drop: 0.03, profit: 0.50, stop: 0.12 },
  { iter: 230, drop: 0.015, profit: 0.45, stop: 0.09 }, // 1.5% drop sweet spot test
];

dropProfitConfigs.forEach(cfg => {
  ['a', 'b', 'c', 'd', 'e'].forEach((suffix, i) => {
    const hold = 25 + (i * 5); // 25, 30, 35, 40, 45
    strategies.push({
      iteration: cfg.iter,
      suffix,
      params: { drop_pct: cfg.drop, stop_loss: cfg.stop, profit_target: cfg.profit, max_hold: hold, risk: 0.30 },
      desc: `${(cfg.drop*100).toFixed(1)}% drop, ${(cfg.profit*100).toFixed(0)}% profit, ${(cfg.stop*100).toFixed(0)}% stop, ${hold} hold`
    });
  });
});

// ============ ITERATION 231-240: Trailing Stops ============
const trailingStops = [0.05, 0.10, 0.15];
const dropConfigs = [0.01, 0.02, 0.03];

// 231: 1% drop + trailing stops
[0.05, 0.10, 0.15, 0.10, 0.08].forEach((trail, i) => {
  const drop = i === 4 ? 0.015 : 0.01;
  const stop = i === 4 ? 0.08 : 0.12;
  strategies.push({
    iteration: 231,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: drop, stop_loss: stop, trailing_stop: trail, max_hold: 25, risk: 0.30 },
    desc: `1% drop with ${(trail*100).toFixed(0)}% trailing stop`
  });
});

// 232: 2% drop + trailing stops
[0.05, 0.10, 0.15, 0.08, 0.12].forEach((trail, i) => {
  const stop = i === 3 ? 0.08 : i === 4 ? 0.06 : 0.12;
  const hold = i === 4 ? 30 : 25;
  strategies.push({
    iteration: 232,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, trailing_stop: trail, max_hold: hold, risk: 0.30 },
    desc: `2% drop with ${(trail*100).toFixed(0)}% trailing stop`
  });
});

// 233: 3% drop + trailing stops
[0.05, 0.10, 0.15, 0.15, 0.10].forEach((trail, i) => {
  const stop = i === 3 ? 0.10 : i === 4 ? 0.08 : 0.12;
  strategies.push({
    iteration: 233,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.03, stop_loss: stop, trailing_stop: trail, max_hold: 25, risk: 0.30 },
    desc: `3% drop with ${(trail*100).toFixed(0)}% trailing stop`
  });
});

// 234-240: Trailing stop combinations
const trailingConfigs = [
  { iter: 234, drop: 0.01, trail: 0.05, stop: 0.06 },
  { iter: 235, drop: 0.01, trail: 0.10, stop: 0.08 },
  { iter: 236, drop: 0.02, trail: 0.05, stop: 0.06 },
  { iter: 237, drop: 0.02, trail: 0.10, stop: 0.08 },
  { iter: 238, drop: 0.02, trail: 0.15, stop: 0.10 },
  { iter: 239, drop: 0.03, trail: 0.10, stop: 0.08 },
  { iter: 240, drop: 0.015, trail: 0.08, stop: 0.08 }, // Balanced config
];

trailingConfigs.forEach(cfg => {
  ['a', 'b', 'c', 'd', 'e'].forEach((suffix, i) => {
    const hold = 20 + (i * 5); // 20, 25, 30, 35, 40
    const risk = 0.25 + (i * 0.05); // 0.25, 0.30, 0.35, 0.40, 0.45
    strategies.push({
      iteration: cfg.iter,
      suffix,
      params: { drop_pct: cfg.drop, stop_loss: cfg.stop, trailing_stop: cfg.trail, max_hold: hold, risk },
      desc: `${(cfg.drop*100).toFixed(1)}% drop, ${(cfg.trail*100).toFixed(0)}% trail, ${(cfg.stop*100).toFixed(0)}% stop, ${hold} hold, ${(risk*100).toFixed(0)}% risk`
    });
  });
});

// ============ ITERATION 241-250: Max Hold Variations ============
const holdTimes = [30, 40, 50];

// 241: 30 bar hold + 35-50% profit
[0.35, 0.40, 0.45, 0.50, 0.45].forEach((profit, i) => {
  const stop = [0.08, 0.10, 0.10, 0.12, 0.08][i];
  strategies.push({
    iteration: 241,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: 30, risk: 0.30 },
    desc: `30 bar hold with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 242: 40 bar hold + 35-50% profit
[0.35, 0.40, 0.45, 0.50, 0.50].forEach((profit, i) => {
  const stop = [0.08, 0.10, 0.12, 0.12, 0.10][i];
  strategies.push({
    iteration: 242,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: 40, risk: 0.30 },
    desc: `40 bar hold with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 243: 50 bar hold + 35-50% profit
[0.35, 0.40, 0.45, 0.50, 0.50].forEach((profit, i) => {
  const stop = [0.10, 0.12, 0.12, 0.15, 0.10][i];
  strategies.push({
    iteration: 243,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: 50, risk: 0.30 },
    desc: `50 bar hold with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 244-250: Combined hold/profit/stop variations
const holdConfigs = [
  { iter: 244, hold: 35, profit: 0.40, stop: 0.08 },
  { iter: 245, hold: 35, profit: 0.50, stop: 0.10 },
  { iter: 246, hold: 45, profit: 0.45, stop: 0.10 },
  { iter: 247, hold: 45, profit: 0.50, stop: 0.12 },
  { iter: 248, hold: 60, profit: 0.40, stop: 0.12 }, // Extended hold test
  { iter: 249, hold: 25, profit: 0.35, stop: 0.06 }, // Shorter hold
  { iter: 250, hold: 35, profit: 0.45, stop: 0.10 }, // Balanced
];

holdConfigs.forEach(cfg => {
  ['a', 'b', 'c', 'd', 'e'].forEach((suffix, i) => {
    const risk = 0.20 + (i * 0.10); // 0.20, 0.30, 0.40, 0.50, 0.60
    const drop = [0.01, 0.02, 0.03, 0.02, 0.015][i];
    strategies.push({
      iteration: cfg.iter,
      suffix,
      params: { drop_pct: drop, stop_loss: cfg.stop, profit_target: cfg.profit, max_hold: cfg.hold, risk },
      desc: `${cfg.hold} bar hold, ${(cfg.profit*100).toFixed(0)}% profit, ${(cfg.stop*100).toFixed(0)}% stop, ${(risk*100).toFixed(0)}% risk, ${(drop*100).toFixed(1)}% drop`
    });
  });
});

// ============ ITERATION 251-260: Risk % Variations ============
const riskLevels = [0.40, 0.50, 0.60, 0.70, 0.80];

// 251: 40% risk + various profit/stop combos
[0.35, 0.40, 0.45, 0.50, 0.45].forEach((profit, i) => {
  const stop = [0.08, 0.10, 0.10, 0.12, 0.08][i];
  const hold = [25, 25, 30, 30, 35][i];
  strategies.push({
    iteration: 251,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: hold, risk: 0.40 },
    desc: `40% risk with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 252: 50% risk + various profit/stop combos
[0.35, 0.40, 0.45, 0.50, 0.50].forEach((profit, i) => {
  const stop = [0.10, 0.10, 0.12, 0.12, 0.10][i];
  const hold = [25, 30, 30, 35, 35][i];
  strategies.push({
    iteration: 252,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: hold, risk: 0.50 },
    desc: `50% risk with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 253: 60% risk + various profit/stop combos
[0.40, 0.45, 0.50, 0.45, 0.50].forEach((profit, i) => {
  const stop = [0.10, 0.12, 0.12, 0.08, 0.10][i];
  const hold = [30, 30, 35, 25, 35][i];
  strategies.push({
    iteration: 253,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: hold, risk: 0.60 },
    desc: `60% risk with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 254: 70% risk + various profit/stop combos
[0.40, 0.45, 0.50, 0.50, 0.45].forEach((profit, i) => {
  const stop = [0.12, 0.12, 0.15, 0.10, 0.08][i];
  const hold = [30, 35, 35, 30, 25][i];
  strategies.push({
    iteration: 254,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: hold, risk: 0.70 },
    desc: `70% risk with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 255: 80% risk + various profit/stop combos
[0.40, 0.45, 0.50, 0.50, 0.45].forEach((profit, i) => {
  const stop = [0.12, 0.15, 0.15, 0.12, 0.10][i];
  const hold = [35, 35, 40, 30, 30][i];
  strategies.push({
    iteration: 255,
    suffix: String.fromCharCode(97 + i),
    params: { drop_pct: 0.02, stop_loss: stop, profit_target: profit, max_hold: hold, risk: 0.80 },
    desc: `80% risk with ${(profit*100).toFixed(0)}% profit target`
  });
});

// 256-260: Risk level variations with different drops and holds
const riskConfigs = [
  { iter: 256, risk: 0.45, drop: 0.01, profit: 0.40, stop: 0.08 },
  { iter: 257, risk: 0.55, drop: 0.015, profit: 0.45, stop: 0.10 },
  { iter: 258, risk: 0.65, drop: 0.02, profit: 0.50, stop: 0.10 },
  { iter: 259, risk: 0.75, drop: 0.025, profit: 0.50, stop: 0.12 },
  { iter: 260, risk: 0.50, drop: 0.02, profit: 0.45, stop: 0.10 },
];

riskConfigs.forEach(cfg => {
  ['a', 'b', 'c', 'd', 'e'].forEach((suffix, i) => {
    const hold = 25 + (i * 5); // 25, 30, 35, 40, 45
    strategies.push({
      iteration: cfg.iter,
      suffix,
      params: { drop_pct: cfg.drop, stop_loss: cfg.stop, profit_target: cfg.profit, max_hold: hold, risk: cfg.risk },
      desc: `${(cfg.risk*100).toFixed(0)}% risk, ${(cfg.drop*100).toFixed(1)}% drop, ${(cfg.profit*100).toFixed(0)}% profit, ${(cfg.stop*100).toFixed(0)}% stop, ${hold} hold`
    });
  });
});

// ============ ITERATION 261-300: Best Combinations Grid Search ============
const gridDrops = [0.01, 0.015, 0.02, 0.025, 0.03];
const gridStops = [0.08, 0.10, 0.12, 0.15];
const gridProfits = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50];
const gridHolds = [15, 20, 25, 30, 35, 40];
const gridRisks = [0.20, 0.30, 0.40, 0.50];

// Create 40 iterations (261-300) with different grid combinations
for (let iter = 261; iter <= 300; iter++) {
  const iterOffset = iter - 261;
  
  // For each iteration, create 5 strategies (a-e) with different parameter combinations
  ['a', 'b', 'c', 'd', 'e'].forEach((suffix, i) => {
    // Use iteration offset and suffix index to cycle through parameter combinations
    const dropIdx = (iterOffset + i) % gridDrops.length;
    const stopIdx = (iterOffset + i + 1) % gridStops.length;
    const profitIdx = (iterOffset + i + 2) % gridProfits.length;
    const holdIdx = (iterOffset + i) % gridHolds.length;
    const riskIdx = (iterOffset + i + 1) % gridRisks.length;
    
    const drop = gridDrops[dropIdx];
    const stop = gridStops[stopIdx];
    const profit = gridProfits[profitIdx];
    const hold = gridHolds[holdIdx];
    const risk = gridRisks[riskIdx];
    
    strategies.push({
      iteration: iter,
      suffix,
      params: { drop_pct: drop, stop_loss: stop, profit_target: profit, max_hold: hold, risk },
      desc: `Grid: ${(drop*100).toFixed(1)}% drop, ${(stop*100).toFixed(0)}% stop, ${(profit*100).toFixed(0)}% profit, ${hold} hold, ${(risk*100).toFixed(0)}% risk`
    });
  });
}

// Generate all files
console.log(`Generating ${strategies.length} strategy files...`);

strategies.forEach(({ iteration, suffix, params, desc }) => {
  const content = generateStrategyFile(iteration, suffix, params, desc);
  const fileName = `strat_iter${iteration}_${suffix}.ts`;
  const filePath = path.join(strategiesDir, fileName);
  fs.writeFileSync(filePath, content);
});

console.log(`Generated ${strategies.length} strategies successfully!`);
console.log('Iterations 211-220: Higher Profit Targets (35-50%)');
console.log('Iterations 221-230: Drop % vs High Profit');
console.log('Iterations 231-240: Trailing Stops');
console.log('Iterations 241-250: Max Hold Variations');
console.log('Iterations 251-260: Risk % Variations');
console.log('Iterations 261-300: Best Combinations Grid Search');

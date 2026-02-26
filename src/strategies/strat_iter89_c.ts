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

function savitzkyGolayCoeffs(windowSize: number, polyOrder: number, derivOrder: number): number[] {
  const halfWindow = Math.floor(windowSize / 2);
  const n = windowSize;
  const m = polyOrder + 1;
  
  const J: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    const x = i - halfWindow;
    for (let j = 0; j < m; j++) {
      row.push(Math.pow(x, j));
    }
    J.push(row);
  }
  
  const JT: number[][] = [];
  for (let j = 0; j < m; j++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++) {
      row.push(J[i][j]);
    }
    JT.push(row);
  }
  
  const JTJ: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += JT[i][k] * J[k][j];
      }
      row.push(sum);
    }
    JTJ.push(row);
  }
  
  const inv: number[][] = [];
  for (let i = 0; i < m; i++) {
    inv.push(new Array(m).fill(0));
  }
  for (let i = 0; i < m; i++) {
    inv[i][i] = 1;
  }
  
  const aug = JTJ.map((row, i) => [...row, ...inv[i]]);
  
  for (let col = 0; col < m; col++) {
    let maxRow = col;
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    
    for (let j = 0; j < 2 * m; j++) {
      aug[col][j] /= pivot;
    }
    
    for (let row = 0; row < m; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        for (let j = 0; j < 2 * m; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }
  }
  
  const invJTJ: number[][] = [];
  for (let i = 0; i < m; i++) {
    invJTJ.push(aug[i].slice(m));
  }
  
  const coeffs: number[] = [];
  for (let i = 0; i < n; i++) {
    let coeff = 0;
    for (let j = 0; j < m; j++) {
      coeff += invJTJ[derivOrder][j] * Math.pow(i - halfWindow, j);
    }
    coeffs.push(coeff);
  }
  
  const factorial = (n: number): number => {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  };
  
  const derivFactor = factorial(derivOrder);
  for (let i = 0; i < n; i++) {
    coeffs[i] *= derivFactor;
  }
  
  return coeffs;
}

function savitzkyGolaySmooth(data: number[], windowSize: number, polyOrder: number): number[] {
  if (data.length < windowSize) return [];
  
  const coeffs = savitzkyGolayCoeffs(windowSize, polyOrder, 0);
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = halfWindow; i < data.length - halfWindow; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += coeffs[j] * data[i - halfWindow + j];
    }
    result.push(sum);
  }
  
  return result;
}

function savitzkyGolayDerivative(data: number[], windowSize: number, polyOrder: number, derivOrder: number = 1): number[] {
  if (data.length < windowSize) return [];
  
  const coeffs = savitzkyGolayCoeffs(windowSize, polyOrder, derivOrder);
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = halfWindow; i < data.length - halfWindow; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += coeffs[j] * data[i - halfWindow + j];
    }
    result.push(sum);
  }
  
  return result;
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

export interface StratIter89CParams extends StrategyParams {
  sg_window: number;
  sg_polyorder: number;
  derivative_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  sr_lookback: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter89CStrategy extends BaseIterStrategy<StratIter89CParams> {
  private smoothPrices: Map<string, number[]> = new Map();
  private derivatives: Map<string, number[]> = new Map();
  private kVals: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter89CParams> = {}) {
    super('strat_iter89_c.params.json', {
      sg_window: 7,
      sg_polyorder: 3,
      derivative_threshold: 0.0005,
      stoch_k_period: 14,
      stoch_oversold: 16,
      sr_lookback: 50,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.smoothPrices.has(bar.tokenId)) this.smoothPrices.set(bar.tokenId, []);
    if (!this.derivatives.has(bar.tokenId)) this.derivatives.set(bar.tokenId, []);
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);

    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          (sr && bar.high >= sr.resistance * 0.98) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || series.closes.length < this.params.sg_window + 2) return;

    const windowSize = Math.min(this.params.sg_window, series.closes.length);
    const polyOrder = Math.min(this.params.sg_polyorder, windowSize - 1);
    
    const smoothed = savitzkyGolaySmooth(series.closes, windowSize, polyOrder);
    const derivs = savitzkyGolayDerivative(series.closes, windowSize, polyOrder, 1);

    if (smoothed.length < 2 || derivs.length < 1) return;

    const smoothArr = this.smoothPrices.get(bar.tokenId)!;
    capPush(smoothArr, smoothed[smoothed.length - 1]);
    
    const derivArr = this.derivatives.get(bar.tokenId)!;
    capPush(derivArr, derivs[derivs.length - 1]);

    if (derivArr.length < 2) return;

    const currentDeriv = derivArr[derivArr.length - 1];
    const prevDeriv = derivArr[derivArr.length - 2];
    
    const turningPoint = prevDeriv < 0 && currentDeriv >= this.params.derivative_threshold;
    
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (turningPoint && nearSupport && stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

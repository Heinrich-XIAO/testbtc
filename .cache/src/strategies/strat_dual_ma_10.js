"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DualMAStrategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    fast_period: 5,
    slow_period: 12,
    trend_period: 25,
    stop_loss: 0.05,
    trailing_stop_pct: 0.03,
    risk_percent: 0.10,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_dual_ma_10.params.json');
    if (!fs.existsSync(paramsPath))
        return null;
    try {
        const content = fs.readFileSync(paramsPath, 'utf-8');
        const saved = JSON.parse(content);
        const params = {};
        for (const [key, value] of Object.entries(saved)) {
            if (key !== 'metadata' && key in defaultParams) {
                if (typeof value === 'number') {
                    params[key] = value;
                }
            }
        }
        return params;
    }
    catch {
        return null;
    }
}
class DualMAStrategy {
    constructor(params = {}) {
        // Per-token indicators
        this.fastMAs = new Map();
        this.slowMAs = new Map();
        this.trendMAs = new Map();
        this.crossovers = new Map();
        // Per-token position tracking
        this.buyPrice = new Map();
        this.highestPrice = new Map();
        const savedParams = loadSavedParams();
        const mergedParams = { ...defaultParams, ...savedParams, ...params };
        // Ensure fast < slow < trend
        let fast = mergedParams.fast_period;
        let slow = mergedParams.slow_period;
        let trend = mergedParams.trend_period;
        // Sort the three periods so fast < slow < trend
        const sorted = [fast, slow, trend].sort((a, b) => a - b);
        fast = sorted[0];
        slow = sorted[1];
        trend = sorted[2];
        this.params = {
            fast_period: fast,
            slow_period: slow,
            trend_period: trend,
            stop_loss: mergedParams.stop_loss,
            trailing_stop_pct: mergedParams.trailing_stop_pct,
            risk_percent: mergedParams.risk_percent,
        };
    }
    getIndicators(tokenId) {
        if (!this.fastMAs.has(tokenId)) {
            const fastMA = new types_1.SimpleMovingAverage(this.params.fast_period);
            const slowMA = new types_1.SimpleMovingAverage(this.params.slow_period);
            const trendMA = new types_1.SimpleMovingAverage(this.params.trend_period);
            const crossover = new types_1.CrossOver(fastMA, slowMA);
            this.fastMAs.set(tokenId, fastMA);
            this.slowMAs.set(tokenId, slowMA);
            this.trendMAs.set(tokenId, trendMA);
            this.crossovers.set(tokenId, crossover);
        }
        return {
            fastMA: this.fastMAs.get(tokenId),
            slowMA: this.slowMAs.get(tokenId),
            trendMA: this.trendMAs.get(tokenId),
            crossover: this.crossovers.get(tokenId),
        };
    }
    onInit(_ctx) {
        console.log(`DualMAStrategy initialized with params:`);
        console.log(`  Fast MA period: ${this.params.fast_period}`);
        console.log(`  Slow MA period: ${this.params.slow_period}`);
        console.log(`  Trend MA period: ${this.params.trend_period}`);
        console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
        console.log(`  Trailing stop: ${(this.params.trailing_stop_pct * 100).toFixed(1)}%`);
        console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
    }
    onNext(ctx, bar) {
        const { fastMA, slowMA, trendMA, crossover } = this.getIndicators(bar.tokenId);
        // Update all indicators with current price
        fastMA.update(bar.close);
        slowMA.update(bar.close);
        trendMA.update(bar.close);
        crossover.update();
        const crossoverValue = crossover.get(0);
        const trendValue = trendMA.get(0);
        const position = ctx.getPosition(bar.tokenId);
        // --- Exit logic ---
        if (position && position.size > 0) {
            const entry = this.buyPrice.get(bar.tokenId);
            if (entry !== undefined) {
                // Fixed stop loss
                const stopPrice = entry * (1 - this.params.stop_loss);
                if (bar.close <= stopPrice) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} entry=${entry.toFixed(4)}`);
                    ctx.close(bar.tokenId);
                    this.buyPrice.delete(bar.tokenId);
                    this.highestPrice.delete(bar.tokenId);
                    return;
                }
                // Trailing stop
                const prevHighest = this.highestPrice.get(bar.tokenId) ?? entry;
                const highest = Math.max(prevHighest, bar.close);
                this.highestPrice.set(bar.tokenId, highest);
                const drawdown = (highest - bar.close) / highest;
                if (drawdown >= this.params.trailing_stop_pct && bar.close > entry) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TRAILING STOP ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} highest=${highest.toFixed(4)} drawdown=${(drawdown * 100).toFixed(1)}%`);
                    ctx.close(bar.tokenId);
                    this.buyPrice.delete(bar.tokenId);
                    this.highestPrice.delete(bar.tokenId);
                    return;
                }
                // Bearish crossover exit
                if (crossoverValue !== undefined && crossoverValue < 0) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] SELL crossover ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
                    ctx.close(bar.tokenId);
                    this.buyPrice.delete(bar.tokenId);
                    this.highestPrice.delete(bar.tokenId);
                    return;
                }
            }
            return;
        }
        // --- Entry logic ---
        // Don't trade near extremes
        if (bar.close < 0.05 || bar.close > 0.95) {
            return;
        }
        // Buy on bullish crossover IF price is above trend MA (uptrend confirmed)
        if (crossoverValue !== undefined && crossoverValue > 0) {
            if (trendValue !== undefined && bar.close > trendValue) {
                const feeBuffer = 0.995;
                const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} trendMA=${trendValue.toFixed(4)}`);
                    const result = ctx.buy(bar.tokenId, size);
                    if (result.success) {
                        this.buyPrice.set(bar.tokenId, bar.close);
                        this.highestPrice.set(bar.tokenId, bar.close);
                    }
                    else {
                        console.error(`  Order failed: ${result.error}`);
                    }
                }
            }
        }
    }
    onComplete(ctx) {
        console.log('\nStrategy completed.');
        const positions = ctx.portfolio.getAllPositions();
        if (positions.length > 0) {
            console.log(`Open positions: ${positions.length}`);
            for (const pos of positions) {
                console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
            }
        }
    }
}
exports.DualMAStrategy = DualMAStrategy;

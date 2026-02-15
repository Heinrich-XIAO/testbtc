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
exports.StochAdaptiveStrategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    min_k_period: 3,
    max_k_period: 14,
    d_period: 3,
    percentile_lookback: 20,
    oversold_percentile: 15,
    overbought_percentile: 85,
    atr_period: 14,
    min_atr_threshold: 0.005,
    volatility_scale: 50,
    stop_loss: 0.04,
    risk_percent: 0.1,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_stoch_adaptive_204.params.json');
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
/**
 * Calculate the p-th percentile of an array of values
 */
function percentile(values, p) {
    if (values.length === 0)
        return 50;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (upper >= sorted.length)
        return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
/**
 * Calculate the average of an array
 */
function mean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}
class StochAdaptiveStrategy {
    constructor(params = {}) {
        // Per-token price history for stochastic calculation
        this.priceHistory = new Map();
        this.kValues = new Map();
        this.entryPrice = new Map();
        // Per-token ATR indicators
        this.atrIndicators = new Map();
        // Per-token k-value history for adaptive levels
        this.kHistory = new Map();
        // Per-token volatility tracking
        this.atrHistory = new Map();
        const savedParams = loadSavedParams();
        const mergedParams = { ...defaultParams, ...savedParams, ...params };
        // Ensure integer periods
        const minKPeriod = Math.max(2, Math.floor(mergedParams.min_k_period));
        const maxKPeriod = Math.max(minKPeriod + 1, Math.floor(mergedParams.max_k_period));
        this.params = {
            min_k_period: minKPeriod,
            max_k_period: maxKPeriod,
            d_period: Math.max(2, Math.floor(mergedParams.d_period)),
            percentile_lookback: Math.max(5, Math.floor(mergedParams.percentile_lookback)),
            oversold_percentile: mergedParams.oversold_percentile,
            overbought_percentile: mergedParams.overbought_percentile,
            atr_period: Math.max(5, Math.floor(mergedParams.atr_period)),
            min_atr_threshold: mergedParams.min_atr_threshold,
            volatility_scale: mergedParams.volatility_scale,
            stop_loss: mergedParams.stop_loss,
            risk_percent: mergedParams.risk_percent,
        };
    }
    getATR(tokenId) {
        let atr = this.atrIndicators.get(tokenId);
        if (!atr) {
            atr = new types_1.ATR(this.params.atr_period);
            this.atrIndicators.set(tokenId, atr);
        }
        return atr;
    }
    getAdaptiveKPeriod(tokenId, currentATR, currentPrice) {
        const atrHistory = this.atrHistory.get(tokenId) || [];
        if (atrHistory.length < 5) {
            return Math.floor((this.params.min_k_period + this.params.max_k_period) / 2);
        }
        // Calculate relative volatility
        const avgATR = mean(atrHistory);
        const relVol = avgATR > 0 ? currentATR / avgATR : 1;
        // Map volatility to k_period: high vol = short period (responsive), low vol = long period (smooth)
        const volScale = Math.min(1, Math.max(0, (relVol - 0.5) * this.params.volatility_scale));
        const adaptivePeriod = Math.floor(this.params.max_k_period - (this.params.max_k_period - this.params.min_k_period) * volScale);
        return Math.max(this.params.min_k_period, Math.min(this.params.max_k_period, adaptivePeriod));
    }
    getAdaptiveLevels(tokenId) {
        const kHistory = this.kHistory.get(tokenId) || [];
        if (kHistory.length < this.params.percentile_lookback) {
            return { oversold: 20, overbought: 80 };
        }
        const oversold = percentile(kHistory, this.params.oversold_percentile);
        const overbought = percentile(kHistory, this.params.overbought_percentile);
        return { oversold, overbought };
    }
    checkVolatilityThreshold(tokenId, currentATR, currentPrice) {
        if (currentPrice <= 0)
            return false;
        const relATR = currentATR / currentPrice;
        return relATR >= this.params.min_atr_threshold;
    }
    onInit(_ctx) { }
    onNext(ctx, bar) {
        // Initialize per-token maps if needed
        if (!this.priceHistory.has(bar.tokenId)) {
            this.priceHistory.set(bar.tokenId, []);
            this.kValues.set(bar.tokenId, []);
            this.kHistory.set(bar.tokenId, []);
            this.atrHistory.set(bar.tokenId, []);
        }
        const history = this.priceHistory.get(bar.tokenId);
        const kVals = this.kValues.get(bar.tokenId);
        const kHistory = this.kHistory.get(bar.tokenId);
        const atrHistory = this.atrHistory.get(bar.tokenId);
        // Update ATR
        const atr = this.getATR(bar.tokenId);
        atr.update(bar.high, bar.low, bar.close);
        const currentATR = atr.get(0);
        if (currentATR !== undefined) {
            atrHistory.push(currentATR);
            if (atrHistory.length > this.params.atr_period * 2) {
                atrHistory.shift();
            }
        }
        // Check volatility threshold before proceeding
        const isVolatileEnough = currentATR !== undefined &&
            this.checkVolatilityThreshold(bar.tokenId, currentATR, bar.close);
        // Get adaptive k_period based on current volatility
        const kPeriod = this.getAdaptiveKPeriod(bar.tokenId, currentATR || 0, bar.close);
        // Update price history with adaptive period
        history.push(bar.close);
        const maxHistoryLen = Math.max(kPeriod, this.params.max_k_period) + 5;
        if (history.length > maxHistoryLen) {
            history.shift();
        }
        // Need enough data for stochastic calculation
        if (history.length < kPeriod)
            return;
        // Calculate %K
        const periodHistory = history.slice(-kPeriod);
        const highest = Math.max(...periodHistory);
        const lowest = Math.min(...periodHistory);
        const k = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
        // Store k for %D calculation and history tracking
        kVals.push(k);
        if (kVals.length > this.params.d_period) {
            kVals.shift();
        }
        // Store k in history for percentile calculation
        kHistory.push(k);
        if (kHistory.length > this.params.percentile_lookback) {
            kHistory.shift();
        }
        // Need enough k values for %D
        if (kVals.length < this.params.d_period)
            return;
        // Calculate %D (SMA of %K)
        const d = kVals.reduce((a, b) => a + b, 0) / kVals.length;
        // Get adaptive oversold/overbought levels
        const levels = this.getAdaptiveLevels(bar.tokenId);
        const position = ctx.getPosition(bar.tokenId);
        // Handle existing position
        if (position && position.size > 0) {
            const entry = this.entryPrice.get(bar.tokenId);
            if (entry) {
                // Stop loss check
                if (bar.close < entry * (1 - this.params.stop_loss)) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    return;
                }
                // Exit when %K reaches overbought and crosses below %D
                if (k >= levels.overbought && k < d) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                }
            }
        }
        else if (bar.close > 0.05 && bar.close < 0.95) {
            // Only enter if volatility is above threshold
            if (!isVolatileEnough)
                return;
            // Entry: %K at or below adaptive oversold and crossing above %D
            if (k <= levels.oversold && k > d) {
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
    onComplete(_ctx) { }
}
exports.StochAdaptiveStrategy = StochAdaptiveStrategy;

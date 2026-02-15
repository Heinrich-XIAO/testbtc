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
exports.StochV20Tweak201Strategy = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    k_period: 8,
    d_period: 3,
    oversold_base: 20,
    overbought_base: 80,
    volatility_period: 20,
    level_adjustment_factor: 10,
    stop_loss: 0.08,
    risk_percent: 0.15,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_stoch_v20_tweak_201.params.json');
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
function stddev(values) {
    if (values.length < 2)
        return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0);
    return Math.sqrt(sqDiffs / values.length);
}
class StochV20Tweak201Strategy {
    constructor(params = {}) {
        this.priceHistory = new Map();
        this.highHistory = new Map();
        this.lowHistory = new Map();
        this.kValues = new Map();
        this.entryPrice = new Map();
        const savedParams = loadSavedParams();
        const merged = { ...defaultParams, ...savedParams, ...params };
        this.params = merged;
        // Clamp k_period to range 6-12
        this.params.k_period = Math.max(6, Math.min(12, Math.floor(this.params.k_period)));
        this.params.d_period = Math.max(2, Math.floor(this.params.d_period));
    }
    onInit(_ctx) { }
    getVolatilityAdjustedLevels(tokenId) {
        const history = this.priceHistory.get(tokenId) || [];
        if (history.length < this.params.volatility_period) {
            return {
                oversold: this.params.oversold_base,
                overbought: this.params.overbought_base,
            };
        }
        const relevantHistory = history.slice(-this.params.volatility_period);
        const vol = stddev(relevantHistory);
        const meanPrice = relevantHistory.reduce((a, b) => a + b, 0) / relevantHistory.length;
        const volatilityPct = meanPrice > 0 ? (vol / meanPrice) * 100 : 0;
        // Adjust levels: higher volatility = wider levels
        const adjustment = volatilityPct * this.params.level_adjustment_factor / 10;
        return {
            oversold: Math.max(5, this.params.oversold_base - adjustment),
            overbought: Math.min(95, this.params.overbought_base + adjustment),
        };
    }
    onNext(ctx, bar) {
        if (!this.priceHistory.has(bar.tokenId)) {
            this.priceHistory.set(bar.tokenId, []);
            this.highHistory.set(bar.tokenId, []);
            this.lowHistory.set(bar.tokenId, []);
            this.kValues.set(bar.tokenId, []);
        }
        const history = this.priceHistory.get(bar.tokenId);
        const highHistory = this.highHistory.get(bar.tokenId);
        const lowHistory = this.lowHistory.get(bar.tokenId);
        const kVals = this.kValues.get(bar.tokenId);
        // Update histories
        history.push(bar.close);
        highHistory.push(bar.high);
        lowHistory.push(bar.low);
        // Maintain buffer sizes
        const maxPeriod = Math.max(this.params.k_period, this.params.volatility_period);
        if (history.length > maxPeriod)
            history.shift();
        if (highHistory.length > maxPeriod)
            highHistory.shift();
        if (lowHistory.length > maxPeriod)
            lowHistory.shift();
        // Need enough data for stochastic calculation
        if (history.length < this.params.k_period)
            return;
        // Calculate %K using high/low for the period
        const periodHighs = highHistory.slice(-this.params.k_period);
        const periodLows = lowHistory.slice(-this.params.k_period);
        const highest = Math.max(...periodHighs);
        const lowest = Math.min(...periodLows);
        const k = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
        kVals.push(k);
        if (kVals.length > this.params.d_period)
            kVals.shift();
        if (kVals.length < this.params.d_period)
            return;
        const d = kVals.reduce((a, b) => a + b, 0) / kVals.length;
        const position = ctx.getPosition(bar.tokenId);
        // Get adaptive levels based on volatility
        const { oversold, overbought } = this.getVolatilityAdjustedLevels(bar.tokenId);
        if (position && position.size > 0) {
            const entry = this.entryPrice.get(bar.tokenId);
            if (entry) {
                if (bar.close < entry * (1 - this.params.stop_loss)) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    return;
                }
                if (k >= overbought && k < d) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                }
            }
        }
        else if (bar.close > 0.05 && bar.close < 0.95) {
            if (k <= oversold && k > d) {
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
exports.StochV20Tweak201Strategy = StochV20Tweak201Strategy;

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
exports.StochV09Tweak203Strategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    k_period: 10,
    d_period: 4,
    oversold: 25,
    overbought: 75,
    rsi_period: 14,
    rsi_oversold_max: 40,
    rsi_overbought_min: 60,
    divergence_lookback: 5,
    enable_divergence: true,
    enable_rsi_confirm: true,
    profit_level_1: 0.05,
    profit_level_2: 0.10,
    partial_close_pct_1: 0.5,
    partial_close_pct_2: 0.5,
    stop_loss: 0.07,
    risk_percent: 0.15,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_stoch_v09_tweak_203.params.json');
    if (!fs.existsSync(paramsPath))
        return null;
    try {
        const content = fs.readFileSync(paramsPath, 'utf-8');
        const saved = JSON.parse(content);
        const params = {};
        for (const [key, value] of Object.entries(saved)) {
            if (key !== 'metadata' && key in defaultParams) {
                if (typeof value === 'number' || typeof value === 'boolean') {
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
class StochV09Tweak203Strategy {
    constructor(params = {}) {
        this.priceHistory = new Map();
        this.kValues = new Map();
        this.priceKHistory = new Map();
        this.rsiMap = new Map();
        this.entryPrice = new Map();
        this.initialSize = new Map();
        this.profitLevel1Hit = new Map();
        this.profitLevel2Hit = new Map();
        const savedParams = loadSavedParams();
        const merged = { ...defaultParams, ...(savedParams || {}), ...params };
        this.params = merged;
        this.params.k_period = Math.max(3, Math.floor(this.params.k_period));
        this.params.d_period = Math.max(2, Math.floor(this.params.d_period));
        this.params.rsi_period = Math.max(3, Math.floor(this.params.rsi_period));
        this.params.divergence_lookback = Math.max(3, Math.floor(this.params.divergence_lookback));
    }
    onInit(_ctx) { }
    calculateStochastic(history) {
        const highest = Math.max(...history);
        const lowest = Math.min(...history);
        return highest === lowest ? 50 : ((history[history.length - 1] - lowest) / (highest - lowest)) * 100;
    }
    detectBullishDivergence(priceKHist) {
        if (priceKHist.length < this.params.divergence_lookback * 2)
            return false;
        const lookback = this.params.divergence_lookback;
        const recent = priceKHist.slice(-lookback);
        const previous = priceKHist.slice(-lookback * 2, -lookback);
        const recentLowPrice = Math.min(...recent.map(p => p.price));
        const prevLowPrice = Math.min(...previous.map(p => p.price));
        const recentLowK = Math.min(...recent.map(p => p.k));
        const prevLowK = Math.min(...previous.map(p => p.k));
        const priceMakingLowerLows = recentLowPrice < prevLowPrice * 0.99;
        const stochMakingHigherLows = recentLowK > prevLowK * 1.01;
        return priceMakingLowerLows && stochMakingHigherLows;
    }
    detectBearishDivergence(priceKHist) {
        if (priceKHist.length < this.params.divergence_lookback * 2)
            return false;
        const lookback = this.params.divergence_lookback;
        const recent = priceKHist.slice(-lookback);
        const previous = priceKHist.slice(-lookback * 2, -lookback);
        const recentHighPrice = Math.max(...recent.map(p => p.price));
        const prevHighPrice = Math.max(...previous.map(p => p.price));
        const recentHighK = Math.max(...recent.map(p => p.k));
        const prevHighK = Math.max(...previous.map(p => p.k));
        const priceMakingHigherHighs = recentHighPrice > prevHighPrice * 1.01;
        const stochMakingLowerHighs = recentHighK < prevHighK * 0.99;
        return priceMakingHigherHighs && stochMakingLowerHighs;
    }
    onNext(ctx, bar) {
        if (!this.priceHistory.has(bar.tokenId)) {
            this.priceHistory.set(bar.tokenId, []);
            this.kValues.set(bar.tokenId, []);
            this.priceKHistory.set(bar.tokenId, []);
            this.rsiMap.set(bar.tokenId, new types_1.RSI(this.params.rsi_period));
        }
        const history = this.priceHistory.get(bar.tokenId);
        const kVals = this.kValues.get(bar.tokenId);
        const priceKHist = this.priceKHistory.get(bar.tokenId);
        const rsi = this.rsiMap.get(bar.tokenId);
        history.push(bar.close);
        rsi.update(bar.close);
        if (history.length > this.params.k_period)
            history.shift();
        if (history.length < this.params.k_period)
            return;
        const k = this.calculateStochastic(history);
        kVals.push(k);
        priceKHist.push({ price: bar.close, k });
        if (kVals.length > this.params.d_period)
            kVals.shift();
        if (priceKHist.length > this.params.divergence_lookback * 3)
            priceKHist.shift();
        if (kVals.length < this.params.d_period)
            return;
        const d = kVals.reduce((a, b) => a + b, 0) / kVals.length;
        const rsiVal = rsi.get(0);
        const position = ctx.getPosition(bar.tokenId);
        if (position && position.size > 0) {
            const entry = this.entryPrice.get(bar.tokenId);
            if (!entry)
                return;
            // Stop loss
            if (bar.close < entry * (1 - this.params.stop_loss)) {
                ctx.close(bar.tokenId);
                this.entryPrice.delete(bar.tokenId);
                this.initialSize.delete(bar.tokenId);
                this.profitLevel1Hit.delete(bar.tokenId);
                this.profitLevel2Hit.delete(bar.tokenId);
                return;
            }
            const pl1Hit = this.profitLevel1Hit.get(bar.tokenId) || false;
            const pl2Hit = this.profitLevel2Hit.get(bar.tokenId) || false;
            const initialPosSize = this.initialSize.get(bar.tokenId) || position.size;
            // Partial profit taking at level 1
            if (!pl1Hit && bar.close >= entry * (1 + this.params.profit_level_1)) {
                const closeSize = initialPosSize * this.params.partial_close_pct_1;
                if (closeSize > 0 && closeSize < position.size) {
                    ctx.sell(bar.tokenId, closeSize);
                }
                this.profitLevel1Hit.set(bar.tokenId, true);
            }
            // Partial profit taking at level 2
            if (pl1Hit && !pl2Hit && bar.close >= entry * (1 + this.params.profit_level_2)) {
                const remainingSize = position.size;
                if (remainingSize > 0) {
                    ctx.sell(bar.tokenId, remainingSize);
                }
                this.profitLevel2Hit.set(bar.tokenId, true);
                this.entryPrice.delete(bar.tokenId);
                this.initialSize.delete(bar.tokenId);
                return;
            }
            // Regular exit conditions
            const bearishDiv = this.params.enable_divergence && this.detectBearishDivergence(priceKHist);
            if (k >= this.params.overbought && k < d && !bearishDiv) {
                ctx.close(bar.tokenId);
                this.entryPrice.delete(bar.tokenId);
                this.initialSize.delete(bar.tokenId);
                this.profitLevel1Hit.delete(bar.tokenId);
                this.profitLevel2Hit.delete(bar.tokenId);
            }
        }
        else if (bar.close > 0.05 && bar.close < 0.95) {
            // Entry conditions
            const stochOversold = k <= this.params.oversold && k > d;
            const bullishDiv = this.params.enable_divergence && this.detectBullishDivergence(priceKHist);
            const rsiConfirm = !this.params.enable_rsi_confirm || (rsiVal !== undefined && rsiVal <= this.params.rsi_oversold_max);
            if ((stochOversold || bullishDiv) && rsiConfirm) {
                const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                    const result = ctx.buy(bar.tokenId, size);
                    if (result.success) {
                        this.entryPrice.set(bar.tokenId, bar.close);
                        this.initialSize.set(bar.tokenId, size);
                        this.profitLevel1Hit.set(bar.tokenId, false);
                        this.profitLevel2Hit.set(bar.tokenId, false);
                    }
                }
            }
        }
    }
    onComplete(_ctx) { }
}
exports.StochV09Tweak203Strategy = StochV09Tweak203Strategy;

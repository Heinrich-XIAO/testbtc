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
exports.MeanReversionBandV208Strategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    bb_period: 20,
    bb_stddev_mult: 2.0,
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    stop_loss: 0.05,
    trailing_stop: 0.03,
    risk_percent: 0.1,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_mean_reversion_band_208.params.json');
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
class MeanReversionBandV208Strategy {
    constructor(params = {}) {
        this.smaMap = new Map();
        this.rsiMap = new Map();
        this.priceHistoryMap = new Map();
        this.entryPriceMap = new Map();
        this.highestPriceMap = new Map();
        this.lowestPriceMap = new Map();
        this.prevPriceMap = new Map();
        this.positionSideMap = new Map();
        const savedParams = loadSavedParams() ?? {};
        const merged = { ...defaultParams };
        for (const [key, value] of Object.entries(savedParams)) {
            if (typeof value === 'number' && key in defaultParams) {
                merged[key] = value;
            }
        }
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'number' && key in defaultParams) {
                merged[key] = value;
            }
        }
        this.params = merged;
    }
    onInit(_ctx) { }
    calculateBollingerBands(prices) {
        const period = Math.max(3, Math.floor(this.params.bb_period));
        if (prices.length < period)
            return undefined;
        const recentPrices = prices.slice(-period);
        const sum = recentPrices.reduce((a, b) => a + b, 0);
        const mean = sum / period;
        const squaredDiffs = recentPrices.map((p) => Math.pow(p - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const stddev = Math.sqrt(variance);
        const multiplier = Math.max(0.5, this.params.bb_stddev_mult);
        return {
            upper: mean + multiplier * stddev,
            middle: mean,
            lower: mean - multiplier * stddev,
        };
    }
    isRising(priceHistory) {
        if (priceHistory.length < 2)
            return false;
        const current = priceHistory[priceHistory.length - 1];
        const previous = priceHistory[priceHistory.length - 2];
        return current > previous;
    }
    isFalling(priceHistory) {
        if (priceHistory.length < 2)
            return false;
        const current = priceHistory[priceHistory.length - 1];
        const previous = priceHistory[priceHistory.length - 2];
        return current < previous;
    }
    onNext(ctx, bar) {
        const period = Math.max(3, Math.floor(this.params.bb_period));
        if (!this.smaMap.has(bar.tokenId)) {
            this.smaMap.set(bar.tokenId, new types_1.SimpleMovingAverage(period));
            this.rsiMap.set(bar.tokenId, new types_1.RSI(Math.max(3, Math.floor(this.params.rsi_period))));
            this.priceHistoryMap.set(bar.tokenId, []);
        }
        const sma = this.smaMap.get(bar.tokenId);
        const rsi = this.rsiMap.get(bar.tokenId);
        const priceHistory = this.priceHistoryMap.get(bar.tokenId);
        sma.update(bar.close);
        rsi.update(bar.close);
        priceHistory.push(bar.close);
        if (priceHistory.length > period * 2) {
            priceHistory.shift();
        }
        const bb = this.calculateBollingerBands(priceHistory);
        const rsiVal = rsi.get(0);
        if (!bb || rsiVal === undefined)
            return;
        const position = ctx.getPosition(bar.tokenId);
        const side = this.positionSideMap.get(bar.tokenId);
        if (position && position.size > 0) {
            const entry = this.entryPriceMap.get(bar.tokenId);
            if (!entry)
                return;
            if (side === 'long') {
                if (bar.close < entry * (1 - this.params.stop_loss)) {
                    ctx.close(bar.tokenId);
                    this.entryPriceMap.delete(bar.tokenId);
                    this.highestPriceMap.delete(bar.tokenId);
                    this.lowestPriceMap.delete(bar.tokenId);
                    this.positionSideMap.delete(bar.tokenId);
                    return;
                }
                const highest = Math.max(this.highestPriceMap.get(bar.tokenId) ?? entry, bar.close);
                this.highestPriceMap.set(bar.tokenId, highest);
                if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
                    ctx.close(bar.tokenId);
                    this.entryPriceMap.delete(bar.tokenId);
                    this.highestPriceMap.delete(bar.tokenId);
                    this.lowestPriceMap.delete(bar.tokenId);
                    this.positionSideMap.delete(bar.tokenId);
                    return;
                }
                if (bar.close >= bb.middle || rsiVal >= this.params.rsi_overbought) {
                    ctx.close(bar.tokenId);
                    this.entryPriceMap.delete(bar.tokenId);
                    this.highestPriceMap.delete(bar.tokenId);
                    this.lowestPriceMap.delete(bar.tokenId);
                    this.positionSideMap.delete(bar.tokenId);
                    return;
                }
            }
            else if (side === 'short') {
                if (bar.close > entry * (1 + this.params.stop_loss)) {
                    ctx.close(bar.tokenId);
                    this.entryPriceMap.delete(bar.tokenId);
                    this.highestPriceMap.delete(bar.tokenId);
                    this.lowestPriceMap.delete(bar.tokenId);
                    this.positionSideMap.delete(bar.tokenId);
                    return;
                }
                const lowest = Math.min(this.lowestPriceMap.get(bar.tokenId) ?? entry, bar.close);
                this.lowestPriceMap.set(bar.tokenId, lowest);
                if (bar.close > lowest * (1 + this.params.trailing_stop) && bar.close < entry) {
                    ctx.close(bar.tokenId);
                    this.entryPriceMap.delete(bar.tokenId);
                    this.highestPriceMap.delete(bar.tokenId);
                    this.lowestPriceMap.delete(bar.tokenId);
                    this.positionSideMap.delete(bar.tokenId);
                    return;
                }
                if (bar.close <= bb.middle || rsiVal <= this.params.rsi_oversold) {
                    ctx.close(bar.tokenId);
                    this.entryPriceMap.delete(bar.tokenId);
                    this.highestPriceMap.delete(bar.tokenId);
                    this.lowestPriceMap.delete(bar.tokenId);
                    this.positionSideMap.delete(bar.tokenId);
                    return;
                }
            }
        }
        else if (bar.close > 0.05 && bar.close < 0.95) {
            const isPriceRising = this.isRising(priceHistory);
            const isPriceFalling = this.isFalling(priceHistory);
            if (bar.close <= bb.lower && isPriceRising && rsiVal > this.params.rsi_oversold) {
                const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                    const result = ctx.buy(bar.tokenId, size);
                    if (result.success) {
                        this.entryPriceMap.set(bar.tokenId, bar.close);
                        this.highestPriceMap.set(bar.tokenId, bar.close);
                        this.positionSideMap.set(bar.tokenId, 'long');
                    }
                }
            }
            else if (bar.close >= bb.upper && isPriceFalling && rsiVal < this.params.rsi_overbought) {
                const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                    const result = ctx.buy(bar.tokenId, size);
                    if (result.success) {
                        this.entryPriceMap.set(bar.tokenId, bar.close);
                        this.lowestPriceMap.set(bar.tokenId, bar.close);
                        this.positionSideMap.set(bar.tokenId, 'short');
                    }
                }
            }
        }
        this.prevPriceMap.set(bar.tokenId, bar.close);
    }
    onComplete(_ctx) { }
}
exports.MeanReversionBandV208Strategy = MeanReversionBandV208Strategy;

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
exports.RsiDV02Strategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    rsi_period: 4,
    divergence_lookback: 5,
    oversold: 30,
    overbought: 70,
    stop_loss: 0.04,
    risk_percent: 0.1,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_rsi_d_v02_195.params.json');
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
class RsiDV02Strategy {
    constructor(params = {}) {
        this.rsiMap = new Map();
        this.priceHistory = new Map();
        this.rsiHistory = new Map();
        this.entryPrice = new Map();
        const savedParams = loadSavedParams();
        this.params = { ...defaultParams, ...savedParams, ...params };
        this.params.rsi_period = Math.max(3, Math.floor(this.params.rsi_period));
        this.params.divergence_lookback = Math.max(3, Math.floor(this.params.divergence_lookback));
    }
    onInit(_ctx) { }
    onNext(ctx, bar) {
        if (!this.rsiMap.has(bar.tokenId)) {
            this.rsiMap.set(bar.tokenId, new types_1.RSI(this.params.rsi_period));
            this.priceHistory.set(bar.tokenId, []);
            this.rsiHistory.set(bar.tokenId, []);
        }
        const rsi = this.rsiMap.get(bar.tokenId);
        rsi.update(bar.close);
        const rsiVal = rsi.get(0);
        if (rsiVal === undefined)
            return;
        const prices = this.priceHistory.get(bar.tokenId);
        const rsis = this.rsiHistory.get(bar.tokenId);
        prices.push(bar.close);
        rsis.push(rsiVal);
        if (prices.length > this.params.divergence_lookback) {
            prices.shift();
            rsis.shift();
        }
        if (prices.length < this.params.divergence_lookback)
            return;
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
        }
        else if (bar.close > 0.05 && bar.close < 0.95) {
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
    onComplete(_ctx) { }
}
exports.RsiDV02Strategy = RsiDV02Strategy;

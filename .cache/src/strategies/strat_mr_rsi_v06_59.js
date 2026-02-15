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
exports.MRRsiV06Strategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    ma_period: 8,
    rsi_period: 7,
    deviation_threshold: 0.04,
    rsi_oversold: 25,
    rsi_overbought: 75,
    stop_loss: 0.07,
    risk_percent: 0.18,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_mr_rsi_v06_59.params.json');
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
class MRRsiV06Strategy {
    constructor(params = {}) {
        this.smaMap = new Map();
        this.rsiMap = new Map();
        this.entryPrice = new Map();
        const savedParams = loadSavedParams();
        this.params = { ...defaultParams, ...savedParams, ...params };
    }
    onInit(_ctx) { }
    onNext(ctx, bar) {
        if (!this.smaMap.has(bar.tokenId)) {
            this.smaMap.set(bar.tokenId, new types_1.SimpleMovingAverage(Math.max(3, Math.floor(this.params.ma_period))));
            this.rsiMap.set(bar.tokenId, new types_1.RSI(Math.max(3, Math.floor(this.params.rsi_period))));
        }
        const sma = this.smaMap.get(bar.tokenId);
        const rsi = this.rsiMap.get(bar.tokenId);
        sma.update(bar.close);
        rsi.update(bar.close);
        const maVal = sma.get(0);
        const rsiVal = rsi.get(0);
        if (maVal === undefined || rsiVal === undefined)
            return;
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
        }
        else if (bar.close > 0.05 && bar.close < 0.90) {
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
    onComplete(_ctx) { }
}
exports.MRRsiV06Strategy = MRRsiV06Strategy;

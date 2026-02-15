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
exports.StochV09Strategy = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    k_period: 12,
    d_period: 5,
    oversold: 20,
    overbought: 80,
    stop_loss: 0.07,
    risk_percent: 0.15,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_stoch_v09_162.params.json');
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
class StochV09Strategy {
    constructor(params = {}) {
        this.priceHistory = new Map();
        this.kValues = new Map();
        this.entryPrice = new Map();
        const savedParams = loadSavedParams();
        this.params = { ...defaultParams, ...savedParams, ...params };
        this.params.k_period = Math.max(3, Math.floor(this.params.k_period));
        this.params.d_period = Math.max(2, Math.floor(this.params.d_period));
    }
    onInit(_ctx) { }
    onNext(ctx, bar) {
        if (!this.priceHistory.has(bar.tokenId)) {
            this.priceHistory.set(bar.tokenId, []);
            this.kValues.set(bar.tokenId, []);
        }
        const history = this.priceHistory.get(bar.tokenId);
        const kVals = this.kValues.get(bar.tokenId);
        history.push(bar.close);
        if (history.length > this.params.k_period)
            history.shift();
        if (history.length < this.params.k_period)
            return;
        const highest = Math.max(...history);
        const lowest = Math.min(...history);
        const k = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
        kVals.push(k);
        if (kVals.length > this.params.d_period)
            kVals.shift();
        if (kVals.length < this.params.d_period)
            return;
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
        }
        else if (bar.close > 0.05 && bar.close < 0.95) {
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
    onComplete(_ctx) { }
}
exports.StochV09Strategy = StochV09Strategy;

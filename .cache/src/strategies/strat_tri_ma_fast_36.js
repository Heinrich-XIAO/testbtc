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
exports.TriMAFastStrategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    fast_period: 3,
    mid_period: 6,
    slow_period: 12,
    stop_loss: 0.05,
    trailing_stop: 0.04,
    risk_percent: 0.1,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_tri_ma_fast_36.params.json');
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
class TriMAFastStrategy {
    constructor(params = {}) {
        this.fastMAs = new Map();
        this.midMAs = new Map();
        this.slowMAs = new Map();
        this.entryPrice = new Map();
        this.highestPrice = new Map();
        const savedParams = loadSavedParams();
        this.params = { ...defaultParams, ...savedParams, ...params };
        const sorted = [this.params.fast_period, this.params.mid_period, this.params.slow_period].sort((a, b) => a - b);
        this.params.fast_period = Math.max(2, Math.floor(sorted[0]));
        this.params.mid_period = Math.max(3, Math.floor(sorted[1]));
        this.params.slow_period = Math.max(4, Math.floor(sorted[2]));
    }
    onInit(_ctx) { }
    onNext(ctx, bar) {
        if (!this.fastMAs.has(bar.tokenId)) {
            this.fastMAs.set(bar.tokenId, new types_1.SimpleMovingAverage(this.params.fast_period));
            this.midMAs.set(bar.tokenId, new types_1.SimpleMovingAverage(this.params.mid_period));
            this.slowMAs.set(bar.tokenId, new types_1.SimpleMovingAverage(this.params.slow_period));
        }
        const fast = this.fastMAs.get(bar.tokenId);
        const mid = this.midMAs.get(bar.tokenId);
        const slow = this.slowMAs.get(bar.tokenId);
        fast.update(bar.close);
        mid.update(bar.close);
        slow.update(bar.close);
        const fv = fast.get(0), mv = mid.get(0), sv = slow.get(0);
        if (fv === undefined || mv === undefined || sv === undefined)
            return;
        const bullish = fv > mv && mv > sv;
        const bearish = fv < mv && mv < sv;
        const position = ctx.getPosition(bar.tokenId);
        if (position && position.size > 0) {
            const entry = this.entryPrice.get(bar.tokenId);
            if (entry) {
                if (bar.close < entry * (1 - this.params.stop_loss)) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    this.highestPrice.delete(bar.tokenId);
                    return;
                }
                const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
                this.highestPrice.set(bar.tokenId, highest);
                if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    this.highestPrice.delete(bar.tokenId);
                    return;
                }
                if (bearish) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    this.highestPrice.delete(bar.tokenId);
                }
            }
        }
        else if (bar.close > 0.05 && bar.close < 0.95) {
            if (bullish) {
                const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                    const result = ctx.buy(bar.tokenId, size);
                    if (result.success) {
                        this.entryPrice.set(bar.tokenId, bar.close);
                        this.highestPrice.set(bar.tokenId, bar.close);
                    }
                }
            }
        }
    }
    onComplete(_ctx) { }
}
exports.TriMAFastStrategy = TriMAFastStrategy;

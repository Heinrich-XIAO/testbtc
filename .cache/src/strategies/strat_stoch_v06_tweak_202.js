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
exports.StochV06Tweak202Strategy = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    k_period: 12,
    d_period: 5,
    oversold: 15,
    overbought: 85,
    stop_loss: 0.05,
    risk_percent: 0.12,
    ma_period: 20,
    use_trend_filter: true,
    use_mtf_confirmation: true,
    use_dynamic_sizing: true,
    mtf_threshold: 0.5,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_stoch_v06_tweak_202.params.json');
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
                else if (typeof value === 'boolean') {
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
class StochV06Tweak202Strategy {
    constructor(params = {}) {
        this.tokenData = new Map();
        this.entryPrice = new Map();
        const savedParams = loadSavedParams() || {};
        this.params = { ...defaultParams, ...savedParams, ...params };
        this.params.k_period = Math.max(3, Math.floor(this.params.k_period));
        this.params.d_period = Math.max(2, Math.floor(this.params.d_period));
        this.params.ma_period = Math.max(5, Math.floor(this.params.ma_period));
    }
    onInit(_ctx) { }
    getOrCreateTokenData(tokenId) {
        if (!this.tokenData.has(tokenId)) {
            this.tokenData.set(tokenId, {
                priceHistory: [],
                kValues: [],
                slowKValues: [],
                fastKValues: [],
                maValues: [],
            });
        }
        return this.tokenData.get(tokenId);
    }
    calculateStochastic(priceHistory, period) {
        if (priceHistory.length < period)
            return null;
        const relevantHistory = priceHistory.slice(-period);
        const highest = Math.max(...relevantHistory);
        const lowest = Math.min(...relevantHistory);
        if (highest === lowest)
            return 50;
        const currentPrice = priceHistory[priceHistory.length - 1];
        return ((currentPrice - lowest) / (highest - lowest)) * 100;
    }
    calculateMA(priceHistory, period) {
        if (priceHistory.length < period)
            return null;
        const relevantPrices = priceHistory.slice(-period);
        return relevantPrices.reduce((a, b) => a + b, 0) / period;
    }
    calculateSignalStrength(baseK, slowK, fastK, isOversold) {
        let strength = 1.0;
        if (this.params.use_mtf_confirmation && slowK !== null && fastK !== null) {
            const slowConfirm = isOversold ? slowK <= this.params.oversold : slowK >= this.params.overbought;
            const fastConfirm = isOversold ? fastK <= this.params.oversold : fastK >= this.params.overbought;
            if (slowConfirm && fastConfirm) {
                strength += this.params.mtf_threshold;
            }
            else if (slowConfirm || fastConfirm) {
                strength += this.params.mtf_threshold * 0.5;
            }
        }
        const oversoldDepth = isOversold
            ? Math.max(0, (this.params.oversold - baseK) / this.params.oversold)
            : Math.max(0, (baseK - this.params.overbought) / (100 - this.params.overbought));
        strength += oversoldDepth * 0.5;
        return Math.min(strength, 2.0);
    }
    onNext(ctx, bar) {
        const data = this.getOrCreateTokenData(bar.tokenId);
        data.priceHistory.push(bar.close);
        const maxPeriod = Math.max(this.params.k_period * 2, this.params.ma_period);
        if (data.priceHistory.length > maxPeriod * 2) {
            data.priceHistory.shift();
        }
        const baseK = this.calculateStochastic(data.priceHistory, this.params.k_period);
        if (baseK === null)
            return;
        data.kValues.push(baseK);
        if (data.kValues.length > this.params.d_period) {
            data.kValues.shift();
        }
        if (this.params.use_mtf_confirmation) {
            const slowK = this.calculateStochastic(data.priceHistory, this.params.k_period * 2);
            const fastK = this.calculateStochastic(data.priceHistory, Math.max(3, Math.floor(this.params.k_period * 0.5)));
            if (slowK !== null) {
                data.slowKValues.push(slowK);
                if (data.slowKValues.length > this.params.d_period)
                    data.slowKValues.shift();
            }
            if (fastK !== null) {
                data.fastKValues.push(fastK);
                if (data.fastKValues.length > this.params.d_period)
                    data.fastKValues.shift();
            }
        }
        if (this.params.use_trend_filter) {
            const ma = this.calculateMA(data.priceHistory, this.params.ma_period);
            if (ma !== null) {
                data.maValues.push(ma);
                if (data.maValues.length > 5)
                    data.maValues.shift();
            }
        }
        if (data.kValues.length < this.params.d_period)
            return;
        const d = data.kValues.reduce((a, b) => a + b, 0) / data.kValues.length;
        const position = ctx.getPosition(bar.tokenId);
        if (position && position.size > 0) {
            const entry = this.entryPrice.get(bar.tokenId);
            if (entry) {
                if (bar.close < entry * (1 - this.params.stop_loss)) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    return;
                }
                if (baseK >= this.params.overbought && baseK < d) {
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                }
            }
        }
        else if (bar.close > 0.05 && bar.close < 0.95) {
            let trendOk = true;
            if (this.params.use_trend_filter && data.maValues.length >= 2) {
                const maDirection = data.maValues[data.maValues.length - 1] > data.maValues[0];
                trendOk = maDirection;
            }
            if (trendOk && baseK <= this.params.oversold && baseK > d) {
                const slowK = data.slowKValues.length > 0 ? data.slowKValues[data.slowKValues.length - 1] : null;
                const fastK = data.fastKValues.length > 0 ? data.fastKValues[data.fastKValues.length - 1] : null;
                const signalStrength = this.calculateSignalStrength(baseK, slowK, fastK, true);
                let positionSize = this.params.risk_percent;
                if (this.params.use_dynamic_sizing) {
                    positionSize = Math.min(this.params.risk_percent * signalStrength, 0.25);
                }
                const cash = ctx.getCapital() * positionSize * 0.995;
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
exports.StochV06Tweak202Strategy = StochV06Tweak202Strategy;

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
exports.SimpleMAStrategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    fast_period: 50,
    slow_period: 200,
    stop_loss: 0.02,
    trailing_stop: false,
    risk_percent: 0.10,
    rsi_enabled: false,
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    atr_enabled: false,
    atr_multiplier: 2.0,
    take_profit_enabled: false,
    take_profit: 0.05,
    exit_strategy: 0,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_simple_ma_01.params.json');
    if (!fs.existsSync(paramsPath))
        return null;
    try {
        const content = fs.readFileSync(paramsPath, 'utf-8');
        const saved = JSON.parse(content);
        const params = {};
        const booleanParams = ['trailing_stop', 'rsi_enabled', 'atr_enabled', 'take_profit_enabled'];
        for (const [key, value] of Object.entries(saved)) {
            if (key !== 'metadata' && key in defaultParams) {
                if (booleanParams.includes(key)) {
                    if (typeof value === 'number') {
                        params[key] = value === 1;
                    }
                    else if (typeof value === 'boolean') {
                        params[key] = value;
                    }
                }
                else if (typeof value === 'number') {
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
class SimpleMAStrategy {
    constructor(params = {}) {
        this.buyPrice = new Map();
        this.highestPrice = new Map();
        const savedParams = loadSavedParams();
        const mergedParams = { ...defaultParams, ...savedParams, ...params };
        // Ensure fast_period < slow_period
        let fast = mergedParams.fast_period;
        let slow = mergedParams.slow_period;
        if (fast >= slow) {
            // Swap them if inverted
            [fast, slow] = [slow, fast];
        }
        this.params = {
            fast_period: fast,
            slow_period: slow,
            stop_loss: mergedParams.stop_loss,
            trailing_stop: mergedParams.trailing_stop,
            risk_percent: mergedParams.risk_percent,
            rsi_enabled: mergedParams.rsi_enabled,
            rsi_period: mergedParams.rsi_period,
            rsi_oversold: mergedParams.rsi_oversold,
            rsi_overbought: mergedParams.rsi_overbought,
            atr_enabled: mergedParams.atr_enabled,
            atr_multiplier: mergedParams.atr_multiplier,
            take_profit_enabled: mergedParams.take_profit_enabled,
            take_profit: mergedParams.take_profit,
            exit_strategy: mergedParams.exit_strategy,
        };
        this.fastMA = new types_1.SimpleMovingAverage(this.params.fast_period);
        this.slowMA = new types_1.SimpleMovingAverage(this.params.slow_period);
        this.crossover = new types_1.CrossOver(this.fastMA, this.slowMA);
        this.rsi = new types_1.RSI(this.params.rsi_period);
        this.atr = new types_1.ATR(this.params.slow_period);
    }
    onInit(_ctx) {
        console.log(`SimpleMAStrategy initialized with params:`);
        console.log(`  Fast MA period: ${this.params.fast_period}`);
        console.log(`  Slow MA period: ${this.params.slow_period}`);
        console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
        console.log(`  Trailing stop: ${this.params.trailing_stop}`);
        console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
        console.log(`  RSI: ${this.params.rsi_enabled ? `period=${this.params.rsi_period}, oversold=${this.params.rsi_oversold}, overbought=${this.params.rsi_overbought}` : 'disabled'}`);
        console.log(`  ATR: ${this.params.atr_enabled ? `multiplier=${this.params.atr_multiplier}` : 'disabled'}`);
        console.log(`  Take Profit: ${this.params.take_profit_enabled ? `${this.params.take_profit * 100}%` : 'disabled'}`);
        console.log(`  Exit Strategy: ${this.params.exit_strategy}`);
    }
    onNext(ctx, bar) {
        this.fastMA.update(bar.close);
        this.slowMA.update(bar.close);
        this.crossover.update();
        this.rsi.update(bar.close);
        this.atr.update(bar.high, bar.low, bar.close);
        const position = ctx.getPosition(bar.tokenId);
        const crossoverValue = this.crossover.get(0);
        const rsiValue = this.rsi.get(0);
        const atrValue = this.atr.get(0);
        if (position && position.size > 0) {
            const buyPrice = this.buyPrice.get(bar.tokenId);
            const highest = this.highestPrice.get(bar.tokenId);
            if (buyPrice !== undefined) {
                let stopPrice;
                if (this.params.atr_enabled && atrValue !== undefined && this.params.atr_multiplier > 0) {
                    stopPrice = buyPrice - (atrValue * this.params.atr_multiplier);
                }
                else {
                    stopPrice = buyPrice * (1 - this.params.stop_loss);
                }
                if (bar.close <= stopPrice) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
                    ctx.close(bar.tokenId);
                    this.buyPrice.delete(bar.tokenId);
                    this.highestPrice.delete(bar.tokenId);
                    return;
                }
                if (this.params.trailing_stop) {
                    const currentHighest = highest !== undefined ? Math.max(highest, bar.close) : bar.close;
                    this.highestPrice.set(bar.tokenId, currentHighest);
                    let trailingStopPrice;
                    if (this.params.atr_enabled && atrValue !== undefined) {
                        trailingStopPrice = currentHighest - (atrValue * this.params.atr_multiplier);
                    }
                    else {
                        trailingStopPrice = currentHighest * (1 - this.params.stop_loss);
                    }
                    if (bar.close <= trailingStopPrice && bar.close > buyPrice) {
                        console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
                        ctx.close(bar.tokenId);
                        this.buyPrice.delete(bar.tokenId);
                        this.highestPrice.delete(bar.tokenId);
                        return;
                    }
                }
                if (this.params.take_profit_enabled) {
                    const tpPrice = buyPrice * (1 + this.params.take_profit);
                    if (bar.close >= tpPrice) {
                        console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Take profit triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
                        ctx.close(bar.tokenId);
                        this.buyPrice.delete(bar.tokenId);
                        this.highestPrice.delete(bar.tokenId);
                        return;
                    }
                }
                let shouldSell = false;
                if (this.params.exit_strategy === 0) {
                    if (crossoverValue !== undefined && crossoverValue < 0) {
                        shouldSell = true;
                    }
                }
                else if (this.params.exit_strategy === 1) {
                    if (this.params.rsi_enabled && rsiValue !== undefined && rsiValue >= this.params.rsi_overbought) {
                        shouldSell = true;
                    }
                }
                if (shouldSell) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] SELL signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}${rsiValue !== undefined ? `, RSI: ${rsiValue.toFixed(2)}` : ''}`);
                    ctx.close(bar.tokenId);
                    this.buyPrice.delete(bar.tokenId);
                    this.highestPrice.delete(bar.tokenId);
                }
            }
        }
        else {
            let shouldBuy = false;
            if (crossoverValue !== undefined && crossoverValue > 0) {
                if (this.params.rsi_enabled && rsiValue !== undefined) {
                    if (rsiValue <= this.params.rsi_oversold) {
                        shouldBuy = true;
                    }
                }
                else {
                    shouldBuy = true;
                }
            }
            if (shouldBuy) {
                const feeBuffer = 0.995;
                let cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
                if (this.params.atr_enabled && atrValue !== undefined && this.params.atr_multiplier > 0 && atrValue > 0) {
                    const atrRisk = atrValue * this.params.atr_multiplier;
                    const maxSizeByATR = (ctx.getCapital() * this.params.risk_percent) / atrRisk;
                    cash = Math.min(cash, maxSizeByATR * bar.close * feeBuffer);
                }
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}${rsiValue !== undefined ? `, RSI: ${rsiValue.toFixed(2)}` : ''}${atrValue !== undefined ? `, ATR: ${atrValue.toFixed(4)}` : ''}`);
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
exports.SimpleMAStrategy = SimpleMAStrategy;

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
exports.RSIMeanReversionStrategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    rsi_period: 5,
    rsi_oversold: 25,
    rsi_overbought: 75,
    stop_loss: 0.05,
    risk_percent: 0.10,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_rsi_03.params.json');
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
class RSIMeanReversionStrategy {
    constructor(params = {}) {
        this.rsiMap = new Map();
        this.buyPrice = new Map();
        const savedParams = loadSavedParams();
        const mergedParams = { ...defaultParams, ...savedParams, ...params };
        this.params = {
            rsi_period: mergedParams.rsi_period,
            rsi_oversold: mergedParams.rsi_oversold,
            rsi_overbought: mergedParams.rsi_overbought,
            stop_loss: mergedParams.stop_loss,
            risk_percent: mergedParams.risk_percent,
        };
    }
    getRsi(tokenId) {
        let rsi = this.rsiMap.get(tokenId);
        if (!rsi) {
            rsi = new types_1.RSI(this.params.rsi_period);
            this.rsiMap.set(tokenId, rsi);
        }
        return rsi;
    }
    onInit(_ctx) {
        console.log(`RSI Mean Reversion Strategy initialized with params:`);
        console.log(`  RSI period: ${this.params.rsi_period}`);
        console.log(`  Oversold: ${this.params.rsi_oversold}`);
        console.log(`  Overbought: ${this.params.rsi_overbought}`);
        console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
        console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
    }
    onNext(ctx, bar) {
        const rsi = this.getRsi(bar.tokenId);
        rsi.update(bar.close);
        const position = ctx.getPosition(bar.tokenId);
        const rsiValue = rsi.get(0);
        if (position && position.size > 0) {
            const buyPrice = this.buyPrice.get(bar.tokenId);
            if (buyPrice !== undefined) {
                const stopPrice = buyPrice * (1 - this.params.stop_loss);
                if (bar.close <= stopPrice) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
                    ctx.close(bar.tokenId);
                    this.buyPrice.delete(bar.tokenId);
                    return;
                }
                if (rsiValue !== undefined && rsiValue >= this.params.rsi_overbought) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] RSI overbought SELL for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, RSI: ${rsiValue.toFixed(2)}`);
                    ctx.close(bar.tokenId);
                    this.buyPrice.delete(bar.tokenId);
                }
            }
        }
        else {
            if (rsiValue !== undefined && rsiValue <= this.params.rsi_oversold) {
                const feeBuffer = 0.995;
                const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] RSI oversold BUY for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, RSI: ${rsiValue.toFixed(2)}, size: ${size.toFixed(2)}`);
                    const result = ctx.buy(bar.tokenId, size);
                    if (result.success) {
                        this.buyPrice.set(bar.tokenId, bar.close);
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
exports.RSIMeanReversionStrategy = RSIMeanReversionStrategy;

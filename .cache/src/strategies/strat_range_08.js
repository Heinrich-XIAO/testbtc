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
exports.RangeTradingStrategy = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    buy_below: 0.3,
    sell_above: 0.6,
    stop_loss: 0.15,
    risk_percent: 0.1,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_range_08.params.json');
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
class RangeTradingStrategy {
    constructor(params = {}) {
        this.entryPrice = new Map();
        const savedParams = loadSavedParams();
        const mergedParams = { ...defaultParams, ...savedParams, ...params };
        // Ensure buy_below < sell_above
        let buyBelow = mergedParams.buy_below;
        let sellAbove = mergedParams.sell_above;
        if (buyBelow >= sellAbove) {
            // Swap if inverted
            [buyBelow, sellAbove] = [sellAbove, buyBelow];
        }
        this.params = {
            buy_below: buyBelow,
            sell_above: sellAbove,
            stop_loss: mergedParams.stop_loss,
            risk_percent: mergedParams.risk_percent,
        };
    }
    onInit(_ctx) {
        console.log(`RangeTradingStrategy initialized:`);
        console.log(`  Buy below: ${(this.params.buy_below * 100).toFixed(0)}%`);
        console.log(`  Sell above: ${(this.params.sell_above * 100).toFixed(0)}%`);
        console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
        console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
    }
    onNext(ctx, bar) {
        const position = ctx.getPosition(bar.tokenId);
        if (position && position.size > 0) {
            const entry = this.entryPrice.get(bar.tokenId);
            if (entry) {
                // Stop loss
                if (bar.close < entry * (1 - this.params.stop_loss)) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    return;
                }
                // Take profit - sell when price goes above sell_above
                if (bar.close >= this.params.sell_above) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TAKE PROFIT ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    return;
                }
            }
        }
        else {
            // Entry: buy when price is below buy_below threshold
            if (bar.close <= this.params.buy_below && bar.close > 0.02) {
                const cash = ctx.getCapital() * this.params.risk_percent;
                const size = cash / bar.close;
                if (size > 0 && cash <= ctx.getCapital()) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
                    const result = ctx.buy(bar.tokenId, size);
                    if (result.success) {
                        this.entryPrice.set(bar.tokenId, bar.close);
                    }
                }
            }
        }
    }
    onComplete(_ctx) {
        console.log('\nStrategy completed.');
    }
}
exports.RangeTradingStrategy = RangeTradingStrategy;

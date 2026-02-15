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
exports.ShortTermStrategy = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    lookback: 3,
    entry_threshold: 0.05,
    trailing_stop_pct: 0.05,
    minimum_hold: 3,
    risk_percent: 0.1,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_momentum_07.params.json');
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
class ShortTermStrategy {
    constructor(params = {}) {
        this.priceHistory = new Map();
        this.entryPrice = new Map();
        this.highestSinceEntry = new Map();
        this.barsHeld = new Map();
        const savedParams = loadSavedParams();
        const mergedParams = { ...defaultParams, ...savedParams, ...params };
        this.params = {
            lookback: Math.max(2, Math.floor(mergedParams.lookback)),
            entry_threshold: mergedParams.entry_threshold,
            trailing_stop_pct: mergedParams.trailing_stop_pct,
            minimum_hold: Math.max(0, Math.floor(mergedParams.minimum_hold)),
            risk_percent: mergedParams.risk_percent,
        };
    }
    onInit(_ctx) {
        console.log(`ShortTermStrategy initialized:`);
        console.log(`  Lookback: ${this.params.lookback} bars`);
        console.log(`  Entry threshold: ${(this.params.entry_threshold * 100).toFixed(1)}%`);
        console.log(`  Trailing stop: ${(this.params.trailing_stop_pct * 100).toFixed(1)}%`);
        console.log(`  Minimum hold: ${this.params.minimum_hold} bars`);
        console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
    }
    getPriceChange(tokenId) {
        const history = this.priceHistory.get(tokenId);
        if (!history || history.length < this.params.lookback + 1) {
            return undefined;
        }
        const current = history[history.length - 1];
        const past = history[history.length - 1 - this.params.lookback];
        if (past <= 0)
            return undefined;
        return (current - past) / past;
    }
    onNext(ctx, bar) {
        // Update price history
        if (!this.priceHistory.has(bar.tokenId)) {
            this.priceHistory.set(bar.tokenId, []);
        }
        const history = this.priceHistory.get(bar.tokenId);
        history.push(bar.close);
        // Keep history bounded
        const maxHistory = this.params.lookback + 5;
        if (history.length > maxHistory) {
            history.shift();
        }
        const priceChange = this.getPriceChange(bar.tokenId);
        if (priceChange === undefined) {
            return;
        }
        const position = ctx.getPosition(bar.tokenId);
        if (position && position.size > 0) {
            const entry = this.entryPrice.get(bar.tokenId);
            if (entry) {
                // Update highest price since entry
                const prevHighest = this.highestSinceEntry.get(bar.tokenId) ?? entry;
                const highest = Math.max(prevHighest, bar.close);
                this.highestSinceEntry.set(bar.tokenId, highest);
                // Increment bars held
                const held = (this.barsHeld.get(bar.tokenId) ?? 0) + 1;
                this.barsHeld.set(bar.tokenId, held);
                // Only consider exits after minimum hold period
                if (held >= this.params.minimum_hold) {
                    // Trailing stop: exit when price drops trailing_stop_pct from highest
                    const drawdownFromHighest = (highest - bar.close) / highest;
                    if (drawdownFromHighest >= this.params.trailing_stop_pct) {
                        console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TRAILING STOP ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} highest=${highest.toFixed(4)} drawdown=${(drawdownFromHighest * 100).toFixed(1)}%`);
                        ctx.close(bar.tokenId);
                        this.entryPrice.delete(bar.tokenId);
                        this.highestSinceEntry.delete(bar.tokenId);
                        this.barsHeld.delete(bar.tokenId);
                        return;
                    }
                }
            }
        }
        else {
            // Entry: buy when price has moved up by threshold amount
            if (priceChange >= this.params.entry_threshold) {
                // Don't buy near extremes (prediction market specific)
                if (bar.close > 0.1 && bar.close < 0.9) {
                    const cash = ctx.getCapital() * this.params.risk_percent;
                    const size = cash / bar.close;
                    if (size > 0 && cash <= ctx.getCapital()) {
                        console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... change=${(priceChange * 100).toFixed(1)}% price=${bar.close.toFixed(4)}`);
                        const result = ctx.buy(bar.tokenId, size);
                        if (result.success) {
                            this.entryPrice.set(bar.tokenId, bar.close);
                            this.highestSinceEntry.set(bar.tokenId, bar.close);
                            this.barsHeld.set(bar.tokenId, 0);
                        }
                    }
                }
            }
        }
    }
    onComplete(_ctx) {
        console.log('\nStrategy completed.');
    }
}
exports.ShortTermStrategy = ShortTermStrategy;

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
exports.MeanReversionStrategy = void 0;
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const defaultParams = {
    ma_period: 8,
    deviation_threshold: 0.03,
    stop_loss: 0.08,
    risk_percent: 0.10,
};
function loadSavedParams() {
    const paramsPath = path.join(__dirname, 'strat_mean_revert_09.params.json');
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
class MeanReversionStrategy {
    constructor(params = {}) {
        this.smaMap = new Map();
        this.entryPrice = new Map();
        const savedParams = loadSavedParams();
        const mergedParams = { ...defaultParams, ...savedParams, ...params };
        this.params = {
            ma_period: Math.max(2, Math.floor(mergedParams.ma_period)),
            deviation_threshold: mergedParams.deviation_threshold,
            stop_loss: mergedParams.stop_loss,
            risk_percent: mergedParams.risk_percent,
        };
    }
    onInit(_ctx) {
        console.log(`MeanReversionStrategy initialized:`);
        console.log(`  MA period: ${this.params.ma_period}`);
        console.log(`  Deviation threshold: ${(this.params.deviation_threshold * 100).toFixed(1)}%`);
        console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
        console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
    }
    getSMA(tokenId) {
        let sma = this.smaMap.get(tokenId);
        if (!sma) {
            sma = new types_1.SimpleMovingAverage(this.params.ma_period);
            this.smaMap.set(tokenId, sma);
        }
        return sma;
    }
    onNext(ctx, bar) {
        const sma = this.getSMA(bar.tokenId);
        sma.update(bar.close);
        const maValue = sma.get(0);
        if (maValue === undefined) {
            return;
        }
        const price = bar.close;
        const deviation = maValue - price; // positive when price is below MA
        const position = ctx.getPosition(bar.tokenId);
        if (position && position.size > 0) {
            const entry = this.entryPrice.get(bar.tokenId);
            if (entry) {
                // Stop loss
                if (price < entry * (1 - this.params.stop_loss)) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)}`);
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    return;
                }
                // Mean reversion exit: price returned to or exceeded the MA
                if (price >= maValue) {
                    console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MEAN REVERT EXIT ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)} ma=${maValue.toFixed(4)}`);
                    ctx.close(bar.tokenId);
                    this.entryPrice.delete(bar.tokenId);
                    return;
                }
            }
        }
        else {
            // Entry: buy when price deviates below MA by more than threshold
            if (deviation >= this.params.deviation_threshold) {
                // Don't buy near extremes (prediction market specific)
                if (price >= 0.05 && price <= 0.90) {
                    const cash = ctx.getCapital() * this.params.risk_percent;
                    const size = cash / price;
                    if (size > 0 && cash <= ctx.getCapital()) {
                        console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)} ma=${maValue.toFixed(4)} dev=${(deviation * 100).toFixed(1)}%`);
                        const result = ctx.buy(bar.tokenId, size);
                        if (result.success) {
                            this.entryPrice.set(bar.tokenId, price);
                        }
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
exports.MeanReversionStrategy = MeanReversionStrategy;

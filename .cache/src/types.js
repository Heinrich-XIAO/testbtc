"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATR = exports.RSI = exports.CrossOver = exports.SimpleMovingAverage = exports.Indicator = void 0;
class Indicator {
    constructor() {
        this.values = [];
    }
    get(index = 0) {
        return this.values[this.values.length - 1 - index];
    }
    getValues() {
        return [...this.values];
    }
    push(value) {
        this.values.push(value);
    }
}
exports.Indicator = Indicator;
class SimpleMovingAverage extends Indicator {
    constructor(period) {
        super();
        this.prices = [];
        this.period = period;
    }
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.period) {
            this.prices.shift();
        }
        if (this.prices.length === this.period) {
            const sum = this.prices.reduce((a, b) => a + b, 0);
            this.push(sum / this.period);
        }
    }
}
exports.SimpleMovingAverage = SimpleMovingAverage;
class CrossOver extends Indicator {
    constructor(line1, line2) {
        super();
        this.prevDiff = null;
        this.line1 = line1;
        this.line2 = line2;
    }
    update() {
        const val1 = this.line1.get(0);
        const val2 = this.line2.get(0);
        if (val1 === undefined || val2 === undefined) {
            return;
        }
        const diff = val1 - val2;
        if (this.prevDiff !== null) {
            if (this.prevDiff <= 0 && diff > 0) {
                this.push(1);
            }
            else if (this.prevDiff >= 0 && diff < 0) {
                this.push(-1);
            }
            else {
                this.push(0);
            }
        }
        this.prevDiff = diff;
    }
}
exports.CrossOver = CrossOver;
class RSI extends Indicator {
    constructor(period) {
        super();
        this.prices = [];
        this.gains = [];
        this.losses = [];
        this.avgGain = 0;
        this.avgLoss = 0;
        this.initialized = false;
        this.period = period;
    }
    update(price) {
        this.prices.push(price);
        if (this.prices.length > this.period) {
            this.prices.shift();
        }
        if (this.prices.length >= 2) {
            const change = this.prices[this.prices.length - 1] - this.prices[this.prices.length - 2];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;
            this.gains.push(gain);
            this.losses.push(loss);
            if (this.gains.length > this.period) {
                this.gains.shift();
                this.losses.shift();
            }
            if (!this.initialized && this.gains.length === this.period) {
                this.avgGain = this.gains.reduce((a, b) => a + b, 0) / this.period;
                this.avgLoss = this.losses.reduce((a, b) => a + b, 0) / this.period;
                this.initialized = true;
            }
            else if (this.initialized) {
                this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
                this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
            }
            if (this.initialized && this.avgLoss === 0) {
                this.push(100);
            }
            else if (this.initialized) {
                const rs = this.avgGain / this.avgLoss;
                const rsi = 100 - (100 / (1 + rs));
                this.push(rsi);
            }
        }
    }
}
exports.RSI = RSI;
class ATR extends Indicator {
    constructor(period) {
        super();
        this.highs = [];
        this.lows = [];
        this.closes = [];
        this.prevClose = null;
        this.trValues = [];
        this.period = period;
    }
    update(high, low, close) {
        this.highs.push(high);
        this.lows.push(low);
        this.closes.push(close);
        if (this.highs.length > this.period) {
            this.highs.shift();
            this.lows.shift();
            this.closes.shift();
        }
        if (this.closes.length >= 2) {
            const tr = Math.max(this.highs[this.highs.length - 1] - this.lows[this.lows.length - 1], Math.abs(this.highs[this.highs.length - 1] - this.closes[this.closes.length - 2]), Math.abs(this.lows[this.lows.length - 1] - this.closes[this.closes.length - 2]));
            this.trValues.push(tr);
            if (this.trValues.length > this.period) {
                this.trValues.shift();
            }
            if (this.trValues.length === this.period) {
                const atr = this.trValues.reduce((a, b) => a + b, 0) / this.period;
                this.push(atr);
            }
        }
    }
}
exports.ATR = ATR;

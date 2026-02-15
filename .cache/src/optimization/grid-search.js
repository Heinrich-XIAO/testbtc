"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridSearchOptimizer = void 0;
class GridSearchOptimizer {
    constructor(data, strategyClass, paramConfigs) {
        this.quiet = false;
        this.data = data;
        this.strategyClass = strategyClass;
        this.paramConfigs = paramConfigs;
    }
    setQuiet(quiet) {
        this.quiet = quiet;
    }
    generateGridPoints() {
        const paramNames = Object.keys(this.paramConfigs);
        const gridSizes = [];
        const steps = {};
        let totalPoints = 1;
        for (const name of paramNames) {
            const config = this.paramConfigs[name];
            const configSteps = [];
            for (let v = config.min; v <= config.max; v += config.stepSize) {
                configSteps.push(Math.round(v * 1000) / 1000);
            }
            if (configSteps.length === 0) {
                configSteps.push(config.min);
            }
            steps[name] = configSteps;
            gridSizes.push(configSteps.length);
            totalPoints *= configSteps.length;
        }
        if (!this.quiet) {
            console.log(`Grid: ${gridSizes.join(' x ')} = ${totalPoints} points`);
        }
        const points = [];
        const generate = (index, currentParams) => {
            if (index === paramNames.length) {
                points.push({ params: { ...currentParams }, total: totalPoints });
                return;
            }
            const name = paramNames[index];
            for (const value of steps[name]) {
                currentParams[name] = value;
                generate(index + 1, currentParams);
            }
        };
        generate(0, {});
        return points;
    }
    testParams(params) {
        const StrategyClass = this.strategyClass;
        const { BacktestEngine } = require('../backtest/engine');
        const strategy = new StrategyClass(params);
        const engine = new BacktestEngine(this.data, strategy, { feeRate: 0.002 });
        const originalLog = console.log;
        console.log = () => { };
        try {
            const result = engine.run();
            return {
                sharpe: result.sharpeRatio || 0,
                return: result.totalReturn || 0,
                trades: result.totalTrades || 0
            };
        }
        finally {
            console.log = originalLog;
        }
    }
    async optimize() {
        const gridPoints = this.generateGridPoints();
        const history = [];
        let bestSharpe = -Infinity;
        let bestReturn = -Infinity;
        let bestParams = {};
        let tested = 0;
        const total = gridPoints.length;
        for (const point of gridPoints) {
            tested++;
            if (tested % 100 === 0 || tested === total) {
                process.stdout.write(`\rTesting: ${tested}/${total} (${((tested / total) * 100).toFixed(1)}%) | Best Sharpe: ${bestSharpe.toFixed(4)}`);
            }
            const metrics = this.testParams(point.params);
            history.push({
                iteration: tested,
                params: { ...point.params },
                sharpeRatio: metrics.sharpe,
            });
            if (metrics.sharpe > bestSharpe) {
                bestSharpe = metrics.sharpe;
                bestReturn = metrics.return;
                bestParams = { ...point.params };
            }
        }
        console.log('\n');
        console.log(`Best: Sharpe ${bestSharpe.toFixed(4)}, Return $${bestReturn.toFixed(2)}`);
        return {
            finalParams: bestParams,
            bestSharpe,
            bestReturn,
            history,
            iterations: tested,
            converged: true,
        };
    }
}
exports.GridSearchOptimizer = GridSearchOptimizer;

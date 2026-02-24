import { Command } from 'commander';
import kleur from 'kleur';
import { loadStoredData } from '../src/backtest/engine';
import { SimpleMAStrategy } from '../src/strategies/strat_simple_ma_01';
import { SrStoch02Strategy } from '../src/strategies/strat_sr_stoch_02';
import { SrStoch03Strategy } from '../src/strategies/strat_sr_stoch_03';
import { StratIter201Strategy } from '../src/strategies/strat_iter2_01';
import { StratIter202Strategy } from '../src/strategies/strat_iter2_02';
import { StratIter203Strategy } from '../src/strategies/strat_iter2_03';
import { StratIter3AStrategy } from '../src/strategies/strat_iter3_a';
import { StratIter3BStrategy } from '../src/strategies/strat_iter3_b';
import { StratIter3CStrategy } from '../src/strategies/strat_iter3_c';
import { StratIter4AStrategy } from '../src/strategies/strat_iter4_a';
import { StratIter4BStrategy } from '../src/strategies/strat_iter4_b';
import { StratIter4CStrategy } from '../src/strategies/strat_iter4_c';
import { StratIter5AStrategy } from '../src/strategies/strat_iter5_a';
import { StratIter5BStrategy } from '../src/strategies/strat_iter5_b';
import { StratIter5CStrategy } from '../src/strategies/strat_iter5_c';
import { StratIter6BStrategy } from '../src/strategies/strat_iter6_b';
import { StratIter6CStrategy } from '../src/strategies/strat_iter6_c';
import { StratIter7AStrategy } from '../src/strategies/strat_iter7_a';
import { StratIter7BStrategy } from '../src/strategies/strat_iter7_b';
import { StratIter7CStrategy } from '../src/strategies/strat_iter7_c';
import { StratIter8AStrategy } from '../src/strategies/strat_iter8_a';
import { StratIter8BStrategy } from '../src/strategies/strat_iter8_b';
import { StratIter8CStrategy } from '../src/strategies/strat_iter8_c';
import { StratIter9AStrategy } from '../src/strategies/strat_iter9_a';
import { StratIter9BStrategy } from '../src/strategies/strat_iter9_b';
import { StratIter9CStrategy } from '../src/strategies/strat_iter9_c';
import { StratIter10AStrategy } from '../src/strategies/strat_iter10_a';
import { StratIter10BStrategy } from '../src/strategies/strat_iter10_b';
import { StratIter10CStrategy } from '../src/strategies/strat_iter10_c';
import { StratIter11AStrategy } from '../src/strategies/strat_iter11_a';
import { StratIter11BStrategy } from '../src/strategies/strat_iter11_b';
import { StratIter11CStrategy } from '../src/strategies/strat_iter11_c';
import { StratIter12AStrategy } from '../src/strategies/strat_iter12_a';
import { StratIter12BStrategy } from '../src/strategies/strat_iter12_b';
import { StratIter12CStrategy } from '../src/strategies/strat_iter12_c';
import { StratIter13AStrategy } from '../src/strategies/strat_iter13_a';
import { StratIter13BStrategy } from '../src/strategies/strat_iter13_b';
import { StratIter13CStrategy } from '../src/strategies/strat_iter13_c';
import { StratIter14AStrategy } from '../src/strategies/strat_iter14_a';
import { StratIter14BStrategy } from '../src/strategies/strat_iter14_b';
import { StratIter14CStrategy } from '../src/strategies/strat_iter14_c';
import { StratIter15AStrategy } from '../src/strategies/strat_iter15_a';
import { StratIter15BStrategy } from '../src/strategies/strat_iter15_b';
import { StratIter15CStrategy } from '../src/strategies/strat_iter15_c';
import { StratIter16AStrategy } from '../src/strategies/strat_iter16_a';
import { StratIter16BStrategy } from '../src/strategies/strat_iter16_b';
import { StratIter16CStrategy } from '../src/strategies/strat_iter16_c';
import { StratIter17AStrategy } from '../src/strategies/strat_iter17_a';
import { StratIter17BStrategy } from '../src/strategies/strat_iter17_b';
import { StratIter17CStrategy } from '../src/strategies/strat_iter17_c';
import { StratIter18AStrategy } from '../src/strategies/strat_iter18_a';
import { StratIter18BStrategy } from '../src/strategies/strat_iter18_b';
import { StratIter18CStrategy } from '../src/strategies/strat_iter18_c';
import { StratIter19AStrategy } from '../src/strategies/strat_iter19_a';
import { StratIter19BStrategy } from '../src/strategies/strat_iter19_b';
import { StratIter19CStrategy } from '../src/strategies/strat_iter19_c';
import { StratIter20AStrategy } from '../src/strategies/strat_iter20_a';
import { StratIter20BStrategy } from '../src/strategies/strat_iter20_b';
import { StratIter20CStrategy } from '../src/strategies/strat_iter20_c';
import { StratIter21AStrategy } from '../src/strategies/strat_iter21_a';
import { StratIter21BStrategy } from '../src/strategies/strat_iter21_b';
import { StratIter21CStrategy } from '../src/strategies/strat_iter21_c';
import { StratIter22AStrategy } from '../src/strategies/strat_iter22_a';
import { StratIter22BStrategy } from '../src/strategies/strat_iter22_b';
import { StratIter22CStrategy } from '../src/strategies/strat_iter22_c';
import { StratIter23AStrategy } from '../src/strategies/strat_iter23_a';
import { StratIter23BStrategy } from '../src/strategies/strat_iter23_b';
import { StratIter23CStrategy } from '../src/strategies/strat_iter23_c';
import { StratIter24AStrategy } from '../src/strategies/strat_iter24_a';
import { StratIter24BStrategy } from '../src/strategies/strat_iter24_b';
import { StratIter24CStrategy } from '../src/strategies/strat_iter24_c';
import { StratIter25AStrategy } from '../src/strategies/strat_iter25_a';
import { StratIter25BStrategy } from '../src/strategies/strat_iter25_b';
import { StratIter25CStrategy } from '../src/strategies/strat_iter25_c';
import { StratIter26AStrategy } from '../src/strategies/strat_iter26_a';
import { StratIter26BStrategy } from '../src/strategies/strat_iter26_b';
import { StratIter26CStrategy } from '../src/strategies/strat_iter26_c';
import { StratIter27AStrategy } from '../src/strategies/strat_iter27_a';
import { StratIter27BStrategy } from '../src/strategies/strat_iter27_b';
import { StratIter27CStrategy } from '../src/strategies/strat_iter27_c';
import { StratIter28AStrategy } from '../src/strategies/strat_iter28_a';
import { StratIter28BStrategy } from '../src/strategies/strat_iter28_b';
import { StratIter28CStrategy } from '../src/strategies/strat_iter28_c';
import { StratIter30AStrategy } from '../src/strategies/strat_iter30_a';
import { StratIter30BStrategy } from '../src/strategies/strat_iter30_b';
import { StratIter30CStrategy } from '../src/strategies/strat_iter30_c';
import { StratIter31AStrategy } from '../src/strategies/strat_iter31_a';
import { StratIter31BStrategy } from '../src/strategies/strat_iter31_b';
import { StratIter31CStrategy } from '../src/strategies/strat_iter31_c';
import { StratIter32AStrategy } from '../src/strategies/strat_iter32_a';
import { StratIter32BStrategy } from '../src/strategies/strat_iter32_b';
import { StratIter32CStrategy } from '../src/strategies/strat_iter32_c';
import { StratIter33AStrategy } from '../src/strategies/strat_iter33_a';
import { StratIter33BStrategy } from '../src/strategies/strat_iter33_b';
import { StratIter33CStrategy } from '../src/strategies/strat_iter33_c';
import { StratIter34AStrategy } from '../src/strategies/strat_iter34_a';
import { StratIter34BStrategy } from '../src/strategies/strat_iter34_b';
import { StratIter34CStrategy } from '../src/strategies/strat_iter34_c';
import { StratIter35AStrategy } from '../src/strategies/strat_iter35_a';
import { StratIter35BStrategy } from '../src/strategies/strat_iter35_b';
import { StratIter35CStrategy } from '../src/strategies/strat_iter35_c';
import { StratIter36AStrategy } from '../src/strategies/strat_iter36_a';
import { StratIter36BStrategy } from '../src/strategies/strat_iter36_b';
import { StratIter36CStrategy } from '../src/strategies/strat_iter36_c';
import { StratIter37AStrategy } from '../src/strategies/strat_iter37_a';
import { StratIter37BStrategy } from '../src/strategies/strat_iter37_b';
import { StratIter37CStrategy } from '../src/strategies/strat_iter37_c';
import { StratIter38AStrategy } from '../src/strategies/strat_iter38_a';
import { StratIter38BStrategy } from '../src/strategies/strat_iter38_b';
import { StratIter38CStrategy } from '../src/strategies/strat_iter38_c';
import { StratIter39AStrategy } from '../src/strategies/strat_iter39_a';
import { StratIter39BStrategy } from '../src/strategies/strat_iter39_b';
import { StratIter39CStrategy } from '../src/strategies/strat_iter39_c';
import { StratIter40AStrategy } from '../src/strategies/strat_iter40_a';
import { StratIter40BStrategy } from '../src/strategies/strat_iter40_b';
import { StratIter40CStrategy } from '../src/strategies/strat_iter40_c';
import { StratIter41AStrategy } from '../src/strategies/strat_iter41_a';
import { StratIter41BStrategy } from '../src/strategies/strat_iter41_b';
import { StratIter41CStrategy } from '../src/strategies/strat_iter41_c';
import { StratIter42AStrategy } from '../src/strategies/strat_iter42_a';
import { StratIter42BStrategy } from '../src/strategies/strat_iter42_b';
import { StratIter42CStrategy } from '../src/strategies/strat_iter42_c';
import { StratIter43AStrategy } from '../src/strategies/strat_iter43_a';
import { StratIter43BStrategy } from '../src/strategies/strat_iter43_b';
import { StratIter43CStrategy } from '../src/strategies/strat_iter43_c';
import { StratIter44AStrategy } from '../src/strategies/strat_iter44_a';
import { StratIter44BStrategy } from '../src/strategies/strat_iter44_b';
import { StratIter44CStrategy } from '../src/strategies/strat_iter44_c';
import { StratIter45AStrategy } from '../src/strategies/strat_iter45_a';
import { StratIter45BStrategy } from '../src/strategies/strat_iter45_b';
import { StratIter45CStrategy } from '../src/strategies/strat_iter45_c';
import { StratIter46AStrategy } from '../src/strategies/strat_iter46_a';
import { StratIter46BStrategy } from '../src/strategies/strat_iter46_b';
import { StratIter46CStrategy } from '../src/strategies/strat_iter46_c';
import { StratIter47AStrategy } from '../src/strategies/strat_iter47_a';
import { StratIter47BStrategy } from '../src/strategies/strat_iter47_b';
import { StratIter47CStrategy } from '../src/strategies/strat_iter47_c';
import { StratIter48AStrategy } from '../src/strategies/strat_iter48_a';
import { StratIter48BStrategy } from '../src/strategies/strat_iter48_b';
import { StratIter48CStrategy } from '../src/strategies/strat_iter48_c';
import { StratIter49AStrategy } from '../src/strategies/strat_iter49_a';
import { StratIter49BStrategy } from '../src/strategies/strat_iter49_b';
import { StratIter49CStrategy } from '../src/strategies/strat_iter49_c';
import { StratIter50AStrategy } from '../src/strategies/strat_iter50_a';
import { StratIter50BStrategy } from '../src/strategies/strat_iter50_b';
import { StratIter50CStrategy } from '../src/strategies/strat_iter50_c';
import { DifferentialEvolutionOptimizer } from '../src/optimization';
import type { ParamConfig, OptimizationResult } from '../src/optimization/types';
import type { StoredData } from '../src/types';
import { BacktestEngine } from '../src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const strategies: Record<string, { class: any; params: Record<string, ParamConfig>; outputFile: string }> = {
  simple_ma: {
    class: SimpleMAStrategy,
    params: {
      fast_period: { min: 5, max: 30, stepSize: 5 },
      slow_period: { min: 20, max: 100, stepSize: 10 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.02 },
      trailing_stop: { min: 0, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.1, max: 0.5, stepSize: 0.1 },
    },
    outputFile: 'strat_simple_ma_01.params.json',
  },
  sr_stoch_02: {
    class: SrStoch02Strategy,
    params: {
      stoch_k_period: { min: 14, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      bounce_threshold: { min: 0.01, max: 0.02, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.25, stepSize: 0.05 },
      sr_lookback: { min: 36, max: 50, stepSize: 14 },
    },
    outputFile: 'strat_sr_stoch_02.params.json',
  },
  sr_stoch_03: {
    class: SrStoch03Strategy,
    params: {
      stoch_k_period: { min: 14, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.25, stepSize: 0.05 },
      sr_lookback: { min: 36, max: 50, stepSize: 14 },
    },
    outputFile: 'strat_sr_stoch_03.params.json',
  },
  iter2_01: {
    class: StratIter201Strategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
      momentum_threshold: { min: 0.008, max: 0.012, stepSize: 0.002 },
    },
    outputFile: 'strat_iter2_01.params.json',
  },
  iter2_02: {
    class: StratIter202Strategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 36, max: 50, stepSize: 14 },
    },
    outputFile: 'strat_iter2_02.params.json',
  },
  iter2_03: {
    class: StratIter203Strategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter2_03.params.json',
  },
  iter3_b: {
    class: StratIter3BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
      momentum_threshold: { min: 0.008, max: 0.012, stepSize: 0.002 },
      retest_lookback: { min: 10, max: 20, stepSize: 5 },
      retest_tolerance: { min: 0.015, max: 0.03, stepSize: 0.005 },
    },
    outputFile: 'strat_iter3_b.params.json',
  },
  iter3_a: {
    class: StratIter3AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 82, max: 82, stepSize: 1 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
      momentum_threshold: { min: 0.008, max: 0.012, stepSize: 0.002 },
    },
    outputFile: 'strat_iter3_a.params.json',
  },
  iter3_c: {
    class: StratIter3CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter3_c.params.json',
  },
  iter4_a: {
    class: StratIter4AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.12, max: 0.18, stepSize: 0.03 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 70, max: 70, stepSize: 1 },
      momentum_threshold: { min: 0.008, max: 0.012, stepSize: 0.002 },
    },
    outputFile: 'strat_iter4_a.params.json',
  },
  iter4_b: {
    class: StratIter4BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter4_b.params.json',
  },
  iter4_c: {
    class: StratIter4CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
      momentum_threshold: { min: 0.008, max: 0.012, stepSize: 0.002 },
    },
    outputFile: 'strat_iter4_c.params.json',
  },
  iter5_a: {
    class: StratIter5AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 80, max: 80, stepSize: 1 },
      momentum_threshold: { min: 0.008, max: 0.012, stepSize: 0.002 },
    },
    outputFile: 'strat_iter5_a.params.json',
  },
  iter6_b: {
    class: StratIter6BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.10, max: 0.10, stepSize: 0.01 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter6_b.params.json',
  },
  iter6_c: {
    class: StratIter6CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter6_c.params.json',
  },
  iter7_a: {
    class: StratIter7AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter7_a.params.json',
  },
  iter7_b: {
    class: StratIter7BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 86, max: 86, stepSize: 1 },
      support_threshold: { min: 0.03, max: 0.03, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.18, max: 0.18, stepSize: 0.01 },
      max_hold_bars: { min: 24, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter7_b.params.json',
  },
  iter7_c: {
    class: StratIter7CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 86, max: 86, stepSize: 1 },
      support_threshold: { min: 0.03, max: 0.03, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.18, max: 0.18, stepSize: 0.01 },
      max_hold_bars: { min: 32, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter7_c.params.json',
  },
  iter8_b: {
    class: StratIter8BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 18, max: 18, stepSize: 1 },
      stoch_overbought: { min: 86, max: 86, stepSize: 1 },
      support_threshold: { min: 0.03, max: 0.03, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.18, max: 0.18, stepSize: 0.01 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter8_b.params.json',
  },
  iter8_c: {
    class: StratIter8CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 16, max: 16, stepSize: 1 },
      stoch_overbought: { min: 86, max: 86, stepSize: 1 },
      support_threshold: { min: 0.03, max: 0.03, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.20, max: 0.20, stepSize: 0.01 },
      max_hold_bars: { min: 32, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter8_c.params.json',
  },
  iter8_a: {
    class: StratIter8AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 86, max: 88, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter8_a.params.json',
  },
  iter9_a: {
    class: StratIter9AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 86, max: 88, stepSize: 2 },
      support_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter9_a.params.json',
  },
  iter9_b: {
    class: StratIter9BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter9_b.params.json',
  },
  iter9_c: {
    class: StratIter9CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter9_c.params.json',
  },
  iter10_a: {
    class: StratIter10AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 86, max: 88, stepSize: 2 },
      bounce_threshold: { min: 1.01, max: 1.03, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter10_a.params.json',
  },
  iter10_b: {
    class: StratIter10BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      momentum_threshold: { min: 0.008, max: 0.014, stepSize: 0.002 },
      bounce_threshold: { min: 1.01, max: 1.03, stepSize: 0.01 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 60, max: 60, stepSize: 1 },
    },
    outputFile: 'strat_iter10_b.params.json',
  },
  iter10_c: {
    class: StratIter10CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.15, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter10_c.params.json',
  },
  iter11_a: {
    class: StratIter11AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 55, max: 55, stepSize: 1 },
    },
    outputFile: 'strat_iter11_a.params.json',
  },
  iter11_b: {
    class: StratIter11BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 65, max: 65, stepSize: 1 },
    },
    outputFile: 'strat_iter11_b.params.json',
  },
  iter11_c: {
    class: StratIter11CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 45, max: 45, stepSize: 1 },
    },
    outputFile: 'strat_iter11_c.params.json',
  },
  iter12_a: {
    class: StratIter12AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 55, max: 55, stepSize: 1 },
    },
    outputFile: 'strat_iter12_a.params.json',
  },
  iter12_b: {
    class: StratIter12BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.15, max: 0.15, stepSize: 0.01 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 55, max: 55, stepSize: 1 },
    },
    outputFile: 'strat_iter12_b.params.json',
  },
  iter12_c: {
    class: StratIter12CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.01, max: 0.01, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.15, max: 0.18, stepSize: 0.01 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 55, max: 55, stepSize: 1 },
    },
    outputFile: 'strat_iter12_c.params.json',
  },
  iter13_a: {
    class: StratIter13AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 52, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter13_a.params.json',
  },
  iter13_b: {
    class: StratIter13BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 58, max: 58, stepSize: 1 },
    },
    outputFile: 'strat_iter13_b.params.json',
  },
  iter13_c: {
    class: StratIter13CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.01, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 55, max: 55, stepSize: 1 },
    },
    outputFile: 'strat_iter13_c.params.json',
  },
  iter14_a: {
    class: StratIter14AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 54, max: 54, stepSize: 1 },
    },
    outputFile: 'strat_iter14_a.params.json',
  },
  iter14_b: {
    class: StratIter14BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter14_b.params.json',
  },
  iter14_c: {
    class: StratIter14CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 48, max: 48, stepSize: 1 },
    },
    outputFile: 'strat_iter14_c.params.json',
  },
  iter15_a: {
    class: StratIter15AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter15_a.params.json',
  },
  iter15_b: {
    class: StratIter15BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 53, max: 53, stepSize: 1 },
    },
    outputFile: 'strat_iter15_b.params.json',
  },
  iter15_c: {
    class: StratIter15CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 49, max: 49, stepSize: 1 },
    },
    outputFile: 'strat_iter15_c.params.json',
  },
  iter16_a: {
    class: StratIter16AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.18, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter16_a.params.json',
  },
  iter16_b: {
    class: StratIter16BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.14, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter16_b.params.json',
  },
  iter16_c: {
    class: StratIter16CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter16_c.params.json',
  },
  iter17_a: {
    class: StratIter17AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter17_a.params.json',
  },
  iter17_b: {
    class: StratIter17BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 84, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter17_b.params.json',
  },
  iter17_c: {
    class: StratIter17CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 24, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter17_c.params.json',
  },
  iter18_a: {
    class: StratIter18AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.20, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter18_a.params.json',
  },
  iter18_b: {
    class: StratIter18BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.30, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter18_b.params.json',
  },
  iter18_c: {
    class: StratIter18CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 86, max: 86, stepSize: 1 },
      support_threshold: { min: 0.01, max: 0.01, stepSize: 0.005 },
      resistance_threshold: { min: 0.98, max: 0.98, stepSize: 0.01 },
      stop_loss: { min: 0.10, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.18, max: 0.18, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 20, stepSize: 4 },
      risk_percent: { min: 0.25, max: 0.25, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter18_c.params.json',
  },
  iter19_a: {
    class: StratIter19AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.015, max: 0.015, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.20, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter19_a.params.json',
  },
  iter19_b: {
    class: StratIter19BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.025, max: 0.025, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.20, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter19_b.params.json',
  },
  iter19_c: {
    class: StratIter19CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.01, max: 0.01, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.95, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 16, max: 24, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter19_c.params.json',
  },
  iter20_a: {
    class: StratIter20AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter20_a.params.json',
  },
  iter20_b: {
    class: StratIter20BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 15, max: 15, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter20_b.params.json',
  },
  iter20_c: {
    class: StratIter20CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.015, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter20_c.params.json',
  },
  iter21_a: {
    class: StratIter21AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 36, max: 36, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter21_a.params.json',
  },
  iter21_b: {
    class: StratIter21BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter21_b.params.json',
  },
  iter21_c: {
    class: StratIter21CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.16, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter21_c.params.json',
  },
  iter22_a: {
    class: StratIter22AStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 36, max: 36, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 52, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter22_a.params.json',
  },
  iter22_b: {
    class: StratIter22BStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 36, max: 36, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter22_b.params.json',
  },
  iter22_c: {
    class: StratIter22CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 14, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 14, stepSize: 1 },
      stoch_overbought: { min: 84, max: 88, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.99, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 36, max: 36, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter22_c.params.json',
  },
  iter23_a: {
    class: StratIter23AStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 36, max: 36, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter23_a.params.json',
  },
  iter23_b: {
    class: StratIter23BStrategy,
    params: {
      stoch_k_period: { min: 10, max: 10, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 36, max: 36, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter23_b.params.json',
  },
  iter23_c: {
    class: StratIter23CStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 5, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 36, max: 36, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter23_c.params.json',
  },
  iter24_a: {
    class: StratIter24AStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter24_a.params.json',
  },
  iter24_b: {
    class: StratIter24BStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 52, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter24_b.params.json',
  },
  iter24_c: {
    class: StratIter24CStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter24_c.params.json',
  },
  iter25_a: {
    class: StratIter25AStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 48, max: 48, stepSize: 1 },
    },
    outputFile: 'strat_iter25_a.params.json',
  },
  iter25_b: {
    class: StratIter25BStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 55, max: 55, stepSize: 1 },
    },
    outputFile: 'strat_iter25_b.params.json',
  },
  iter25_c: {
    class: StratIter25CStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 28, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter25_c.params.json',
  },
  iter26_a: {
    class: StratIter26AStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 35, max: 35, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter26_a.params.json',
  },
  iter26_b: {
    class: StratIter26BStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 35, max: 35, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter26_b.params.json',
  },
  iter26_c: {
    class: StratIter26CStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 35, max: 35, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 52, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter26_c.params.json',
  },
  iter27_a: {
    class: StratIter27AStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 40, max: 40, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter27_a.params.json',
  },
  iter27_b: {
    class: StratIter27BStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 40, max: 40, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter27_b.params.json',
  },
  iter27_c: {
    class: StratIter27CStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.95, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 40, max: 40, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 52, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter27_c.params.json',
  },
  iter28_a: {
    class: StratIter28AStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter28_a.params.json',
  },
  iter28_b: {
    class: StratIter28BStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 51, max: 51, stepSize: 1 },
    },
    outputFile: 'strat_iter28_b.params.json',
  },
  iter28_c: {
    class: StratIter28CStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 52, max: 52, stepSize: 1 },
    },
    outputFile: 'strat_iter28_c.params.json',
  },
  iter30_a: {
    class: StratIter30AStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
      volume_lookback: { min: 20, max: 20, stepSize: 1 },
    },
    outputFile: 'strat_iter30_a.params.json',
  },
  iter30_b: {
    class: StratIter30BStrategy,
    params: {
      stoch_k_period: { min: 18, max: 18, stepSize: 1 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      rsi_period: { min: 14, max: 14, stepSize: 1 },
      rsi_filter: { min: 35, max: 45, stepSize: 5 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 32, stepSize: 1 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter30_b.params.json',
  },
  strat_iter30_c: {
    class: StratIter30CStrategy,
    params: {
      stoch_k_period: { min: 14, max: 22, stepSize: 2 },
      stoch_d_period: { min: 3, max: 3, stepSize: 1 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 86, stepSize: 2 },
      support_threshold: { min: 0.01, max: 0.02, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.35, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
      trail_activation: { min: 0.03, max: 0.08, stepSize: 0.01 },
      trail_distance: { min: 0.02, max: 0.05, stepSize: 0.01 },
    },
    outputFile: 'strat_iter30_c.params.json',
  },
  strat_iter31_c: {
    class: StratIter31CStrategy,
    params: {
      mean_period: { min: 18, max: 26, stepSize: 2 },
      rsi_period: { min: 10, max: 20, stepSize: 2 },
      entry_std_multiplier: { min: 1.5, max: 2.5, stepSize: 0.25 },
      rsi_threshold: { min: 20, max: 35, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.35, stepSize: 0.05 },
      history_limit: { min: 200, max: 300, stepSize: 25 },
    },
    outputFile: 'strat_iter31_c.params.json',
  },
  iter31_b: {
    class: StratIter31BStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter31_b.params.json',
  },
  iter31_a: {
    class: StratIter31AStrategy,
    params: {
      macd_fast: { min: 12, max: 12, stepSize: 1 },
      macd_slow: { min: 26, max: 26, stepSize: 1 },
      macd_signal: { min: 9, max: 9, stepSize: 1 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 50, max: 50, stepSize: 1 },
    },
    outputFile: 'strat_iter31_a.params.json',
  },
  iter32_a: {
    class: StratIter32AStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.96, max: 0.99, stepSize: 0.01 },
      atr_period: { min: 14, max: 14, stepSize: 1 },
      atr_regime_threshold: { min: 0.01, max: 0.05, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 40, max: 60, stepSize: 10 },
    },
    outputFile: 'strat_iter32_a.params.json',
  },
  strat_iter32_b: {
    class: StratIter32BStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      sr_lookback: { min: 48, max: 56, stepSize: 4 },
      rsi_period: { min: 14, max: 14, stepSize: 1 },
      rsi_rising_bars: { min: 2, max: 4, stepSize: 1 },
      divergence_lookback: { min: 6, max: 12, stepSize: 2 },
      lower_low_threshold: { min: 0.001, max: 0.005, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter32_b.params.json',
  },
  strat_iter32_c: {
    class: StratIter32CStrategy,
    params: {
      macd_fast: { min: 10, max: 14, stepSize: 2 },
      macd_slow: { min: 22, max: 30, stepSize: 2 },
      macd_signal: { min: 7, max: 11, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      histogram_accel_threshold: { min: 0.0002, max: 0.0012, stepSize: 0.0002 },
      histogram_weakening_threshold: { min: 0.0008, max: 0.0032, stepSize: 0.0004 },
    },
    outputFile: 'strat_iter32_c.params.json',
  },
  iter33_a: {
    class: StratIter33AStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      stoch_k_rise_min: { min: 0.5, max: 3, stepSize: 0.5 },
      break_below_support_pct: { min: 0.005, max: 0.025, stepSize: 0.005 },
      reclaim_within_bars: { min: 2, max: 8, stepSize: 1 },
      support_reclaim_buffer: { min: 0, max: 0.005, stepSize: 0.001 },
      resistance_threshold: { min: 0.96, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
    },
    outputFile: 'strat_iter33_a.params.json',
  },
  strat_iter33_b: {
    class: StratIter33BStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      range_lookback: { min: 2, max: 8, stepSize: 2 },
      range_threshold: { min: 0.015, max: 0.08, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter33_b.params.json',
  },
  strat_iter33_c: {
    class: StratIter33CStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      rsi_period: { min: 12, max: 18, stepSize: 2 },
      rsi_strong_trigger: { min: 56, max: 64, stepSize: 2 },
      rsi_medium_trigger: { min: 48, max: 56, stepSize: 2 },
      rsi_strong_exit: { min: 46, max: 54, stepSize: 2 },
      rsi_medium_exit: { min: 40, max: 48, stepSize: 2 },
      rsi_weak_exit: { min: 34, max: 42, stepSize: 2 },
      rsi_exit_min_hold_bars: { min: 2, max: 8, stepSize: 1 },
    },
    outputFile: 'strat_iter33_c.params.json',
  },
  strat_iter34_c: {
    class: StratIter34CStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      roc_period: { min: 3, max: 8, stepSize: 1 },
      roc_delta_threshold: { min: -0.03, max: -0.005, stepSize: 0.005 },
      roc_exit_min_hold_bars: { min: 1, max: 6, stepSize: 1 },
    },
    outputFile: 'strat_iter34_c.params.json',
  },
  strat_iter34_a: {
    class: StratIter34AStrategy,
    params: {
      donchian_breakout_lookback: { min: 8, max: 18, stepSize: 2 },
      donchian_resistance_lookback: { min: 40, max: 60, stepSize: 5 },
      breakout_buffer: { min: 0, max: 0.008, stepSize: 0.001 },
      retest_tolerance: { min: 0.005, max: 0.02, stepSize: 0.0025 },
      retest_window_bars: { min: 2, max: 10, stepSize: 1 },
      breakout_fail_pct: { min: 0.005, max: 0.025, stepSize: 0.005 },
      resistance_threshold: { min: 0.96, max: 0.995, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter34_a.params.json',
  },
  strat_iter34_b: {
    class: StratIter34BStrategy,
    params: {
      z_lookback: { min: 16, max: 40, stepSize: 4 },
      z_entry_threshold: { min: 1.2, max: 2.8, stepSize: 0.2 },
      z_exit_threshold: { min: -0.6, max: 0.6, stepSize: 0.2 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter34_b.params.json',
  },
  strat_iter35_a: {
    class: StratIter35AStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 18, stepSize: 2 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      support_zone_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      min_support_touches: { min: 1, max: 4, stepSize: 1 },
      resistance_threshold: { min: 0.96, max: 0.995, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter35_a.params.json',
  },
  strat_iter35_b: {
    class: StratIter35BStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.96, max: 0.995, stepSize: 0.005 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 40, stepSize: 4 },
      breakeven_trigger: { min: 0.04, max: 0.14, stepSize: 0.02 },
      breakeven_buffer: { min: 0, max: 0.01, stepSize: 0.0025 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter35_b.params.json',
  },
  strat_iter35_c: {
    class: StratIter35CStrategy,
    params: {
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      support_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      resistance_threshold: { min: 0.96, max: 0.99, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      contraction_lookback: { min: 6, max: 12, stepSize: 2 },
      baseline_lookback: { min: 24, max: 48, stepSize: 8 },
      contraction_ratio_threshold: { min: 0.5, max: 0.9, stepSize: 0.1 },
      breakout_buffer: { min: 0.001, max: 0.01, stepSize: 0.001 },
      expansion_check_bars: { min: 3, max: 8, stepSize: 1 },
      expansion_factor: { min: 1.1, max: 1.8, stepSize: 0.1 },
    },
    outputFile: 'strat_iter35_c.params.json',
  },
  strat_iter36_a: {
    class: StratIter36AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      vwap_lookback: { min: 16, max: 40, stepSize: 8 },
      deviation_threshold: { min: 0.01, max: 0.05, stepSize: 0.01 },
      reclaim_buffer: { min: 0.001, max: 0.008, stepSize: 0.001 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter36_a.params.json',
  },
  strat_iter36_b: {
    class: StratIter36BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      ema_fast: { min: 7, max: 15, stepSize: 2 },
      ema_slow: { min: 24, max: 42, stepSize: 6 },
      slope_lookback: { min: 4, max: 10, stepSize: 2 },
      min_slope: { min: -0.005, max: 0.001, stepSize: 0.001 },
      max_slope: { min: 0.004, max: 0.016, stepSize: 0.002 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter36_b.params.json',
  },
  strat_iter36_c: {
    class: StratIter36CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      arm_band: { min: 12, max: 20, stepSize: 2 },
      trigger_band: { min: 20, max: 30, stepSize: 2 },
      disarm_band: { min: 40, max: 60, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter36_c.params.json',
  },
  strat_iter37_a: {
    class: StratIter37AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      atr_period: { min: 10, max: 20, stepSize: 2 },
      atr_mult: { min: 1.4, max: 3.0, stepSize: 0.2 },
      hard_stop: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.16, max: 0.28, stepSize: 0.02 },
      max_hold_bars: { min: 24, max: 40, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter37_a.params.json',
  },
  strat_iter37_b: {
    class: StratIter37BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      support_touch_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      max_touch_age: { min: 8, max: 24, stepSize: 4 },
      age_decay_bars: { min: 4, max: 12, stepSize: 2 },
      weighted_min_score: { min: 0.2, max: 0.6, stepSize: 0.1 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter37_b.params.json',
  },
  strat_iter37_c: {
    class: StratIter37CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      breakout_buffer: { min: 0.002, max: 0.012, stepSize: 0.002 },
      reclaim_buffer: { min: 0.001, max: 0.008, stepSize: 0.001 },
      fail_window: { min: 3, max: 9, stepSize: 1 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.24, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter37_c.params.json',
  },
  strat_iter38_a: {
    class: StratIter38AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      rsi_period: { min: 10, max: 18, stepSize: 2 },
      rsi_percentile_lookback: { min: 50, max: 100, stepSize: 10 },
      rsi_percentile_entry: { min: 10, max: 30, stepSize: 5 },
      support_buffer: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter38_a.params.json',
  },
  strat_iter38_b: {
    class: StratIter38BStrategy,
    params: {
      donchian_lookback: { min: 18, max: 40, stepSize: 4 },
      revert_band: { min: 0.08, max: 0.24, stepSize: 0.04 },
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      midline_take_profit: { min: 0.2, max: 0.6, stepSize: 0.1 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter38_b.params.json',
  },
  strat_iter38_c: {
    class: StratIter38CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      confirm_window: { min: 3, max: 8, stepSize: 1 },
      confirm_break_buffer: { min: 0.001, max: 0.01, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter38_c.params.json',
  },
  strat_iter39_a: {
    class: StratIter39AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      initial_profit_target: { min: 0.16, max: 0.26, stepSize: 0.02 },
      min_profit_target: { min: 0.08, max: 0.14, stepSize: 0.02 },
      decay_per_bar: { min: 0.001, max: 0.008, stepSize: 0.001 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter39_a.params.json',
  },
  strat_iter39_b: {
    class: StratIter39BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      vol_lookback: { min: 12, max: 32, stepSize: 4 },
      min_resistance_threshold: { min: 0.92, max: 0.97, stepSize: 0.01 },
      max_resistance_threshold: { min: 0.97, max: 0.995, stepSize: 0.005 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter39_b.params.json',
  },
  strat_iter39_c: {
    class: StratIter39CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      cooldown_bars: { min: 4, max: 16, stepSize: 2 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter39_c.params.json',
  },
  strat_iter40_a: {
    class: StratIter40AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      momentum_lookback: { min: 2, max: 8, stepSize: 1 },
      score_threshold: { min: 2, max: 5, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter40_a.params.json',
  },
  strat_iter40_b: {
    class: StratIter40BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      macd_fast: { min: 8, max: 14, stepSize: 2 },
      macd_slow: { min: 20, max: 32, stepSize: 2 },
      macd_signal: { min: 5, max: 11, stepSize: 2 },
      zero_retest_band: { min: 0.003, max: 0.02, stepSize: 0.002 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter40_b.params.json',
  },
  strat_iter40_c: {
    class: StratIter40CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      range_lookback: { min: 16, max: 36, stepSize: 4 },
      momentum_lookback: { min: 2, max: 8, stepSize: 1 },
      normalized_momentum_threshold: { min: 0.08, max: 0.3, stepSize: 0.02 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter40_c.params.json',
  },
  strat_iter41_a: {
    class: StratIter41AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      compression_window: { min: 4, max: 8, stepSize: 1 },
      compression_ratio_max: { min: 0.55, max: 0.9, stepSize: 0.05 },
      support_buffer: { min: 0.008, max: 0.02, stepSize: 0.002 },
      breakout_buffer: { min: 0.001, max: 0.008, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter41_a.params.json',
  },
  strat_iter41_b: {
    class: StratIter41BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      sweep_buffer: { min: 0.002, max: 0.01, stepSize: 0.001 },
      reclaim_buffer: { min: 0.001, max: 0.008, stepSize: 0.001 },
      min_wick_to_body: { min: 1.1, max: 3.0, stepSize: 0.2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter41_b.params.json',
  },
  strat_iter41_c: {
    class: StratIter41CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      momentum_lookback: { min: 2, max: 8, stepSize: 1 },
      min_profit_target: { min: 0.08, max: 0.14, stepSize: 0.02 },
      max_profit_target: { min: 0.16, max: 0.26, stepSize: 0.02 },
      target_capture_ratio: { min: 0.5, max: 0.9, stepSize: 0.1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter41_c.params.json',
  },
  strat_iter42_a: {
    class: StratIter42AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      support_shift: { min: 12, max: 28, stepSize: 4 },
      min_support_lift: { min: 0.001, max: 0.008, stepSize: 0.001 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter42_a.params.json',
  },
  strat_iter42_b: {
    class: StratIter42BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      z_lookback: { min: 16, max: 36, stepSize: 4 },
      z_entry_threshold: { min: -2.0, max: -0.6, stepSize: 0.2 },
      hold_window: { min: 6, max: 18, stepSize: 2 },
      min_support_holds: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter42_b.params.json',
  },
  strat_iter42_c: {
    class: StratIter42CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      ema_period: { min: 8, max: 18, stepSize: 2 },
      breakout_lookback: { min: 4, max: 10, stepSize: 1 },
      pullback_buffer: { min: 0.001, max: 0.01, stepSize: 0.001 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_trigger: { min: 20, max: 32, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter42_c.params.json',
  },
  strat_iter43_a: {
    class: StratIter43AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      atr_short: { min: 4, max: 10, stepSize: 2 },
      atr_long: { min: 14, max: 28, stepSize: 2 },
      expansion_ratio: { min: 1.02, max: 1.3, stepSize: 0.02 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter43_a.params.json',
  },
  strat_iter43_b: {
    class: StratIter43BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      divergence_window: { min: 5, max: 12, stepSize: 1 },
      min_price_break: { min: 0.001, max: 0.01, stepSize: 0.001 },
      min_stoch_lift: { min: 2, max: 10, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter43_b.params.json',
  },
  strat_iter43_c: {
    class: StratIter43CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      min_under_bars: { min: 1, max: 3, stepSize: 1 },
      max_under_bars: { min: 3, max: 8, stepSize: 1 },
      reclaim_buffer: { min: 0.001, max: 0.008, stepSize: 0.001 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter43_c.params.json',
  },
  strat_iter44_a: {
    class: StratIter44AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      range_lookback: { min: 12, max: 30, stepSize: 3 },
      low_vol_threshold: { min: 0.04, max: 0.16, stepSize: 0.02 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      breakout_buffer: { min: 0.001, max: 0.01, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter44_a.params.json',
  },
  strat_iter44_b: {
    class: StratIter44BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      cooldown_base: { min: 0, max: 6, stepSize: 1 },
      cooldown_step: { min: 1, max: 6, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter44_b.params.json',
  },
  strat_iter44_c: {
    class: StratIter44CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      initial_stop: { min: 0.08, max: 0.14, stepSize: 0.02 },
      floor_stop: { min: 0.02, max: 0.06, stepSize: 0.01 },
      stop_half_life_bars: { min: 6, max: 18, stepSize: 2 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter44_c.params.json',
  },
  strat_iter45_a: {
    class: StratIter45AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      chop_lookback: { min: 8, max: 20, stepSize: 2 },
      min_chop_ratio: { min: 0.3, max: 0.8, stepSize: 0.05 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter45_a.params.json',
  },
  strat_iter45_b: {
    class: StratIter45BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      persistence_bars: { min: 2, max: 6, stepSize: 1 },
      oversold_band: { min: 12, max: 20, stepSize: 2 },
      release_band: { min: 20, max: 32, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter45_b.params.json',
  },
  strat_iter45_c: {
    class: StratIter45CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      shock_threshold: { min: 0.01, max: 0.06, stepSize: 0.01 },
      setup_window: { min: 2, max: 8, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter45_c.params.json',
  },
  strat_iter46_a: {
    class: StratIter46AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      short_range_window: { min: 4, max: 10, stepSize: 1 },
      long_range_window: { min: 16, max: 30, stepSize: 2 },
      squeeze_ratio_max: { min: 0.45, max: 0.85, stepSize: 0.05 },
      release_range_ratio_min: { min: 1.0, max: 1.8, stepSize: 0.1 },
      support_buffer: { min: 0.01, max: 0.025, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter46_a.params.json',
  },
  strat_iter46_b: {
    class: StratIter46BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_trigger: { min: 18, max: 30, stepSize: 2 },
      exhaustion_window: { min: 4, max: 12, stepSize: 1 },
      min_down_bars: { min: 2, max: 8, stepSize: 1 },
      max_last_drop: { min: 0.004, max: 0.02, stepSize: 0.002 },
      support_buffer: { min: 0.01, max: 0.025, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter46_b.params.json',
  },
  strat_iter46_c: {
    class: StratIter46CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      wick_body_ratio_min: { min: 1.0, max: 3.0, stepSize: 0.2 },
      reclaim_buffer: { min: 0.001, max: 0.008, stepSize: 0.001 },
      close_location_min: { min: 0.45, max: 0.8, stepSize: 0.05 },
      support_sweep_buffer: { min: 0.001, max: 0.01, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter46_c.params.json',
  },
  strat_iter47_a: {
    class: StratIter47AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      ema_period: { min: 7, max: 21, stepSize: 2 },
      slope_flip_min: { min: 0.0, max: 0.003, stepSize: 0.0005 },
      support_buffer: { min: 0.01, max: 0.025, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter47_a.params.json',
  },
  strat_iter47_b: {
    class: StratIter47BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      min_velocity: { min: 1, max: 8, stepSize: 1 },
      support_buffer: { min: 0.01, max: 0.025, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter47_b.params.json',
  },
  strat_iter47_c: {
    class: StratIter47CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_trigger: { min: 18, max: 32, stepSize: 2 },
      dwell_bars: { min: 3, max: 8, stepSize: 1 },
      support_band: { min: 0.006, max: 0.025, stepSize: 0.001 },
      breakout_buffer: { min: 0.001, max: 0.01, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter47_c.params.json',
  },
  strat_iter48_a: {
    class: StratIter48AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      shock_window: { min: 12, max: 36, stepSize: 4 },
      shock_pct_rank: { min: 0.05, max: 0.35, stepSize: 0.05 },
      arm_window: { min: 2, max: 8, stepSize: 1 },
      support_buffer: { min: 0.01, max: 0.03, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter48_a.params.json',
  },
  strat_iter48_b: {
    class: StratIter48BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      atr_period: { min: 8, max: 24, stepSize: 2 },
      mean_period: { min: 10, max: 30, stepSize: 2 },
      discount_atr_mult: { min: 0.4, max: 2.0, stepSize: 0.2 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter48_b.params.json',
  },
  strat_iter48_c: {
    class: StratIter48CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      z_lookback: { min: 12, max: 36, stepSize: 4 },
      z_entry: { min: -2.0, max: -0.8, stepSize: 0.2 },
      z_release: { min: -0.8, max: 0.4, stepSize: 0.2 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter48_c.params.json',
  },
  strat_iter49_a: {
    class: StratIter49AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      cluster_bars: { min: 3, max: 10, stepSize: 1 },
      min_down_closes: { min: 2, max: 8, stepSize: 1 },
      support_buffer: { min: 0.01, max: 0.025, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter49_a.params.json',
  },
  strat_iter49_b: {
    class: StratIter49BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      min_profit_target: { min: 0.08, max: 0.14, stepSize: 0.02 },
      max_profit_target: { min: 0.16, max: 0.26, stepSize: 0.02 },
      target_capture_ratio: { min: 0.5, max: 0.95, stepSize: 0.05 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter49_b.params.json',
  },
  strat_iter49_c: {
    class: StratIter49CStrategy,
    params: {
      short_lookback: { min: 16, max: 36, stepSize: 4 },
      long_lookback: { min: 45, max: 60, stepSize: 5 },
      support_alignment_max: { min: 0.005, max: 0.03, stepSize: 0.0025 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter49_c.params.json',
  },
  strat_iter50_a: {
    class: StratIter50AStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      min_under_bars: { min: 1, max: 3, stepSize: 1 },
      max_under_bars: { min: 3, max: 8, stepSize: 1 },
      reclaim_buffer: { min: 0.001, max: 0.008, stepSize: 0.001 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter50_a.params.json',
  },
  strat_iter50_b: {
    class: StratIter50BStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      narrow_window: { min: 4, max: 10, stepSize: 1 },
      narrow_ratio_max: { min: 0.5, max: 0.95, stepSize: 0.05 },
      body_ratio_min: { min: 0.35, max: 0.8, stepSize: 0.05 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_trigger: { min: 16, max: 30, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter50_b.params.json',
  },
  strat_iter50_c: {
    class: StratIter50CStrategy,
    params: {
      sr_lookback: { min: 45, max: 55, stepSize: 5 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_oversold: { min: 14, max: 20, stepSize: 2 },
      pressure_flip_min: { min: 0.05, max: 0.35, stepSize: 0.05 },
      support_buffer: { min: 0.01, max: 0.025, stepSize: 0.001 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 36, stepSize: 4 },
      risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_iter50_c.params.json',
  },
};

async function loadDataset(datasetPath: string): Promise<StoredData> {
  const absolutePath = path.resolve(datasetPath);
  console.log(kleur.gray(`Loading dataset from: ${absolutePath}`));
  const data = await loadStoredData(absolutePath);
  console.log(kleur.gray(`Loaded ${data.markets.length} markets, ${data.priceHistory.size} price histories`));
  return data;
}

async function runOptimization(
  strategyName: string,
  data: StoredData,
  options: { generations: number; population: number; fidelity: number }
): Promise<OptimizationResult> {
  const strategyConfig = strategies[strategyName];
  if (!strategyConfig) throw new Error(`Unknown strategy: ${strategyName}`);

  console.log(kleur.cyan(`\nOptimizing ${strategyName}...`));

  const optimizer = new DifferentialEvolutionOptimizer(
    data,
    strategyConfig.class,
    strategyConfig.params,
    { maxIterations: options.generations }
  );

  const result = await optimizer.optimize(null);
  
  console.log(kleur.green(`\nBest result: Return = $${result.bestReturn.toFixed(2)}`));
  console.log(kleur.gray(`Best params: ${JSON.stringify(result.finalParams, null, 2)}`));

  const outputPath = path.join(__dirname, '../src/strategies', strategyConfig.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(result.finalParams, null, 2));

  return result;
}

async function runBacktest(
  strategyName: string,
  data: StoredData,
  params?: Record<string, number>
): Promise<void> {
  const strategyConfig = strategies[strategyName];
  if (!strategyConfig) throw new Error(`Unknown strategy: ${strategyName}`);

  const strategy = new strategyConfig.class(params || {});
  const engine = new BacktestEngine(data, strategy);
  const result = engine.run();

  console.log(kleur.cyan(`\nBacktest results for ${strategyName}:`));
  console.log(kleur.white(`  Final Capital: $${result.finalCapital.toFixed(2)}`));
  console.log(kleur.white(`  Total Return: $${result.totalReturn.toFixed(2)} (${result.totalReturnPercent.toFixed(2)}%)`));
  console.log(kleur.white(`  Total Trades: ${result.totalTrades}`));
  console.log(kleur.white(`  Win Rate: ${result.totalTrades > 0 ? ((result.winningTrades / result.totalTrades) * 100).toFixed(1) : 0}%`));
}

async function main() {
  const program = new Command();
  program
    .name('run-optimization')
    .argument('[strategy]', 'Strategy name', 'simple_ma')
    .option('-d, --dataset <path>', 'Path to dataset', 'data/test-data.bson')
    .option('-g, --generations <number>', 'Number of generations', '20')
    .option('--backtest-only', 'Run backtest only', false)
    .parse(process.argv);

  const options = program.opts();
  const strategyName = program.args[0] || 'simple_ma';

  try {
    const data = await loadDataset(options.dataset);

    if (options.backtestOnly) {
      const paramsPath = path.join(__dirname, '../src/strategies', strategies[strategyName].outputFile);
      let params = {};
      if (fs.existsSync(paramsPath)) params = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
      await runBacktest(strategyName, data, params);
    } else {
      await runOptimization(strategyName, data, { generations: parseInt(options.generations), population: 15, fidelity: 1 });
      await runBacktest(strategyName, data);
    }
  } catch (error) {
    console.error(kleur.red(`Error: ${error}`));
    process.exit(1);
  }
}

main();

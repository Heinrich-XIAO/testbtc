import { Command } from 'commander';
import kleur from 'kleur';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import type { Strategy, BacktestConfig, BacktestResult } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const DEFAULT_DATA_FILE = 'data/polymarket-data.bson';

function loadSavedParams(paramsFile: string): Record<string, number> | null {
  const paramsPath = path.join(process.cwd(), paramsFile);
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

const strategies: Record<string, { 
  name: string;
  getStrategy: (params: any) => Strategy;
  paramsFile: string;
}> = {
  'stoch_baseline_01': {
    name: 'Stoch Baseline (01)',
    getStrategy: (params) => new (require('../src/strategies/strat_stoch_baseline_01').StochBaseline01Strategy)(params),
    paramsFile: 'src/strategies/strat_stoch_baseline_01.params.json',
  },
  'simple_ma': {
    name: 'Simple MA (01)',
    getStrategy: (params) => new (require('../src/strategies/strat_simple_ma_01').SimpleMAStrategy)(params),
    paramsFile: 'src/strategies/strat_simple_ma_01.params.json',
  },
  'bollinger': {
    name: 'Bollinger Bands (02)',
    getStrategy: (params) => new (require('../src/strategies/strat_bollinger_02').BollingerBandsStrategy)(params),
    paramsFile: 'src/strategies/strat_bollinger_02.params.json',
  },
  'rsi': {
    name: 'RSI Mean Reversion (03)',
    getStrategy: (params) => new (require('../src/strategies/strat_rsi_03').RSIMeanReversionStrategy)(params),
    paramsFile: 'src/strategies/strat_rsi_03.params.json',
  },
  'breakout': {
    name: 'Price Breakout (04)',
    getStrategy: (params) => new (require('../src/strategies/strat_atr_breakout_04').ATRBreakoutStrategy)(params),
    paramsFile: 'src/strategies/strat_atr_breakout_04.params.json',
  },
  'ma_vol': {
    name: 'MA + Volatility Stop (05)',
    getStrategy: (params) => new (require('../src/strategies/strat_ma_atr_05').MAStrategyWithATRStop)(params),
    paramsFile: 'src/strategies/strat_ma_atr_05.params.json',
  },
  'support': {
    name: 'Support/Resistance (06)',
    getStrategy: (params) => new (require('../src/strategies/strat_support_06').SupportResistanceStrategy)(params),
    paramsFile: 'src/strategies/strat_support_06.params.json',
  },
  'momentum': {
    name: 'Momentum (07)',
    getStrategy: (params) => new (require('../src/strategies/strat_momentum_07').ShortTermStrategy)(params),
    paramsFile: 'src/strategies/strat_momentum_07.params.json',
  },
  'range': {
    name: 'Range Trading (08)',
    getStrategy: (params) => new (require('../src/strategies/strat_range_08').RangeTradingStrategy)(params),
    paramsFile: 'src/strategies/strat_range_08.params.json',
  },
  'mean_revert': {
    name: 'Mean Reversion (09)',
    getStrategy: (params) => new (require('../src/strategies/strat_mean_revert_09').MeanReversionStrategy)(params),
    paramsFile: 'src/strategies/strat_mean_revert_09.params.json',
  },
  'dual_ma': {
    name: 'Dual MA + Trend (10)',
    getStrategy: (params) => new (require('../src/strategies/strat_dual_ma_10').DualMAStrategy)(params),
    paramsFile: 'src/strategies/strat_dual_ma_10.params.json',
  },
  'strat_sr_no_trend_filter_302': {
    name: 'SR No Trend Filter (302)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_filter_302').SRNoTrendFilter302Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_filter_302.params.json',
  },
  'strat_sr_no_trend_lookup_55_378': {
    name: 'SR No Trend Lookup 55 (378)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_lookup_55_378').SRNoTrendLookup55378Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_lookup_55_378.params.json',
  },
  'strat_sr_no_trend_lookup_45_372': {
    name: 'SR No Trend Lookup 45 (372)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_lookup_45_372').SRNoTrendLookup45Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_lookup_45_372.params.json',
  },
  'strat_sr_no_trend_combo_366': {
    name: 'SR No Trend Combo (366)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_combo_366').SRNoTrendCombo366Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_combo_366.params.json',
  },
  'strat_sr_no_trend_combo_wide_380': {
    name: 'SR No Trend Combo Wide (380)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_combo_wide_380').SRNoTrendComboWide380Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_combo_wide_380.params.json',
  },
  'strat_sr_no_trend_base_30_365': {
    name: 'SR No Trend Base 30 (365)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_base_30_365').SRNoTrendBase30_365Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_base_30_365.params.json',
  },
  'strat_sr_no_trend_late_exit_355': {
    name: 'SR No Trend Late Exit (355)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_late_exit_355').SRNoTrendLateExit355Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_late_exit_355.params.json',
  },
  'strat_sr_no_trend_slow_stoch_360': {
    name: 'SR No Trend Slow Stoch (360)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_slow_stoch_360').SRSlowStoch360Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_slow_stoch_360.params.json',
  },
  'strat_sr_no_trend_tight_bounce_354': {
    name: 'SR No Trend Tight Bounce (354)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_tight_bounce_354').SRNoTrendTightBounce354Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_tight_bounce_354.params.json',
  },
  'strat_sr_no_trend_only_stoch_353': {
    name: 'SR No Trend Only Stoch (353)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_only_stoch_353').SRNoTrendOnlyStoch353Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_only_stoch_353.params.json',
  },
  'strat_sr_no_trend_momentum_only_352': {
    name: 'SR No Trend Momentum Only (352)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_momentum_only_352').SRNoTrendMomentumOnly352Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_momentum_only_352.params.json',
  },
  'strat_sr_no_trend_day_filter_356': {
    name: 'SR No Trend Day Filter (356)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_day_filter_356').SRNoTrendDayFilter356Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_day_filter_356.params.json',
  },
  'strat_sr_no_trend_support_zone_345': {
    name: 'SR No Trend Support Zone (345)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_support_zone_345').SRNoTrendSupportZone345Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_support_zone_345.params.json',
  },
  'strat_sr_no_trend_two_level_344': {
    name: 'SR No Trend Two Level (344)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_two_level_344').SRNoTrendTwoLevel344Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_two_level_344.params.json',
  },
  'strat_sr_no_trend_adx_341': {
    name: 'SR No Trend ADX (341)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_adx_341').SRNoTrendADX341Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_adx_341.params.json',
  },
  'strat_sr_no_trend_macd_339': {
    name: 'SR No Trend MACD (339)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_macd_339').SRNoTrendMACD339Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_macd_339.params.json',
  },
  'strat_sr_no_trend_vwap_338': {
    name: 'SR No Trend VWAP (338)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_vwap_338').SRNoTrendVwap338Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_vwap_338.params.json',
  },
  'strat_sr_no_trend_bollinger_336': {
    name: 'SR No Trend Bollinger (336)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_bollinger_336').SRNoTrendBollinger336Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_bollinger_336.params.json',
  },
  'strat_sr_no_trend_wider_bounce_327': {
    name: 'SR No Trend Wider Bounce (327)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_wider_bounce_327').SRNoTrendWiderBounce327Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_wider_bounce_327.params.json',
  },
  'strat_sr_no_trend_no_bounce_326': {
    name: 'SR No Trend No Bounce (326)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_no_bounce_326').SRNoTrendNoBounce326Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_no_bounce_326.params.json',
  },
  'strat_sr_no_trend_with_trend_318': {
    name: 'SR No Trend With Trend (318)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_with_trend_318').SRNoTrendWithTrend318Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_with_trend_318.params.json',
  },
  'strat_sr_no_trend_volatility_316': {
    name: 'SR No Trend Volatility (316)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_volatility_316').SRNoTrendVolatility316Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_volatility_316.params.json',
  },
  'strat_sr_no_trend_dynamic_trail_317': {
    name: 'SR No Trend Dynamic Trail (317)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_dynamic_trail_317').SRNoTrendDynamicTrail317Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_dynamic_trail_317.params.json',
  },
  'strat_sr_no_trend_no_momentum_315': {
    name: 'SR No Trend No Momentum (315)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_no_momentum_315').SRNoTrendNoMomentum315Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_no_momentum_315.params.json',
  },
  'strat_sr_no_trend_rsi_exit_314': {
    name: 'SR No Trend RSI Exit (314)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_rsi_exit_314').SRNoTrendRSIExit314Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_rsi_exit_314.params.json',
  },
  'strat_sr_no_trend_volume_313': {
    name: 'SR No Trend Volume (313)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_volume_313').SRNoTrendVolume313Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_volume_313.params.json',
  },
  'strat_sr_no_trend_multi_tp_319': {
    name: 'SR No Trend Multi TP (319)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_multi_tp_319').SRNoTrendMultiTP319Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_multi_tp_319.params.json',
  },
  'strat_sr_no_trend_confluence_320': {
    name: 'SR No Trend Confluence (320)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_confluence_320').SRNoTrendConfluence320Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_confluence_320.params.json',
  },
  'strat_sr_no_trend_time_filter_321': {
    name: 'SR No Trend Time Filter (321)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_time_filter_321').SRNoTrendTimeFilter321Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_time_filter_321.params.json',
  },
  'strat_sr_no_trend_atr_stop_322': {
    name: 'SR No Trend ATR Stop (322)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_atr_stop_322').SRNoTrendATRStop322Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_atr_stop_322.params.json',
  },
  'strat_sr_no_trend_wider_bounce_323': {
    name: 'SR No Trend Wider Bounce (323)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_wider_bounce_323').SRNoTrendWiderBounce323Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_wider_bounce_323.params.json',
  },
  'strat_sr_no_trend_tight_stoch_324': {
    name: 'SR No Trend Tight Stoch (324)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_tight_stoch_324').SRNoTrendTightStoch324Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_tight_stoch_324.params.json',
  },
  'strat_sr_no_trend_wide_stoch_325': {
    name: 'SR No Trend Wide Stoch (325)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_wide_stoch_325').SRNoTrendWideStoch325Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_wide_stoch_325.params.json',
  },
  'strat_sr_no_trend_tight_stop_328': {
    name: 'SR No Trend Tight Stop (328)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_tight_stop_328').SRNoTrendTightStop328Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_tight_stop_328.params.json',
  },
  'strat_sr_no_trend_wide_stop_329': {
    name: 'SR No Trend Wide Stop (329)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_wide_stop_329').SRNoTrendWideStop329Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_wide_stop_329.params.json',
  },
  'strat_sr_no_trend_wide_tp_330': {
    name: 'SR No Trend Wide TP (330)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_wide_tp_330').SRNoTrendWideTP330Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_wide_tp_330.params.json',
  },
  'strat_sr_no_trend_no_trail_331': {
    name: 'SR No Trend No Trail (331)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_no_trail_331').SRNoTrendNoTrail331Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_no_trail_331.params.json',
  },
  'strat_sr_no_trend_long_hold_332': {
    name: 'SR No Trend Long Hold (332)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_long_hold_332').SRNoTrendLongHold332Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_long_hold_332.params.json',
  },
  'strat_sr_no_trend_multi_exit_333': {
    name: 'SR No Trend Multi Exit (333)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_multi_exit_333').SRNoTrendMultiExit333Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_multi_exit_333.params.json',
  },
  'strat_sr_no_trend_rsi_filter_334': {
    name: 'SR No Trend RSI Filter (334)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_rsi_filter_334').SRNoTrendRSIFilter334Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_rsi_filter_334.params.json',
  },
  'strat_sr_no_trend_ema_filter_335': {
    name: 'SR No Trend EMA Filter (335)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_ema_filter_335').SRNoTrendEMAFilter335Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_ema_filter_335.params.json',
  },
  'strat_sr_no_trend_atr_filter_337': {
    name: 'SR No Trend ATR Filter (337)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_atr_filter_337').SRNoTrendATRFilter337Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_atr_filter_337.params.json',
  },
  'strat_sr_no_trend_roc_342': {
    name: 'SR No Trend ROC (342)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_roc_342').SRNoTrendRoc342Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_roc_342.params.json',
  },
  'strat_sr_no_trend_short_343': {
    name: 'SR No Trend Short (343)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_short_343').SRNoTrendShort343Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_short_343.params.json',
  },
  'strat_sr_no_trend_willr_340': {
    name: 'SR No Trend WillR (340)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_willr_340').SRNoTrendWillR340Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_willr_340.params.json',
  },
  'strat_sr_no_trend_progressive_346': {
    name: 'SR No Trend Progressive (346)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_progressive_346').SRNoTrendProgressive346Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_progressive_346.params.json',
  },
  'strat_sr_no_trend_partial_347': {
    name: 'SR No Trend Partial (347)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_partial_347').SRNoTrendPartial347Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_partial_347.params.json',
  },
  'strat_sr_no_trend_strong_momentum_348': {
    name: 'SR No Trend Strong Momentum (348)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_strong_momentum_348').SRNoTrendStrongMomentum348Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_strong_momentum_348.params.json',
  },
  'strat_sr_no_trend_simple_349': {
    name: 'SR No Trend Simple (349)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_simple_349').SRSimple349Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_simple_349.params.json',
  },
  'strat_sr_no_trend_triple_350': {
    name: 'SR No Trend Triple (350)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_triple_350').SRNoTrendTriple350Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_triple_350.params.json',
  },
  'strat_sr_no_trend_close_resistance_351': {
    name: 'SR No Trend Close Resistance (351)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_close_resistance_351').SRNoTrendCloseResistance351Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_close_resistance_351.params.json',
  },
  'strat_sr_no_trend_short_hold_357': {
    name: 'SR No Trend Short Hold (357)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_short_hold_357').SRNoTrendShortHold357Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_short_hold_357.params.json',
  },
  'strat_sr_no_trend_vol_tp_358': {
    name: 'SR No Trend Vol TP (358)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_vol_tp_358').SRSrNoTrendVolTp358Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_vol_tp_358.params.json',
  },
  'strat_sr_no_trend_no_bounce_359': {
    name: 'SR No Trend No Bounce (359)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_no_bounce_359').SRNoTrendNoBounce359Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_no_bounce_359.params.json',
  },
  'strat_sr_no_trend_high_risk_361': {
    name: 'SR No Trend High Risk (361)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_high_risk_361').SRNoTrendHighRisk361Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_high_risk_361.params.json',
  },
  'strat_sr_no_trend_wide_lookup_362': {
    name: 'SR No Trend Wide Lookup (362)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_wide_lookup_362').SRNoTrendWideLookup362Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_wide_lookup_362.params.json',
  },
  'strat_sr_no_trend_lookup_48_382': {
    name: 'SR No Trend Lookup 48 (382)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_lookup_48_382').SRNoTrendLookup382Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_lookup_48_382.params.json',
  },
  'strat_sr_no_trend_lookup_52_383': {
    name: 'SR No Trend Lookup 52 (383)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_lookup_52_383').SRNoTrendLookup383Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_lookup_52_383.params.json',
  },
  'strat_sr_no_trend_lookup_60_377': {
    name: 'SR No Trend Lookup 60 (377)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_lookup_60_377').SRNoTrendLookup60377Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_lookup_60_377.params.json',
  },
  'strat_sr_no_trend_smooth_stoch_364': {
    name: 'SR No Trend Smooth Stoch (364)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_smooth_stoch_364').SRNoTrendSmoothStoch364Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_smooth_stoch_364.params.json',
  },
  'strat_sr_no_trend_wider_lookup_363': {
    name: 'SR No Trend Wider Lookup (363)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_wider_lookup_363').SRNoTrendWiderLookup363Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_wider_lookup_363.params.json',
  },
  'strat_sr_no_trend_tight_trail_367': {
    name: 'SR No Trend Tight Trail (367)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_tight_trail_367').SRNoTrendTightTrail367Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_tight_trail_367.params.json',
  },
  'strat_sr_no_trend_wide_res_370': {
    name: 'SR No Trend Wide Res (370)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_wide_res_370').SRNoTrendWideRes370Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_wide_res_370.params.json',
  },
  'strat_sr_no_trend_combo3_371': {
    name: 'SR No Trend Combo3 (371)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_combo3_371').SRSRNoTrendCombo3371Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_combo3_371.params.json',
  },
  'strat_sr_no_trend_vol_20_373': {
    name: 'SR No Trend Vol 20 (373)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_vol_20_373').SRNoTrendVol20373Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_vol_20_373.params.json',
  },
  'strat_sr_no_trend_vol_6_374': {
    name: 'SR No Trend Vol 6 (374)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_vol_6_374').SRNoTrendVol6374Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_vol_6_374.params.json',
  },
  'strat_sr_no_trend_combo_mom_375': {
    name: 'SR No Trend Combo Mom (375)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_combo_mom_375').SRNoTrendComboMom375Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_combo_mom_375.params.json',
  },
  'strat_sr_no_trend_min_look_376': {
    name: 'SR No Trend Min Look (376)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_min_look_376').SRNoTrendMinLook376Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_min_look_376.params.json',
  },
  'strat_sr_no_trend_combo_tight_379': {
    name: 'SR No Trend Combo Tight (379)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_combo_tight_379').SRNoTrendComboTight379Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_combo_tight_379.params.json',
  },
  'strat_sr_no_trend_stoch_turn_384': {
    name: 'SR No Trend Stoch Turn (384)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_stoch_turn_384').SRNoTrendStochTurn384Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_stoch_turn_384.params.json',
  },
  'strat_sr_no_trend_retest_385': {
    name: 'SR No Trend Retest (385)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_retest_385').SRNoTrendRetest385Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_retest_385.params.json',
  },
  'strat_sr_no_trend_mom_exit_386': {
    name: 'SR No Trend Mom Exit (386)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_mom_exit_386').SRNoTrendMomExit386Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_mom_exit_386.params.json',
  },
  'strat_sr_no_trend_weighted_support_387': {
    name: 'SR No Trend Weighted Support (387)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_weighted_support_387').SRNoTrendWeightedSupport387Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_weighted_support_387.params.json',
  },
  'strat_sr_no_trend_stoch_cross_exit_388': {
    name: 'SR No Trend Stoch Cross Exit (388)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_stoch_cross_exit_388').SRNoTrendStochCrossExit388Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_stoch_cross_exit_388.params.json',
  },
  'strat_sr_no_trend_support_strength_389': {
    name: 'SR No Trend Support Strength (389)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_support_strength_389').SRNoTrendSupportStrength389Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_support_strength_389.params.json',
  },
  'strat_sr_no_trend_vol_sized_390': {
    name: 'SR No Trend Vol Sized (390)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_vol_sized_390').SRNoTrendVolSized390Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_vol_sized_390.params.json',
  },
  'strat_sr_no_trend_price_action_391': {
    name: 'SR No Trend Price Action (391)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_price_action_391').SRNoTrendPriceAction391Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_price_action_391.params.json',
  },
  'strat_sr_no_trend_minimal_exit_392': {
    name: 'SR No Trend Minimal Exit (392)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_minimal_exit_392').SRNoTrendMinimalExit392Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_minimal_exit_392.params.json',
  },
  'strat_sr_no_trend_clustered_support_393': {
    name: 'SR No Trend Clustered Support (393)',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_no_trend_clustered_support_393').SRNoTrendClusteredSupport393Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_no_trend_clustered_support_393.params.json',
  },
  'stoch_baseline_02': {
    name: 'Stoch Baseline 02',
    getStrategy: (params) => new (require('../src/strategies/strat_stoch_baseline_02').StochBaseline02Strategy)(params),
    paramsFile: 'src/strategies/strat_stoch_baseline_02.params.json',
  },
  'stoch_baseline_03': {
    name: 'Stoch Baseline 03',
    getStrategy: (params) => new (require('../src/strategies/strat_stoch_baseline_03').StochBaseline03Strategy)(params),
    paramsFile: 'src/strategies/strat_stoch_baseline_03.params.json',
  },
  'sr_stoch_02': {
    name: 'SR Stoch 02',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_stoch_02').SrStoch02Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_stoch_02.params.json',
  },
  'sr_stoch_03': {
    name: 'SR Stoch 03',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_stoch_03').SrStoch03Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_stoch_03.params.json',
  },
  'sr_stoch_01': {
    name: 'SR Stoch 01',
    getStrategy: (params) => new (require('../src/strategies/strat_sr_stoch_01').SrStoch01Strategy)(params),
    paramsFile: 'src/strategies/strat_sr_stoch_01.params.json',
  },
  'strat_iter2_02': {
    name: 'Iter2 02 - No Trend Filter',
    getStrategy: (params) => new (require('../src/strategies/strat_iter2_02').StratIter202Strategy)(params),
    paramsFile: 'src/strategies/strat_iter2_02.params.json',
  },
  'iter2_03': {
    name: 'Iter2 03 - Wider Lookback 60',
    getStrategy: (params) => new (require('../src/strategies/strat_iter2_03').StratIter203Strategy)(params),
    paramsFile: 'src/strategies/strat_iter2_03.params.json',
  },
  'iter2_01': {
    name: 'Iter2 01 - Momentum + Tight Stoch',
    getStrategy: (params) => new (require('../src/strategies/strat_iter2_01').StratIter201Strategy)(params),
    paramsFile: 'src/strategies/strat_iter2_01.params.json',
  },
  'iter4_a': {
    name: 'Iter4 A - Lookback 70',
    getStrategy: (params) => new (require('../src/strategies/strat_iter4_a').StratIter4AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter4_a.params.json',
  },
  'iter4_b': {
    name: 'Iter4 B - Higher Profit Target',
    getStrategy: (params) => new (require('../src/strategies/strat_iter4_b').StratIter4BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter4_b.params.json',
  },
  'iter4_c': {
    name: 'Iter4 C - Exit at Resistance',
    getStrategy: (params) => new (require('../src/strategies/strat_iter4_c').StratIter4CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter4_c.params.json',
  },
  'iter5_b': {
    name: 'Iter5 B - Tight Stochastic + PT 18%',
    getStrategy: (params) => new (require('../src/strategies/strat_iter5_b').StratIter5BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter5_b.params.json',
  },
  'iter5_c': {
    name: 'Iter5 C - Lookback 50 + PT 18%',
    getStrategy: (params) => new (require('../src/strategies/strat_iter5_c').StratIter5CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter5_c.params.json',
  },
  'iter6_a': {
    name: 'Iter6 A - Lower Risk 20%',
    getStrategy: (params) => new (require('../src/strategies/strat_iter6_a').StratIter6AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter6_a.params.json',
  },
  'iter6_b': {
    name: 'Iter6 B - Wider Stop 10%',
    getStrategy: (params) => new (require('../src/strategies/strat_iter6_b').StratIter6BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter6_b.params.json',
  },
  'iter6_c': {
    name: 'Iter6 C - Tight Overbought 86',
    getStrategy: (params) => new (require('../src/strategies/strat_iter6_c').StratIter6CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter6_c.params.json',
  },
  'iter7_a': {
    name: 'Iter7 A - Support Retest',
    getStrategy: (params) => new (require('../src/strategies/strat_iter7_a').StratIter7AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter7_a.params.json',
  },
  'iter7_b': {
    name: 'Iter7 B - No Trend Filter',
    getStrategy: (params) => new (require('../src/strategies/strat_iter7_b').StratIter7BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter7_b.params.json',
  },
  'iter7_c': {
    name: 'Iter7 C - Simple Exit',
    getStrategy: (params) => new (require('../src/strategies/strat_iter7_c').StratIter7CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter7_c.params.json',
  },
  'iter8_a': {
    name: 'Iter8 A - No Overbought Exit',
    getStrategy: (params) => new (require('../src/strategies/strat_iter8_a').StratIter8AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter8_a.params.json',
  },
  'iter8_b': {
    name: 'Iter8 B - Wider Lookback',
    getStrategy: (params) => new (require('../src/strategies/strat_iter8_b').StratIter8BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter8_b.params.json',
  },
  'iter8_c': {
    name: 'Iter8 C - Momentum Filter',
    getStrategy: (params) => new (require('../src/strategies/strat_iter8_c').StratIter8CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter8_c.params.json',
  },
  'iter9_a': {
    name: 'Iter9 A - No Overbought Exit',
    getStrategy: (params) => new (require('../src/strategies/strat_iter9_a').StratIter9AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter9_a.params.json',
  },
  'iter9_b': {
    name: 'Iter9 B - K/D Crossover',
    getStrategy: (params) => new (require('../src/strategies/strat_iter9_b').StratIter9BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter9_b.params.json',
  },
  'iter9_c': {
    name: 'Iter9 C - Tight Support',
    getStrategy: (params) => new (require('../src/strategies/strat_iter9_c').StratIter9CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter9_c.params.json',
  },
  'iter11_c': {
    name: 'Iter11 C - Lookback 45',
    getStrategy: (params) => new (require('../src/strategies/strat_iter11_c').StratIter11CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter11_c.params.json',
  },
  'iter14_c': {
    name: 'Iter14 C - Lookback 48',
    getStrategy: (params) => new (require('../src/strategies/strat_iter14_c').StratIter14CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter14_c.params.json',
  },
  'iter15_a': {
    name: 'Iter15 A - Lookback 51',
    getStrategy: (params) => new (require('../src/strategies/strat_iter15_a').StratIter15AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter15_a.params.json',
  },
  'iter15_b': {
    name: 'Iter15 B - Lookback 53',
    getStrategy: (params) => new (require('../src/strategies/strat_iter15_b').StratIter15BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter15_b.params.json',
  },
  'iter15_c': {
    name: 'Iter15 C - Lookback 49',
    getStrategy: (params) => new (require('../src/strategies/strat_iter15_c').StratIter15CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter15_c.params.json',
  },
  'iter16_a': {
    name: 'Iter16 A - Lookback 51, PT 0.16',
    getStrategy: (params) => new (require('../src/strategies/strat_iter16_a').StratIter16AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter16_a.params.json',
  },
  'iter16_b': {
    name: 'Iter16 B - Lookback 51, PT 0.14',
    getStrategy: (params) => new (require('../src/strategies/strat_iter16_b').StratIter16BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter16_b.params.json',
  },
  'iter16_c': {
    name: 'Iter16 C - Lookback 51, No PT',
    getStrategy: (params) => new (require('../src/strategies/strat_iter16_c').StratIter16CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter16_c.params.json',
  },
  'iter17_a': {
    name: 'Iter17 A - Tighter Stoch 14',
    getStrategy: (params) => new (require('../src/strategies/strat_iter17_a').StratIter17AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter17_a.params.json',
  },
  'iter17_c': {
    name: 'Iter17 C - Max Hold 24',
    getStrategy: (params) => new (require('../src/strategies/strat_iter17_c').StratIter17CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter17_c.params.json',
  },
  'iter18_a': {
    name: 'Iter18 A - Risk 0.20',
    getStrategy: (params) => new (require('../src/strategies/strat_iter18_a').StratIter18AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter18_a.params.json',
  },
  'iter18_b': {
    name: 'Iter18 B - Risk 0.30',
    getStrategy: (params) => new (require('../src/strategies/strat_iter18_b').StratIter18BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter18_b.params.json',
  },
  'iter18_c': {
    name: 'Iter18 C - Stop Loss 0.10',
    getStrategy: (params) => new (require('../src/strategies/strat_iter18_c').StratIter18CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter18_c.params.json',
  },
  'iter19_c': {
    name: 'Iter19 C - Resistance 0.95',
    getStrategy: (params) => new (require('../src/strategies/strat_iter19_c').StratIter19CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter19_c.params.json',
  },
  'iter20_a': {
    name: 'Iter20 A - Max Hold 32',
    getStrategy: (params) => new (require('../src/strategies/strat_iter20_a').StratIter20AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter20_a.params.json',
  },
  'iter20_b': {
    name: 'Iter20 B - Max Hold 15',
    getStrategy: (params) => new (require('../src/strategies/strat_iter20_b').StratIter20BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter20_b.params.json',
  },
  'iter20_c': {
    name: 'Iter20 C - Tighter Stochastic',
    getStrategy: (params) => new (require('../src/strategies/strat_iter20_c').StratIter20CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter20_c.params.json',
  },
  'iter21_a': {
    name: 'Iter21 A - Max Hold 36',
    getStrategy: (params) => new (require('../src/strategies/strat_iter21_a').StratIter21AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter21_a.params.json',
  },
  'iter21_b': {
    name: 'Iter21 B - Max Hold 32',
    getStrategy: (params) => new (require('../src/strategies/strat_iter21_b').StratIter21BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter21_b.params.json',
  },
  'iter21_c': {
    name: 'Iter21 C - Profit Target 0.16',
    getStrategy: (params) => new (require('../src/strategies/strat_iter21_c').StratIter21CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter21_c.params.json',
  },
  'iter22_a': {
    name: 'Iter22 A - Lookback 52',
    getStrategy: (params) => new (require('../src/strategies/strat_iter22_a').StratIter22AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter22_a.params.json',
  },
  'iter23_a': {
    name: 'Iter23 A - Stoch Period 18',
    getStrategy: (params) => new (require('../src/strategies/strat_iter23_a').StratIter23AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter23_a.params.json',
  },
  'iter23_b': {
    name: 'Iter23 B - Stoch Period 10',
    getStrategy: (params) => new (require('../src/strategies/strat_iter23_b').StratIter23BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter23_b.params.json',
  },
  'iter24_a': {
    name: 'Iter24 A - Lookback 51',
    getStrategy: (params) => new (require('../src/strategies/strat_iter24_a').StratIter24AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter24_a.params.json',
  },
  'iter24_b': {
    name: 'Iter24 B - Lookback 52',
    getStrategy: (params) => new (require('../src/strategies/strat_iter24_b').StratIter24BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter24_b.params.json',
  },
  'iter24_c': {
    name: 'Iter24 C - Lookback 50',
    getStrategy: (params) => new (require('../src/strategies/strat_iter24_c').StratIter24CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter24_c.params.json',
  },
  'iter25_a': {
    name: 'Iter25 A - Lookback 48',
    getStrategy: (params) => new (require('../src/strategies/strat_iter25_a').StratIter25AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter25_a.params.json',
  },
  'iter25_b': {
    name: 'Iter25 B - Lookback 55',
    getStrategy: (params) => new (require('../src/strategies/strat_iter25_b').StratIter25BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter25_b.params.json',
  },
  'iter25_c': {
    name: 'Iter25 C - Lookback 50',
    getStrategy: (params) => new (require('../src/strategies/strat_iter25_c').StratIter25CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter25_c.params.json',
  },
  'strat_iter30_a': {
    name: 'Iter30 A - Volume Confirmation',
    getStrategy: (params) => new (require('../src/strategies/strat_iter30_a').StratIter30AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter30_a.params.json',
  },
  'strat_iter30_b': {
    name: 'Iter30 B - RSI Filter',
    getStrategy: (params) => new (require('../src/strategies/strat_iter30_b').StratIter30BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter30_b.params.json',
  },
  'strat_iter30_c': {
    name: 'Iter30 C - Trailing Stop Exit',
    getStrategy: (params) => new (require('../src/strategies/strat_iter30_c').StratIter30CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter30_c.params.json',
  },
  'strat_iter31_a': {
    name: 'Iter31 A - MACD Entry',
    getStrategy: (params) => new (require('../src/strategies/strat_iter31_a').StratIter31AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter31_a.params.json',
  },
  'strat_iter31_b': {
    name: 'Iter31 B - Bollinger Entry',
    getStrategy: (params) => new (require('../src/strategies/strat_iter31_b').StratIter31BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter31_b.params.json',
  },
  'strat_iter31_c': {
    name: 'Iter31 C - Mean Reversion',
    getStrategy: (params) => new (require('../src/strategies/strat_iter31_c').StratIter31CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter31_c.params.json',
  },
  'strat_iter32_a': {
    name: 'Iter32 A - ATR Regime + Stoch Support',
    getStrategy: (params) => new (require('../src/strategies/strat_iter32_a').StratIter32AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter32_a.params.json',
  },
  'strat_iter32_b': {
    name: 'Iter32 B - RSI Divergence Proxy',
    getStrategy: (params) => new (require('../src/strategies/strat_iter32_b').StratIter32BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter32_b.params.json',
  },
  'strat_iter32_c': {
    name: 'Iter32 C - MACD Histogram Acceleration',
    getStrategy: (params) => new (require('../src/strategies/strat_iter32_c').StratIter32CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter32_c.params.json',
  },
  'strat_iter33_a': {
    name: 'Iter33 A - False Breakdown Reclaim',
    getStrategy: (params) => new (require('../src/strategies/strat_iter33_a').StratIter33AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter33_a.params.json',
  },
  'strat_iter33_b': {
    name: 'Iter33 B - Stoch Support + Range Filter',
    getStrategy: (params) => new (require('../src/strategies/strat_iter33_b').StratIter33BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter33_b.params.json',
  },
  'strat_iter33_c': {
    name: 'Iter33 C - RSI Regime-Switch Exit',
    getStrategy: (params) => new (require('../src/strategies/strat_iter33_c').StratIter33CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter33_c.params.json',
  },
  'strat_iter34_a': {
    name: 'Iter34 A - Donchian Breakout Retest',
    getStrategy: (params) => new (require('../src/strategies/strat_iter34_a').StratIter34AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter34_a.params.json',
  },
  'strat_iter34_c': {
    name: 'Iter34 C - ROC Momentum Exhaustion Exit',
    getStrategy: (params) => new (require('../src/strategies/strat_iter34_c').StratIter34CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter34_c.params.json',
  },
  'strat_iter34_b': {
    name: 'Iter34 B - Z-Score Support Reversion',
    getStrategy: (params) => new (require('../src/strategies/strat_iter34_b').StratIter34BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter34_b.params.json',
  },
  'strat_iter35_a': {
    name: 'Iter35 A - Support Touch Count + Stoch Cross',
    getStrategy: (params) => new (require('../src/strategies/strat_iter35_a').StratIter35AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter35_a.params.json',
  },
  'strat_iter35_b': {
    name: 'Iter35 B - Break-even Stop Promotion',
    getStrategy: (params) => new (require('../src/strategies/strat_iter35_b').StratIter35BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter35_b.params.json',
  },
  'strat_iter35_c': {
    name: 'Iter35 C - Volatility Contraction Reclaim',
    getStrategy: (params) => new (require('../src/strategies/strat_iter35_c').StratIter35CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter35_c.params.json',
  },
  'strat_iter36_a': {
    name: 'Iter36 A - VWAP Deviation Re-entry',
    getStrategy: (params) => new (require('../src/strategies/strat_iter36_a').StratIter36AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter36_a.params.json',
  },
  'strat_iter36_b': {
    name: 'Iter36 B - EMA Slope Regime Gate',
    getStrategy: (params) => new (require('../src/strategies/strat_iter36_b').StratIter36BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter36_b.params.json',
  },
  'strat_iter36_c': {
    name: 'Iter36 C - Stochastic Hysteresis Bands',
    getStrategy: (params) => new (require('../src/strategies/strat_iter36_c').StratIter36CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter36_c.params.json',
  },
  'strat_iter37_a': {
    name: 'Iter37 A - ATR Trailing Stop Variant',
    getStrategy: (params) => new (require('../src/strategies/strat_iter37_a').StratIter37AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter37_a.params.json',
  },
  'strat_iter37_b': {
    name: 'Iter37 B - Support Age Weighting',
    getStrategy: (params) => new (require('../src/strategies/strat_iter37_b').StratIter37BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter37_b.params.json',
  },
  'strat_iter37_c': {
    name: 'Iter37 C - Failed Breakout Fade',
    getStrategy: (params) => new (require('../src/strategies/strat_iter37_c').StratIter37CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter37_c.params.json',
  },
  'strat_iter38_a': {
    name: 'Iter38 A - RSI Percentile Regime',
    getStrategy: (params) => new (require('../src/strategies/strat_iter38_a').StratIter38AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter38_a.params.json',
  },
  'strat_iter38_b': {
    name: 'Iter38 B - Donchian Mean Revert Hybrid',
    getStrategy: (params) => new (require('../src/strategies/strat_iter38_b').StratIter38BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter38_b.params.json',
  },
  'strat_iter38_c': {
    name: 'Iter38 C - Two-Stage Confirmation',
    getStrategy: (params) => new (require('../src/strategies/strat_iter38_c').StratIter38CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter38_c.params.json',
  },
  'strat_iter39_a': {
    name: 'Iter39 A - Time-decay Profit Target',
    getStrategy: (params) => new (require('../src/strategies/strat_iter39_a').StratIter39AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter39_a.params.json',
  },
  'strat_iter39_b': {
    name: 'Iter39 B - Dynamic Volatility Resistance',
    getStrategy: (params) => new (require('../src/strategies/strat_iter39_b').StratIter39BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter39_b.params.json',
  },
  'strat_iter39_c': {
    name: 'Iter39 C - Stopout Cooldown',
    getStrategy: (params) => new (require('../src/strategies/strat_iter39_c').StratIter39CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter39_c.params.json',
  },
  'strat_iter40_a': {
    name: 'Iter40 A - Multi-bar Score Confirmation',
    getStrategy: (params) => new (require('../src/strategies/strat_iter40_a').StratIter40AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter40_a.params.json',
  },
  'strat_iter40_b': {
    name: 'Iter40 B - MACD Zero-line Retest',
    getStrategy: (params) => new (require('../src/strategies/strat_iter40_b').StratIter40BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter40_b.params.json',
  },
  'strat_iter40_c': {
    name: 'Iter40 C - Range-normalized Momentum',
    getStrategy: (params) => new (require('../src/strategies/strat_iter40_c').StratIter40CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter40_c.params.json',
  },
  'strat_iter41_a': {
    name: 'Iter41 A - Support Compression Breakout',
    getStrategy: (params) => new (require('../src/strategies/strat_iter41_a').StratIter41AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter41_a.params.json',
  },
  'strat_iter41_b': {
    name: 'Iter41 B - Liquidity Sweep Reclaim',
    getStrategy: (params) => new (require('../src/strategies/strat_iter41_b').StratIter41BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter41_b.params.json',
  },
  'strat_iter41_c': {
    name: 'Iter41 C - Distance-scaled Target',
    getStrategy: (params) => new (require('../src/strategies/strat_iter41_c').StratIter41CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter41_c.params.json',
  },
  'strat_iter42_a': {
    name: 'Iter42 A - Rising Support Staircase',
    getStrategy: (params) => new (require('../src/strategies/strat_iter42_a').StratIter42AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter42_a.params.json',
  },
  'strat_iter42_b': {
    name: 'Iter42 B - Z-score Support Holds',
    getStrategy: (params) => new (require('../src/strategies/strat_iter42_b').StratIter42BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter42_b.params.json',
  },
  'strat_iter42_c': {
    name: 'Iter42 C - EMA Pullback Continuation',
    getStrategy: (params) => new (require('../src/strategies/strat_iter42_c').StratIter42CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter42_c.params.json',
  },
  'strat_iter43_a': {
    name: 'Iter43 A - ATR Expansion Kickoff',
    getStrategy: (params) => new (require('../src/strategies/strat_iter43_a').StratIter43AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter43_a.params.json',
  },
  'strat_iter43_b': {
    name: 'Iter43 B - Divergence Proxy',
    getStrategy: (params) => new (require('../src/strategies/strat_iter43_b').StratIter43BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter43_b.params.json',
  },
  'strat_iter43_c': {
    name: 'Iter43 C - Under-support Reclaim Duration',
    getStrategy: (params) => new (require('../src/strategies/strat_iter43_c').StratIter43CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter43_c.params.json',
  },
  'strat_iter44_a': {
    name: 'Iter44 A - Range Regime Hybrid',
    getStrategy: (params) => new (require('../src/strategies/strat_iter44_a').StratIter44AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter44_a.params.json',
  },
  'strat_iter44_b': {
    name: 'Iter44 B - Loss-streak Cooldown',
    getStrategy: (params) => new (require('../src/strategies/strat_iter44_b').StratIter44BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter44_b.params.json',
  },
  'strat_iter44_c': {
    name: 'Iter44 C - Half-life Stop Tightening',
    getStrategy: (params) => new (require('../src/strategies/strat_iter44_c').StratIter44CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter44_c.params.json',
  },
  'strat_iter45_a': {
    name: 'Iter45 A - Choppiness Mean Revert',
    getStrategy: (params) => new (require('../src/strategies/strat_iter45_a').StratIter45AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter45_a.params.json',
  },
  'strat_iter45_b': {
    name: 'Iter45 B - Oversold Persistence Release',
    getStrategy: (params) => new (require('../src/strategies/strat_iter45_b').StratIter45BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter45_b.params.json',
  },
  'strat_iter45_c': {
    name: 'Iter45 C - Shock Reversal Inside Bar',
    getStrategy: (params) => new (require('../src/strategies/strat_iter45_c').StratIter45CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter45_c.params.json',
  },
  'strat_iter46_a': {
    name: 'Iter46 A - Squeeze Release Support Reversion',
    getStrategy: (params) => new (require('../src/strategies/strat_iter46_a').StratIter46AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter46_a.params.json',
  },
  'strat_iter46_b': {
    name: 'Iter46 B - Downside Exhaustion Ladder',
    getStrategy: (params) => new (require('../src/strategies/strat_iter46_b').StratIter46BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter46_b.params.json',
  },
  'strat_iter46_c': {
    name: 'Iter46 C - Wick Reclaim Strength',
    getStrategy: (params) => new (require('../src/strategies/strat_iter46_c').StratIter46CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter46_c.params.json',
  },
  'strat_iter47_a': {
    name: 'Iter47 A - EMA Inflection Reclaim',
    getStrategy: (params) => new (require('../src/strategies/strat_iter47_a').StratIter47AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter47_a.params.json',
  },
  'strat_iter47_b': {
    name: 'Iter47 B - Stochastic Velocity Burst',
    getStrategy: (params) => new (require('../src/strategies/strat_iter47_b').StratIter47BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter47_b.params.json',
  },
  'strat_iter47_c': {
    name: 'Iter47 C - Support Dwell Breakout',
    getStrategy: (params) => new (require('../src/strategies/strat_iter47_c').StratIter47CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter47_c.params.json',
  },
  'strat_iter48_a': {
    name: 'Iter48 A - Percentile Shock Snapback',
    getStrategy: (params) => new (require('../src/strategies/strat_iter48_a').StratIter48AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter48_a.params.json',
  },
  'strat_iter48_b': {
    name: 'Iter48 B - ATR Discount Reversion',
    getStrategy: (params) => new (require('../src/strategies/strat_iter48_b').StratIter48BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter48_b.params.json',
  },
  'strat_iter48_c': {
    name: 'Iter48 C - Z-score Release Reversal',
    getStrategy: (params) => new (require('../src/strategies/strat_iter48_c').StratIter48CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter48_c.params.json',
  },
  'strat_iter49_a': {
    name: 'Iter49 A - Loss Cluster Higher-low',
    getStrategy: (params) => new (require('../src/strategies/strat_iter49_a').StratIter49AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter49_a.params.json',
  },
  'strat_iter49_b': {
    name: 'Iter49 B - Distance-scaled Target v2',
    getStrategy: (params) => new (require('../src/strategies/strat_iter49_b').StratIter49BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter49_b.params.json',
  },
  'strat_iter49_c': {
    name: 'Iter49 C - Dual Support Alignment',
    getStrategy: (params) => new (require('../src/strategies/strat_iter49_c').StratIter49CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter49_c.params.json',
  },
  'strat_iter50_a': {
    name: 'Iter50 A - Under-support Reclaim v2',
    getStrategy: (params) => new (require('../src/strategies/strat_iter50_a').StratIter50AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter50_a.params.json',
  },
  'strat_iter50_b': {
    name: 'Iter50 B - Narrow Range Impulse',
    getStrategy: (params) => new (require('../src/strategies/strat_iter50_b').StratIter50BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter50_b.params.json',
  },
  'strat_iter50_c': {
    name: 'Iter50 C - Pressure Flip Reversal',
    getStrategy: (params) => new (require('../src/strategies/strat_iter50_c').StratIter50CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter50_c.params.json',
  },
  'strat_iter51_a': {
    name: 'Iter51 A - Genetic Fitness Score',
    getStrategy: (params) => new (require('../src/strategies/strat_iter51_a').StratIter51AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter51_a.params.json',
  },
  'strat_iter51_b': {
    name: 'Iter51 B - Shannon Entropy Regime',
    getStrategy: (params) => new (require('../src/strategies/strat_iter51_b').StratIter51BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter51_b.params.json',
  },
  'strat_iter51_c': {
    name: 'Iter51 C - Autocorrelation Cycle Detection',
    getStrategy: (params) => new (require('../src/strategies/strat_iter51_c').StratIter51CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter51_c.params.json',
  },
  'strat_iter52_a': {
    name: 'Iter52 A - Hurst Exponent Trending Regime',
    getStrategy: (params) => new (require('../src/strategies/strat_iter52_a').StratIter52AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter52_a.params.json',
  },
  'strat_iter52_b': {
    name: 'Iter52 B - Quantum Stochastic Collapse',
    getStrategy: (params) => new (require('../src/strategies/strat_iter52_b').StratIter52BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter52_b.params.json',
  },
  'strat_iter52_c': {
    name: 'Iter52 C - Swarm Intelligence',
    getStrategy: (params) => new (require('../src/strategies/strat_iter52_c').StratIter52CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter52_c.params.json',
  },
  'strat_iter53_a': {
    name: 'Iter53 A - Wave Interference Oscillator',
    getStrategy: (params) => new (require('../src/strategies/strat_iter53_a').StratIter53AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter53_a.params.json',
  },
  'strat_iter53_b': {
    name: 'Iter53 B - Fuzzy Logic Entry Controller',
    getStrategy: (params) => new (require('../src/strategies/strat_iter53_b').StratIter53BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter53_b.params.json',
  },
  'strat_iter53_c': {
    name: 'Iter53 C - Bayesian Regime Updater',
    getStrategy: (params) => new (require('../src/strategies/strat_iter53_c').StratIter53CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter53_c.params.json',
  },
  'strat_iter54_a': {
    name: 'Iter54 A - Cellular Automata Emergence',
    getStrategy: (params) => new (require('../src/strategies/strat_iter54_a').StratIter54AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter54_a.params.json',
  },
  'strat_iter54_b': {
    name: 'Iter54 B - KL Shock Stabilization Regime',
    getStrategy: (params) => new (require('../src/strategies/strat_iter54_b').StratIter54BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter54_b.params.json',
  },
  'strat_iter54_c': {
    name: 'Iter54 C - Agent Consensus Micro-Sim Proxy',
    getStrategy: (params) => new (require('../src/strategies/strat_iter54_c').StratIter54CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter54_c.params.json',
  },
  'strat_iter55_a': {
    name: 'Iter55 A - Time-Warped Momentum',
    getStrategy: (params) => new (require('../src/strategies/strat_iter55_a').StratIter55AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter55_a.params.json',
  },
  'strat_iter55_b': {
    name: 'Iter55 B - Nash Proxy Regime Game',
    getStrategy: (params) => new (require('../src/strategies/strat_iter55_b').StratIter55BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter55_b.params.json',
  },
  'strat_iter55_c': {
    name: 'Iter55 C - Mutation-Crossover Signal Pool',
    getStrategy: (params) => new (require('../src/strategies/strat_iter55_c').StratIter55CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter55_c.params.json',
  },
  'strat_iter56_a': {
    name: 'Iter56 A - Topological Persistence Basin Proxy',
    getStrategy: (params) => new (require('../src/strategies/strat_iter56_a').StratIter56AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter56_a.params.json',
  },
  'strat_iter56_b': {
    name: 'Iter56 B - Hidden-State Markov Proxy',
    getStrategy: (params) => new (require('../src/strategies/strat_iter56_b').StratIter56BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter56_b.params.json',
  },
  'strat_iter56_c': {
    name: 'Iter56 C - Wavelet Energy Regime Switching',
    getStrategy: (params) => new (require('../src/strategies/strat_iter56_c').StratIter56CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter56_c.params.json',
  },
  'strat_iter57_c': {
    name: 'Iter57 C - Dynamic Risk Parity State Control',
    getStrategy: (params) => new (require('../src/strategies/strat_iter57_c').StratIter57CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter57_c.params.json',
  },
  'strat_iter57_b': {
    name: 'Iter57 B - Behavioral Capitulation Detector',
    getStrategy: (params) => new (require('../src/strategies/strat_iter57_b').StratIter57BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter57_b.params.json',
  },
  'strat_iter57_a': {
    name: 'Iter57 A - Mutual Information Predictability Spike',
    getStrategy: (params) => new (require('../src/strategies/strat_iter57_a').StratIter57AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter57_a.params.json',
  },
  'strat_iter58_a': {
    name: 'Iter58 A - Recurrence Transition Support Rebound',
    getStrategy: (params) => new (require('../src/strategies/strat_iter58_a').StratIter58AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter58_a.params.json',
  },
  'strat_iter58_b': {
    name: 'Iter58 B - Adaptive Bayesian Mini-Model Ensemble',
    getStrategy: (params) => new (require('../src/strategies/strat_iter58_b').StratIter58BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter58_b.params.json',
  },
  'strat_iter58_c': {
    name: 'Iter58 C - Multi-Horizon Hurst Dispersion Persistence',
    getStrategy: (params) => new (require('../src/strategies/strat_iter58_c').StratIter58CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter58_c.params.json',
  },
  'strat_iter59_a': {
    name: 'Iter59 A - Phase-Space Curvature Cusp Reversal',
    getStrategy: (params) => new (require('../src/strategies/strat_iter59_a').StratIter59AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter59_a.params.json',
  },
  'strat_iter59_b': {
    name: 'Iter59 B - Predictive Residual Surprise Mean-Revert',
    getStrategy: (params) => new (require('../src/strategies/strat_iter59_b').StratIter59BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter59_b.params.json',
  },
  'strat_iter60_a': {
    name: 'Iter60 A - SAX Motif Dictionary Reversal',
    getStrategy: (params) => new (require('../src/strategies/strat_iter60_a').StratIter60AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter60_a.params.json',
  },
  'strat_iter60_b': {
    name: 'Iter60 B - Adaptive Kalman Residual Rebound Gate',
    getStrategy: (params) => new (require('../src/strategies/strat_iter60_b').StratIter60BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter60_b.params.json',
  },
  'strat_iter60_c': {
    name: 'Iter60 C - Counterfactual Transition Utility Ensemble',
    getStrategy: (params) => new (require('../src/strategies/strat_iter60_c').StratIter60CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter60_c.params.json',
  },
  'strat_iter61_a': {
    name: 'Iter61 A - Reservoir Readout Support Reclaim',
    getStrategy: (params) => new (require('../src/strategies/strat_iter61_a').StratIter61AStrategy)(params),
    paramsFile: 'src/strategies/strat_iter61_a.params.json',
  },
  'strat_iter61_b': {
    name: 'Iter61 B - Bifurcation Flip Reversion',
    getStrategy: (params) => new (require('../src/strategies/strat_iter61_b').StratIter61BStrategy)(params),
    paramsFile: 'src/strategies/strat_iter61_b.params.json',
  },
  'strat_iter61_c': {
    name: 'Iter61 C - Meta-Label Confidence Stack',
    getStrategy: (params) => new (require('../src/strategies/strat_iter61_c').StratIter61CStrategy)(params),
    paramsFile: 'src/strategies/strat_iter61_c.params.json',
  },
};

async function runBacktest(
  strategyInfo: typeof strategies['simple_ma'],
  data: any,
  options: any,
  savedParams: Record<string, number> | null
): Promise<{ result: BacktestResult; params: any }> {
  // Pass saved params directly to the strategy constructor - each strategy handles its own merging
  const strategy = strategyInfo.getStrategy(savedParams || {});

  const config: Partial<BacktestConfig> = {
    initialCapital: parseFloat(options.capital),
    feeRate: parseFloat(options.fee) / 100,
    slippage: 0,
  };

  const engine = new BacktestEngine(data, strategy, config);
  const result = engine.run();

  return { result, params: savedParams };
}

function buildParams(strategyInfo: any, options: any, savedParams: Record<string, number> | null): any {
  // Kept for backward compatibility but strategies now handle their own param merging
  return savedParams || {};
}

function printComparison(results: Array<{ strategy: string; result: BacktestResult }>) {
  const col = (s: string, w: number) => s.toString().padEnd(w).slice(0, w);
  
  console.log('\n' + kleur.bold(kleur.cyan('='.repeat(100))));
  console.log(kleur.bold(kleur.cyan('STRATEGY COMPARISON')));
  console.log(kleur.bold(kleur.cyan('='.repeat(100))));
  
  const header = col('Strategy', 20) + col('Final Capital', 14) + col('Return', 12) + col('Drawdown', 12) + col('Sharpe', 10) + col('Trades', 8) + col('Win Rate', 10);
  console.log(kleur.bold(header));
  console.log('-'.repeat(100));

  for (const { strategy, result } of results) {
    const winRate = result.totalTrades > 0 
      ? ((result.winningTrades / (result.winningTrades + result.losingTrades)) * 100).toFixed(1) + '%'
      : '-';
    
    const row = col(strategy, 20) +
      col('$' + result.finalCapital.toFixed(2), 14) +
      col('$' + result.totalReturn.toFixed(2) + ' (' + result.totalReturnPercent.toFixed(2) + '%)', 12) +
      col('-' + result.maxDrawdown.toFixed(2) + '%', 12) +
      col(result.sharpeRatio.toFixed(3), 10) +
      col(result.totalTrades.toString(), 8) +
      col(winRate, 10);
    
    const isBest = result.totalReturn === Math.max(...results.map(r => r.result.totalReturn));
    console.log(isBest ? kleur.green(row) : row);
  }

  console.log('-'.repeat(100));
  
  const best = results.reduce((a, b) => a.result.totalReturn > b.result.totalReturn ? a : b);
  console.log(kleur.green(`\n★ Best: ${best.strategy} with $${best.result.totalReturn.toFixed(2)} return`));
}

const program = new Command();

program
  .name('backtest')
  .description('Polymarket Backtest Runner')
  .option('-s, --strategy <name>', 'Strategy to use (all, simple_ma, bollinger, rsi, breakout, ma_vol, support, momentum, range, mean_revert, dual_ma, strat_sr_no_trend_filter_302, strat_sr_no_trend_lookup_55_378, strat_sr_no_trend_combo_366, strat_sr_no_trend_combo_wide_380, strat_sr_no_trend_base_30_365, strat_sr_no_trend_late_exit_355, strat_sr_no_trend_slow_stoch_360, strat_sr_no_trend_tight_bounce_354, strat_sr_no_trend_adx_341, strat_sr_no_trend_vwap_338, strat_sr_no_trend_wider_bounce_327, strat_sr_no_trend_tight_stop_328, strat_sr_no_trend_volatility_316, strat_sr_no_trend_dynamic_trail_317, strat_sr_no_trend_no_momentum_315, strat_sr_no_trend_volume_313, strat_sr_no_trend_tight_stoch_324, strat_sr_no_trend_wide_res_370, strat_sr_no_trend_vol_6_374, strat_iter34_a, strat_iter34_c, strat_iter34_b, strat_iter35_a, strat_iter35_b, strat_iter35_c)', 'all')
  .option('-d, --data <file>', 'Data file path', DEFAULT_DATA_FILE)
  .option('-c, --capital <number>', 'Initial capital in USD', '1000')
  .option('-f, --fee <percent>', 'Fee rate as percentage', '0')
  .option('--fast <number>', 'Fast MA period', '50')
  .option('--slow <number>', 'Slow MA period', '200')
  .option('--stop-loss <percent>', 'Stop loss as percentage', '2')
  .option('--risk-percent <percent>', 'Risk percent', '95')
  .option('-t, --trailing-stop', 'Enable trailing stop')
  .option('-v, --verbose', 'Show detailed trade history for each strategy')
  .action(async (options) => {
    console.log(kleur.cyan('Polymarket Backtest Runner'));
    console.log(kleur.cyan('=========================='));
    console.log(`Data file:       ${options.data}`);
    console.log(`Initial capital: $${options.capital}`);
    console.log(`Fee rate:        ${options.fee}%`);
    console.log('');

    try {
      console.log(kleur.yellow('Loading data...'));
      const data = loadStoredData(options.data);
      console.log(`Loaded ${data.markets.length} markets`);
      console.log(`Price history for ${data.priceHistory.size} tokens`);
      console.log('');

      const strategiesToRun = options.strategy === 'all' 
        ? Object.entries(strategies) 
        : [[options.strategy, strategies[options.strategy as keyof typeof strategies]]] as Array<[string, typeof strategies['ma']]>;

      if (options.strategy !== 'all' && !strategies[options.strategy as keyof typeof strategies]) {
        console.error(kleur.red(`Unknown strategy: ${options.strategy}`));
        console.log(`Available strategies: all, ${Object.keys(strategies).join(', ')}`);
        process.exit(1);
      }

      const results: Array<{ strategy: string; result: BacktestResult }> = [];

      for (const [key, strategyInfo] of strategiesToRun) {
        console.log(kleur.yellow(`Running ${strategyInfo.name}...`));
        const savedParams = loadSavedParams(strategyInfo.paramsFile);
        const { result } = await runBacktest(strategyInfo, data, options, savedParams);
        results.push({ strategy: strategyInfo.name, result });

        if (options.strategy !== 'all') {
          printComparison(results);
        }
      }

      if (options.strategy === 'all') {
        printComparison(results);
      }

    } catch (error) {
      console.error(kleur.red('Error running backtest:'), error);
      process.exit(1);
    }
  });

program.parse();

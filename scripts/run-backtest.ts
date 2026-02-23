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
  .option('-s, --strategy <name>', 'Strategy to use (all, simple_ma, bollinger, rsi, breakout, ma_vol, support, momentum, range, mean_revert, dual_ma, strat_sr_no_trend_filter_302, strat_sr_no_trend_lookup_55_378, strat_sr_no_trend_combo_366, strat_sr_no_trend_combo_wide_380, strat_sr_no_trend_base_30_365, strat_sr_no_trend_late_exit_355, strat_sr_no_trend_slow_stoch_360, strat_sr_no_trend_tight_bounce_354, strat_sr_no_trend_adx_341, strat_sr_no_trend_vwap_338, strat_sr_no_trend_wider_bounce_327, strat_sr_no_trend_tight_stop_328, strat_sr_no_trend_volatility_316, strat_sr_no_trend_dynamic_trail_317, strat_sr_no_trend_no_momentum_315, strat_sr_no_trend_volume_313, strat_sr_no_trend_tight_stoch_324, strat_sr_no_trend_wide_res_370, strat_sr_no_trend_vol_6_374)', 'all')
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

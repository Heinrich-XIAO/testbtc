import { Command } from 'commander';
import kleur from 'kleur';
import { loadStoredData } from '../src/backtest/engine';
import { SimpleMAStrategy } from '../src/strategies/strat_simple_ma_01';
import { BollingerBandsStrategy } from '../src/strategies/strat_bollinger_02';
import { RSIMeanReversionStrategy } from '../src/strategies/strat_rsi_03';
import { ATRBreakoutStrategy } from '../src/strategies/strat_atr_breakout_04';
import { MAStrategyWithATRStop } from '../src/strategies/strat_ma_atr_05';
import { SupportResistanceStrategy } from '../src/strategies/strat_support_06';
import { ShortTermStrategy } from '../src/strategies/strat_momentum_07';
import { RangeTradingStrategy } from '../src/strategies/strat_range_08';
import { MeanReversionStrategy } from '../src/strategies/strat_mean_revert_09';
import { DualMAStrategy } from '../src/strategies/strat_dual_ma_10';
import { EMAFastCrossStrategy } from '../src/strategies/strat_ema_fast_11';
import { EMAMedCrossStrategy } from '../src/strategies/strat_ema_med_12';
import { EMASlowCrossStrategy } from '../src/strategies/strat_ema_slow_13';
import { EMATightStopStrategy } from '../src/strategies/strat_ema_tight_14';
import { EMAWideStopStrategy } from '../src/strategies/strat_ema_wide_15';
import { ROCFastStrategy } from '../src/strategies/strat_roc_fast_16';
import { ROCSlowStrategy } from '../src/strategies/strat_roc_slow_17';
import { DonchianShortStrategy } from '../src/strategies/strat_donchian_short_18';
import { DonchianLongStrategy } from '../src/strategies/strat_donchian_long_19';
import { StochFastStrategy } from '../src/strategies/strat_stoch_fast_20';
import { StochSlowStrategy } from '../src/strategies/strat_stoch_slow_21';
import { WillRShortStrategy } from '../src/strategies/strat_willr_short_22';
import { WillRLongStrategy } from '../src/strategies/strat_willr_long_23';
import { AccelFastStrategy } from '../src/strategies/strat_accel_fast_24';
import { AccelSlowStrategy } from '../src/strategies/strat_accel_slow_25';
import { VolBreakTightStrategy } from '../src/strategies/strat_vbreak_tight_26';
import { VolBreakWideStrategy } from '../src/strategies/strat_vbreak_wide_27';
import { RibbonTightStrategy } from '../src/strategies/strat_ribbon_tight_28';
import { RibbonWideStrategy } from '../src/strategies/strat_ribbon_wide_29';
import { RSIDivFastStrategy } from '../src/strategies/strat_rsi_div_fast_30';
import { RSIDivSlowStrategy } from '../src/strategies/strat_rsi_div_slow_31';
import { MRRSITightStrategy } from '../src/strategies/strat_mr_rsi_tight_32';
import { MRRSIWideStrategy } from '../src/strategies/strat_mr_rsi_wide_33';
import { AdaptFastStrategy } from '../src/strategies/strat_adapt_fast_34';
import { AdaptSlowStrategy } from '../src/strategies/strat_adapt_slow_35';
import { TriMAFastStrategy } from '../src/strategies/strat_tri_ma_fast_36';
import { TriMASlowStrategy } from '../src/strategies/strat_tri_ma_slow_37';
import { EnvTightStrategy } from '../src/strategies/strat_env_tight_38';
import { EnvWideStrategy } from '../src/strategies/strat_env_wide_39';
import { PatDipStrategy } from '../src/strategies/strat_pat_dip_40';
import { PatMomStrategy } from '../src/strategies/strat_pat_mom_41';
import { ComboTightStrategy } from '../src/strategies/strat_combo_tight_42';
import { ComboWideStrategy } from '../src/strategies/strat_combo_wide_43';
import { TStrFastStrategy } from '../src/strategies/strat_tstr_fast_44';
import { TStrSlowStrategy } from '../src/strategies/strat_tstr_slow_45';
import { SwingShortStrategy } from '../src/strategies/strat_swing_short_46';
import { SwingLongStrategy } from '../src/strategies/strat_swing_long_47';
import { RevFastStrategy } from '../src/strategies/strat_rev_fast_48';
import { RevSlowStrategy } from '../src/strategies/strat_rev_slow_49';
import { ChanTightStrategy } from '../src/strategies/strat_chan_tight_50';
import { ChanWideStrategy } from '../src/strategies/strat_chan_wide_51';
import { MCrossFastStrategy } from '../src/strategies/strat_mcross_fast_52';
import { MCrossSlowStrategy } from '../src/strategies/strat_mcross_slow_53';
import { MRRsiV01Strategy } from '../src/strategies/strat_mr_rsi_v01_54';
import { MRRsiV02Strategy } from '../src/strategies/strat_mr_rsi_v02_55';
import { MRRsiV03Strategy } from '../src/strategies/strat_mr_rsi_v03_56';
import { MRRsiV04Strategy } from '../src/strategies/strat_mr_rsi_v04_57';
import { MRRsiV05Strategy } from '../src/strategies/strat_mr_rsi_v05_58';
import { MRRsiV06Strategy } from '../src/strategies/strat_mr_rsi_v06_59';
import { MRRsiV07Strategy } from '../src/strategies/strat_mr_rsi_v07_60';
import { MRRsiV08Strategy } from '../src/strategies/strat_mr_rsi_v08_61';
import { MRRsiV09Strategy } from '../src/strategies/strat_mr_rsi_v09_62';
import { MRRsiV10Strategy } from '../src/strategies/strat_mr_rsi_v10_63';
import { MRRsiV11Strategy } from '../src/strategies/strat_mr_rsi_v11_64';
import { MRRsiV12Strategy } from '../src/strategies/strat_mr_rsi_v12_65';
import { MRRsiV13Strategy } from '../src/strategies/strat_mr_rsi_v13_66';
import { MRRsiV14Strategy } from '../src/strategies/strat_mr_rsi_v14_67';
import { MRRsiV15Strategy } from '../src/strategies/strat_mr_rsi_v15_68';
import { MRRsiV16Strategy } from '../src/strategies/strat_mr_rsi_v16_69';
import { MRRsiV17Strategy } from '../src/strategies/strat_mr_rsi_v17_70';
import { MRRsiV18Strategy } from '../src/strategies/strat_mr_rsi_v18_71';
import { MRRsiV19Strategy } from '../src/strategies/strat_mr_rsi_v19_72';
import { MRRsiV20Strategy } from '../src/strategies/strat_mr_rsi_v20_73';
import { WillRV01Strategy } from '../src/strategies/strat_willr_v01_74';
import { WillRV02Strategy } from '../src/strategies/strat_willr_v02_75';
import { WillRV03Strategy } from '../src/strategies/strat_willr_v03_76';
import { WillRV04Strategy } from '../src/strategies/strat_willr_v04_77';
import { WillRV05Strategy } from '../src/strategies/strat_willr_v05_78';
import { WillRV06Strategy } from '../src/strategies/strat_willr_v06_79';
import { WillRV07Strategy } from '../src/strategies/strat_willr_v07_80';
import { WillRV08Strategy } from '../src/strategies/strat_willr_v08_81';
import { WillRV09Strategy } from '../src/strategies/strat_willr_v09_82';
import { WillRV10Strategy } from '../src/strategies/strat_willr_v10_83';
import { WillRV11Strategy } from '../src/strategies/strat_willr_v11_84';
import { WillRV12Strategy } from '../src/strategies/strat_willr_v12_85';
import { WillRV13Strategy } from '../src/strategies/strat_willr_v13_86';
import { WillRV14Strategy } from '../src/strategies/strat_willr_v14_87';
import { WillRV15Strategy } from '../src/strategies/strat_willr_v15_88';
import { WillRV16Strategy } from '../src/strategies/strat_willr_v16_89';
import { WillRV17Strategy } from '../src/strategies/strat_willr_v17_90';
import { WillRV18Strategy } from '../src/strategies/strat_willr_v18_91';
import { WillRV19Strategy } from '../src/strategies/strat_willr_v19_92';
import { WillRV20Strategy } from '../src/strategies/strat_willr_v20_93';
import { EnvV01Strategy } from '../src/strategies/strat_env_v01_94';
import { EnvV02Strategy } from '../src/strategies/strat_env_v02_95';
import { EnvV03Strategy } from '../src/strategies/strat_env_v03_96';
import { EnvV04Strategy } from '../src/strategies/strat_env_v04_97';
import { EnvV05Strategy } from '../src/strategies/strat_env_v05_98';
import { EnvV06Strategy } from '../src/strategies/strat_env_v06_99';
import { EnvV07Strategy } from '../src/strategies/strat_env_v07_100';
import { EnvV08Strategy } from '../src/strategies/strat_env_v08_101';
import { EnvV09Strategy } from '../src/strategies/strat_env_v09_102';
import { EnvV10Strategy } from '../src/strategies/strat_env_v10_103';
import { EnvV11Strategy } from '../src/strategies/strat_env_v11_104';
import { EnvV12Strategy } from '../src/strategies/strat_env_v12_105';
import { EnvV13Strategy } from '../src/strategies/strat_env_v13_106';
import { EnvV14Strategy } from '../src/strategies/strat_env_v14_107';
import { EnvV15Strategy } from '../src/strategies/strat_env_v15_108';
import { EnvV16Strategy } from '../src/strategies/strat_env_v16_109';
import { EnvV17Strategy } from '../src/strategies/strat_env_v17_110';
import { EnvV18Strategy } from '../src/strategies/strat_env_v18_111';
import { EnvV19Strategy } from '../src/strategies/strat_env_v19_112';
import { EnvV20Strategy } from '../src/strategies/strat_env_v20_113';
import { ChanV01Strategy } from '../src/strategies/strat_chan_v01_114';
import { ChanV02Strategy } from '../src/strategies/strat_chan_v02_115';
import { ChanV03Strategy } from '../src/strategies/strat_chan_v03_116';
import { ChanV04Strategy } from '../src/strategies/strat_chan_v04_117';
import { ChanV05Strategy } from '../src/strategies/strat_chan_v05_118';
import { ChanV06Strategy } from '../src/strategies/strat_chan_v06_119';
import { ChanV07Strategy } from '../src/strategies/strat_chan_v07_120';
import { ChanV08Strategy } from '../src/strategies/strat_chan_v08_121';
import { ChanV09Strategy } from '../src/strategies/strat_chan_v09_122';
import { ChanV10Strategy } from '../src/strategies/strat_chan_v10_123';
import { ChanV11Strategy } from '../src/strategies/strat_chan_v11_124';
import { ChanV12Strategy } from '../src/strategies/strat_chan_v12_125';
import { ChanV13Strategy } from '../src/strategies/strat_chan_v13_126';
import { ChanV14Strategy } from '../src/strategies/strat_chan_v14_127';
import { ChanV15Strategy } from '../src/strategies/strat_chan_v15_128';
import { ChanV16Strategy } from '../src/strategies/strat_chan_v16_129';
import { ChanV17Strategy } from '../src/strategies/strat_chan_v17_130';
import { ChanV18Strategy } from '../src/strategies/strat_chan_v18_131';
import { ChanV19Strategy } from '../src/strategies/strat_chan_v19_132';
import { ChanV20Strategy } from '../src/strategies/strat_chan_v20_133';
import { ComboV01Strategy } from '../src/strategies/strat_combo_v01_134';
import { ComboV02Strategy } from '../src/strategies/strat_combo_v02_135';
import { ComboV03Strategy } from '../src/strategies/strat_combo_v03_136';
import { ComboV04Strategy } from '../src/strategies/strat_combo_v04_137';
import { ComboV05Strategy } from '../src/strategies/strat_combo_v05_138';
import { ComboV06Strategy } from '../src/strategies/strat_combo_v06_139';
import { ComboV07Strategy } from '../src/strategies/strat_combo_v07_140';
import { ComboV08Strategy } from '../src/strategies/strat_combo_v08_141';
import { ComboV09Strategy } from '../src/strategies/strat_combo_v09_142';
import { ComboV10Strategy } from '../src/strategies/strat_combo_v10_143';
import { ComboV11Strategy } from '../src/strategies/strat_combo_v11_144';
import { ComboV12Strategy } from '../src/strategies/strat_combo_v12_145';
import { ComboV13Strategy } from '../src/strategies/strat_combo_v13_146';
import { ComboV14Strategy } from '../src/strategies/strat_combo_v14_147';
import { ComboV15Strategy } from '../src/strategies/strat_combo_v15_148';
import { ComboV16Strategy } from '../src/strategies/strat_combo_v16_149';
import { ComboV17Strategy } from '../src/strategies/strat_combo_v17_150';
import { ComboV18Strategy } from '../src/strategies/strat_combo_v18_151';
import { ComboV19Strategy } from '../src/strategies/strat_combo_v19_152';
import { ComboV20Strategy } from '../src/strategies/strat_combo_v20_153';
import { StochV01Strategy } from '../src/strategies/strat_stoch_v01_154';
import { StochV02Strategy } from '../src/strategies/strat_stoch_v02_155';
import { StochV03Strategy } from '../src/strategies/strat_stoch_v03_156';
import { StochV04Strategy } from '../src/strategies/strat_stoch_v04_157';
import { StochV05Strategy } from '../src/strategies/strat_stoch_v05_158';
import { StochV06Strategy } from '../src/strategies/strat_stoch_v06_159';
import { StochV07Strategy } from '../src/strategies/strat_stoch_v07_160';
import { StochV08Strategy } from '../src/strategies/strat_stoch_v08_161';
import { StochV09Strategy } from '../src/strategies/strat_stoch_v09_162';
import { StochV10Strategy } from '../src/strategies/strat_stoch_v10_163';
import { StochV11Strategy } from '../src/strategies/strat_stoch_v11_164';
import { StochV12Strategy } from '../src/strategies/strat_stoch_v12_165';
import { StochV13Strategy } from '../src/strategies/strat_stoch_v13_166';
import { StochV14Strategy } from '../src/strategies/strat_stoch_v14_167';
import { StochV15Strategy } from '../src/strategies/strat_stoch_v15_168';
import { StochV16Strategy } from '../src/strategies/strat_stoch_v16_169';
import { StochV17Strategy } from '../src/strategies/strat_stoch_v17_170';
import { StochV18Strategy } from '../src/strategies/strat_stoch_v18_171';
import { StochV19Strategy } from '../src/strategies/strat_stoch_v19_172';
import { StochV20Strategy } from '../src/strategies/strat_stoch_v20_173';
import { PatV01Strategy } from '../src/strategies/strat_pat_v01_174';
import { PatV02Strategy } from '../src/strategies/strat_pat_v02_175';
import { PatV03Strategy } from '../src/strategies/strat_pat_v03_176';
import { PatV04Strategy } from '../src/strategies/strat_pat_v04_177';
import { PatV05Strategy } from '../src/strategies/strat_pat_v05_178';
import { PatV06Strategy } from '../src/strategies/strat_pat_v06_179';
import { PatV07Strategy } from '../src/strategies/strat_pat_v07_180';
import { PatV08Strategy } from '../src/strategies/strat_pat_v08_181';
import { PatV09Strategy } from '../src/strategies/strat_pat_v09_182';
import { PatV10Strategy } from '../src/strategies/strat_pat_v10_183';
import { PatV11Strategy } from '../src/strategies/strat_pat_v11_184';
import { PatV12Strategy } from '../src/strategies/strat_pat_v12_185';
import { PatV13Strategy } from '../src/strategies/strat_pat_v13_186';
import { PatV14Strategy } from '../src/strategies/strat_pat_v14_187';
import { PatV15Strategy } from '../src/strategies/strat_pat_v15_188';
import { PatV16Strategy } from '../src/strategies/strat_pat_v16_189';
import { PatV17Strategy } from '../src/strategies/strat_pat_v17_190';
import { PatV18Strategy } from '../src/strategies/strat_pat_v18_191';
import { PatV19Strategy } from '../src/strategies/strat_pat_v19_192';
import { PatV20Strategy } from '../src/strategies/strat_pat_v20_193';
import { RsiDV01Strategy } from '../src/strategies/strat_rsi_d_v01_194';
import { RsiDV02Strategy } from '../src/strategies/strat_rsi_d_v02_195';
import { RsiDV03Strategy } from '../src/strategies/strat_rsi_d_v03_196';
import { RsiDV04Strategy } from '../src/strategies/strat_rsi_d_v04_197';
import { RsiDV05Strategy } from '../src/strategies/strat_rsi_d_v05_198';
import { RsiDV06Strategy } from '../src/strategies/strat_rsi_d_v06_199';
import { RsiDV07Strategy } from '../src/strategies/strat_rsi_d_v07_200';
import { StochV20Tweak201Strategy } from '../src/strategies/strat_stoch_v20_tweak_201';
import { StochV06Tweak202Strategy } from '../src/strategies/strat_stoch_v06_tweak_202';
import { StochV09Tweak203Strategy } from '../src/strategies/strat_stoch_v09_tweak_203';
import { StochAdaptiveStrategy } from '../src/strategies/strat_stoch_adaptive_204';
import { RsiStochCombo205Strategy } from '../src/strategies/strat_rsi_stoch_combo_205';
import { VolatilityBreakoutStrategy } from '../src/strategies/strat_volatility_breakout_206';
import { TrendFollowingMAStrategy } from '../src/strategies/strat_trend_following_ma_207';
import { MeanReversionBandV208Strategy } from '../src/strategies/strat_mean_reversion_band_208';
import { StochV20Tweak2_209Strategy } from '../src/strategies/strat_stoch_v20_tweak2_209';
import { MeanReversionBand2_210Strategy } from '../src/strategies/strat_mean_reversion_band2_210';
import { StochV06Tweak2_211Strategy } from '../src/strategies/strat_stoch_v06_tweak2_211';
import { MomentumVol212Strategy } from '../src/strategies/strat_momentum_vol_212';
import { RocAdaptive213Strategy } from '../src/strategies/strat_roc_adaptive_213';
import { KeltnerBreakout214Strategy } from '../src/strategies/strat_keltner_breakout_214';
import { MacdStochCombo215Strategy } from '../src/strategies/strat_macd_stoch_combo_215';
import { SupportResistanceStoch216Strategy } from '../src/strategies/strat_support_resistance_stoch_216';
import { MomentumVolTweak217Strategy } from '../src/strategies/strat_momentum_vol_tweak_217';
import { SupportResistanceTweak218Strategy } from '../src/strategies/strat_support_resistance_tweak_218';
import { KeltnerTweak219Strategy } from '../src/strategies/strat_keltner_tweak_219';
import { DualMomentum220Strategy } from '../src/strategies/strat_dual_momentum_220';
import { PriceRangeBreakout221Strategy } from '../src/strategies/strat_price_range_breakout_221';
import { Velocity222Strategy } from '../src/strategies/strat_velocity_222';
import { TripleEMA223Strategy } from '../src/strategies/strat_triple_ema_223';
import { MeanRevMomentum224Strategy } from '../src/strategies/strat_mean_rev_momentum_224';
import { SRAdaptive225Strategy } from '../src/strategies/strat_sr_adaptive_225';
import { SRMultiExit226Strategy } from '../src/strategies/strat_sr_multi_exit_226';
import { SRMomentumFilter227Strategy } from '../src/strategies/strat_sr_momentum_filter_227';
import { PivotPoint228Strategy } from '../src/strategies/strat_pivot_point_228';
import { RangeMeanRevert229Strategy } from '../src/strategies/strat_range_mean_revert_229';
import { BreakoutConfirmation230Strategy } from '../src/strategies/strat_breakout_confirmation_230';
import { StochRSI231Strategy } from '../src/strategies/strat_stoch_rsi_231';
import { ChannelBreakout232Strategy } from '../src/strategies/strat_channel_breakout_232';
import { SRAdaptiveTweak233Strategy } from '../src/strategies/strat_sr_adaptive_tweak_233';
import { SRAdaptiveMultiExit234Strategy } from '../src/strategies/strat_sr_adaptive_multi_exit_234';
import { SRAdaptiveMomentum235Strategy } from '../src/strategies/strat_sr_adaptive_momentum_235';
import { RSIAdaptiveSupport236Strategy } from '../src/strategies/strat_rsi_adaptive_support_236';
import { DynamicStoch237Strategy } from '../src/strategies/strat_dynamic_stoch_237';
import { VolatilitySizing238Strategy } from '../src/strategies/strat_volatility_sizing_238';
import { ATRTrailing239Strategy } from '../src/strategies/strat_atr_trailing_239';
import { MultiTimeframeSR240Strategy } from '../src/strategies/strat_multi_timeframe_sr_240';
import { SRMultiExitTweak241Strategy } from '../src/strategies/strat_sr_multi_exit_tweak_241';
import { SRAdaptiveTweak2_242Strategy } from '../src/strategies/strat_sr_adaptive_tweak2_242';
import { SRMomentumTweak243Strategy } from '../src/strategies/strat_sr_momentum_tweak_243';
import { SRMultiMomentum244Strategy } from '../src/strategies/strat_sr_multi_momentum_244';
import { SRRSIConfirm245Strategy } from '../src/strategies/strat_sr_rsi_confirm_245';
import { SRAsymmetric246Strategy } from '../src/strategies/strat_sr_asymmetric_246';
import { SRTrendStrength247Strategy } from '../src/strategies/strat_sr_trend_strength_247';
import { SRDoubleConfirm248Strategy } from '../src/strategies/strat_sr_double_confirm_248';
import { SRTrendStrict249Strategy } from '../src/strategies/strat_sr_trend_strict_249';
import { SRMultiTrend250Strategy } from '../src/strategies/strat_sr_multi_trend_250';
import { SRAdaptiveTarget251Strategy } from '../src/strategies/strat_sr_adaptive_target_251';
import { SRMomentumTrend252Strategy } from '../src/strategies/strat_sr_momentum_trend_252';
import { SRTripleConfirm253Strategy } from '../src/strategies/strat_sr_triple_confirm_253';
import { SRRangeVol254Strategy } from '../src/strategies/strat_sr_range_vol_254';
import { SRLongTrend255Strategy } from '../src/strategies/strat_sr_long_trend_255';
import { SRStrictEntry256Strategy } from '../src/strategies/strat_sr_strict_entry_256';
import { SRStrictLoose257Strategy } from '../src/strategies/strat_sr_strict_loose_257';
import { SRStrictMomentum258Strategy } from '../src/strategies/strat_sr_strict_momentum_258';
import { SRTrendMultiExit259Strategy } from '../src/strategies/strat_sr_trend_multi_exit_259';
import { SRStrictMultiExit260Strategy } from '../src/strategies/strat_sr_strict_multi_exit_260';
import { SRVeryStrict261Strategy } from '../src/strategies/strat_sr_very_strict_261';
import { SRBounceQuality262Strategy } from '../src/strategies/strat_sr_bounce_quality_262';
import { SRWeightedTrend263Strategy } from '../src/strategies/strat_sr_weighted_trend_263';
import { SRAdaptiveStrict264Strategy } from '../src/strategies/strat_sr_adaptive_strict_264';
import { SRMultiExitHighPT265Strategy } from '../src/strategies/strat_sr_multi_exit_high_pt_265';
import { SRMultiExitShortHold266Strategy } from '../src/strategies/strat_sr_multi_exit_short_hold_266';
import { SRMultiExitTightTrail267Strategy } from '../src/strategies/strat_sr_multi_exit_tight_trail_267';
import { SRAdaptiveMultiExit268Strategy } from '../src/strategies/strat_sr_adaptive_multi_exit_268';
import { SRDynamicPT269Strategy } from '../src/strategies/strat_sr_dynamic_pt_269';
import { SRTieredExit270Strategy } from '../src/strategies/strat_sr_tiered_exit_270';
import { SRMomentumExit271Strategy } from '../src/strategies/strat_sr_momentum_exit_271';
import { SRRsiExit272Strategy } from '../src/strategies/strat_sr_rsi_exit_272';
import { SRTightStrictCombo273Strategy } from '../src/strategies/strat_sr_tight_strict_combo_273';
import { SRStochWide274Strategy } from '../src/strategies/strat_sr_stoch_wide_274';
import { SRStochNarrow275Strategy } from '../src/strategies/strat_sr_stoch_narrow_275';
import { SRLongTrend276Strategy } from '../src/strategies/strat_sr_long_trend_276';
import { SRDoubleConfirm277Strategy } from '../src/strategies/strat_sr_double_confirm_277';
import { SRTimeExit278Strategy } from '../src/strategies/strat_sr_time_exit_278';
import { SRVolFilter279Strategy } from '../src/strategies/strat_sr_vol_filter_279';
import { SRBreakoutEntry280Strategy } from '../src/strategies/strat_sr_breakout_entry_280';
import { SRWideMultiExit281Strategy } from '../src/strategies/strat_sr_wide_multi_exit_281';
import { SRVeryWideStoch282Strategy } from '../src/strategies/strat_sr_very_wide_stoch_282';
import { SRWideTightTrail283Strategy } from '../src/strategies/strat_sr_wide_tight_trail_283';
import { SRWideShortK284Strategy } from '../src/strategies/strat_sr_wide_short_k_284';
import { SRWideLongK285Strategy } from '../src/strategies/strat_sr_wide_long_k_285';
import { SRWideLongHold286Strategy } from '../src/strategies/strat_sr_wide_long_hold_286';
import { SRWideHigherPT287Strategy } from '../src/strategies/strat_sr_wide_higher_pt_287';
import { SRWideLowerStop288Strategy } from '../src/strategies/strat_sr_wide_lower_stop_288';
import { SRModerateMultiExit289Strategy } from '../src/strategies/strat_sr_moderate_multi_exit_289';
import { SRModerateLooser290Strategy } from '../src/strategies/strat_sr_moderate_looser_290';
import { SRModerateTighter291Strategy } from '../src/strategies/strat_sr_moderate_tighter_291';
import { SRBalancedStoch292Strategy } from '../src/strategies/strat_sr_balanced_stoch_292';
import { SRNoMomentumFilter293Strategy } from '../src/strategies/strat_sr_no_momentum_filter_293';
import { SRSimpleStoch294Strategy } from '../src/strategies/strat_sr_simple_stoch_294';
import { SRRsiConfirm295Strategy } from '../src/strategies/strat_sr_rsi_confirm_295';
import { SRMixedSignals296Strategy } from '../src/strategies/strat_sr_mixed_signals_296';
import { DifferentialEvolutionOptimizer } from '../src/optimization';
import type { ParamConfig, OptimizationResult } from '../src/optimization/types';
import type { StoredData, PricePoint } from '../src/types';
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
      trailing_stop: { min: 0, max: 0, stepSize: 1 },
      risk_percent: { min: 0.1, max: 0.5, stepSize: 0.1 },
    },
    outputFile: 'strat_simple_ma_01.params.json',
  },
  bollinger: {
    class: BollingerBandsStrategy,
    params: {
      period: { min: 10, max: 50, stepSize: 5 },
      std_dev_multiplier: { min: 1.5, max: 3.0, stepSize: 0.5 },
      stop_loss: { min: 0.01, max: 0.1, stepSize: 0.02 },
      trailing_stop: { min: 0, max: 1, stepSize: 1 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
      mean_reversion: { min: 0, max: 1, stepSize: 1 },
    },
    outputFile: 'strat_bollinger_02.params.json',
  },
  rsi: {
    class: RSIMeanReversionStrategy,
    params: {
      rsi_period: { min: 3, max: 10, stepSize: 1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.10, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_03.params.json',
  },
  breakout: {
    class: ATRBreakoutStrategy,
    params: {
      breakout_multiplier: { min: 0.1, max: 1.0, stepSize: 0.1 },
      lookback: { min: 5, max: 20, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.10, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_atr_breakout_04.params.json',
  },
  ma_vol: {
    class: MAStrategyWithATRStop,
    params: {
      fast_period: { min: 3, max: 10, stepSize: 1 },
      slow_period: { min: 10, max: 30, stepSize: 5 },
      volatility_period: { min: 10, max: 30, stepSize: 5 },
      vol_multiplier: { min: 1.0, max: 4.0, stepSize: 0.5 },
      risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_ma_atr_05.params.json',
  },
  support: {
    class: SupportResistanceStrategy,
    params: {
      lookback: { min: 5, max: 20, stepSize: 5 },
      bounce_threshold: { min: 0.02, max: 0.10, stepSize: 0.02 },
      stop_loss: { min: 0.02, max: 0.10, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.20, stepSize: 0.05 },
      take_profit: { min: 0.05, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_support_06.params.json',
  },
  momentum: {
    class: ShortTermStrategy,
    params: {
      lookback: { min: 2, max: 6, stepSize: 1 },
      entry_threshold: { min: 0.02, max: 0.10, stepSize: 0.02 },
      trailing_stop_pct: { min: 0.02, max: 0.10, stepSize: 0.02 },
      minimum_hold: { min: 2, max: 6, stepSize: 1 },
      risk_percent: { min: 0.05, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_momentum_07.params.json',
  },
  range: {
    class: RangeTradingStrategy,
    params: {
      buy_below: { min: 0.15, max: 0.40, stepSize: 0.05 },
      sell_above: { min: 0.50, max: 0.80, stepSize: 0.05 },
      stop_loss: { min: 0.10, max: 0.30, stepSize: 0.05 },
      risk_percent: { min: 0.05, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_range_08.params.json',
  },
  mean_revert: {
    class: MeanReversionStrategy,
    params: {
      ma_period: { min: 5, max: 15, stepSize: 1 },
      deviation_threshold: { min: 0.01, max: 0.08, stepSize: 0.01 },
      stop_loss: { min: 0.03, max: 0.15, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_mean_revert_09.params.json',
  },
  dual_ma: {
    class: DualMAStrategy,
    params: {
      fast_period: { min: 3, max: 8, stepSize: 1 },
      slow_period: { min: 10, max: 20, stepSize: 2 },
      trend_period: { min: 20, max: 40, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.10, stepSize: 0.02 },
      trailing_stop_pct: { min: 0.02, max: 0.08, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 },
    },
    outputFile: 'strat_dual_ma_10.params.json',
  },
  ema_fast: {
    class: EMAFastCrossStrategy,
    params: {
      fast_period: { min: 2, max: 5, stepSize: 1 },
      slow_period: { min: 6, max: 15, stepSize: 1 },
      stop_loss: { min: 0.02, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_ema_fast_11.params.json',
  },
  ema_med: {
    class: EMAMedCrossStrategy,
    params: {
      fast_period: { min: 3, max: 8, stepSize: 1 },
      slow_period: { min: 10, max: 25, stepSize: 2 },
      stop_loss: { min: 0.03, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_ema_med_12.params.json',
  },
  ema_slow: {
    class: EMASlowCrossStrategy,
    params: {
      fast_period: { min: 5, max: 12, stepSize: 1 },
      slow_period: { min: 15, max: 35, stepSize: 2 },
      stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_ema_slow_13.params.json',
  },
  ema_tight: {
    class: EMATightStopStrategy,
    params: {
      fast_period: { min: 2, max: 6, stepSize: 1 },
      slow_period: { min: 8, max: 18, stepSize: 1 },
      stop_loss: { min: 0.01, max: 0.05, stepSize: 0.005 },
      trailing_stop: { min: 0.01, max: 0.04, stepSize: 0.005 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_ema_tight_14.params.json',
  },
  ema_wide: {
    class: EMAWideStopStrategy,
    params: {
      fast_period: { min: 3, max: 8, stepSize: 1 },
      slow_period: { min: 8, max: 20, stepSize: 2 },
      stop_loss: { min: 0.06, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.04, max: 0.12, stepSize: 0.01 },
      risk_percent: { min: 0.1, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_ema_wide_15.params.json',
  },
  roc_fast: {
    class: ROCFastStrategy,
    params: {
      lookback: { min: 2, max: 5, stepSize: 1 },
      entry_threshold: { min: 0.01, max: 0.08, stepSize: 0.01 },
      exit_threshold: { min: 0.01, max: 0.06, stepSize: 0.01 },
      min_hold: { min: 1, max: 5, stepSize: 1 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_roc_fast_16.params.json',
  },
  roc_slow: {
    class: ROCSlowStrategy,
    params: {
      lookback: { min: 5, max: 15, stepSize: 1 },
      entry_threshold: { min: 0.02, max: 0.1, stepSize: 0.01 },
      exit_threshold: { min: 0.01, max: 0.08, stepSize: 0.01 },
      min_hold: { min: 2, max: 8, stepSize: 1 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_roc_slow_17.params.json',
  },
  donchian_short: {
    class: DonchianShortStrategy,
    params: {
      channel_period: { min: 5, max: 15, stepSize: 1 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      exit_at_mid: { min: 0, max: 1, stepSize: 1 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_donchian_short_18.params.json',
  },
  donchian_long: {
    class: DonchianLongStrategy,
    params: {
      channel_period: { min: 10, max: 25, stepSize: 2 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      exit_at_mid: { min: 0, max: 1, stepSize: 1 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_donchian_long_19.params.json',
  },
  stoch_fast: {
    class: StochFastStrategy,
    params: {
      k_period: { min: 3, max: 8, stepSize: 1 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_fast_20.params.json',
  },
  stoch_slow: {
    class: StochSlowStrategy,
    params: {
      k_period: { min: 8, max: 15, stepSize: 1 },
      d_period: { min: 3, max: 8, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.04, max: 0.12, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_slow_21.params.json',
  },
  willr_short: {
    class: WillRShortStrategy,
    params: {
      period: { min: 5, max: 12, stepSize: 1 },
      oversold_level: { min: -95, max: -70, stepSize: 5 },
      overbought_level: { min: -30, max: -5, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_short_22.params.json',
  },
  willr_long: {
    class: WillRLongStrategy,
    params: {
      period: { min: 10, max: 20, stepSize: 1 },
      oversold_level: { min: -95, max: -75, stepSize: 5 },
      overbought_level: { min: -25, max: -5, stepSize: 5 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_long_23.params.json',
  },
  accel_fast: {
    class: AccelFastStrategy,
    params: {
      lookback: { min: 3, max: 6, stepSize: 1 },
      entry_threshold: { min: 0.001, max: 0.015, stepSize: 0.002 },
      exit_threshold: { min: 0.001, max: 0.01, stepSize: 0.001 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_accel_fast_24.params.json',
  },
  accel_slow: {
    class: AccelSlowStrategy,
    params: {
      lookback: { min: 5, max: 12, stepSize: 1 },
      entry_threshold: { min: 0.001, max: 0.01, stepSize: 0.001 },
      exit_threshold: { min: 0.001, max: 0.008, stepSize: 0.001 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_accel_slow_25.params.json',
  },
  vbreak_tight: {
    class: VolBreakTightStrategy,
    params: {
      vol_period: { min: 5, max: 12, stepSize: 1 },
      lookback: { min: 8, max: 20, stepSize: 2 },
      contraction_ratio: { min: 0.3, max: 0.7, stepSize: 0.1 },
      breakout_threshold: { min: 0.01, max: 0.05, stepSize: 0.005 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_vbreak_tight_26.params.json',
  },
  vbreak_wide: {
    class: VolBreakWideStrategy,
    params: {
      vol_period: { min: 8, max: 18, stepSize: 2 },
      lookback: { min: 12, max: 25, stepSize: 2 },
      contraction_ratio: { min: 0.4, max: 0.8, stepSize: 0.1 },
      breakout_threshold: { min: 0.015, max: 0.06, stepSize: 0.005 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_vbreak_wide_27.params.json',
  },
  ribbon_tight: {
    class: RibbonTightStrategy,
    params: {
      shortest_period: { min: 2, max: 5, stepSize: 1 },
      period_step: { min: 1, max: 4, stepSize: 1 },
      num_mas: { min: 3, max: 6, stepSize: 1 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_ribbon_tight_28.params.json',
  },
  ribbon_wide: {
    class: RibbonWideStrategy,
    params: {
      shortest_period: { min: 3, max: 8, stepSize: 1 },
      period_step: { min: 2, max: 6, stepSize: 1 },
      num_mas: { min: 3, max: 7, stepSize: 1 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_ribbon_wide_29.params.json',
  },
  rsi_div_fast: {
    class: RSIDivFastStrategy,
    params: {
      rsi_period: { min: 3, max: 8, stepSize: 1 },
      divergence_lookback: { min: 4, max: 10, stepSize: 1 },
      oversold: { min: 20, max: 40, stepSize: 5 },
      overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_div_fast_30.params.json',
  },
  rsi_div_slow: {
    class: RSIDivSlowStrategy,
    params: {
      rsi_period: { min: 5, max: 12, stepSize: 1 },
      divergence_lookback: { min: 8, max: 15, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_div_slow_31.params.json',
  },
  mr_rsi_tight: {
    class: MRRSITightStrategy,
    params: {
      ma_period: { min: 4, max: 10, stepSize: 1 },
      rsi_period: { min: 3, max: 8, stepSize: 1 },
      deviation_threshold: { min: 0.01, max: 0.05, stepSize: 0.005 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_tight_32.params.json',
  },
  mr_rsi_wide: {
    class: MRRSIWideStrategy,
    params: {
      ma_period: { min: 6, max: 15, stepSize: 1 },
      rsi_period: { min: 5, max: 10, stepSize: 1 },
      deviation_threshold: { min: 0.02, max: 0.08, stepSize: 0.01 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_wide_33.params.json',
  },
  adapt_fast: {
    class: AdaptFastStrategy,
    params: {
      min_period: { min: 2, max: 5, stepSize: 1 },
      max_period: { min: 8, max: 20, stepSize: 2 },
      vol_sensitivity: { min: 20, max: 100, stepSize: 10 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_adapt_fast_34.params.json',
  },
  adapt_slow: {
    class: AdaptSlowStrategy,
    params: {
      min_period: { min: 3, max: 8, stepSize: 1 },
      max_period: { min: 15, max: 35, stepSize: 5 },
      vol_sensitivity: { min: 10, max: 80, stepSize: 10 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_adapt_slow_35.params.json',
  },
  tri_ma_fast: {
    class: TriMAFastStrategy,
    params: {
      fast_period: { min: 2, max: 5, stepSize: 1 },
      mid_period: { min: 4, max: 10, stepSize: 1 },
      slow_period: { min: 8, max: 18, stepSize: 2 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_tri_ma_fast_36.params.json',
  },
  tri_ma_slow: {
    class: TriMASlowStrategy,
    params: {
      fast_period: { min: 3, max: 8, stepSize: 1 },
      mid_period: { min: 8, max: 16, stepSize: 2 },
      slow_period: { min: 15, max: 30, stepSize: 2 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_tri_ma_slow_37.params.json',
  },
  env_tight: {
    class: EnvTightStrategy,
    params: {
      ma_period: { min: 5, max: 15, stepSize: 1 },
      envelope_pct: { min: 0.01, max: 0.06, stepSize: 0.005 },
      stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_env_tight_38.params.json',
  },
  env_wide: {
    class: EnvWideStrategy,
    params: {
      ma_period: { min: 8, max: 20, stepSize: 2 },
      envelope_pct: { min: 0.03, max: 0.1, stepSize: 0.01 },
      stop_loss: { min: 0.05, max: 0.15, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_env_wide_39.params.json',
  },
  pat_dip: {
    class: PatDipStrategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_dip_40.params.json',
  },
  pat_mom: {
    class: PatMomStrategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_mom_41.params.json',
  },
  combo_tight: {
    class: ComboTightStrategy,
    params: {
      bb_period: { min: 5, max: 12, stepSize: 1 },
      rsi_period: { min: 3, max: 8, stepSize: 1 },
      std_mult: { min: 1.2, max: 2.5, stepSize: 0.1 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_tight_42.params.json',
  },
  combo_wide: {
    class: ComboWideStrategy,
    params: {
      bb_period: { min: 8, max: 18, stepSize: 2 },
      rsi_period: { min: 5, max: 10, stepSize: 1 },
      std_mult: { min: 1.5, max: 3, stepSize: 0.2 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_wide_43.params.json',
  },
  tstr_fast: {
    class: TStrFastStrategy,
    params: {
      lookback: { min: 4, max: 10, stepSize: 1 },
      entry_strength: { min: 0.5, max: 0.9, stepSize: 0.05 },
      exit_strength: { min: 0.1, max: 0.5, stepSize: 0.05 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_tstr_fast_44.params.json',
  },
  tstr_slow: {
    class: TStrSlowStrategy,
    params: {
      lookback: { min: 8, max: 18, stepSize: 2 },
      entry_strength: { min: 0.5, max: 0.85, stepSize: 0.05 },
      exit_strength: { min: 0.15, max: 0.5, stepSize: 0.05 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_tstr_slow_45.params.json',
  },
  swing_short: {
    class: SwingShortStrategy,
    params: {
      swing_window: { min: 2, max: 5, stepSize: 1 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      take_profit: { min: 0.04, max: 0.15, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_swing_short_46.params.json',
  },
  swing_long: {
    class: SwingLongStrategy,
    params: {
      swing_window: { min: 3, max: 8, stepSize: 1 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      take_profit: { min: 0.06, max: 0.2, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_swing_long_47.params.json',
  },
  rev_fast: {
    class: RevFastStrategy,
    params: {
      lookback: { min: 3, max: 8, stepSize: 1 },
      drop_threshold: { min: 0.02, max: 0.1, stepSize: 0.01 },
      bounce_threshold: { min: 0.01, max: 0.05, stepSize: 0.005 },
      stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 },
      take_profit: { min: 0.04, max: 0.15, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_rev_fast_48.params.json',
  },
  rev_slow: {
    class: RevSlowStrategy,
    params: {
      lookback: { min: 6, max: 15, stepSize: 1 },
      drop_threshold: { min: 0.04, max: 0.15, stepSize: 0.01 },
      bounce_threshold: { min: 0.01, max: 0.06, stepSize: 0.005 },
      stop_loss: { min: 0.05, max: 0.15, stepSize: 0.01 },
      take_profit: { min: 0.06, max: 0.2, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_rev_slow_49.params.json',
  },
  chan_tight: {
    class: ChanTightStrategy,
    params: {
      channel_period: { min: 5, max: 12, stepSize: 1 },
      channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_tight_50.params.json',
  },
  chan_wide: {
    class: ChanWideStrategy,
    params: {
      channel_period: { min: 10, max: 20, stepSize: 2 },
      channel_width: { min: 0.3, max: 1, stepSize: 0.1 },
      stop_loss: { min: 0.04, max: 0.15, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_wide_51.params.json',
  },
  mcross_fast: {
    class: MCrossFastStrategy,
    params: {
      ma_period: { min: 3, max: 10, stepSize: 1 },
      stop_loss: { min: 0.02, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_mcross_fast_52.params.json',
  },
  mcross_slow: {
    class: MCrossSlowStrategy,
    params: {
      ma_period: { min: 8, max: 20, stepSize: 2 },
      stop_loss: { min: 0.04, max: 0.12, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_mcross_slow_53.params.json',
  },
  mr_rsi_v01: {
    class: MRRsiV01Strategy,
    params: {
      ma_period: { min: 2, max: 8, stepSize: 1 },
      rsi_period: { min: 2, max: 7, stepSize: 1 },
      deviation_threshold: { min: 0.005, max: 0.045, stepSize: 0.005 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v01_54.params.json',
  },
  mr_rsi_v02: {
    class: MRRsiV02Strategy,
    params: {
      ma_period: { min: 2, max: 9, stepSize: 1 },
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      deviation_threshold: { min: 0.005, max: 0.05, stepSize: 0.005 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v02_55.params.json',
  },
  mr_rsi_v03: {
    class: MRRsiV03Strategy,
    params: {
      ma_period: { min: 2, max: 9, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      deviation_threshold: { min: 0.009999999999999998, max: 0.06, stepSize: 0.005 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v03_56.params.json',
  },
  mr_rsi_v04: {
    class: MRRsiV04Strategy,
    params: {
      ma_period: { min: 3, max: 11, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      deviation_threshold: { min: 0.005, max: 0.05, stepSize: 0.005 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v04_57.params.json',
  },
  mr_rsi_v05: {
    class: MRRsiV05Strategy,
    params: {
      ma_period: { min: 4, max: 12, stepSize: 1 },
      rsi_period: { min: 4, max: 10, stepSize: 1 },
      deviation_threshold: { min: 0.009999999999999998, max: 0.06, stepSize: 0.005 },
      rsi_oversold: { min: 18, max: 38, stepSize: 5 },
      rsi_overbought: { min: 62, max: 82, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v05_58.params.json',
  },
  mr_rsi_v06: {
    class: MRRsiV06Strategy,
    params: {
      ma_period: { min: 5, max: 13, stepSize: 1 },
      rsi_period: { min: 5, max: 11, stepSize: 1 },
      deviation_threshold: { min: 0.02, max: 0.07, stepSize: 0.005 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v06_59.params.json',
  },
  mr_rsi_v07: {
    class: MRRsiV07Strategy,
    params: {
      ma_period: { min: 7, max: 15, stepSize: 1 },
      rsi_period: { min: 6, max: 12, stepSize: 1 },
      deviation_threshold: { min: 0.009999999999999998, max: 0.06, stepSize: 0.005 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v07_60.params.json',
  },
  mr_rsi_v08: {
    class: MRRsiV08Strategy,
    params: {
      ma_period: { min: 9, max: 17, stepSize: 1 },
      rsi_period: { min: 7, max: 13, stepSize: 1 },
      deviation_threshold: { min: 0.030000000000000002, max: 0.08, stepSize: 0.005 },
      rsi_oversold: { min: 12, max: 32, stepSize: 5 },
      rsi_overbought: { min: 68, max: 88, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.35, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v08_61.params.json',
  },
  mr_rsi_v09: {
    class: MRRsiV09Strategy,
    params: {
      ma_period: { min: 2, max: 10, stepSize: 1 },
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      deviation_threshold: { min: 0.030000000000000002, max: 0.08, stepSize: 0.005 },
      rsi_oversold: { min: 10, max: 30, stepSize: 5 },
      rsi_overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v09_62.params.json',
  },
  mr_rsi_v10: {
    class: MRRsiV10Strategy,
    params: {
      ma_period: { min: 2, max: 10, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      deviation_threshold: { min: 0.005, max: 0.04, stepSize: 0.005 },
      rsi_oversold: { min: 25, max: 45, stepSize: 5 },
      rsi_overbought: { min: 55, max: 75, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v10_63.params.json',
  },
  mr_rsi_v11: {
    class: MRRsiV11Strategy,
    params: {
      ma_period: { min: 2, max: 8, stepSize: 1 },
      rsi_period: { min: 2, max: 7, stepSize: 1 },
      deviation_threshold: { min: 0.005, max: 0.04, stepSize: 0.005 },
      rsi_oversold: { min: 25, max: 45, stepSize: 5 },
      rsi_overbought: { min: 55, max: 75, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v11_64.params.json',
  },
  mr_rsi_v12: {
    class: MRRsiV12Strategy,
    params: {
      ma_period: { min: 7, max: 15, stepSize: 1 },
      rsi_period: { min: 6, max: 12, stepSize: 1 },
      deviation_threshold: { min: 0.02, max: 0.07, stepSize: 0.005 },
      rsi_oversold: { min: 10, max: 30, stepSize: 5 },
      rsi_overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v12_65.params.json',
  },
  mr_rsi_v13: {
    class: MRRsiV13Strategy,
    params: {
      ma_period: { min: 3, max: 11, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      deviation_threshold: { min: 0.005000000000000001, max: 0.055, stepSize: 0.005 },
      rsi_oversold: { min: 18, max: 38, stepSize: 5 },
      rsi_overbought: { min: 62, max: 82, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v13_66.params.json',
  },
  mr_rsi_v14: {
    class: MRRsiV14Strategy,
    params: {
      ma_period: { min: 4, max: 12, stepSize: 1 },
      rsi_period: { min: 4, max: 10, stepSize: 1 },
      deviation_threshold: { min: 0.015000000000000003, max: 0.065, stepSize: 0.005 },
      rsi_oversold: { min: 16, max: 36, stepSize: 5 },
      rsi_overbought: { min: 64, max: 84, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.29000000000000004, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v14_67.params.json',
  },
  mr_rsi_v15: {
    class: MRRsiV15Strategy,
    params: {
      ma_period: { min: 2, max: 10, stepSize: 1 },
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      deviation_threshold: { min: 0.005, max: 0.05, stepSize: 0.005 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v15_68.params.json',
  },
  mr_rsi_v16: {
    class: MRRsiV16Strategy,
    params: {
      ma_period: { min: 2, max: 10, stepSize: 1 },
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      deviation_threshold: { min: 0.005, max: 0.05, stepSize: 0.005 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v16_69.params.json',
  },
  mr_rsi_v17: {
    class: MRRsiV17Strategy,
    params: {
      ma_period: { min: 3, max: 11, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      deviation_threshold: { min: 0.009999999999999998, max: 0.06, stepSize: 0.005 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v17_70.params.json',
  },
  mr_rsi_v18: {
    class: MRRsiV18Strategy,
    params: {
      ma_period: { min: 3, max: 11, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      deviation_threshold: { min: 0.009999999999999998, max: 0.06, stepSize: 0.005 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v18_71.params.json',
  },
  mr_rsi_v19: {
    class: MRRsiV19Strategy,
    params: {
      ma_period: { min: 2, max: 8, stepSize: 1 },
      rsi_period: { min: 2, max: 7, stepSize: 1 },
      deviation_threshold: { min: 0.005, max: 0.05, stepSize: 0.005 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v19_72.params.json',
  },
  mr_rsi_v20: {
    class: MRRsiV20Strategy,
    params: {
      ma_period: { min: 11, max: 19, stepSize: 1 },
      rsi_period: { min: 8, max: 14, stepSize: 1 },
      deviation_threshold: { min: 0.039999999999999994, max: 0.09, stepSize: 0.005 },
      rsi_oversold: { min: 10, max: 30, stepSize: 5 },
      rsi_overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_mr_rsi_v20_73.params.json',
  },
  willr_v01: {
    class: WillRV01Strategy,
    params: {
      period: { min: 3, max: 9, stepSize: 1 },
      oversold_level: { min: -95, max: -75, stepSize: 5 },
      overbought_level: { min: -25, max: -5, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v01_74.params.json',
  },
  willr_v02: {
    class: WillRV02Strategy,
    params: {
      period: { min: 3, max: 10, stepSize: 1 },
      oversold_level: { min: -90, max: -70, stepSize: 5 },
      overbought_level: { min: -30, max: -10, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v02_75.params.json',
  },
  willr_v03: {
    class: WillRV03Strategy,
    params: {
      period: { min: 3, max: 10, stepSize: 1 },
      oversold_level: { min: -98, max: -80, stepSize: 5 },
      overbought_level: { min: -20, max: -2, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v03_76.params.json',
  },
  willr_v04: {
    class: WillRV04Strategy,
    params: {
      period: { min: 5, max: 13, stepSize: 1 },
      oversold_level: { min: -90, max: -70, stepSize: 5 },
      overbought_level: { min: -30, max: -10, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v04_77.params.json',
  },
  willr_v05: {
    class: WillRV05Strategy,
    params: {
      period: { min: 5, max: 13, stepSize: 1 },
      oversold_level: { min: -95, max: -75, stepSize: 5 },
      overbought_level: { min: -25, max: -5, stepSize: 5 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v05_78.params.json',
  },
  willr_v06: {
    class: WillRV06Strategy,
    params: {
      period: { min: 5, max: 13, stepSize: 1 },
      oversold_level: { min: -98, max: -85, stepSize: 5 },
      overbought_level: { min: -15, max: -2, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      trailing_stop: { min: 0.039999999999999994, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.35, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v06_79.params.json',
  },
  willr_v07: {
    class: WillRV07Strategy,
    params: {
      period: { min: 9, max: 17, stepSize: 1 },
      oversold_level: { min: -90, max: -70, stepSize: 5 },
      overbought_level: { min: -30, max: -10, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v07_80.params.json',
  },
  willr_v08: {
    class: WillRV08Strategy,
    params: {
      period: { min: 9, max: 17, stepSize: 1 },
      oversold_level: { min: -98, max: -80, stepSize: 5 },
      overbought_level: { min: -20, max: -2, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      trailing_stop: { min: 0.039999999999999994, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v08_81.params.json',
  },
  willr_v09: {
    class: WillRV09Strategy,
    params: {
      period: { min: 4, max: 12, stepSize: 1 },
      oversold_level: { min: -98, max: -85, stepSize: 5 },
      overbought_level: { min: -35, max: -15, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v09_82.params.json',
  },
  willr_v10: {
    class: WillRV10Strategy,
    params: {
      period: { min: 3, max: 11, stepSize: 1 },
      oversold_level: { min: -80, max: -60, stepSize: 5 },
      overbought_level: { min: -40, max: -20, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v10_83.params.json',
  },
  willr_v11: {
    class: WillRV11Strategy,
    params: {
      period: { min: 3, max: 9, stepSize: 1 },
      oversold_level: { min: -85, max: -65, stepSize: 5 },
      overbought_level: { min: -35, max: -15, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v11_84.params.json',
  },
  willr_v12: {
    class: WillRV12Strategy,
    params: {
      period: { min: 11, max: 19, stepSize: 1 },
      oversold_level: { min: -98, max: -80, stepSize: 5 },
      overbought_level: { min: -20, max: -2, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v12_85.params.json',
  },
  willr_v13: {
    class: WillRV13Strategy,
    params: {
      period: { min: 4, max: 12, stepSize: 1 },
      oversold_level: { min: -92, max: -72, stepSize: 5 },
      overbought_level: { min: -28, max: -8, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v13_86.params.json',
  },
  willr_v14: {
    class: WillRV14Strategy,
    params: {
      period: { min: 6, max: 14, stepSize: 1 },
      oversold_level: { min: -88, max: -68, stepSize: 5 },
      overbought_level: { min: -32, max: -12, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.29000000000000004, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v14_87.params.json',
  },
  willr_v15: {
    class: WillRV15Strategy,
    params: {
      period: { min: 4, max: 12, stepSize: 1 },
      oversold_level: { min: -90, max: -70, stepSize: 5 },
      overbought_level: { min: -30, max: -10, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.07, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v15_88.params.json',
  },
  willr_v16: {
    class: WillRV16Strategy,
    params: {
      period: { min: 4, max: 12, stepSize: 1 },
      oversold_level: { min: -90, max: -70, stepSize: 5 },
      overbought_level: { min: -30, max: -10, stepSize: 5 },
      stop_loss: { min: 0.09, max: 0.16999999999999998, stepSize: 0.01 },
      trailing_stop: { min: 0.06, max: 0.12, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v16_89.params.json',
  },
  willr_v17: {
    class: WillRV17Strategy,
    params: {
      period: { min: 3, max: 11, stepSize: 1 },
      oversold_level: { min: -95, max: -75, stepSize: 5 },
      overbought_level: { min: -25, max: -5, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v17_90.params.json',
  },
  willr_v18: {
    class: WillRV18Strategy,
    params: {
      period: { min: 3, max: 11, stepSize: 1 },
      oversold_level: { min: -95, max: -75, stepSize: 5 },
      overbought_level: { min: -25, max: -5, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v18_91.params.json',
  },
  willr_v19: {
    class: WillRV19Strategy,
    params: {
      period: { min: 3, max: 8, stepSize: 1 },
      oversold_level: { min: -90, max: -70, stepSize: 5 },
      overbought_level: { min: -30, max: -10, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v19_92.params.json',
  },
  willr_v20: {
    class: WillRV20Strategy,
    params: {
      period: { min: 15, max: 23, stepSize: 1 },
      oversold_level: { min: -95, max: -75, stepSize: 5 },
      overbought_level: { min: -25, max: -5, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      trailing_stop: { min: 0.039999999999999994, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_willr_v20_93.params.json',
  },
  env_v01: {
    class: EnvV01Strategy,
    params: {
      ma_period: { min: 2, max: 9, stepSize: 1 },
      envelope_pct: { min: 0.005, max: 0.04, stepSize: 0.005 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v01_94.params.json',
  },
  env_v02: {
    class: EnvV02Strategy,
    params: {
      ma_period: { min: 2, max: 10, stepSize: 1 },
      envelope_pct: { min: 0.005, max: 0.045, stepSize: 0.005 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v02_95.params.json',
  },
  env_v03: {
    class: EnvV03Strategy,
    params: {
      ma_period: { min: 2, max: 10, stepSize: 1 },
      envelope_pct: { min: 0.010000000000000002, max: 0.055, stepSize: 0.005 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v03_96.params.json',
  },
  env_v04: {
    class: EnvV04Strategy,
    params: {
      ma_period: { min: 2, max: 10, stepSize: 1 },
      envelope_pct: { min: 0.025, max: 0.07, stepSize: 0.005 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v04_97.params.json',
  },
  env_v05: {
    class: EnvV05Strategy,
    params: {
      ma_period: { min: 5, max: 13, stepSize: 1 },
      envelope_pct: { min: 0.005000000000000001, max: 0.05, stepSize: 0.005 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v05_98.params.json',
  },
  env_v06: {
    class: EnvV06Strategy,
    params: {
      ma_period: { min: 5, max: 13, stepSize: 1 },
      envelope_pct: { min: 0.015, max: 0.06, stepSize: 0.005 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v06_99.params.json',
  },
  env_v07: {
    class: EnvV07Strategy,
    params: {
      ma_period: { min: 5, max: 13, stepSize: 1 },
      envelope_pct: { min: 0.035, max: 0.08, stepSize: 0.005 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v07_100.params.json',
  },
  env_v08: {
    class: EnvV08Strategy,
    params: {
      ma_period: { min: 9, max: 17, stepSize: 1 },
      envelope_pct: { min: 0.005000000000000001, max: 0.05, stepSize: 0.005 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v08_101.params.json',
  },
  env_v09: {
    class: EnvV09Strategy,
    params: {
      ma_period: { min: 9, max: 17, stepSize: 1 },
      envelope_pct: { min: 0.025, max: 0.07, stepSize: 0.005 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v09_102.params.json',
  },
  env_v10: {
    class: EnvV10Strategy,
    params: {
      ma_period: { min: 9, max: 17, stepSize: 1 },
      envelope_pct: { min: 0.045, max: 0.09, stepSize: 0.005 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.35, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v10_103.params.json',
  },
  env_v11: {
    class: EnvV11Strategy,
    params: {
      ma_period: { min: 2, max: 9, stepSize: 1 },
      envelope_pct: { min: 0.005, max: 0.045, stepSize: 0.005 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v11_104.params.json',
  },
  env_v12: {
    class: EnvV12Strategy,
    params: {
      ma_period: { min: 12, max: 20, stepSize: 1 },
      envelope_pct: { min: 0.035, max: 0.08, stepSize: 0.005 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v12_105.params.json',
  },
  env_v13: {
    class: EnvV13Strategy,
    params: {
      ma_period: { min: 4, max: 12, stepSize: 1 },
      envelope_pct: { min: 0.010000000000000002, max: 0.055, stepSize: 0.005 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v13_106.params.json',
  },
  env_v14: {
    class: EnvV14Strategy,
    params: {
      ma_period: { min: 6, max: 14, stepSize: 1 },
      envelope_pct: { min: 0.020000000000000004, max: 0.065, stepSize: 0.005 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.29000000000000004, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v14_107.params.json',
  },
  env_v15: {
    class: EnvV15Strategy,
    params: {
      ma_period: { min: 3, max: 11, stepSize: 1 },
      envelope_pct: { min: 0.005000000000000001, max: 0.05, stepSize: 0.005 },
      stop_loss: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v15_108.params.json',
  },
  env_v16: {
    class: EnvV16Strategy,
    params: {
      ma_period: { min: 3, max: 11, stepSize: 1 },
      envelope_pct: { min: 0.005000000000000001, max: 0.05, stepSize: 0.005 },
      stop_loss: { min: 0.09, max: 0.16999999999999998, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v16_109.params.json',
  },
  env_v17: {
    class: EnvV17Strategy,
    params: {
      ma_period: { min: 4, max: 12, stepSize: 1 },
      envelope_pct: { min: 0.015, max: 0.06, stepSize: 0.005 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v17_110.params.json',
  },
  env_v18: {
    class: EnvV18Strategy,
    params: {
      ma_period: { min: 4, max: 12, stepSize: 1 },
      envelope_pct: { min: 0.015, max: 0.06, stepSize: 0.005 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v18_111.params.json',
  },
  env_v19: {
    class: EnvV19Strategy,
    params: {
      ma_period: { min: 2, max: 8, stepSize: 1 },
      envelope_pct: { min: 0.005, max: 0.038, stepSize: 0.005 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v19_112.params.json',
  },
  env_v20: {
    class: EnvV20Strategy,
    params: {
      ma_period: { min: 15, max: 23, stepSize: 1 },
      envelope_pct: { min: 0.045, max: 0.09, stepSize: 0.005 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_env_v20_113.params.json',
  },
  chan_v01: {
    class: ChanV01Strategy,
    params: {
      channel_period: { min: 3, max: 9, stepSize: 1 },
      channel_width: { min: 0.1, max: 0.6, stepSize: 0.1 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v01_114.params.json',
  },
  chan_v02: {
    class: ChanV02Strategy,
    params: {
      channel_period: { min: 3, max: 10, stepSize: 1 },
      channel_width: { min: 0.10000000000000003, max: 0.7, stepSize: 0.1 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v02_115.params.json',
  },
  chan_v03: {
    class: ChanV03Strategy,
    params: {
      channel_period: { min: 3, max: 10, stepSize: 1 },
      channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v03_116.params.json',
  },
  chan_v04: {
    class: ChanV04Strategy,
    params: {
      channel_period: { min: 3, max: 10, stepSize: 1 },
      channel_width: { min: 0.39999999999999997, max: 1, stepSize: 0.1 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v04_117.params.json',
  },
  chan_v05: {
    class: ChanV05Strategy,
    params: {
      channel_period: { min: 5, max: 13, stepSize: 1 },
      channel_width: { min: 0.10000000000000003, max: 0.7, stepSize: 0.1 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v05_118.params.json',
  },
  chan_v06: {
    class: ChanV06Strategy,
    params: {
      channel_period: { min: 5, max: 13, stepSize: 1 },
      channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v06_119.params.json',
  },
  chan_v07: {
    class: ChanV07Strategy,
    params: {
      channel_period: { min: 5, max: 13, stepSize: 1 },
      channel_width: { min: 0.5, max: 1.1, stepSize: 0.1 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      trailing_stop: { min: 0.039999999999999994, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v07_120.params.json',
  },
  chan_v08: {
    class: ChanV08Strategy,
    params: {
      channel_period: { min: 9, max: 17, stepSize: 1 },
      channel_width: { min: 0.10000000000000003, max: 0.7, stepSize: 0.1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v08_121.params.json',
  },
  chan_v09: {
    class: ChanV09Strategy,
    params: {
      channel_period: { min: 9, max: 17, stepSize: 1 },
      channel_width: { min: 0.3, max: 0.8999999999999999, stepSize: 0.1 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v09_122.params.json',
  },
  chan_v10: {
    class: ChanV10Strategy,
    params: {
      channel_period: { min: 9, max: 17, stepSize: 1 },
      channel_width: { min: 0.6000000000000001, max: 1.2, stepSize: 0.1 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      trailing_stop: { min: 0.05, max: 0.11000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.35, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v10_123.params.json',
  },
  chan_v11: {
    class: ChanV11Strategy,
    params: {
      channel_period: { min: 3, max: 9, stepSize: 1 },
      channel_width: { min: 0.1, max: 0.6, stepSize: 0.1 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v11_124.params.json',
  },
  chan_v12: {
    class: ChanV12Strategy,
    params: {
      channel_period: { min: 12, max: 20, stepSize: 1 },
      channel_width: { min: 0.39999999999999997, max: 1, stepSize: 0.1 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v12_125.params.json',
  },
  chan_v13: {
    class: ChanV13Strategy,
    params: {
      channel_period: { min: 4, max: 12, stepSize: 1 },
      channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v13_126.params.json',
  },
  chan_v14: {
    class: ChanV14Strategy,
    params: {
      channel_period: { min: 6, max: 14, stepSize: 1 },
      channel_width: { min: 0.3, max: 0.8999999999999999, stepSize: 0.1 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.29000000000000004, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v14_127.params.json',
  },
  chan_v15: {
    class: ChanV15Strategy,
    params: {
      channel_period: { min: 4, max: 12, stepSize: 1 },
      channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.01, max: 0.07, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v15_128.params.json',
  },
  chan_v16: {
    class: ChanV16Strategy,
    params: {
      channel_period: { min: 4, max: 12, stepSize: 1 },
      channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.09, max: 0.16999999999999998, stepSize: 0.01 },
      trailing_stop: { min: 0.06, max: 0.12, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v16_129.params.json',
  },
  chan_v17: {
    class: ChanV17Strategy,
    params: {
      channel_period: { min: 3, max: 11, stepSize: 1 },
      channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v17_130.params.json',
  },
  chan_v18: {
    class: ChanV18Strategy,
    params: {
      channel_period: { min: 3, max: 11, stepSize: 1 },
      channel_width: { min: 0.2, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v18_131.params.json',
  },
  chan_v19: {
    class: ChanV19Strategy,
    params: {
      channel_period: { min: 3, max: 8, stepSize: 1 },
      channel_width: { min: 0.1, max: 0.5, stepSize: 0.1 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v19_132.params.json',
  },
  chan_v20: {
    class: ChanV20Strategy,
    params: {
      channel_period: { min: 15, max: 23, stepSize: 1 },
      channel_width: { min: 0.7, max: 1.3, stepSize: 0.1 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      trailing_stop: { min: 0.05, max: 0.11000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_chan_v20_133.params.json',
  },
  combo_v01: {
    class: ComboV01Strategy,
    params: {
      bb_period: { min: 2, max: 9, stepSize: 1 },
      rsi_period: { min: 2, max: 7, stepSize: 1 },
      std_mult: { min: 1, max: 2.3, stepSize: 0.1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v01_134.params.json',
  },
  combo_v02: {
    class: ComboV02Strategy,
    params: {
      bb_period: { min: 2, max: 10, stepSize: 1 },
      rsi_period: { min: 2, max: 7, stepSize: 1 },
      std_mult: { min: 1.3, max: 2.6, stepSize: 0.1 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v02_135.params.json',
  },
  combo_v03: {
    class: ComboV03Strategy,
    params: {
      bb_period: { min: 3, max: 11, stepSize: 1 },
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      std_mult: { min: 1.5, max: 2.8, stepSize: 0.1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v03_136.params.json',
  },
  combo_v04: {
    class: ComboV04Strategy,
    params: {
      bb_period: { min: 3, max: 11, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      std_mult: { min: 2, max: 3.3, stepSize: 0.1 },
      rsi_oversold: { min: 10, max: 30, stepSize: 5 },
      rsi_overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v04_137.params.json',
  },
  combo_v05: {
    class: ComboV05Strategy,
    params: {
      bb_period: { min: 5, max: 13, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      std_mult: { min: 1, max: 2.3, stepSize: 0.1 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v05_138.params.json',
  },
  combo_v06: {
    class: ComboV06Strategy,
    params: {
      bb_period: { min: 5, max: 13, stepSize: 1 },
      rsi_period: { min: 4, max: 10, stepSize: 1 },
      std_mult: { min: 1.5, max: 2.8, stepSize: 0.1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v06_139.params.json',
  },
  combo_v07: {
    class: ComboV07Strategy,
    params: {
      bb_period: { min: 7, max: 15, stepSize: 1 },
      rsi_period: { min: 5, max: 11, stepSize: 1 },
      std_mult: { min: 2, max: 3.3, stepSize: 0.1 },
      rsi_oversold: { min: 10, max: 30, stepSize: 5 },
      rsi_overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v07_140.params.json',
  },
  combo_v08: {
    class: ComboV08Strategy,
    params: {
      bb_period: { min: 9, max: 17, stepSize: 1 },
      rsi_period: { min: 5, max: 11, stepSize: 1 },
      std_mult: { min: 1, max: 2.3, stepSize: 0.1 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v08_141.params.json',
  },
  combo_v09: {
    class: ComboV09Strategy,
    params: {
      bb_period: { min: 9, max: 17, stepSize: 1 },
      rsi_period: { min: 6, max: 12, stepSize: 1 },
      std_mult: { min: 1.5, max: 2.8, stepSize: 0.1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v09_142.params.json',
  },
  combo_v10: {
    class: ComboV10Strategy,
    params: {
      bb_period: { min: 12, max: 20, stepSize: 1 },
      rsi_period: { min: 7, max: 13, stepSize: 1 },
      std_mult: { min: 2, max: 3.3, stepSize: 0.1 },
      rsi_oversold: { min: 10, max: 30, stepSize: 5 },
      rsi_overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.35, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v10_143.params.json',
  },
  combo_v11: {
    class: ComboV11Strategy,
    params: {
      bb_period: { min: 2, max: 9, stepSize: 1 },
      rsi_period: { min: 2, max: 7, stepSize: 1 },
      std_mult: { min: 0.8, max: 2.1, stepSize: 0.1 },
      rsi_oversold: { min: 25, max: 45, stepSize: 5 },
      rsi_overbought: { min: 55, max: 75, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v11_144.params.json',
  },
  combo_v12: {
    class: ComboV12Strategy,
    params: {
      bb_period: { min: 11, max: 19, stepSize: 1 },
      rsi_period: { min: 6, max: 12, stepSize: 1 },
      std_mult: { min: 2.3, max: 3.5999999999999996, stepSize: 0.1 },
      rsi_oversold: { min: 10, max: 28, stepSize: 5 },
      rsi_overbought: { min: 72, max: 90, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v12_145.params.json',
  },
  combo_v13: {
    class: ComboV13Strategy,
    params: {
      bb_period: { min: 4, max: 12, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      std_mult: { min: 1.3, max: 2.6, stepSize: 0.1 },
      rsi_oversold: { min: 18, max: 38, stepSize: 5 },
      rsi_overbought: { min: 62, max: 82, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v13_146.params.json',
  },
  combo_v14: {
    class: ComboV14Strategy,
    params: {
      bb_period: { min: 6, max: 14, stepSize: 1 },
      rsi_period: { min: 4, max: 10, stepSize: 1 },
      std_mult: { min: 1.7000000000000002, max: 3, stepSize: 0.1 },
      rsi_oversold: { min: 16, max: 36, stepSize: 5 },
      rsi_overbought: { min: 64, max: 84, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.29000000000000004, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v14_147.params.json',
  },
  combo_v15: {
    class: ComboV15Strategy,
    params: {
      bb_period: { min: 3, max: 11, stepSize: 1 },
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      std_mult: { min: 1.5, max: 2.8, stepSize: 0.1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v15_148.params.json',
  },
  combo_v16: {
    class: ComboV16Strategy,
    params: {
      bb_period: { min: 3, max: 11, stepSize: 1 },
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      std_mult: { min: 1.5, max: 2.8, stepSize: 0.1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.09, max: 0.16999999999999998, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v16_149.params.json',
  },
  combo_v17: {
    class: ComboV17Strategy,
    params: {
      bb_period: { min: 4, max: 12, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      std_mult: { min: 1.5, max: 2.8, stepSize: 0.1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v17_150.params.json',
  },
  combo_v18: {
    class: ComboV18Strategy,
    params: {
      bb_period: { min: 4, max: 12, stepSize: 1 },
      rsi_period: { min: 3, max: 9, stepSize: 1 },
      std_mult: { min: 1.5, max: 2.8, stepSize: 0.1 },
      rsi_oversold: { min: 15, max: 35, stepSize: 5 },
      rsi_overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v18_151.params.json',
  },
  combo_v19: {
    class: ComboV19Strategy,
    params: {
      bb_period: { min: 2, max: 8, stepSize: 1 },
      rsi_period: { min: 2, max: 7, stepSize: 1 },
      std_mult: { min: 0.8, max: 2, stepSize: 0.1 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v19_152.params.json',
  },
  combo_v20: {
    class: ComboV20Strategy,
    params: {
      bb_period: { min: 15, max: 23, stepSize: 1 },
      rsi_period: { min: 8, max: 14, stepSize: 1 },
      std_mult: { min: 2.5, max: 3.8, stepSize: 0.1 },
      rsi_oversold: { min: 10, max: 25, stepSize: 5 },
      rsi_overbought: { min: 75, max: 90, stepSize: 5 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_combo_v20_153.params.json',
  },
  stoch_v01: {
    class: StochV01Strategy,
    params: {
      k_period: { min: 2, max: 8, stepSize: 1 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold: { min: 5, max: 25, stepSize: 5 },
      overbought: { min: 75, max: 95, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v01_154.params.json',
  },
  stoch_v02: {
    class: StochV02Strategy,
    params: {
      k_period: { min: 2, max: 9, stepSize: 1 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v02_155.params.json',
  },
  stoch_v03: {
    class: StochV03Strategy,
    params: {
      k_period: { min: 2, max: 10, stepSize: 1 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v03_156.params.json',
  },
  stoch_v04: {
    class: StochV04Strategy,
    params: {
      k_period: { min: 2, max: 10, stepSize: 1 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 5, max: 25, stepSize: 5 },
      overbought: { min: 75, max: 95, stepSize: 5 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v04_157.params.json',
  },
  stoch_v05: {
    class: StochV05Strategy,
    params: {
      k_period: { min: 4, max: 12, stepSize: 1 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v05_158.params.json',
  },
  stoch_v06: {
    class: StochV06Strategy,
    params: {
      k_period: { min: 5, max: 13, stepSize: 1 },
      d_period: { min: 3, max: 7, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v06_159.params.json',
  },
  stoch_v07: {
    class: StochV07Strategy,
    params: {
      k_period: { min: 7, max: 15, stepSize: 1 },
      d_period: { min: 3, max: 7, stepSize: 1 },
      oversold: { min: 5, max: 25, stepSize: 5 },
      overbought: { min: 75, max: 95, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v07_160.params.json',
  },
  stoch_v08: {
    class: StochV08Strategy,
    params: {
      k_period: { min: 9, max: 17, stepSize: 1 },
      d_period: { min: 4, max: 8, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v08_161.params.json',
  },
  stoch_v09: {
    class: StochV09Strategy,
    params: {
      k_period: { min: 9, max: 17, stepSize: 1 },
      d_period: { min: 4, max: 8, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v09_162.params.json',
  },
  stoch_v10: {
    class: StochV10Strategy,
    params: {
      k_period: { min: 11, max: 19, stepSize: 1 },
      d_period: { min: 5, max: 9, stepSize: 1 },
      oversold: { min: 5, max: 25, stepSize: 5 },
      overbought: { min: 75, max: 95, stepSize: 5 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.35, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v10_163.params.json',
  },
  stoch_v11: {
    class: StochV11Strategy,
    params: {
      k_period: { min: 2, max: 8, stepSize: 1 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v11_164.params.json',
  },
  stoch_v12: {
    class: StochV12Strategy,
    params: {
      k_period: { min: 11, max: 19, stepSize: 1 },
      d_period: { min: 5, max: 9, stepSize: 1 },
      oversold: { min: 5, max: 20, stepSize: 5 },
      overbought: { min: 80, max: 95, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v12_165.params.json',
  },
  stoch_v13: {
    class: StochV13Strategy,
    params: {
      k_period: { min: 3, max: 11, stepSize: 1 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 12, max: 32, stepSize: 5 },
      overbought: { min: 68, max: 88, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v13_166.params.json',
  },
  stoch_v14: {
    class: StochV14Strategy,
    params: {
      k_period: { min: 6, max: 14, stepSize: 1 },
      d_period: { min: 3, max: 7, stepSize: 1 },
      oversold: { min: 8, max: 28, stepSize: 5 },
      overbought: { min: 72, max: 92, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.29000000000000004, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v14_167.params.json',
  },
  stoch_v15: {
    class: StochV15Strategy,
    params: {
      k_period: { min: 3, max: 11, stepSize: 1 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v15_168.params.json',
  },
  stoch_v16: {
    class: StochV16Strategy,
    params: {
      k_period: { min: 3, max: 11, stepSize: 1 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.09, max: 0.16999999999999998, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v16_169.params.json',
  },
  stoch_v17: {
    class: StochV17Strategy,
    params: {
      k_period: { min: 4, max: 12, stepSize: 1 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v17_170.params.json',
  },
  stoch_v18: {
    class: StochV18Strategy,
    params: {
      k_period: { min: 4, max: 12, stepSize: 1 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v18_171.params.json',
  },
  stoch_v19: {
    class: StochV19Strategy,
    params: {
      k_period: { min: 2, max: 8, stepSize: 1 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v19_172.params.json',
  },
  stoch_v20: {
    class: StochV20Strategy,
    params: {
      k_period: { min: 15, max: 23, stepSize: 1 },
      d_period: { min: 6, max: 10, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v20_173.params.json',
  },
  pat_v01: {
    class: PatV01Strategy,
    params: {
      consec_bars: { min: 2, max: 4, stepSize: 1 },
      exit_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v01_174.params.json',
  },
  pat_v02: {
    class: PatV02Strategy,
    params: {
      consec_bars: { min: 2, max: 4, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v02_175.params.json',
  },
  pat_v03: {
    class: PatV03Strategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v03_176.params.json',
  },
  pat_v04: {
    class: PatV04Strategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v04_177.params.json',
  },
  pat_v05: {
    class: PatV05Strategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 5, stepSize: 1 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v05_178.params.json',
  },
  pat_v06: {
    class: PatV06Strategy,
    params: {
      consec_bars: { min: 3, max: 6, stepSize: 1 },
      exit_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v06_179.params.json',
  },
  pat_v07: {
    class: PatV07Strategy,
    params: {
      consec_bars: { min: 3, max: 6, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      trailing_stop: { min: 0.030000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v07_180.params.json',
  },
  pat_v08: {
    class: PatV08Strategy,
    params: {
      consec_bars: { min: 3, max: 6, stepSize: 1 },
      exit_bars: { min: 1, max: 5, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      trailing_stop: { min: 0.039999999999999994, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v08_181.params.json',
  },
  pat_v09: {
    class: PatV09Strategy,
    params: {
      consec_bars: { min: 4, max: 7, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
      trailing_stop: { min: 0.039999999999999994, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v09_182.params.json',
  },
  pat_v10: {
    class: PatV10Strategy,
    params: {
      consec_bars: { min: 4, max: 7, stepSize: 1 },
      exit_bars: { min: 1, max: 5, stepSize: 1 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      trailing_stop: { min: 0.05, max: 0.11000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.35, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v10_183.params.json',
  },
  pat_v11: {
    class: PatV11Strategy,
    params: {
      consec_bars: { min: 2, max: 4, stepSize: 1 },
      exit_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v11_184.params.json',
  },
  pat_v12: {
    class: PatV12Strategy,
    params: {
      consec_bars: { min: 3, max: 6, stepSize: 1 },
      exit_bars: { min: 1, max: 5, stepSize: 1 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v12_185.params.json',
  },
  pat_v13: {
    class: PatV13Strategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v13_186.params.json',
  },
  pat_v14: {
    class: PatV14Strategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.29000000000000004, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v14_187.params.json',
  },
  pat_v15: {
    class: PatV15Strategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.01, max: 0.07, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v15_188.params.json',
  },
  pat_v16: {
    class: PatV16Strategy,
    params: {
      consec_bars: { min: 2, max: 5, stepSize: 1 },
      exit_bars: { min: 1, max: 4, stepSize: 1 },
      stop_loss: { min: 0.09, max: 0.16999999999999998, stepSize: 0.01 },
      trailing_stop: { min: 0.06, max: 0.12, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v16_189.params.json',
  },
  pat_v17: {
    class: PatV17Strategy,
    params: {
      consec_bars: { min: 2, max: 4, stepSize: 1 },
      exit_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v17_190.params.json',
  },
  pat_v18: {
    class: PatV18Strategy,
    params: {
      consec_bars: { min: 2, max: 4, stepSize: 1 },
      exit_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v18_191.params.json',
  },
  pat_v19: {
    class: PatV19Strategy,
    params: {
      consec_bars: { min: 2, max: 4, stepSize: 1 },
      exit_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v19_192.params.json',
  },
  pat_v20: {
    class: PatV20Strategy,
    params: {
      consec_bars: { min: 4, max: 7, stepSize: 1 },
      exit_bars: { min: 1, max: 6, stepSize: 1 },
      stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
      trailing_stop: { min: 0.06, max: 0.12, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_pat_v20_193.params.json',
  },
  rsi_d_v01: {
    class: RsiDV01Strategy,
    params: {
      rsi_period: { min: 2, max: 7, stepSize: 1 },
      divergence_lookback: { min: 3, max: 9, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_d_v01_194.params.json',
  },
  rsi_d_v02: {
    class: RsiDV02Strategy,
    params: {
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      divergence_lookback: { min: 3, max: 10, stepSize: 1 },
      oversold: { min: 20, max: 40, stepSize: 5 },
      overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_d_v02_195.params.json',
  },
  rsi_d_v03: {
    class: RsiDV03Strategy,
    params: {
      rsi_period: { min: 4, max: 10, stepSize: 1 },
      divergence_lookback: { min: 4, max: 12, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_d_v03_196.params.json',
  },
  rsi_d_v04: {
    class: RsiDV04Strategy,
    params: {
      rsi_period: { min: 6, max: 12, stepSize: 1 },
      divergence_lookback: { min: 7, max: 15, stepSize: 1 },
      oversold: { min: 10, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 90, stepSize: 5 },
      stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_d_v04_197.params.json',
  },
  rsi_d_v05: {
    class: RsiDV05Strategy,
    params: {
      rsi_period: { min: 2, max: 8, stepSize: 1 },
      divergence_lookback: { min: 3, max: 10, stepSize: 1 },
      oversold: { min: 20, max: 40, stepSize: 5 },
      overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_d_v05_198.params.json',
  },
  rsi_d_v06: {
    class: RsiDV06Strategy,
    params: {
      rsi_period: { min: 8, max: 14, stepSize: 1 },
      divergence_lookback: { min: 9, max: 17, stepSize: 1 },
      oversold: { min: 10, max: 28, stepSize: 5 },
      overbought: { min: 72, max: 90, stepSize: 5 },
      stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_d_v06_199.params.json',
  },
  rsi_d_v07: {
    class: RsiDV07Strategy,
    params: {
      rsi_period: { min: 4, max: 10, stepSize: 1 },
      divergence_lookback: { min: 5, max: 13, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_d_v07_200.params.json',
  },
  stoch_v20_tweak_201: {
    class: StochV20Tweak201Strategy,
    params: {
      k_period: { min: 6, max: 12, stepSize: 1 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold_base: { min: 15, max: 30, stepSize: 5 },
      overbought_base: { min: 70, max: 85, stepSize: 5 },
      volatility_period: { min: 10, max: 30, stepSize: 5 },
      level_adjustment_factor: { min: 5, max: 20, stepSize: 5 },
      stop_loss: { min: 0.04, max: 0.12, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v20_tweak_201.params.json',
  },
  stoch_v06_tweak_202: {
    class: StochV06Tweak202Strategy,
    params: {
      k_period: { min: 8, max: 16, stepSize: 2 },
      d_period: { min: 3, max: 7, stepSize: 1 },
      oversold: { min: 10, max: 25, stepSize: 5 },
      overbought: { min: 75, max: 90, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.20, stepSize: 0.05 },
      ma_period: { min: 10, max: 30, stepSize: 5 },
      use_trend_filter: { min: 0, max: 1, stepSize: 1 },
      use_mtf_confirmation: { min: 0, max: 1, stepSize: 1 },
      use_dynamic_sizing: { min: 0, max: 1, stepSize: 1 },
      mtf_threshold: { min: 0.3, max: 0.7, stepSize: 0.1 },
    },
    outputFile: 'strat_stoch_v06_tweak_202.params.json',
  },
  stoch_v09_tweak_203: {
    class: StochV09Tweak203Strategy,
    params: {
      k_period: { min: 6, max: 14, stepSize: 2 },
      d_period: { min: 2, max: 6, stepSize: 1 },
      oversold: { min: 15, max: 35, stepSize: 5 },
      overbought: { min: 65, max: 85, stepSize: 5 },
      rsi_period: { min: 10, max: 20, stepSize: 2 },
      rsi_oversold_max: { min: 30, max: 50, stepSize: 5 },
      rsi_overbought_min: { min: 50, max: 70, stepSize: 5 },
      divergence_lookback: { min: 3, max: 8, stepSize: 1 },
      enable_divergence: { min: 0, max: 1, stepSize: 1 },
      enable_rsi_confirm: { min: 0, max: 1, stepSize: 1 },
      profit_level_1: { min: 0.03, max: 0.08, stepSize: 0.01 },
      profit_level_2: { min: 0.06, max: 0.15, stepSize: 0.03 },
      partial_close_pct_1: { min: 0.3, max: 0.6, stepSize: 0.1 },
      partial_close_pct_2: { min: 0.3, max: 0.7, stepSize: 0.1 },
      stop_loss: { min: 0.04, max: 0.10, stepSize: 0.02 },
      risk_percent: { min: 0.08, max: 0.20, stepSize: 0.04 },
    },
    outputFile: 'strat_stoch_v09_tweak_203.params.json',
  },
  stoch_adaptive_204: {
    class: StochAdaptiveStrategy,
    params: {
      min_k_period: { min: 2, max: 5, stepSize: 1 },
      max_k_period: { min: 10, max: 20, stepSize: 2 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      percentile_lookback: { min: 10, max: 30, stepSize: 5 },
      oversold_percentile: { min: 10, max: 25, stepSize: 5 },
      overbought_percentile: { min: 75, max: 90, stepSize: 5 },
      atr_period: { min: 10, max: 20, stepSize: 2 },
      min_atr_threshold: { min: 0.002, max: 0.01, stepSize: 0.002 },
      volatility_scale: { min: 30, max: 70, stepSize: 10 },
      stop_loss: { min: 0.02, max: 0.08, stepSize: 0.02 },
      risk_percent: { min: 0.05, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_adaptive_204.params.json',
  },
  rsi_stoch_combo_205: {
    class: RsiStochCombo205Strategy,
    params: {
      rsi_period: { min: 10, max: 20, stepSize: 2 },
      divergence_lookback: { min: 3, max: 8, stepSize: 1 },
      k_period: { min: 10, max: 20, stepSize: 2 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold: { min: 15, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 85, stepSize: 5 },
      signal_window: { min: 2, max: 5, stepSize: 1 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.15, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_stoch_combo_205.params.json',
  },
  volatility_breakout_206: {
    class: VolatilityBreakoutStrategy,
    params: {
      atr_period: { min: 10, max: 20, stepSize: 2 },
      atr_multiplier: { min: 0.3, max: 0.8, stepSize: 0.1 },
      lookback: { min: 10, max: 30, stepSize: 5 },
      volume_period: { min: 5, max: 15, stepSize: 5 },
      stop_loss: { min: 0.02, max: 0.08, stepSize: 0.02 },
      trailing_stop: { min: 0.015, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.15, stepSize: 0.05 },
    },
    outputFile: 'strat_volatility_breakout_206.params.json',
  },
  trend_following_ma_207: {
    class: TrendFollowingMAStrategy,
    params: {
      fast_period: { min: 5, max: 20, stepSize: 5 },
      medium_period: { min: 15, max: 40, stepSize: 5 },
      slow_period: { min: 30, max: 80, stepSize: 10 },
      adx_period: { min: 10, max: 20, stepSize: 2 },
      adx_threshold: { min: 20, max: 35, stepSize: 5 },
      pullback_threshold: { min: 0.001, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.02, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.015, max: 0.06, stepSize: 0.015 },
      risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
      take_profit_enabled: { min: 0, max: 1, stepSize: 1 },
      take_profit: { min: 0.05, max: 0.15, stepSize: 0.05 },
    },
    outputFile: 'strat_trend_following_ma_207.params.json',
  },
  mean_reversion_band_208: {
    class: MeanReversionBandV208Strategy,
    params: {
      bb_period: { min: 15, max: 30, stepSize: 5 },
      bb_stddev_mult: { min: 1.5, max: 2.5, stepSize: 0.25 },
      rsi_period: { min: 10, max: 20, stepSize: 2 },
      rsi_oversold: { min: 20, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 80, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.15, stepSize: 0.05 },
    },
    outputFile: 'strat_mean_reversion_band_208.params.json',
  },
  stoch_v20_tweak2_209: {
    class: StochV20Tweak2_209Strategy,
    params: {
      k_period: { min: 5, max: 14, stepSize: 1 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold_base: { min: 10, max: 25, stepSize: 5 },
      overbought_base: { min: 65, max: 80, stepSize: 5 },
      volatility_period: { min: 5, max: 15, stepSize: 2 },
      level_adjustment_factor: { min: 0.1, max: 0.5, stepSize: 0.1 },
      momentum_period: { min: 3, max: 10, stepSize: 1 },
      momentum_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_v20_tweak2_209.params.json',
  },
  mean_reversion_band2_210: {
    class: MeanReversionBand2_210Strategy,
    params: {
      bb_period: { min: 15, max: 30, stepSize: 5 },
      bb_stddev_mult: { min: 1.5, max: 2.5, stepSize: 0.25 },
      rsi_period: { min: 12, max: 22, stepSize: 2 },
      rsi_oversold: { min: 20, max: 35, stepSize: 5 },
      rsi_overbought: { min: 60, max: 75, stepSize: 5 },
      momentum_lookback: { min: 3, max: 8, stepSize: 1 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.05, max: 0.15, stepSize: 0.05 },
    },
    outputFile: 'strat_mean_reversion_band2_210.params.json',
  },
  stoch_v06_tweak2_211: {
    class: StochV06Tweak2_211Strategy,
    params: {
      k_period: { min: 5, max: 12, stepSize: 1 },
      d_period: { min: 2, max: 5, stepSize: 1 },
      oversold: { min: 15, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 85, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.25, stepSize: 0.05 },
      ma_period: { min: 20, max: 40, stepSize: 5 },
      mtf_fast_period: { min: 3, max: 8, stepSize: 1 },
      mtf_slow_period: { min: 10, max: 20, stepSize: 2 },
    },
    outputFile: 'strat_stoch_v06_tweak2_211.params.json',
  },
  momentum_vol_212: {
    class: MomentumVol212Strategy,
    params: {
      momentum_period: { min: 3, max: 10, stepSize: 1 },
      momentum_threshold: { min: 0.01, max: 0.04, stepSize: 0.005 },
      volatility_period: { min: 8, max: 16, stepSize: 2 },
      volatility_multiplier: { min: 1.0, max: 2.0, stepSize: 0.2 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_momentum_vol_212.params.json',
  },
  roc_adaptive_213: {
    class: RocAdaptive213Strategy,
    params: {
      roc_period: { min: 3, max: 10, stepSize: 1 },
      volatility_period: { min: 10, max: 20, stepSize: 2 },
      base_threshold: { min: 0.01, max: 0.03, stepSize: 0.005 },
      threshold_scale: { min: 1.5, max: 3.0, stepSize: 0.5 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_roc_adaptive_213.params.json',
  },
  keltner_breakout_214: {
    class: KeltnerBreakout214Strategy,
    params: {
      ema_period: { min: 15, max: 30, stepSize: 5 },
      atr_period: { min: 10, max: 18, stepSize: 2 },
      atr_multiplier: { min: 1.5, max: 3.0, stepSize: 0.25 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_keltner_breakout_214.params.json',
  },
  macd_stoch_combo_215: {
    class: MacdStochCombo215Strategy,
    params: {
      macd_fast: { min: 8, max: 16, stepSize: 2 },
      macd_slow: { min: 20, max: 30, stepSize: 2 },
      macd_signal: { min: 6, max: 12, stepSize: 2 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 2, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 65, max: 80, stepSize: 5 },
      signal_window: { min: 2, max: 5, stepSize: 1 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_macd_stoch_combo_215.params.json',
  },
  support_resistance_stoch_216: {
    class: SupportResistanceStoch216Strategy,
    params: {
      lookback: { min: 15, max: 30, stepSize: 5 },
      bounce_threshold: { min: 0.01, max: 0.03, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 2, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 65, max: 80, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.08, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_support_resistance_stoch_216.params.json',
  },
  momentum_vol_tweak_217: {
    class: MomentumVolTweak217Strategy,
    params: {
      momentum_period: { min: 5, max: 12, stepSize: 1 },
      momentum_threshold: { min: 0.02, max: 0.05, stepSize: 0.005 },
      volatility_period: { min: 12, max: 20, stepSize: 2 },
      volatility_multiplier: { min: 0.8, max: 1.5, stepSize: 0.1 },
      ema_period: { min: 15, max: 30, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.06, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.15, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_momentum_vol_tweak_217.params.json',
  },
  support_resistance_tweak_218: {
    class: SupportResistanceTweak218Strategy,
    params: {
      lookback: { min: 10, max: 25, stepSize: 5 },
      bounce_threshold: { min: 0.015, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 12, max: 20, stepSize: 2 },
      stoch_d_period: { min: 2, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.15, max: 0.25, stepSize: 0.05 },
    },
    outputFile: 'strat_support_resistance_tweak_218.params.json',
  },
  keltner_tweak_219: {
    class: KeltnerTweak219Strategy,
    params: {
      ema_period: { min: 18, max: 35, stepSize: 3 },
      atr_period: { min: 8, max: 16, stepSize: 2 },
      atr_multiplier: { min: 2.0, max: 3.5, stepSize: 0.25 },
      momentum_period: { min: 3, max: 8, stepSize: 1 },
      momentum_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.03, max: 0.06, stepSize: 0.01 },
      trailing_stop: { min: 0.015, max: 0.035, stepSize: 0.005 },
      risk_percent: { min: 0.08, max: 0.15, stepSize: 0.02 },
    },
    outputFile: 'strat_keltner_tweak_219.params.json',
  },
  dual_momentum_220: {
    class: DualMomentum220Strategy,
    params: {
      fast_period: { min: 3, max: 8, stepSize: 1 },
      slow_period: { min: 10, max: 20, stepSize: 2 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      momentum_threshold: { min: 0.015, max: 0.03, stepSize: 0.005 },
      vol_adj_factor: { min: 0.3, max: 0.8, stepSize: 0.1 },
      stop_loss: { min: 0.03, max: 0.07, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.04, stepSize: 0.005 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_dual_momentum_220.params.json',
  },
  price_range_breakout_221: {
    class: PriceRangeBreakout221Strategy,
    params: {
      lookback: { min: 10, max: 25, stepSize: 5 },
      range_threshold: { min: 0.02, max: 0.05, stepSize: 0.01 },
      breakout_multiplier: { min: 1.1, max: 1.4, stepSize: 0.1 },
      stop_loss: { min: 0.03, max: 0.07, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.04, stepSize: 0.005 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_price_range_breakout_221.params.json',
  },
  velocity_222: {
    class: Velocity222Strategy,
    params: {
      velocity_period: { min: 3, max: 8, stepSize: 1 },
      acceleration_period: { min: 2, max: 5, stepSize: 1 },
      velocity_threshold: { min: 0.01, max: 0.025, stepSize: 0.005 },
      acceleration_threshold: { min: 0.003, max: 0.01, stepSize: 0.002 },
      stop_loss: { min: 0.03, max: 0.07, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.04, stepSize: 0.005 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_velocity_222.params.json',
  },
  triple_ema_223: {
    class: TripleEMA223Strategy,
    params: {
      fast_period: { min: 3, max: 8, stepSize: 1 },
      medium_period: { min: 10, max: 18, stepSize: 2 },
      slow_period: { min: 20, max: 35, stepSize: 5 },
      stop_loss: { min: 0.03, max: 0.07, stepSize: 0.01 },
      trailing_stop: { min: 0.02, max: 0.04, stepSize: 0.005 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_triple_ema_223.params.json',
  },
  mean_rev_momentum_224: {
    class: MeanRevMomentum224Strategy,
    params: {
      lookback: { min: 15, max: 30, stepSize: 5 },
      oversold_percentile: { min: 15, max: 30, stepSize: 5 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.01, stepSize: 0.002 },
      stop_loss: { min: 0.03, max: 0.07, stepSize: 0.01 },
      take_profit: { min: 0.06, max: 0.12, stepSize: 0.02 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_mean_rev_momentum_224.params.json',
  },
  sr_adaptive_225: {
    class: SRAdaptive225Strategy,
    params: {
      base_lookback: { min: 10, max: 25, stepSize: 5 },
      min_lookback: { min: 5, max: 10, stepSize: 2 },
      max_lookback: { min: 25, max: 40, stepSize: 5 },
      volatility_period: { min: 8, max: 16, stepSize: 4 },
      bounce_threshold: { min: 0.02, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_sr_adaptive_225.params.json',
  },
  sr_multi_exit_226: {
    class: SRMultiExit226Strategy,
    params: {
      lookback: { min: 10, max: 20, stepSize: 5 },
      bounce_threshold: { min: 0.02, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.05 },
      max_hold_bars: { min: 30, max: 80, stepSize: 10 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_sr_multi_exit_226.params.json',
  },
  sr_momentum_filter_227: {
    class: SRMomentumFilter227Strategy,
    params: {
      lookback: { min: 10, max: 20, stepSize: 5 },
      bounce_threshold: { min: 0.02, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      momentum_period: { min: 3, max: 8, stepSize: 1 },
      momentum_min: { min: 0.003, max: 0.01, stepSize: 0.002 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_sr_momentum_filter_227.params.json',
  },
  pivot_point_228: {
    class: PivotPoint228Strategy,
    params: {
      pivot_period: { min: 15, max: 30, stepSize: 5 },
      bounce_threshold: { min: 0.015, max: 0.04, stepSize: 0.01 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_pivot_point_228.params.json',
  },
  range_mean_revert_229: {
    class: RangeMeanRevert229Strategy,
    params: {
      lookback: { min: 20, max: 35, stepSize: 5 },
      range_percentile: { min: 0.08, max: 0.15, stepSize: 0.02 },
      oversold_percentile: { min: 0.10, max: 0.25, stepSize: 0.05 },
      overbought_percentile: { min: 0.75, max: 0.90, stepSize: 0.05 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_range_mean_revert_229.params.json',
  },
  breakout_confirmation_230: {
    class: BreakoutConfirmation230Strategy,
    params: {
      lookback: { min: 15, max: 25, stepSize: 5 },
      breakout_threshold: { min: 0.01, max: 0.025, stepSize: 0.005 },
      volatility_period: { min: 8, max: 16, stepSize: 4 },
      volatility_multiplier: { min: 1.1, max: 1.5, stepSize: 0.1 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_breakout_confirmation_230.params.json',
  },
  stoch_rsi_231: {
    class: StochRSI231Strategy,
    params: {
      rsi_period: { min: 10, max: 18, stepSize: 2 },
      stoch_period: { min: 10, max: 18, stepSize: 2 },
      k_smooth: { min: 2, max: 4, stepSize: 1 },
      d_smooth: { min: 2, max: 4, stepSize: 1 },
      oversold: { min: 15, max: 30, stepSize: 5 },
      overbought: { min: 70, max: 85, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_stoch_rsi_231.params.json',
  },
  channel_breakout_232: {
    class: ChannelBreakout232Strategy,
    params: {
      channel_period: { min: 15, max: 30, stepSize: 5 },
      entry_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      confirmation_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_channel_breakout_232.params.json',
  },

  // ITERATION_6 strategies (233-240)
  sr_adaptive_tweak_233: {
    class: SRAdaptiveTweak233Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 30, max: 50, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      base_bounce_threshold: { min: 0.02, max: 0.05, stepSize: 0.01 },
      vol_bounce_scale: { min: 1.0, max: 2.5, stepSize: 0.5 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.02 },
      risk_percent: { min: 0.12, max: 0.20, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_adaptive_tweak_233.params.json',
  },
  sr_adaptive_multi_exit_234: {
    class: SRAdaptiveMultiExit234Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.02 },
      profit_target: { min: 0.08, max: 0.16, stepSize: 0.02 },
      max_hold_bars: { min: 30, max: 70, stepSize: 10 },
      risk_percent: { min: 0.12, max: 0.20, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_adaptive_multi_exit_234.params.json',
  },
  sr_adaptive_momentum_235: {
    class: SRAdaptiveMomentum235Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      momentum_period: { min: 3, max: 8, stepSize: 1 },
      momentum_min: { min: 0.003, max: 0.01, stepSize: 0.002 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.02 },
      risk_percent: { min: 0.12, max: 0.20, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_adaptive_momentum_235.params.json',
  },
  rsi_adaptive_support_236: {
    class: RSIAdaptiveSupport236Strategy,
    params: {
      rsi_period: { min: 10, max: 20, stepSize: 2 },
      rsi_oversold: { min: 25, max: 40, stepSize: 5 },
      rsi_overbought: { min: 60, max: 75, stepSize: 5 },
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.02 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_rsi_adaptive_support_236.params.json',
  },
  dynamic_stoch_237: {
    class: DynamicStoch237Strategy,
    params: {
      lookback: { min: 15, max: 30, stepSize: 5 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      base_oversold: { min: 20, max: 35, stepSize: 5 },
      base_overbought: { min: 65, max: 80, stepSize: 5 },
      vol_period: { min: 8, max: 16, stepSize: 2 },
      vol_scale: { min: 50, max: 150, stepSize: 25 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.02 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_dynamic_stoch_237.params.json',
  },
  volatility_sizing_238: {
    class: VolatilitySizing238Strategy,
    params: {
      lookback: { min: 15, max: 30, stepSize: 5 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      vol_period: { min: 8, max: 16, stepSize: 2 },
      base_risk: { min: 0.10, max: 0.20, stepSize: 0.05 },
      min_risk: { min: 0.05, max: 0.12, stepSize: 0.02 },
      max_risk: { min: 0.20, max: 0.35, stepSize: 0.05 },
      vol_scale: { min: 1.5, max: 3.0, stepSize: 0.5 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.02 },
    },
    outputFile: 'strat_volatility_sizing_238.params.json',
  },
  atr_trailing_239: {
    class: ATRTrailing239Strategy,
    params: {
      lookback: { min: 15, max: 30, stepSize: 5 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      atr_period: { min: 10, max: 20, stepSize: 2 },
      atr_multiplier: { min: 1.5, max: 3.0, stepSize: 0.5 },
      stop_loss: { min: 0.06, max: 0.14, stepSize: 0.02 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_atr_trailing_239.params.json',
  },
  multi_timeframe_sr_240: {
    class: MultiTimeframeSR240Strategy,
    params: {
      short_lookback: { min: 6, max: 15, stepSize: 3 },
      long_lookback: { min: 20, max: 40, stepSize: 5 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.02 },
      risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
    },
    outputFile: 'strat_multi_timeframe_sr_240.params.json',
  },

  // ITERATION_7 strategies (241-248)
  sr_multi_exit_tweak_241: {
    class: SRMultiExitTweak241Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 60, max: 75, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.02 },
      profit_target: { min: 0.06, max: 0.14, stepSize: 0.02 },
      max_hold_bars: { min: 25, max: 50, stepSize: 5 },
      risk_percent: { min: 0.14, max: 0.22, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_multi_exit_tweak_241.params.json',
  },
  sr_adaptive_tweak2_242: {
    class: SRAdaptiveTweak2_242Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 35, max: 50, stepSize: 5 },
      volatility_period: { min: 8, max: 16, stepSize: 2 },
      base_bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      vol_bounce_scale: { min: 1.5, max: 3.0, stepSize: 0.5 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 65, max: 80, stepSize: 5 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.14, max: 0.22, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_adaptive_tweak2_242.params.json',
  },
  sr_momentum_tweak_243: {
    class: SRMomentumTweak243Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 35, max: 50, stepSize: 5 },
      volatility_period: { min: 8, max: 16, stepSize: 2 },
      bounce_threshold: { min: 0.03, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 22, max: 35, stepSize: 4 },
      stoch_overbought: { min: 62, max: 75, stepSize: 4 },
      momentum_period: { min: 3, max: 6, stepSize: 1 },
      momentum_min: { min: 0.002, max: 0.008, stepSize: 0.002 },
      stop_loss: { min: 0.07, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.14, max: 0.20, stepSize: 0.03 },
    },
    outputFile: 'strat_sr_momentum_tweak_243.params.json',
  },
  sr_multi_momentum_244: {
    class: SRMultiMomentum244Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.03, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 22, max: 35, stepSize: 4 },
      stoch_overbought: { min: 62, max: 75, stepSize: 4 },
      momentum_period: { min: 3, max: 6, stepSize: 1 },
      momentum_min: { min: 0.002, max: 0.008, stepSize: 0.002 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.06, max: 0.14, stepSize: 0.02 },
      max_hold_bars: { min: 30, max: 60, stepSize: 10 },
      risk_percent: { min: 0.14, max: 0.20, stepSize: 0.03 },
    },
    outputFile: 'strat_sr_multi_momentum_244.params.json',
  },
  sr_rsi_confirm_245: {
    class: SRRSIConfirm245Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      rsi_period: { min: 10, max: 18, stepSize: 2 },
      rsi_oversold: { min: 30, max: 45, stepSize: 5 },
      rsi_overbought: { min: 60, max: 75, stepSize: 5 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 25, max: 40, stepSize: 5 },
      stoch_overbought: { min: 65, max: 80, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.12, max: 0.20, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_rsi_confirm_245.params.json',
  },
  sr_asymmetric_246: {
    class: SRAsymmetric246Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 65, max: 80, stepSize: 5 },
      stop_loss: { min: 0.04, max: 0.08, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.06, stepSize: 0.01 },
      target_multiplier: { min: 2.0, max: 3.5, stepSize: 0.5 },
      risk_percent: { min: 0.12, max: 0.20, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_asymmetric_246.params.json',
  },
  sr_trend_strength_247: {
    class: SRTrendStrength247Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 35, stepSize: 5 },
      stoch_overbought: { min: 65, max: 80, stepSize: 5 },
      trend_period: { min: 15, max: 30, stepSize: 5 },
      trend_threshold: { min: -0.04, max: 0.00, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.12, max: 0.20, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_trend_strength_247.params.json',
  },
  sr_double_confirm_248: {
    class: SRDoubleConfirm248Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 22, max: 35, stepSize: 4 },
      stoch_overbought: { min: 62, max: 75, stepSize: 4 },
      bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.08, max: 0.16, stepSize: 0.02 },
      risk_percent: { min: 0.14, max: 0.20, stepSize: 0.03 },
    },
    outputFile: 'strat_sr_double_confirm_248.params.json',
  },

  sr_trend_strict_249: {
    class: SRTrendStrict249Strategy,
    params: {
      base_lookback: { min: 15, max: 30, stepSize: 5 },
      min_lookback: { min: 5, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 45, stepSize: 5 },
      volatility_period: { min: 8, max: 15, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.05, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 18, max: 32, stepSize: 4 },
      stoch_overbought: { min: 65, max: 78, stepSize: 4 },
      trend_period: { min: 18, max: 35, stepSize: 5 },
      trend_threshold: { min: 0.0, max: 0.03, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.12, max: 0.20, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_trend_strict_249.params.json',
  },

  sr_multi_trend_250: {
    class: SRMultiTrend250Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.045, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 30, stepSize: 5 },
      stoch_overbought: { min: 60, max: 72, stepSize: 4 },
      trend_period: { min: 15, max: 28, stepSize: 4 },
      trend_threshold: { min: -0.03, max: 0.0, stepSize: 0.01 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.06, stepSize: 0.01 },
      profit_target: { min: 0.08, max: 0.14, stepSize: 0.02 },
      max_hold_bars: { min: 25, max: 45, stepSize: 5 },
      risk_percent: { min: 0.14, max: 0.20, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_multi_trend_250.params.json',
  },

  sr_adaptive_target_251: {
    class: SRAdaptiveTarget251Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 32, max: 48, stepSize: 5 },
      volatility_period: { min: 8, max: 16, stepSize: 2 },
      base_bounce_threshold: { min: 0.018, max: 0.035, stepSize: 0.005 },
      vol_bounce_scale: { min: 1.5, max: 2.8, stepSize: 0.4 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 30, stepSize: 5 },
      stoch_overbought: { min: 65, max: 78, stepSize: 4 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.08, max: 0.16, stepSize: 0.02 },
      risk_percent: { min: 0.14, max: 0.20, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_adaptive_target_251.params.json',
  },

  sr_momentum_trend_252: {
    class: SRMomentumTrend252Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.045, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 30, stepSize: 5 },
      stoch_overbought: { min: 65, max: 78, stepSize: 4 },
      momentum_period: { min: 3, max: 8, stepSize: 1 },
      momentum_threshold: { min: 0.002, max: 0.01, stepSize: 0.002 },
      trend_period: { min: 15, max: 28, stepSize: 4 },
      trend_threshold: { min: -0.02, max: 0.01, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.13, max: 0.20, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_momentum_trend_252.params.json',
  },

  sr_triple_confirm_253: {
    class: SRTripleConfirm253Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 25, stepSize: 5 },
      stoch_overbought: { min: 70, max: 82, stepSize: 4 },
      momentum_period: { min: 3, max: 7, stepSize: 2 },
      momentum_threshold: { min: 0.001, max: 0.006, stepSize: 0.001 },
      trend_period: { min: 18, max: 32, stepSize: 4 },
      trend_threshold: { min: -0.02, max: 0.01, stepSize: 0.01 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.06, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.03 },
      risk_percent: { min: 0.15, max: 0.22, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_triple_confirm_253.params.json',
  },

  sr_range_vol_254: {
    class: SRRangeVol254Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.045, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 30, stepSize: 5 },
      stoch_overbought: { min: 65, max: 78, stepSize: 4 },
      range_period: { min: 6, max: 15, stepSize: 3 },
      range_multiplier: { min: 1.0, max: 1.6, stepSize: 0.2 },
      trend_period: { min: 15, max: 28, stepSize: 4 },
      trend_threshold: { min: -0.03, max: 0.0, stepSize: 0.01 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.13, max: 0.20, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_range_vol_254.params.json',
  },

  sr_long_trend_255: {
    class: SRLongTrend255Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.045, stepSize: 0.01 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 30, stepSize: 5 },
      stoch_overbought: { min: 65, max: 78, stepSize: 4 },
      short_trend_period: { min: 6, max: 15, stepSize: 3 },
      long_trend_period: { min: 30, max: 55, stepSize: 5 },
      short_trend_threshold: { min: -0.03, max: 0.0, stepSize: 0.01 },
      long_trend_threshold: { min: -0.08, max: -0.02, stepSize: 0.02 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.13, max: 0.20, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_long_trend_255.params.json',
  },

  sr_strict_entry_256: {
    class: SRStrictEntry256Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.018, max: 0.035, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 25, stepSize: 5 },
      stoch_overbought: { min: 70, max: 82, stepSize: 4 },
      trend_period: { min: 15, max: 28, stepSize: 4 },
      trend_threshold: { min: -0.01, max: 0.02, stepSize: 0.01 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.002, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.06, stepSize: 0.01 },
      risk_percent: { min: 0.16, max: 0.24, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_strict_entry_256.params.json',
  },
  sr_strict_loose_257: {
    class: SRStrictLoose257Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 22, max: 35, stepSize: 4 },
      stoch_overbought: { min: 68, max: 80, stepSize: 4 },
      trend_period: { min: 15, max: 28, stepSize: 4 },
      trend_threshold: { min: -0.02, max: 0.01, stepSize: 0.01 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.002, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.14, max: 0.26, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_strict_loose_257.params.json',
  },
  sr_strict_momentum_258: {
    class: SRStrictMomentum258Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.018, max: 0.038, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 18, max: 32, stepSize: 4 },
      stoch_overbought: { min: 70, max: 82, stepSize: 4 },
      trend_period: { min: 18, max: 32, stepSize: 4 },
      trend_threshold: { min: -0.02, max: 0.005, stepSize: 0.008 },
      momentum_period: { min: 2, max: 6, stepSize: 1 },
      momentum_threshold: { min: 0.001, max: 0.005, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_strict_momentum_258.params.json',
  },
  sr_trend_multi_exit_259: {
    class: SRTrendMultiExit259Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.025, max: 0.045, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 18, max: 32, stepSize: 4 },
      stoch_overbought: { min: 66, max: 78, stepSize: 4 },
      trend_period: { min: 18, max: 32, stepSize: 4 },
      trend_threshold: { min: 0.002, max: 0.02, stepSize: 0.006 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.08, max: 0.18, stepSize: 0.02 },
      max_hold_bars: { min: 25, max: 55, stepSize: 10 },
      risk_percent: { min: 0.12, max: 0.24, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_trend_multi_exit_259.params.json',
  },
  sr_strict_multi_exit_260: {
    class: SRStrictMultiExit260Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.015, max: 0.035, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 16, max: 28, stepSize: 4 },
      stoch_overbought: { min: 70, max: 82, stepSize: 4 },
      trend_period: { min: 16, max: 28, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.01, stepSize: 0.008 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.009, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.02 },
      max_hold_bars: { min: 25, max: 45, stepSize: 10 },
      risk_percent: { min: 0.14, max: 0.26, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_strict_multi_exit_260.params.json',
  },
  sr_very_strict_261: {
    class: SRVeryStrict261Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.015, max: 0.030, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 12, max: 24, stepSize: 4 },
      stoch_overbought: { min: 74, max: 86, stepSize: 4 },
      trend_period: { min: 15, max: 28, stepSize: 4 },
      trend_threshold: { min: 0.0, max: 0.015, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.005, max: 0.012, stepSize: 0.002 },
      min_bounce_bars: { min: 2, max: 4, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.18, max: 0.30, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_very_strict_261.params.json',
  },
  sr_bounce_quality_262: {
    class: SRBounceQuality262Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 18, max: 32, stepSize: 4 },
      stoch_overbought: { min: 68, max: 80, stepSize: 4 },
      trend_period: { min: 15, max: 28, stepSize: 4 },
      trend_threshold: { min: -0.02, max: 0.01, stepSize: 0.01 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      min_bounce_gain: { min: 0.005, max: 0.02, stepSize: 0.005 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.14, max: 0.26, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_bounce_quality_262.params.json',
  },
  sr_weighted_trend_263: {
    class: SRWeightedTrend263Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 18, max: 32, stepSize: 4 },
      stoch_overbought: { min: 68, max: 80, stepSize: 4 },
      trend_period: { min: 15, max: 28, stepSize: 4 },
      trend_weight: { min: 0.4, max: 0.8, stepSize: 0.1 },
      momentum_period: { min: 3, max: 7, stepSize: 1 },
      momentum_weight: { min: 0.2, max: 0.6, stepSize: 0.1 },
      min_score: { min: 0.001, max: 0.006, stepSize: 0.001 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.12, max: 0.24, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_weighted_trend_263.params.json',
  },
  sr_adaptive_strict_264: {
    class: SRAdaptiveStrict264Strategy,
    params: {
      base_lookback: { min: 15, max: 28, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      base_bounce_threshold: { min: 0.015, max: 0.035, stepSize: 0.005 },
      vol_bounce_scale: { min: 1.2, max: 2.4, stepSize: 0.3 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      base_stoch_oversold: { min: 16, max: 28, stepSize: 4 },
      stoch_overbought: { min: 70, max: 82, stepSize: 4 },
      trend_period: { min: 16, max: 28, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.01, stepSize: 0.008 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.009, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      risk_percent: { min: 0.14, max: 0.26, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_adaptive_strict_264.params.json',
  },
  sr_multi_exit_high_pt_265: {
    class: SRMultiExitHighPT265Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 12, max: 20, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 28, stepSize: 4 },
      stoch_overbought: { min: 72, max: 84, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.005, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.01 },
      profit_target: { min: 0.15, max: 0.25, stepSize: 0.025 },
      max_hold_bars: { min: 35, max: 60, stepSize: 8 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_multi_exit_high_pt_265.params.json',
  },
  sr_multi_exit_short_hold_266: {
    class: SRMultiExitShortHold266Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 12, max: 20, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 28, stepSize: 4 },
      stoch_overbought: { min: 72, max: 84, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.005, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.01 },
      profit_target: { min: 0.08, max: 0.16, stepSize: 0.02 },
      max_hold_bars: { min: 15, max: 35, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_multi_exit_short_hold_266.params.json',
  },
  sr_multi_exit_tight_trail_267: {
    class: SRMultiExitTightTrail267Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 12, max: 20, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 28, stepSize: 4 },
      stoch_overbought: { min: 72, max: 84, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.005, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.025, max: 0.055, stepSize: 0.01 },
      profit_target: { min: 0.08, max: 0.16, stepSize: 0.02 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_multi_exit_tight_trail_267.params.json',
  },
  sr_adaptive_multi_exit_268: {
    class: SRAdaptiveMultiExit268Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 10, max: 18, stepSize: 2 },
      base_bounce_threshold: { min: 0.025, max: 0.045, stepSize: 0.005 },
      vol_bounce_scale: { min: 1.0, max: 2.0, stepSize: 0.2 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      base_stoch_oversold: { min: 15, max: 25, stepSize: 3 },
      stoch_overbought: { min: 72, max: 84, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.02, max: 0.0, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.006, max: 0.012, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      stop_loss: { min: 0.07, max: 0.12, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.08, max: 0.16, stepSize: 0.02 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.18, max: 0.30, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_adaptive_multi_exit_268.params.json',
  },
  sr_dynamic_pt_269: {
    class: SRDynamicPT269Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 12, max: 20, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 28, stepSize: 4 },
      stoch_overbought: { min: 72, max: 84, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.005, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.01 },
      base_profit_target: { min: 0.06, max: 0.14, stepSize: 0.02 },
      vol_pt_scale: { min: 1.0, max: 3.0, stepSize: 0.5 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_dynamic_pt_269.params.json',
  },
  sr_tiered_exit_270: {
    class: SRTieredExit270Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 12, max: 20, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 28, stepSize: 4 },
      stoch_overbought: { min: 72, max: 84, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.005, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.01 },
      first_target: { min: 0.05, max: 0.10, stepSize: 0.015 },
      second_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
      first_exit_pct: { min: 0.3, max: 0.6, stepSize: 0.1 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_tiered_exit_270.params.json',
  },
  sr_momentum_exit_271: {
    class: SRMomentumExit271Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 12, max: 20, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 28, stepSize: 4 },
      stoch_overbought: { min: 72, max: 84, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.005, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      base_trailing_stop: { min: 0.05, max: 0.09, stepSize: 0.01 },
      momentum_trail_scale: { min: 0.3, max: 0.7, stepSize: 0.1 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.025 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_momentum_exit_271.params.json',
  },
  sr_rsi_exit_272: {
    class: SRRsiExit272Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 4, max: 10, stepSize: 2 },
      max_lookback: { min: 28, max: 42, stepSize: 5 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 12, max: 20, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 15, max: 28, stepSize: 4 },
      stoch_overbought: { min: 72, max: 84, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.005, stepSize: 0.005 },
      momentum_period: { min: 2, max: 5, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 2, stepSize: 1 },
      rsi_period: { min: 10, max: 18, stepSize: 2 },
      rsi_overbought: { min: 65, max: 80, stepSize: 5 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.025 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_rsi_exit_272.params.json',
  },

  sr_tight_strict_combo_273: {
    class: SRTightStrictCombo273Strategy,
    params: {
      base_lookback: { min: 12, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 50, stepSize: 5 },
      volatility_period: { min: 6, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 16, max: 28, stepSize: 4 },
      stoch_overbought: { min: 70, max: 85, stepSize: 5 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.0, stepSize: 0.005 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.03, max: 0.05, stepSize: 0.005 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.025 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_tight_strict_combo_273.params.json',
  },

  sr_stoch_wide_274: {
    class: SRStochWide274Strategy,
    params: {
      base_lookback: { min: 12, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 50, stepSize: 5 },
      volatility_period: { min: 6, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 8, max: 18, stepSize: 2 },
      stoch_overbought: { min: 82, max: 92, stepSize: 2 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.0, stepSize: 0.005 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.025 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_stoch_wide_274.params.json',
  },

  sr_stoch_narrow_275: {
    class: SRStochNarrow275Strategy,
    params: {
      base_lookback: { min: 12, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 50, stepSize: 5 },
      volatility_period: { min: 6, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 28, max: 40, stepSize: 4 },
      stoch_overbought: { min: 58, max: 72, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.0, stepSize: 0.005 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.025 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_stoch_narrow_275.params.json',
  },

  sr_long_trend_276: {
    class: SRLongTrend276Strategy,
    params: {
      base_lookback: { min: 16, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 12, stepSize: 2 },
      max_lookback: { min: 40, max: 60, stepSize: 5 },
      volatility_period: { min: 6, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 16, max: 28, stepSize: 4 },
      stoch_overbought: { min: 70, max: 85, stepSize: 5 },
      trend_period: { min: 40, max: 64, stepSize: 8 },
      trend_threshold: { min: -0.015, max: 0.0, stepSize: 0.005 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.025 },
      max_hold_bars: { min: 35, max: 55, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_long_trend_276.params.json',
  },

  sr_double_confirm_277: {
    class: SRDoubleConfirm277Strategy,
    params: {
      base_lookback: { min: 12, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 50, stepSize: 5 },
      volatility_period: { min: 6, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 20, max: 32, stepSize: 4 },
      stoch_overbought: { min: 68, max: 82, stepSize: 4 },
      rsi_period: { min: 10, max: 18, stepSize: 2 },
      rsi_oversold: { min: 28, max: 42, stepSize: 4 },
      rsi_overbought: { min: 58, max: 72, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.0, stepSize: 0.005 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.025 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_double_confirm_277.params.json',
  },

  sr_time_exit_278: {
    class: SRTimeExit278Strategy,
    params: {
      base_lookback: { min: 12, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 50, stepSize: 5 },
      volatility_period: { min: 6, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 16, max: 28, stepSize: 4 },
      stoch_overbought: { min: 70, max: 85, stepSize: 5 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.0, stepSize: 0.005 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      exit_bar: { min: 20, max: 40, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_time_exit_278.params.json',
  },

  sr_vol_filter_279: {
    class: SRVolFilter279Strategy,
    params: {
      base_lookback: { min: 12, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 50, stepSize: 5 },
      volatility_period: { min: 6, max: 14, stepSize: 2 },
      max_volatility: { min: 0.04, max: 0.12, stepSize: 0.02 },
      bounce_threshold: { min: 0.02, max: 0.04, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 16, max: 28, stepSize: 4 },
      stoch_overbought: { min: 70, max: 85, stepSize: 5 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: -0.015, max: 0.0, stepSize: 0.005 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.10, max: 0.20, stepSize: 0.025 },
      max_hold_bars: { min: 30, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_vol_filter_279.params.json',
  },

  sr_breakout_entry_280: {
    class: SRBreakoutEntry280Strategy,
    params: {
      base_lookback: { min: 12, max: 28, stepSize: 4 },
      min_lookback: { min: 4, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 50, stepSize: 5 },
      volatility_period: { min: 6, max: 14, stepSize: 2 },
      breakout_threshold: { min: 0.01, max: 0.03, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_min: { min: 30, max: 50, stepSize: 5 },
      stoch_overbought: { min: 80, max: 92, stepSize: 4 },
      trend_period: { min: 18, max: 30, stepSize: 4 },
      trend_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.005, max: 0.015, stepSize: 0.002 },
      stop_loss: { min: 0.04, max: 0.08, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.06, stepSize: 0.01 },
      profit_target: { min: 0.08, max: 0.16, stepSize: 0.02 },
      max_hold_bars: { min: 20, max: 40, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_breakout_entry_280.params.json',
  },

  sr_wide_multi_exit_281: {
    class: SRWideMultiExit281Strategy,
    params: {
      base_lookback: { min: 12, max: 24, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 32, max: 48, stepSize: 4 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.035, stepSize: 0.005 },
      stoch_k_period: { min: 10, max: 16, stepSize: 2 },
      stoch_d_period: { min: 2, max: 4, stepSize: 1 },
      stoch_oversold: { min: 12, max: 22, stepSize: 2 },
      stoch_overbought: { min: 82, max: 92, stepSize: 2 },
      trend_period: { min: 20, max: 30, stepSize: 2 },
      trend_threshold: { min: -0.01, max: -0.004, stepSize: 0.002 },
      momentum_period: { min: 1, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.004, max: 0.01, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.12, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 45, stepSize: 5 },
      risk_percent: { min: 0.18, max: 0.3, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_wide_multi_exit_281.params.json',
  },

  sr_very_wide_stoch_282: {
    class: SRVeryWideStoch282Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 34, max: 46, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.032, stepSize: 0.004 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 8, max: 14, stepSize: 2 },
      stoch_overbought: { min: 88, max: 95, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.008, max: -0.004, stepSize: 0.002 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.004, max: 0.009, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.13, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 48, stepSize: 4 },
      risk_percent: { min: 0.18, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_very_wide_stoch_282.params.json',
  },

  sr_wide_tight_trail_283: {
    class: SRWideTightTrail283Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 32, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.032, stepSize: 0.004 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 10, max: 20, stepSize: 2 },
      stoch_overbought: { min: 84, max: 92, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.008, max: -0.003, stepSize: 0.001 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.025, max: 0.045, stepSize: 0.005 },
      profit_target: { min: 0.1, max: 0.18, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 42, stepSize: 4 },
      risk_percent: { min: 0.16, max: 0.26, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_wide_tight_trail_283.params.json',
  },

  sr_wide_short_k_284: {
    class: SRWideShortK284Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.032, stepSize: 0.004 },
      stoch_k_period: { min: 6, max: 12, stepSize: 2 },
      stoch_d_period: { min: 2, max: 4, stepSize: 1 },
      stoch_oversold: { min: 10, max: 20, stepSize: 2 },
      stoch_overbought: { min: 84, max: 92, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.008, max: -0.003, stepSize: 0.001 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.12, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 42, stepSize: 4 },
      risk_percent: { min: 0.16, max: 0.26, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_wide_short_k_284.params.json',
  },

  sr_wide_long_k_285: {
    class: SRWideLongK285Strategy,
    params: {
      base_lookback: { min: 16, max: 26, stepSize: 4 },
      min_lookback: { min: 8, max: 14, stepSize: 2 },
      max_lookback: { min: 34, max: 48, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.034, stepSize: 0.004 },
      stoch_k_period: { min: 16, max: 24, stepSize: 2 },
      stoch_d_period: { min: 4, max: 6, stepSize: 1 },
      stoch_oversold: { min: 10, max: 20, stepSize: 2 },
      stoch_overbought: { min: 84, max: 92, stepSize: 2 },
      trend_period: { min: 20, max: 30, stepSize: 2 },
      trend_threshold: { min: -0.009, max: -0.004, stepSize: 0.001 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.004, max: 0.009, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.12, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 32, max: 48, stepSize: 4 },
      risk_percent: { min: 0.18, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_wide_long_k_285.params.json',
  },

  sr_wide_long_hold_286: {
    class: SRWideLongHold286Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 32, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.032, stepSize: 0.004 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 10, max: 20, stepSize: 2 },
      stoch_overbought: { min: 84, max: 92, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.008, max: -0.003, stepSize: 0.001 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.04, max: 0.07, stepSize: 0.01 },
      profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
      max_hold_bars: { min: 45, max: 70, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.26, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_wide_long_hold_286.params.json',
  },

  sr_wide_higher_pt_287: {
    class: SRWideHigherPT287Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 32, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.032, stepSize: 0.004 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 10, max: 20, stepSize: 2 },
      stoch_overbought: { min: 84, max: 92, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.008, max: -0.003, stepSize: 0.001 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.05, max: 0.08, stepSize: 0.01 },
      profit_target: { min: 0.18, max: 0.28, stepSize: 0.02 },
      max_hold_bars: { min: 35, max: 50, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.26, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_wide_higher_pt_287.params.json',
  },

  sr_wide_lower_stop_288: {
    class: SRWideLowerStop288Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 4 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 32, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.032, stepSize: 0.004 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 10, max: 20, stepSize: 2 },
      stoch_overbought: { min: 84, max: 92, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.008, max: -0.003, stepSize: 0.001 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.035, max: 0.06, stepSize: 0.005 },
      trailing_stop: { min: 0.025, max: 0.05, stepSize: 0.005 },
      profit_target: { min: 0.12, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 42, stepSize: 4 },
      risk_percent: { min: 0.18, max: 0.28, stepSize: 0.02 },
    },
    outputFile: 'strat_sr_wide_lower_stop_288.params.json',
  },

  sr_moderate_multi_exit_289: {
    class: SRModerateMultiExit289Strategy,
    params: {
      base_lookback: { min: 12, max: 22, stepSize: 2 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 32, max: 48, stepSize: 4 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.036, stepSize: 0.004 },
      stoch_k_period: { min: 10, max: 16, stepSize: 2 },
      stoch_d_period: { min: 2, max: 4, stepSize: 1 },
      stoch_oversold: { min: 16, max: 26, stepSize: 2 },
      stoch_overbought: { min: 78, max: 88, stepSize: 2 },
      trend_period: { min: 18, max: 30, stepSize: 3 },
      trend_threshold: { min: -0.01, max: -0.004, stepSize: 0.002 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.01, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.035, max: 0.075, stepSize: 0.01 },
      profit_target: { min: 0.1, max: 0.22, stepSize: 0.03 },
      max_hold_bars: { min: 25, max: 45, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.32, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_moderate_multi_exit_289.params.json',
  },

  sr_moderate_looser_290: {
    class: SRModerateLooser290Strategy,
    params: {
      base_lookback: { min: 12, max: 22, stepSize: 2 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 32, max: 48, stepSize: 4 },
      volatility_period: { min: 6, max: 12, stepSize: 2 },
      bounce_threshold: { min: 0.022, max: 0.04, stepSize: 0.004 },
      stoch_k_period: { min: 10, max: 16, stepSize: 2 },
      stoch_d_period: { min: 2, max: 4, stepSize: 1 },
      stoch_oversold: { min: 18, max: 28, stepSize: 2 },
      stoch_overbought: { min: 76, max: 86, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.012, max: -0.004, stepSize: 0.002 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.06, max: 0.1, stepSize: 0.01 },
      trailing_stop: { min: 0.04, max: 0.08, stepSize: 0.01 },
      profit_target: { min: 0.12, max: 0.24, stepSize: 0.03 },
      max_hold_bars: { min: 28, max: 48, stepSize: 5 },
      risk_percent: { min: 0.16, max: 0.32, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_moderate_looser_290.params.json',
  },

  sr_moderate_tighter_291: {
    class: SRModerateTighter291Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 2 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 46, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.018, max: 0.034, stepSize: 0.004 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 2, max: 4, stepSize: 1 },
      stoch_oversold: { min: 14, max: 22, stepSize: 2 },
      stoch_overbought: { min: 80, max: 90, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.01, max: -0.003, stepSize: 0.002 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.004, max: 0.01, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.03, max: 0.06, stepSize: 0.01 },
      profit_target: { min: 0.1, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 25, max: 45, stepSize: 5 },
      risk_percent: { min: 0.14, max: 0.3, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_moderate_tighter_291.params.json',
  },

  sr_balanced_stoch_292: {
    class: SRBalancedStoch292Strategy,
    params: {
      base_lookback: { min: 16, max: 26, stepSize: 2 },
      min_lookback: { min: 8, max: 14, stepSize: 2 },
      max_lookback: { min: 28, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.018, max: 0.034, stepSize: 0.004 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 3, max: 5, stepSize: 1 },
      stoch_oversold: { min: 22, max: 32, stepSize: 2 },
      stoch_overbought: { min: 72, max: 82, stepSize: 2 },
      trend_period: { min: 16, max: 26, stepSize: 2 },
      trend_threshold: { min: -0.008, max: -0.002, stepSize: 0.002 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.002, max: 0.006, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.035, max: 0.065, stepSize: 0.01 },
      profit_target: { min: 0.1, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 44, stepSize: 4 },
      risk_percent: { min: 0.16, max: 0.3, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_balanced_stoch_292.params.json',
  },

  sr_no_momentum_filter_293: {
    class: SRNoMomentumFilter293Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 2 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.036, stepSize: 0.004 },
      stoch_k_period: { min: 10, max: 16, stepSize: 2 },
      stoch_d_period: { min: 2, max: 4, stepSize: 1 },
      stoch_oversold: { min: 18, max: 28, stepSize: 2 },
      stoch_overbought: { min: 76, max: 86, stepSize: 2 },
      trend_period: { min: 18, max: 28, stepSize: 2 },
      trend_threshold: { min: -0.01, max: -0.003, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.055, max: 0.095, stepSize: 0.01 },
      trailing_stop: { min: 0.035, max: 0.075, stepSize: 0.01 },
      profit_target: { min: 0.1, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 44, stepSize: 4 },
      risk_percent: { min: 0.18, max: 0.32, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_no_momentum_filter_293.params.json',
  },

  sr_simple_stoch_294: {
    class: SRSimpleStoch294Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 2 },
      min_lookback: { min: 8, max: 14, stepSize: 2 },
      max_lookback: { min: 28, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.018, max: 0.034, stepSize: 0.004 },
      stoch_k_period: { min: 12, max: 18, stepSize: 2 },
      stoch_d_period: { min: 2, max: 4, stepSize: 1 },
      stoch_oversold: { min: 20, max: 30, stepSize: 2 },
      stoch_overbought: { min: 74, max: 84, stepSize: 2 },
      stop_loss: { min: 0.05, max: 0.09, stepSize: 0.01 },
      trailing_stop: { min: 0.035, max: 0.065, stepSize: 0.01 },
      profit_target: { min: 0.1, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 44, stepSize: 4 },
      risk_percent: { min: 0.16, max: 0.3, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_simple_stoch_294.params.json',
  },

  sr_rsi_confirm_295: {
    class: SRRsiConfirm295Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 2 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 30, max: 46, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.036, stepSize: 0.004 },
      rsi_period: { min: 10, max: 18, stepSize: 2 },
      rsi_oversold: { min: 25, max: 38, stepSize: 3 },
      rsi_overbought: { min: 65, max: 78, stepSize: 3 },
      trend_period: { min: 16, max: 26, stepSize: 2 },
      trend_threshold: { min: -0.008, max: -0.002, stepSize: 0.002 },
      momentum_period: { min: 2, max: 4, stepSize: 1 },
      momentum_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.055, max: 0.095, stepSize: 0.01 },
      trailing_stop: { min: 0.035, max: 0.075, stepSize: 0.01 },
      profit_target: { min: 0.1, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 44, stepSize: 4 },
      risk_percent: { min: 0.16, max: 0.3, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_rsi_confirm_295.params.json',
  },

  sr_mixed_signals_296: {
    class: SRMixedSignals296Strategy,
    params: {
      base_lookback: { min: 14, max: 24, stepSize: 2 },
      min_lookback: { min: 6, max: 12, stepSize: 2 },
      max_lookback: { min: 28, max: 44, stepSize: 4 },
      volatility_period: { min: 8, max: 14, stepSize: 2 },
      bounce_threshold: { min: 0.02, max: 0.036, stepSize: 0.004 },
      stoch_k_period: { min: 10, max: 16, stepSize: 2 },
      stoch_d_period: { min: 2, max: 4, stepSize: 1 },
      stoch_oversold: { min: 22, max: 32, stepSize: 2 },
      stoch_overbought: { min: 72, max: 82, stepSize: 2 },
      rsi_period: { min: 12, max: 18, stepSize: 2 },
      rsi_oversold: { min: 30, max: 42, stepSize: 3 },
      rsi_overbought: { min: 62, max: 74, stepSize: 3 },
      trend_period: { min: 16, max: 26, stepSize: 2 },
      trend_threshold: { min: -0.01, max: -0.003, stepSize: 0.002 },
      min_bounce_bars: { min: 1, max: 3, stepSize: 1 },
      stop_loss: { min: 0.055, max: 0.095, stepSize: 0.01 },
      trailing_stop: { min: 0.035, max: 0.075, stepSize: 0.01 },
      profit_target: { min: 0.1, max: 0.2, stepSize: 0.02 },
      max_hold_bars: { min: 28, max: 44, stepSize: 4 },
      risk_percent: { min: 0.18, max: 0.32, stepSize: 0.04 },
    },
    outputFile: 'strat_sr_mixed_signals_296.params.json',
  },

};

function splitData(data: StoredData, trainRatio: number = 0.7): { train: StoredData; test: StoredData } {
  const allTimestamps: number[] = [];
  for (const history of data.priceHistory.values()) {
    for (const point of history) {
      allTimestamps.push(point.t);
    }
  }
  
  allTimestamps.sort((a, b) => a - b);
  const splitIndex = Math.floor(allTimestamps.length * trainRatio);
  const splitTime = allTimestamps[splitIndex];
  
  const trainPriceHistory = new Map<string, PricePoint[]>();
  const testPriceHistory = new Map<string, PricePoint[]>();
  
  for (const [tokenId, history] of data.priceHistory) {
    const trainPoints: PricePoint[] = [];
    const testPoints: PricePoint[] = [];
    
    for (const point of history) {
      if (point.t <= splitTime) {
        trainPoints.push(point);
      } else {
        testPoints.push(point);
      }
    }
    
    if (trainPoints.length > 0) {
      trainPriceHistory.set(tokenId, trainPoints);
    }
    if (testPoints.length > 0) {
      testPriceHistory.set(tokenId, testPoints);
    }
  }
  
  return {
    train: {
      markets: data.markets,
      priceHistory: trainPriceHistory,
      collectionMetadata: data.collectionMetadata,
    },
    test: {
      markets: data.markets,
      priceHistory: testPriceHistory,
      collectionMetadata: data.collectionMetadata,
    },
  };
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function testParams(data: StoredData, strategyClass: any, params: Record<string, number>): { return: number; sharpe: number; trades: number; stdDev: number } {
  // Simple direct evaluation without CV - simpler and works better with small datasets
  const strategy = new strategyClass(params);
  const engine = new BacktestEngine(data, strategy, { feeRate: 0.002 });
  
  const originalLog = console.log;
  console.log = () => {};
  
  try {
    const result = engine.run();
    return { 
      return: result.totalReturn, 
      sharpe: result.sharpeRatio, 
      trades: result.totalTrades, 
      stdDev: 0 
    };
  } finally {
    console.log = originalLog;
  }
}

function testParamsCV(data: StoredData, strategyClass: any, params: Record<string, number>, folds: number): { return: number; sharpe: number; trades: number; stdDev: number } {
  const tokens = Array.from(data.priceHistory.keys());
  const shuffled = seededShuffle(tokens, 42);
  const foldSize = Math.floor(shuffled.length / folds);
  
  let totalReturn = 0;
  let totalTrades = 0;
  const foldReturns: number[] = [];
  
  for (let fold = 0; fold < folds; fold++) {
    const valStart = fold * foldSize;
    const valEnd = fold === folds - 1 ? shuffled.length : (fold + 1) * foldSize;
    const valTokens = shuffled.slice(valStart, valEnd);
    const trainTokens = [...shuffled.slice(0, valStart), ...shuffled.slice(valEnd)];
    
    const trainData: StoredData = {
      ...data,
      priceHistory: new Map(trainTokens.map(t => [t, data.priceHistory.get(t)!])),
    };
    const valData: StoredData = {
      ...data,
      priceHistory: new Map(valTokens.map(t => [t, data.priceHistory.get(t)!])),
    };
    
    const trainResult = testParamsBatched(trainData, strategyClass, params, 50);
    const valResult = testParamsBatched(valData, strategyClass, params, 50);
    
    totalReturn += valResult.return;
    totalTrades += valResult.trades;
    foldReturns.push(valResult.return);
  }
  
  let stdDev = 0;
  if (foldReturns.length > 1) {
    const mean = foldReturns.reduce((a, b) => a + b, 0) / foldReturns.length;
    const variance = foldReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / foldReturns.length;
    stdDev = Math.sqrt(variance);
  }
  
  return { return: totalReturn / folds, sharpe: 0, trades: Math.floor(totalTrades / folds), stdDev };
}

function testParamsBatched(data: StoredData, strategyClass: any, params: Record<string, number>, batchSize: number): { return: number; sharpe: number; trades: number; stdDev: number } {
  const tokens = Array.from(data.priceHistory.keys());
  const batches: string[][] = [];
  for (let i = 0; i < tokens.length; i += batchSize) {
    batches.push(tokens.slice(i, i + batchSize));
  }
  
  let totalReturn = 0;
  let totalTrades = 0;
  const batchReturns: number[] = [];
  
  for (const batchTokens of batches) {
    const batchData: StoredData = {
      ...data,
      priceHistory: new Map(batchTokens.map(t => [t, data.priceHistory.get(t)!])),
    };
    
    const strategy = new strategyClass(params);
    const engine = new BacktestEngine(batchData, strategy, { feeRate: 0.002 });
    
    const originalLog = console.log;
    console.log = () => {};
    
    try {
      const result = engine.run();
      totalReturn += result.totalReturn;
      totalTrades += result.totalTrades;
      batchReturns.push(result.totalReturn);
    } finally {
      console.log = originalLog;
    }
  }
  
  let stdDev = 0;
  if (batchReturns.length > 1) {
    const mean = batchReturns.reduce((a, b) => a + b, 0) / batchReturns.length;
    const variance = batchReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / batchReturns.length;
    stdDev = Math.sqrt(variance);
  }
  
  return { return: totalReturn, sharpe: 0, trades: totalTrades, stdDev };
}

const program = new Command();

program
  .name('optimize')
  .description('Differential Evolution Optimization for Trading Strategy')
  .option('-l, --list-strategies', 'List available strategies')
  .option('-s, --strategy <name>', 'Strategy to optimize', 'simple_ma')
  .option('-i, --max-iterations <number>', 'Maximum generations', '30')
  .option('-r, --random-samples <number>', 'Initial random samples', '50')
  .option('-d, --data <file>', 'Data file path', 'data/test-data.bson')
  .option('-m, --min-test-return <number>', 'Minimum test return to accept', '10')
  .option('-a, --attempts <number>', 'Number of optimization attempts', '5')
  .option('-t, --max-tokens <number>', 'Maximum number of tokens to use', '500')
  .action(async (options) => {
    if (options.listStrategies) {
      console.log(kleur.cyan('Available strategies:'));
      for (const [name, config] of Object.entries(strategies)) {
        console.log('  ' + kleur.green(name) + ' -> ' + config.outputFile);
      }
      process.exit(0);
    }
    
    if (options.plot) {
      const historyPath = path.join(process.cwd(), 'data', 'optimization-history.json');
      if (!fs.existsSync(historyPath)) {
        console.error(kleur.red('No optimization history found. Run optimize first.'));
        process.exit(1);
      }
      const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      
      console.log(kleur.cyan('Optimization Progress\n'));
      console.log('Generation | Sharpe Ratio');
      console.log('-'.repeat(30));
      for (const entry of historyData.history) {
        console.log(String(entry.iteration).padStart(10) + ' | ' + entry.sharpeRatio.toFixed(4));
      }
      console.log('-'.repeat(30));
      console.log('\nBest params:');
      for (const [k, v] of Object.entries(historyData.bestParams)) {
        if (k !== 'metadata') console.log('  ' + k + ': ' + v);
      }
      console.log('\nPerformance:');
      console.log('  Test Return: ' + historyData.finalMetrics.testReturn.toFixed(2) + ' (' + (historyData.finalMetrics.testReturn / 10).toFixed(1) + '%)');
      console.log('  Test Sharpe: ' + historyData.finalMetrics.testSharpe.toFixed(4));
      console.log('  Test Trades: ' + historyData.finalMetrics.testTrades);
      process.exit(0);
    }
    
    const strategyName = options.strategy;
    const strategyConfig = strategies[strategyName];
    
    if (!strategyConfig) {
      console.error(kleur.red('Unknown strategy: ' + strategyName));
      console.log(kleur.yellow('Available strategies:') + ' ' + Object.keys(strategies).join(', '));
      process.exit(1);
    }
    
    const StrategyClass = strategyConfig.class;
    const paramConfigs = strategyConfig.params;
    const outputFile = strategyConfig.outputFile;
    
    const maxIterations = parseInt(options.maxIterations);
    const randomSamples = parseInt(options.randomSamples);
    const dataFile = options.data;
    const minTestReturn = parseFloat(options.minTestReturn);
    const attempts = parseInt(options.attempts);
    const maxTokens = parseInt(options.maxTokens);

    console.log(kleur.cyan('Strategy:') + ' ' + strategyName);
    console.log(kleur.cyan('Loading data from:') + ' ' + dataFile);
    const fullData = loadStoredData(dataFile);
    console.log('Loaded ' + fullData.markets.length + ' markets');
    
    console.log(kleur.yellow('\nSplitting data: 70% train, 30% test (by time)...'));
    
    // Get all tokens and optionally limit them
    let allTokens = Array.from(fullData.priceHistory.keys());
    
    // If we have more tokens than maxTokens, shuffle and take first N
    if (allTokens.length > maxTokens) {
      allTokens = seededShuffle(allTokens, 42).slice(0, maxTokens);
      console.log('Limiting to ' + maxTokens + ' tokens (seeded shuffle)');
    }
    
    // Time-based split: use first 70% of each token's history for train, last 30% for test
    const trainPriceHistory = new Map<string, PricePoint[]>();
    const testPriceHistory = new Map<string, PricePoint[]>();
    
    for (const tokenId of allTokens) {
      const history = fullData.priceHistory.get(tokenId);
      if (!history || history.length < 10) continue; // Skip tokens with too little data
      
      const splitIdx = Math.floor(history.length * 0.7);
      const trainHistory = history.slice(0, splitIdx);
      const testHistory = history.slice(splitIdx);
      
      if (trainHistory.length > 0) {
        trainPriceHistory.set(tokenId, trainHistory);
      }
      if (testHistory.length > 0) {
        testPriceHistory.set(tokenId, testHistory);
      }
    }
    
    const train: StoredData = {
      ...fullData,
      priceHistory: trainPriceHistory,
    };
    const test: StoredData = {
      ...fullData,
      priceHistory: testPriceHistory,
    };
    const full: StoredData = fullData;
    
    let totalTrainPoints = 0;
    let totalTestPoints = 0;
    for (const history of train.priceHistory.values()) totalTrainPoints += history.length;
    for (const history of test.priceHistory.values()) totalTestPoints += history.length;
    
    console.log('Train: ' + totalTrainPoints + ' price points, Test: ' + totalTestPoints + ' price points (' + allTokens.length + ' tokens)');
    console.log('Max generations: ' + maxIterations + ', Attempts: ' + attempts);

    console.log('\n' + kleur.bold(kleur.magenta('='.repeat(60))));
    console.log(kleur.bold(kleur.magenta('Differential Evolution Optimization')));
    console.log(kleur.bold(kleur.magenta('='.repeat(60))));

    let bestResult: OptimizationResult | null = null;
    let bestTestReturn = -Infinity;
    let bestParams: Record<string, number> | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      console.log(kleur.yellow('\nAttempt ' + attempt + '/' + attempts + '...'));
      console.log(kleur.cyan('  Random search (' + randomSamples + ' samples)...'));
      
      const optimizer = new DifferentialEvolutionOptimizer(train, StrategyClass, paramConfigs, {
        maxIterations,
        convergenceThreshold: 1e-6,
        learningRate: 1.0,
        randomSamples,
      });

      optimizer.setQuiet(true);
      const result = await optimizer.optimize(attempt === 1 ? null : bestParams);
      console.log(kleur.cyan('  DE running...'));
      
      const testMetrics = testParams(test, StrategyClass, result.finalParams);
      
      console.log('  Train: Sharpe ' + result.bestSharpe.toFixed(4) + ' | Return $' + result.bestReturn.toFixed(2));
      console.log('  Test:  Sharpe ' + testMetrics.sharpe.toFixed(4) + ' | Return $' + testMetrics.return.toFixed(2));
      console.log('  Trades: ' + testMetrics.trades);
      
      if (testMetrics.return > bestTestReturn) {
        bestTestReturn = testMetrics.return;
        bestResult = result;
        bestParams = result.finalParams;
        console.log(kleur.green('  ★ NEW BEST'));
        
        if (testMetrics.return >= minTestReturn) {
          console.log(kleur.green('\n✓ Reached target test return of $' + minTestReturn));
          break;
        }
      }
    }

    if (!bestResult || !bestParams) {
      console.error(kleur.red('\n✗ Failed to find valid parameters'));
      process.exit(1);
    }

    const finalTestMetrics = testParams(test, StrategyClass, bestParams);
    const fullMetrics = testParams(full, StrategyClass, bestParams);
    const trainMetrics = testParams(train, StrategyClass, bestParams);

    console.log('\n' + kleur.bold(kleur.cyan('='.repeat(60))));
    console.log(kleur.bold(kleur.cyan('FINAL RESULTS')));
    console.log(kleur.bold(kleur.cyan('='.repeat(60))));
    
    console.log('\nParameters:');
    for (const [key, value] of Object.entries(bestParams)) {
      const config = paramConfigs[key];
      if (config.stepSize === 1 && config.min === 0 && config.max === 1) {
        console.log('  ' + key + ': ' + (value === 1 ? 'true' : 'false'));
      } else if (key === 'stop_loss' || key === 'risk_percent') {
        console.log('  ' + key + ': ' + value.toFixed(4) + ' (' + (value * 100).toFixed(2) + '%)');
      } else {
        console.log('  ' + key + ': ' + value);
      }
    }
    
    console.log('\nPerformance:');
    console.log('  Train Return: $' + trainMetrics.return.toFixed(2) + ' stdDev:$' + trainMetrics.stdDev.toFixed(2));
    console.log('  Train Sharpe: ' + trainMetrics.sharpe.toFixed(4));
    console.log('  Test Return: $' + finalTestMetrics.return.toFixed(2) + ' stdDev:$' + finalTestMetrics.stdDev.toFixed(2));
    console.log('  Test Sharpe: ' + finalTestMetrics.sharpe.toFixed(4));
    console.log('  Test Trades: ' + finalTestMetrics.trades);
    console.log('  Full Return: $' + fullMetrics.return.toFixed(2) + ' stdDev:$' + fullMetrics.stdDev.toFixed(2));
    console.log('  Full Sharpe: ' + fullMetrics.sharpe.toFixed(4));
    console.log('  Iterations: ' + bestResult.iterations);
    console.log('  Converged: ' + (bestResult.converged ? 'Yes' : 'No'));

    console.log(kleur.cyan('\nOptimization Progress\n'));
    console.log('Generation | Sharpe Ratio');
    console.log('-'.repeat(30));
    for (const entry of bestResult.history) {
      console.log(String(entry.iteration).padStart(10) + ' | ' + entry.sharpeRatio.toFixed(4));
    }
    console.log('-'.repeat(30));

    const output = {
      ...bestParams,
      metadata: {
        best_test_return: finalTestMetrics.return,
        optimized_at: new Date().toISOString(),
      },
    };
    
    const outputPath = path.join(process.cwd(), 'src', 'strategies', outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(kleur.green('\n✓ Parameters saved to ' + outputFile));

    const historyPath = path.join(process.cwd(), 'data', 'optimization-history.json');
    const historyData = {
      strategy: strategyName,
      bestParams,
      history: bestResult.history,
      finalMetrics: {
        trainReturn: trainMetrics.return,
        trainStdDev: trainMetrics.stdDev,
        testReturn: finalTestMetrics.return,
        testStdDev: finalTestMetrics.stdDev,
        testSharpe: finalTestMetrics.sharpe,
        testTrades: finalTestMetrics.trades,
        fullReturn: fullMetrics.return,
        fullStdDev: fullMetrics.stdDev,
        fullSharpe: fullMetrics.sharpe,
      },
    };
    fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2));
    console.log(kleur.green('✓ History saved to optimization-history.json'));
  });

program.parse();

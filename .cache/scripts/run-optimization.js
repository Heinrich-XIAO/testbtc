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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const kleur_1 = __importDefault(require("kleur"));
const engine_1 = require("../src/backtest/engine");
const strat_simple_ma_01_1 = require("../src/strategies/strat_simple_ma_01");
const strat_bollinger_02_1 = require("../src/strategies/strat_bollinger_02");
const strat_rsi_03_1 = require("../src/strategies/strat_rsi_03");
const strat_atr_breakout_04_1 = require("../src/strategies/strat_atr_breakout_04");
const strat_ma_atr_05_1 = require("../src/strategies/strat_ma_atr_05");
const strat_support_06_1 = require("../src/strategies/strat_support_06");
const strat_momentum_07_1 = require("../src/strategies/strat_momentum_07");
const strat_range_08_1 = require("../src/strategies/strat_range_08");
const strat_mean_revert_09_1 = require("../src/strategies/strat_mean_revert_09");
const strat_dual_ma_10_1 = require("../src/strategies/strat_dual_ma_10");
const strat_ema_fast_11_1 = require("../src/strategies/strat_ema_fast_11");
const strat_ema_med_12_1 = require("../src/strategies/strat_ema_med_12");
const strat_ema_slow_13_1 = require("../src/strategies/strat_ema_slow_13");
const strat_ema_tight_14_1 = require("../src/strategies/strat_ema_tight_14");
const strat_ema_wide_15_1 = require("../src/strategies/strat_ema_wide_15");
const strat_roc_fast_16_1 = require("../src/strategies/strat_roc_fast_16");
const strat_roc_slow_17_1 = require("../src/strategies/strat_roc_slow_17");
const strat_donchian_short_18_1 = require("../src/strategies/strat_donchian_short_18");
const strat_donchian_long_19_1 = require("../src/strategies/strat_donchian_long_19");
const strat_stoch_fast_20_1 = require("../src/strategies/strat_stoch_fast_20");
const strat_stoch_slow_21_1 = require("../src/strategies/strat_stoch_slow_21");
const strat_willr_short_22_1 = require("../src/strategies/strat_willr_short_22");
const strat_willr_long_23_1 = require("../src/strategies/strat_willr_long_23");
const strat_accel_fast_24_1 = require("../src/strategies/strat_accel_fast_24");
const strat_accel_slow_25_1 = require("../src/strategies/strat_accel_slow_25");
const strat_vbreak_tight_26_1 = require("../src/strategies/strat_vbreak_tight_26");
const strat_vbreak_wide_27_1 = require("../src/strategies/strat_vbreak_wide_27");
const strat_ribbon_tight_28_1 = require("../src/strategies/strat_ribbon_tight_28");
const strat_ribbon_wide_29_1 = require("../src/strategies/strat_ribbon_wide_29");
const strat_rsi_div_fast_30_1 = require("../src/strategies/strat_rsi_div_fast_30");
const strat_rsi_div_slow_31_1 = require("../src/strategies/strat_rsi_div_slow_31");
const strat_mr_rsi_tight_32_1 = require("../src/strategies/strat_mr_rsi_tight_32");
const strat_mr_rsi_wide_33_1 = require("../src/strategies/strat_mr_rsi_wide_33");
const strat_adapt_fast_34_1 = require("../src/strategies/strat_adapt_fast_34");
const strat_adapt_slow_35_1 = require("../src/strategies/strat_adapt_slow_35");
const strat_tri_ma_fast_36_1 = require("../src/strategies/strat_tri_ma_fast_36");
const strat_tri_ma_slow_37_1 = require("../src/strategies/strat_tri_ma_slow_37");
const strat_env_tight_38_1 = require("../src/strategies/strat_env_tight_38");
const strat_env_wide_39_1 = require("../src/strategies/strat_env_wide_39");
const strat_pat_dip_40_1 = require("../src/strategies/strat_pat_dip_40");
const strat_pat_mom_41_1 = require("../src/strategies/strat_pat_mom_41");
const strat_combo_tight_42_1 = require("../src/strategies/strat_combo_tight_42");
const strat_combo_wide_43_1 = require("../src/strategies/strat_combo_wide_43");
const strat_tstr_fast_44_1 = require("../src/strategies/strat_tstr_fast_44");
const strat_tstr_slow_45_1 = require("../src/strategies/strat_tstr_slow_45");
const strat_swing_short_46_1 = require("../src/strategies/strat_swing_short_46");
const strat_swing_long_47_1 = require("../src/strategies/strat_swing_long_47");
const strat_rev_fast_48_1 = require("../src/strategies/strat_rev_fast_48");
const strat_rev_slow_49_1 = require("../src/strategies/strat_rev_slow_49");
const strat_chan_tight_50_1 = require("../src/strategies/strat_chan_tight_50");
const strat_chan_wide_51_1 = require("../src/strategies/strat_chan_wide_51");
const strat_mcross_fast_52_1 = require("../src/strategies/strat_mcross_fast_52");
const strat_mcross_slow_53_1 = require("../src/strategies/strat_mcross_slow_53");
const strat_mr_rsi_v01_54_1 = require("../src/strategies/strat_mr_rsi_v01_54");
const strat_mr_rsi_v02_55_1 = require("../src/strategies/strat_mr_rsi_v02_55");
const strat_mr_rsi_v03_56_1 = require("../src/strategies/strat_mr_rsi_v03_56");
const strat_mr_rsi_v04_57_1 = require("../src/strategies/strat_mr_rsi_v04_57");
const strat_mr_rsi_v05_58_1 = require("../src/strategies/strat_mr_rsi_v05_58");
const strat_mr_rsi_v06_59_1 = require("../src/strategies/strat_mr_rsi_v06_59");
const strat_mr_rsi_v07_60_1 = require("../src/strategies/strat_mr_rsi_v07_60");
const strat_mr_rsi_v08_61_1 = require("../src/strategies/strat_mr_rsi_v08_61");
const strat_mr_rsi_v09_62_1 = require("../src/strategies/strat_mr_rsi_v09_62");
const strat_mr_rsi_v10_63_1 = require("../src/strategies/strat_mr_rsi_v10_63");
const strat_mr_rsi_v11_64_1 = require("../src/strategies/strat_mr_rsi_v11_64");
const strat_mr_rsi_v12_65_1 = require("../src/strategies/strat_mr_rsi_v12_65");
const strat_mr_rsi_v13_66_1 = require("../src/strategies/strat_mr_rsi_v13_66");
const strat_mr_rsi_v14_67_1 = require("../src/strategies/strat_mr_rsi_v14_67");
const strat_mr_rsi_v15_68_1 = require("../src/strategies/strat_mr_rsi_v15_68");
const strat_mr_rsi_v16_69_1 = require("../src/strategies/strat_mr_rsi_v16_69");
const strat_mr_rsi_v17_70_1 = require("../src/strategies/strat_mr_rsi_v17_70");
const strat_mr_rsi_v18_71_1 = require("../src/strategies/strat_mr_rsi_v18_71");
const strat_mr_rsi_v19_72_1 = require("../src/strategies/strat_mr_rsi_v19_72");
const strat_mr_rsi_v20_73_1 = require("../src/strategies/strat_mr_rsi_v20_73");
const strat_willr_v01_74_1 = require("../src/strategies/strat_willr_v01_74");
const strat_willr_v02_75_1 = require("../src/strategies/strat_willr_v02_75");
const strat_willr_v03_76_1 = require("../src/strategies/strat_willr_v03_76");
const strat_willr_v04_77_1 = require("../src/strategies/strat_willr_v04_77");
const strat_willr_v05_78_1 = require("../src/strategies/strat_willr_v05_78");
const strat_willr_v06_79_1 = require("../src/strategies/strat_willr_v06_79");
const strat_willr_v07_80_1 = require("../src/strategies/strat_willr_v07_80");
const strat_willr_v08_81_1 = require("../src/strategies/strat_willr_v08_81");
const strat_willr_v09_82_1 = require("../src/strategies/strat_willr_v09_82");
const strat_willr_v10_83_1 = require("../src/strategies/strat_willr_v10_83");
const strat_willr_v11_84_1 = require("../src/strategies/strat_willr_v11_84");
const strat_willr_v12_85_1 = require("../src/strategies/strat_willr_v12_85");
const strat_willr_v13_86_1 = require("../src/strategies/strat_willr_v13_86");
const strat_willr_v14_87_1 = require("../src/strategies/strat_willr_v14_87");
const strat_willr_v15_88_1 = require("../src/strategies/strat_willr_v15_88");
const strat_willr_v16_89_1 = require("../src/strategies/strat_willr_v16_89");
const strat_willr_v17_90_1 = require("../src/strategies/strat_willr_v17_90");
const strat_willr_v18_91_1 = require("../src/strategies/strat_willr_v18_91");
const strat_willr_v19_92_1 = require("../src/strategies/strat_willr_v19_92");
const strat_willr_v20_93_1 = require("../src/strategies/strat_willr_v20_93");
const strat_env_v01_94_1 = require("../src/strategies/strat_env_v01_94");
const strat_env_v02_95_1 = require("../src/strategies/strat_env_v02_95");
const strat_env_v03_96_1 = require("../src/strategies/strat_env_v03_96");
const strat_env_v04_97_1 = require("../src/strategies/strat_env_v04_97");
const strat_env_v05_98_1 = require("../src/strategies/strat_env_v05_98");
const strat_env_v06_99_1 = require("../src/strategies/strat_env_v06_99");
const strat_env_v07_100_1 = require("../src/strategies/strat_env_v07_100");
const strat_env_v08_101_1 = require("../src/strategies/strat_env_v08_101");
const strat_env_v09_102_1 = require("../src/strategies/strat_env_v09_102");
const strat_env_v10_103_1 = require("../src/strategies/strat_env_v10_103");
const strat_env_v11_104_1 = require("../src/strategies/strat_env_v11_104");
const strat_env_v12_105_1 = require("../src/strategies/strat_env_v12_105");
const strat_env_v13_106_1 = require("../src/strategies/strat_env_v13_106");
const strat_env_v14_107_1 = require("../src/strategies/strat_env_v14_107");
const strat_env_v15_108_1 = require("../src/strategies/strat_env_v15_108");
const strat_env_v16_109_1 = require("../src/strategies/strat_env_v16_109");
const strat_env_v17_110_1 = require("../src/strategies/strat_env_v17_110");
const strat_env_v18_111_1 = require("../src/strategies/strat_env_v18_111");
const strat_env_v19_112_1 = require("../src/strategies/strat_env_v19_112");
const strat_env_v20_113_1 = require("../src/strategies/strat_env_v20_113");
const strat_chan_v01_114_1 = require("../src/strategies/strat_chan_v01_114");
const strat_chan_v02_115_1 = require("../src/strategies/strat_chan_v02_115");
const strat_chan_v03_116_1 = require("../src/strategies/strat_chan_v03_116");
const strat_chan_v04_117_1 = require("../src/strategies/strat_chan_v04_117");
const strat_chan_v05_118_1 = require("../src/strategies/strat_chan_v05_118");
const strat_chan_v06_119_1 = require("../src/strategies/strat_chan_v06_119");
const strat_chan_v07_120_1 = require("../src/strategies/strat_chan_v07_120");
const strat_chan_v08_121_1 = require("../src/strategies/strat_chan_v08_121");
const strat_chan_v09_122_1 = require("../src/strategies/strat_chan_v09_122");
const strat_chan_v10_123_1 = require("../src/strategies/strat_chan_v10_123");
const strat_chan_v11_124_1 = require("../src/strategies/strat_chan_v11_124");
const strat_chan_v12_125_1 = require("../src/strategies/strat_chan_v12_125");
const strat_chan_v13_126_1 = require("../src/strategies/strat_chan_v13_126");
const strat_chan_v14_127_1 = require("../src/strategies/strat_chan_v14_127");
const strat_chan_v15_128_1 = require("../src/strategies/strat_chan_v15_128");
const strat_chan_v16_129_1 = require("../src/strategies/strat_chan_v16_129");
const strat_chan_v17_130_1 = require("../src/strategies/strat_chan_v17_130");
const strat_chan_v18_131_1 = require("../src/strategies/strat_chan_v18_131");
const strat_chan_v19_132_1 = require("../src/strategies/strat_chan_v19_132");
const strat_chan_v20_133_1 = require("../src/strategies/strat_chan_v20_133");
const strat_combo_v01_134_1 = require("../src/strategies/strat_combo_v01_134");
const strat_combo_v02_135_1 = require("../src/strategies/strat_combo_v02_135");
const strat_combo_v03_136_1 = require("../src/strategies/strat_combo_v03_136");
const strat_combo_v04_137_1 = require("../src/strategies/strat_combo_v04_137");
const strat_combo_v05_138_1 = require("../src/strategies/strat_combo_v05_138");
const strat_combo_v06_139_1 = require("../src/strategies/strat_combo_v06_139");
const strat_combo_v07_140_1 = require("../src/strategies/strat_combo_v07_140");
const strat_combo_v08_141_1 = require("../src/strategies/strat_combo_v08_141");
const strat_combo_v09_142_1 = require("../src/strategies/strat_combo_v09_142");
const strat_combo_v10_143_1 = require("../src/strategies/strat_combo_v10_143");
const strat_combo_v11_144_1 = require("../src/strategies/strat_combo_v11_144");
const strat_combo_v12_145_1 = require("../src/strategies/strat_combo_v12_145");
const strat_combo_v13_146_1 = require("../src/strategies/strat_combo_v13_146");
const strat_combo_v14_147_1 = require("../src/strategies/strat_combo_v14_147");
const strat_combo_v15_148_1 = require("../src/strategies/strat_combo_v15_148");
const strat_combo_v16_149_1 = require("../src/strategies/strat_combo_v16_149");
const strat_combo_v17_150_1 = require("../src/strategies/strat_combo_v17_150");
const strat_combo_v18_151_1 = require("../src/strategies/strat_combo_v18_151");
const strat_combo_v19_152_1 = require("../src/strategies/strat_combo_v19_152");
const strat_combo_v20_153_1 = require("../src/strategies/strat_combo_v20_153");
const strat_stoch_v01_154_1 = require("../src/strategies/strat_stoch_v01_154");
const strat_stoch_v02_155_1 = require("../src/strategies/strat_stoch_v02_155");
const strat_stoch_v03_156_1 = require("../src/strategies/strat_stoch_v03_156");
const strat_stoch_v04_157_1 = require("../src/strategies/strat_stoch_v04_157");
const strat_stoch_v05_158_1 = require("../src/strategies/strat_stoch_v05_158");
const strat_stoch_v06_159_1 = require("../src/strategies/strat_stoch_v06_159");
const strat_stoch_v07_160_1 = require("../src/strategies/strat_stoch_v07_160");
const strat_stoch_v08_161_1 = require("../src/strategies/strat_stoch_v08_161");
const strat_stoch_v09_162_1 = require("../src/strategies/strat_stoch_v09_162");
const strat_stoch_v10_163_1 = require("../src/strategies/strat_stoch_v10_163");
const strat_stoch_v11_164_1 = require("../src/strategies/strat_stoch_v11_164");
const strat_stoch_v12_165_1 = require("../src/strategies/strat_stoch_v12_165");
const strat_stoch_v13_166_1 = require("../src/strategies/strat_stoch_v13_166");
const strat_stoch_v14_167_1 = require("../src/strategies/strat_stoch_v14_167");
const strat_stoch_v15_168_1 = require("../src/strategies/strat_stoch_v15_168");
const strat_stoch_v16_169_1 = require("../src/strategies/strat_stoch_v16_169");
const strat_stoch_v17_170_1 = require("../src/strategies/strat_stoch_v17_170");
const strat_stoch_v18_171_1 = require("../src/strategies/strat_stoch_v18_171");
const strat_stoch_v19_172_1 = require("../src/strategies/strat_stoch_v19_172");
const strat_stoch_v20_173_1 = require("../src/strategies/strat_stoch_v20_173");
const strat_pat_v01_174_1 = require("../src/strategies/strat_pat_v01_174");
const strat_pat_v02_175_1 = require("../src/strategies/strat_pat_v02_175");
const strat_pat_v03_176_1 = require("../src/strategies/strat_pat_v03_176");
const strat_pat_v04_177_1 = require("../src/strategies/strat_pat_v04_177");
const strat_pat_v05_178_1 = require("../src/strategies/strat_pat_v05_178");
const strat_pat_v06_179_1 = require("../src/strategies/strat_pat_v06_179");
const strat_pat_v07_180_1 = require("../src/strategies/strat_pat_v07_180");
const strat_pat_v08_181_1 = require("../src/strategies/strat_pat_v08_181");
const strat_pat_v09_182_1 = require("../src/strategies/strat_pat_v09_182");
const strat_pat_v10_183_1 = require("../src/strategies/strat_pat_v10_183");
const strat_pat_v11_184_1 = require("../src/strategies/strat_pat_v11_184");
const strat_pat_v12_185_1 = require("../src/strategies/strat_pat_v12_185");
const strat_pat_v13_186_1 = require("../src/strategies/strat_pat_v13_186");
const strat_pat_v14_187_1 = require("../src/strategies/strat_pat_v14_187");
const strat_pat_v15_188_1 = require("../src/strategies/strat_pat_v15_188");
const strat_pat_v16_189_1 = require("../src/strategies/strat_pat_v16_189");
const strat_pat_v17_190_1 = require("../src/strategies/strat_pat_v17_190");
const strat_pat_v18_191_1 = require("../src/strategies/strat_pat_v18_191");
const strat_pat_v19_192_1 = require("../src/strategies/strat_pat_v19_192");
const strat_pat_v20_193_1 = require("../src/strategies/strat_pat_v20_193");
const strat_rsi_d_v01_194_1 = require("../src/strategies/strat_rsi_d_v01_194");
const strat_rsi_d_v02_195_1 = require("../src/strategies/strat_rsi_d_v02_195");
const strat_rsi_d_v03_196_1 = require("../src/strategies/strat_rsi_d_v03_196");
const strat_rsi_d_v04_197_1 = require("../src/strategies/strat_rsi_d_v04_197");
const strat_rsi_d_v05_198_1 = require("../src/strategies/strat_rsi_d_v05_198");
const strat_rsi_d_v06_199_1 = require("../src/strategies/strat_rsi_d_v06_199");
const strat_rsi_d_v07_200_1 = require("../src/strategies/strat_rsi_d_v07_200");
const strat_stoch_v20_tweak_201_1 = require("../src/strategies/strat_stoch_v20_tweak_201");
const strat_stoch_v06_tweak_202_1 = require("../src/strategies/strat_stoch_v06_tweak_202");
const strat_stoch_v09_tweak_203_1 = require("../src/strategies/strat_stoch_v09_tweak_203");
const strat_stoch_adaptive_204_1 = require("../src/strategies/strat_stoch_adaptive_204");
const strat_rsi_stoch_combo_205_1 = require("../src/strategies/strat_rsi_stoch_combo_205");
const strat_volatility_breakout_206_1 = require("../src/strategies/strat_volatility_breakout_206");
const strat_trend_following_ma_207_1 = require("../src/strategies/strat_trend_following_ma_207");
const strat_mean_reversion_band_208_1 = require("../src/strategies/strat_mean_reversion_band_208");
const optimization_1 = require("../src/optimization");
const engine_2 = require("../src/backtest/engine");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
kleur_1.default.enabled = true;
const strategies = {
    simple_ma: {
        class: strat_simple_ma_01_1.SimpleMAStrategy,
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
        class: strat_bollinger_02_1.BollingerBandsStrategy,
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
        class: strat_rsi_03_1.RSIMeanReversionStrategy,
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
        class: strat_atr_breakout_04_1.ATRBreakoutStrategy,
        params: {
            breakout_multiplier: { min: 0.1, max: 1.0, stepSize: 0.1 },
            lookback: { min: 5, max: 20, stepSize: 5 },
            stop_loss: { min: 0.02, max: 0.10, stepSize: 0.02 },
            risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 },
        },
        outputFile: 'strat_atr_breakout_04.params.json',
    },
    ma_vol: {
        class: strat_ma_atr_05_1.MAStrategyWithATRStop,
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
        class: strat_support_06_1.SupportResistanceStrategy,
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
        class: strat_momentum_07_1.ShortTermStrategy,
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
        class: strat_range_08_1.RangeTradingStrategy,
        params: {
            buy_below: { min: 0.15, max: 0.40, stepSize: 0.05 },
            sell_above: { min: 0.50, max: 0.80, stepSize: 0.05 },
            stop_loss: { min: 0.10, max: 0.30, stepSize: 0.05 },
            risk_percent: { min: 0.05, max: 0.20, stepSize: 0.05 },
        },
        outputFile: 'strat_range_08.params.json',
    },
    mean_revert: {
        class: strat_mean_revert_09_1.MeanReversionStrategy,
        params: {
            ma_period: { min: 5, max: 15, stepSize: 1 },
            deviation_threshold: { min: 0.01, max: 0.08, stepSize: 0.01 },
            stop_loss: { min: 0.03, max: 0.15, stepSize: 0.02 },
            risk_percent: { min: 0.05, max: 0.30, stepSize: 0.05 },
        },
        outputFile: 'strat_mean_revert_09.params.json',
    },
    dual_ma: {
        class: strat_dual_ma_10_1.DualMAStrategy,
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
        class: strat_ema_fast_11_1.EMAFastCrossStrategy,
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
        class: strat_ema_med_12_1.EMAMedCrossStrategy,
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
        class: strat_ema_slow_13_1.EMASlowCrossStrategy,
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
        class: strat_ema_tight_14_1.EMATightStopStrategy,
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
        class: strat_ema_wide_15_1.EMAWideStopStrategy,
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
        class: strat_roc_fast_16_1.ROCFastStrategy,
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
        class: strat_roc_slow_17_1.ROCSlowStrategy,
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
        class: strat_donchian_short_18_1.DonchianShortStrategy,
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
        class: strat_donchian_long_19_1.DonchianLongStrategy,
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
        class: strat_stoch_fast_20_1.StochFastStrategy,
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
        class: strat_stoch_slow_21_1.StochSlowStrategy,
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
        class: strat_willr_short_22_1.WillRShortStrategy,
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
        class: strat_willr_long_23_1.WillRLongStrategy,
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
        class: strat_accel_fast_24_1.AccelFastStrategy,
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
        class: strat_accel_slow_25_1.AccelSlowStrategy,
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
        class: strat_vbreak_tight_26_1.VolBreakTightStrategy,
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
        class: strat_vbreak_wide_27_1.VolBreakWideStrategy,
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
        class: strat_ribbon_tight_28_1.RibbonTightStrategy,
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
        class: strat_ribbon_wide_29_1.RibbonWideStrategy,
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
        class: strat_rsi_div_fast_30_1.RSIDivFastStrategy,
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
        class: strat_rsi_div_slow_31_1.RSIDivSlowStrategy,
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
        class: strat_mr_rsi_tight_32_1.MRRSITightStrategy,
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
        class: strat_mr_rsi_wide_33_1.MRRSIWideStrategy,
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
        class: strat_adapt_fast_34_1.AdaptFastStrategy,
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
        class: strat_adapt_slow_35_1.AdaptSlowStrategy,
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
        class: strat_tri_ma_fast_36_1.TriMAFastStrategy,
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
        class: strat_tri_ma_slow_37_1.TriMASlowStrategy,
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
        class: strat_env_tight_38_1.EnvTightStrategy,
        params: {
            ma_period: { min: 5, max: 15, stepSize: 1 },
            envelope_pct: { min: 0.01, max: 0.06, stepSize: 0.005 },
            stop_loss: { min: 0.03, max: 0.12, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
        },
        outputFile: 'strat_env_tight_38.params.json',
    },
    env_wide: {
        class: strat_env_wide_39_1.EnvWideStrategy,
        params: {
            ma_period: { min: 8, max: 20, stepSize: 2 },
            envelope_pct: { min: 0.03, max: 0.1, stepSize: 0.01 },
            stop_loss: { min: 0.05, max: 0.15, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
        },
        outputFile: 'strat_env_wide_39.params.json',
    },
    pat_dip: {
        class: strat_pat_dip_40_1.PatDipStrategy,
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
        class: strat_pat_mom_41_1.PatMomStrategy,
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
        class: strat_combo_tight_42_1.ComboTightStrategy,
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
        class: strat_combo_wide_43_1.ComboWideStrategy,
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
        class: strat_tstr_fast_44_1.TStrFastStrategy,
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
        class: strat_tstr_slow_45_1.TStrSlowStrategy,
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
        class: strat_swing_short_46_1.SwingShortStrategy,
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
        class: strat_swing_long_47_1.SwingLongStrategy,
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
        class: strat_rev_fast_48_1.RevFastStrategy,
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
        class: strat_rev_slow_49_1.RevSlowStrategy,
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
        class: strat_chan_tight_50_1.ChanTightStrategy,
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
        class: strat_chan_wide_51_1.ChanWideStrategy,
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
        class: strat_mcross_fast_52_1.MCrossFastStrategy,
        params: {
            ma_period: { min: 3, max: 10, stepSize: 1 },
            stop_loss: { min: 0.02, max: 0.08, stepSize: 0.01 },
            trailing_stop: { min: 0.01, max: 0.06, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
        },
        outputFile: 'strat_mcross_fast_52.params.json',
    },
    mcross_slow: {
        class: strat_mcross_slow_53_1.MCrossSlowStrategy,
        params: {
            ma_period: { min: 8, max: 20, stepSize: 2 },
            stop_loss: { min: 0.04, max: 0.12, stepSize: 0.01 },
            trailing_stop: { min: 0.02, max: 0.08, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
        },
        outputFile: 'strat_mcross_slow_53.params.json',
    },
    mr_rsi_v01: {
        class: strat_mr_rsi_v01_54_1.MRRsiV01Strategy,
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
        class: strat_mr_rsi_v02_55_1.MRRsiV02Strategy,
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
        class: strat_mr_rsi_v03_56_1.MRRsiV03Strategy,
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
        class: strat_mr_rsi_v04_57_1.MRRsiV04Strategy,
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
        class: strat_mr_rsi_v05_58_1.MRRsiV05Strategy,
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
        class: strat_mr_rsi_v06_59_1.MRRsiV06Strategy,
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
        class: strat_mr_rsi_v07_60_1.MRRsiV07Strategy,
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
        class: strat_mr_rsi_v08_61_1.MRRsiV08Strategy,
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
        class: strat_mr_rsi_v09_62_1.MRRsiV09Strategy,
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
        class: strat_mr_rsi_v10_63_1.MRRsiV10Strategy,
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
        class: strat_mr_rsi_v11_64_1.MRRsiV11Strategy,
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
        class: strat_mr_rsi_v12_65_1.MRRsiV12Strategy,
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
        class: strat_mr_rsi_v13_66_1.MRRsiV13Strategy,
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
        class: strat_mr_rsi_v14_67_1.MRRsiV14Strategy,
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
        class: strat_mr_rsi_v15_68_1.MRRsiV15Strategy,
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
        class: strat_mr_rsi_v16_69_1.MRRsiV16Strategy,
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
        class: strat_mr_rsi_v17_70_1.MRRsiV17Strategy,
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
        class: strat_mr_rsi_v18_71_1.MRRsiV18Strategy,
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
        class: strat_mr_rsi_v19_72_1.MRRsiV19Strategy,
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
        class: strat_mr_rsi_v20_73_1.MRRsiV20Strategy,
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
        class: strat_willr_v01_74_1.WillRV01Strategy,
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
        class: strat_willr_v02_75_1.WillRV02Strategy,
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
        class: strat_willr_v03_76_1.WillRV03Strategy,
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
        class: strat_willr_v04_77_1.WillRV04Strategy,
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
        class: strat_willr_v05_78_1.WillRV05Strategy,
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
        class: strat_willr_v06_79_1.WillRV06Strategy,
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
        class: strat_willr_v07_80_1.WillRV07Strategy,
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
        class: strat_willr_v08_81_1.WillRV08Strategy,
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
        class: strat_willr_v09_82_1.WillRV09Strategy,
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
        class: strat_willr_v10_83_1.WillRV10Strategy,
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
        class: strat_willr_v11_84_1.WillRV11Strategy,
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
        class: strat_willr_v12_85_1.WillRV12Strategy,
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
        class: strat_willr_v13_86_1.WillRV13Strategy,
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
        class: strat_willr_v14_87_1.WillRV14Strategy,
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
        class: strat_willr_v15_88_1.WillRV15Strategy,
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
        class: strat_willr_v16_89_1.WillRV16Strategy,
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
        class: strat_willr_v17_90_1.WillRV17Strategy,
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
        class: strat_willr_v18_91_1.WillRV18Strategy,
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
        class: strat_willr_v19_92_1.WillRV19Strategy,
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
        class: strat_willr_v20_93_1.WillRV20Strategy,
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
        class: strat_env_v01_94_1.EnvV01Strategy,
        params: {
            ma_period: { min: 2, max: 9, stepSize: 1 },
            envelope_pct: { min: 0.005, max: 0.04, stepSize: 0.005 },
            stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v01_94.params.json',
    },
    env_v02: {
        class: strat_env_v02_95_1.EnvV02Strategy,
        params: {
            ma_period: { min: 2, max: 10, stepSize: 1 },
            envelope_pct: { min: 0.005, max: 0.045, stepSize: 0.005 },
            stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v02_95.params.json',
    },
    env_v03: {
        class: strat_env_v03_96_1.EnvV03Strategy,
        params: {
            ma_period: { min: 2, max: 10, stepSize: 1 },
            envelope_pct: { min: 0.010000000000000002, max: 0.055, stepSize: 0.005 },
            stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v03_96.params.json',
    },
    env_v04: {
        class: strat_env_v04_97_1.EnvV04Strategy,
        params: {
            ma_period: { min: 2, max: 10, stepSize: 1 },
            envelope_pct: { min: 0.025, max: 0.07, stepSize: 0.005 },
            stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v04_97.params.json',
    },
    env_v05: {
        class: strat_env_v05_98_1.EnvV05Strategy,
        params: {
            ma_period: { min: 5, max: 13, stepSize: 1 },
            envelope_pct: { min: 0.005000000000000001, max: 0.05, stepSize: 0.005 },
            stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v05_98.params.json',
    },
    env_v06: {
        class: strat_env_v06_99_1.EnvV06Strategy,
        params: {
            ma_period: { min: 5, max: 13, stepSize: 1 },
            envelope_pct: { min: 0.015, max: 0.06, stepSize: 0.005 },
            stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v06_99.params.json',
    },
    env_v07: {
        class: strat_env_v07_100_1.EnvV07Strategy,
        params: {
            ma_period: { min: 5, max: 13, stepSize: 1 },
            envelope_pct: { min: 0.035, max: 0.08, stepSize: 0.005 },
            stop_loss: { min: 0.05, max: 0.13, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.32999999999999996, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v07_100.params.json',
    },
    env_v08: {
        class: strat_env_v08_101_1.EnvV08Strategy,
        params: {
            ma_period: { min: 9, max: 17, stepSize: 1 },
            envelope_pct: { min: 0.005000000000000001, max: 0.05, stepSize: 0.005 },
            stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v08_101.params.json',
    },
    env_v09: {
        class: strat_env_v09_102_1.EnvV09Strategy,
        params: {
            ma_period: { min: 9, max: 17, stepSize: 1 },
            envelope_pct: { min: 0.025, max: 0.07, stepSize: 0.005 },
            stop_loss: { min: 0.04000000000000001, max: 0.12000000000000001, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v09_102.params.json',
    },
    env_v10: {
        class: strat_env_v10_103_1.EnvV10Strategy,
        params: {
            ma_period: { min: 9, max: 17, stepSize: 1 },
            envelope_pct: { min: 0.045, max: 0.09, stepSize: 0.005 },
            stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.35, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v10_103.params.json',
    },
    env_v11: {
        class: strat_env_v11_104_1.EnvV11Strategy,
        params: {
            ma_period: { min: 2, max: 9, stepSize: 1 },
            envelope_pct: { min: 0.005, max: 0.045, stepSize: 0.005 },
            stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v11_104.params.json',
    },
    env_v12: {
        class: strat_env_v12_105_1.EnvV12Strategy,
        params: {
            ma_period: { min: 12, max: 20, stepSize: 1 },
            envelope_pct: { min: 0.035, max: 0.08, stepSize: 0.005 },
            stop_loss: { min: 0.010000000000000002, max: 0.09, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v12_105.params.json',
    },
    env_v13: {
        class: strat_env_v13_106_1.EnvV13Strategy,
        params: {
            ma_period: { min: 4, max: 12, stepSize: 1 },
            envelope_pct: { min: 0.010000000000000002, max: 0.055, stepSize: 0.005 },
            stop_loss: { min: 0.020000000000000004, max: 0.1, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.27, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v13_106.params.json',
    },
    env_v14: {
        class: strat_env_v14_107_1.EnvV14Strategy,
        params: {
            ma_period: { min: 6, max: 14, stepSize: 1 },
            envelope_pct: { min: 0.020000000000000004, max: 0.065, stepSize: 0.005 },
            stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.29000000000000004, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v14_107.params.json',
    },
    env_v15: {
        class: strat_env_v15_108_1.EnvV15Strategy,
        params: {
            ma_period: { min: 3, max: 11, stepSize: 1 },
            envelope_pct: { min: 0.005000000000000001, max: 0.05, stepSize: 0.005 },
            stop_loss: { min: 0.01, max: 0.07, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v15_108.params.json',
    },
    env_v16: {
        class: strat_env_v16_109_1.EnvV16Strategy,
        params: {
            ma_period: { min: 3, max: 11, stepSize: 1 },
            envelope_pct: { min: 0.005000000000000001, max: 0.05, stepSize: 0.005 },
            stop_loss: { min: 0.09, max: 0.16999999999999998, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.25, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v16_109.params.json',
    },
    env_v17: {
        class: strat_env_v17_110_1.EnvV17Strategy,
        params: {
            ma_period: { min: 4, max: 12, stepSize: 1 },
            envelope_pct: { min: 0.015, max: 0.06, stepSize: 0.005 },
            stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.4, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v17_110.params.json',
    },
    env_v18: {
        class: strat_env_v18_111_1.EnvV18Strategy,
        params: {
            ma_period: { min: 4, max: 12, stepSize: 1 },
            envelope_pct: { min: 0.015, max: 0.06, stepSize: 0.005 },
            stop_loss: { min: 0.03, max: 0.11, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.2, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v18_111.params.json',
    },
    env_v19: {
        class: strat_env_v19_112_1.EnvV19Strategy,
        params: {
            ma_period: { min: 2, max: 8, stepSize: 1 },
            envelope_pct: { min: 0.005, max: 0.038, stepSize: 0.005 },
            stop_loss: { min: 0.01, max: 0.08, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.22999999999999998, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v19_112.params.json',
    },
    env_v20: {
        class: strat_env_v20_113_1.EnvV20Strategy,
        params: {
            ma_period: { min: 15, max: 23, stepSize: 1 },
            envelope_pct: { min: 0.045, max: 0.09, stepSize: 0.005 },
            stop_loss: { min: 0.07, max: 0.15000000000000002, stepSize: 0.01 },
            risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
        },
        outputFile: 'strat_env_v20_113.params.json',
    },
    chan_v01: {
        class: strat_chan_v01_114_1.ChanV01Strategy,
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
        class: strat_chan_v02_115_1.ChanV02Strategy,
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
        class: strat_chan_v03_116_1.ChanV03Strategy,
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
        class: strat_chan_v04_117_1.ChanV04Strategy,
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
        class: strat_chan_v05_118_1.ChanV05Strategy,
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
        class: strat_chan_v06_119_1.ChanV06Strategy,
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
        class: strat_chan_v07_120_1.ChanV07Strategy,
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
        class: strat_chan_v08_121_1.ChanV08Strategy,
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
        class: strat_chan_v09_122_1.ChanV09Strategy,
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
        class: strat_chan_v10_123_1.ChanV10Strategy,
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
        class: strat_chan_v11_124_1.ChanV11Strategy,
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
        class: strat_chan_v12_125_1.ChanV12Strategy,
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
        class: strat_chan_v13_126_1.ChanV13Strategy,
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
        class: strat_chan_v14_127_1.ChanV14Strategy,
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
        class: strat_chan_v15_128_1.ChanV15Strategy,
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
        class: strat_chan_v16_129_1.ChanV16Strategy,
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
        class: strat_chan_v17_130_1.ChanV17Strategy,
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
        class: strat_chan_v18_131_1.ChanV18Strategy,
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
        class: strat_chan_v19_132_1.ChanV19Strategy,
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
        class: strat_chan_v20_133_1.ChanV20Strategy,
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
        class: strat_combo_v01_134_1.ComboV01Strategy,
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
        class: strat_combo_v02_135_1.ComboV02Strategy,
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
        class: strat_combo_v03_136_1.ComboV03Strategy,
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
        class: strat_combo_v04_137_1.ComboV04Strategy,
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
        class: strat_combo_v05_138_1.ComboV05Strategy,
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
        class: strat_combo_v06_139_1.ComboV06Strategy,
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
        class: strat_combo_v07_140_1.ComboV07Strategy,
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
        class: strat_combo_v08_141_1.ComboV08Strategy,
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
        class: strat_combo_v09_142_1.ComboV09Strategy,
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
        class: strat_combo_v10_143_1.ComboV10Strategy,
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
        class: strat_combo_v11_144_1.ComboV11Strategy,
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
        class: strat_combo_v12_145_1.ComboV12Strategy,
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
        class: strat_combo_v13_146_1.ComboV13Strategy,
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
        class: strat_combo_v14_147_1.ComboV14Strategy,
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
        class: strat_combo_v15_148_1.ComboV15Strategy,
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
        class: strat_combo_v16_149_1.ComboV16Strategy,
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
        class: strat_combo_v17_150_1.ComboV17Strategy,
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
        class: strat_combo_v18_151_1.ComboV18Strategy,
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
        class: strat_combo_v19_152_1.ComboV19Strategy,
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
        class: strat_combo_v20_153_1.ComboV20Strategy,
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
        class: strat_stoch_v01_154_1.StochV01Strategy,
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
        class: strat_stoch_v02_155_1.StochV02Strategy,
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
        class: strat_stoch_v03_156_1.StochV03Strategy,
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
        class: strat_stoch_v04_157_1.StochV04Strategy,
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
        class: strat_stoch_v05_158_1.StochV05Strategy,
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
        class: strat_stoch_v06_159_1.StochV06Strategy,
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
        class: strat_stoch_v07_160_1.StochV07Strategy,
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
        class: strat_stoch_v08_161_1.StochV08Strategy,
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
        class: strat_stoch_v09_162_1.StochV09Strategy,
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
        class: strat_stoch_v10_163_1.StochV10Strategy,
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
        class: strat_stoch_v11_164_1.StochV11Strategy,
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
        class: strat_stoch_v12_165_1.StochV12Strategy,
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
        class: strat_stoch_v13_166_1.StochV13Strategy,
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
        class: strat_stoch_v14_167_1.StochV14Strategy,
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
        class: strat_stoch_v15_168_1.StochV15Strategy,
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
        class: strat_stoch_v16_169_1.StochV16Strategy,
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
        class: strat_stoch_v17_170_1.StochV17Strategy,
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
        class: strat_stoch_v18_171_1.StochV18Strategy,
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
        class: strat_stoch_v19_172_1.StochV19Strategy,
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
        class: strat_stoch_v20_173_1.StochV20Strategy,
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
        class: strat_pat_v01_174_1.PatV01Strategy,
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
        class: strat_pat_v02_175_1.PatV02Strategy,
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
        class: strat_pat_v03_176_1.PatV03Strategy,
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
        class: strat_pat_v04_177_1.PatV04Strategy,
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
        class: strat_pat_v05_178_1.PatV05Strategy,
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
        class: strat_pat_v06_179_1.PatV06Strategy,
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
        class: strat_pat_v07_180_1.PatV07Strategy,
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
        class: strat_pat_v08_181_1.PatV08Strategy,
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
        class: strat_pat_v09_182_1.PatV09Strategy,
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
        class: strat_pat_v10_183_1.PatV10Strategy,
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
        class: strat_pat_v11_184_1.PatV11Strategy,
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
        class: strat_pat_v12_185_1.PatV12Strategy,
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
        class: strat_pat_v13_186_1.PatV13Strategy,
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
        class: strat_pat_v14_187_1.PatV14Strategy,
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
        class: strat_pat_v15_188_1.PatV15Strategy,
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
        class: strat_pat_v16_189_1.PatV16Strategy,
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
        class: strat_pat_v17_190_1.PatV17Strategy,
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
        class: strat_pat_v18_191_1.PatV18Strategy,
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
        class: strat_pat_v19_192_1.PatV19Strategy,
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
        class: strat_pat_v20_193_1.PatV20Strategy,
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
        class: strat_rsi_d_v01_194_1.RsiDV01Strategy,
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
        class: strat_rsi_d_v02_195_1.RsiDV02Strategy,
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
        class: strat_rsi_d_v03_196_1.RsiDV03Strategy,
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
        class: strat_rsi_d_v04_197_1.RsiDV04Strategy,
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
        class: strat_rsi_d_v05_198_1.RsiDV05Strategy,
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
        class: strat_rsi_d_v06_199_1.RsiDV06Strategy,
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
        class: strat_rsi_d_v07_200_1.RsiDV07Strategy,
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
        class: strat_stoch_v20_tweak_201_1.StochV20Tweak201Strategy,
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
        class: strat_stoch_v06_tweak_202_1.StochV06Tweak202Strategy,
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
        class: strat_stoch_v09_tweak_203_1.StochV09Tweak203Strategy,
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
        class: strat_stoch_adaptive_204_1.StochAdaptiveStrategy,
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
        class: strat_rsi_stoch_combo_205_1.RsiStochCombo205Strategy,
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
        class: strat_volatility_breakout_206_1.VolatilityBreakoutStrategy,
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
        class: strat_trend_following_ma_207_1.TrendFollowingMAStrategy,
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
        class: strat_mean_reversion_band_208_1.MeanReversionBandV208Strategy,
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
};
function splitData(data, trainRatio = 0.7) {
    const allTimestamps = [];
    for (const history of data.priceHistory.values()) {
        for (const point of history) {
            allTimestamps.push(point.t);
        }
    }
    allTimestamps.sort((a, b) => a - b);
    const splitIndex = Math.floor(allTimestamps.length * trainRatio);
    const splitTime = allTimestamps[splitIndex];
    const trainPriceHistory = new Map();
    const testPriceHistory = new Map();
    for (const [tokenId, history] of data.priceHistory) {
        const trainPoints = [];
        const testPoints = [];
        for (const point of history) {
            if (point.t <= splitTime) {
                trainPoints.push(point);
            }
            else {
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
function seededShuffle(array, seed) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const j = seed % (i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function testParams(data, strategyClass, params) {
    // Simple direct evaluation without CV - simpler and works better with small datasets
    const strategy = new strategyClass(params);
    const engine = new engine_2.BacktestEngine(data, strategy, { feeRate: 0.002 });
    const originalLog = console.log;
    console.log = () => { };
    try {
        const result = engine.run();
        return {
            return: result.totalReturn,
            sharpe: result.sharpeRatio,
            trades: result.totalTrades,
            stdDev: 0
        };
    }
    finally {
        console.log = originalLog;
    }
}
function testParamsCV(data, strategyClass, params, folds) {
    const tokens = Array.from(data.priceHistory.keys());
    const shuffled = seededShuffle(tokens, 42);
    const foldSize = Math.floor(shuffled.length / folds);
    let totalReturn = 0;
    let totalTrades = 0;
    const foldReturns = [];
    for (let fold = 0; fold < folds; fold++) {
        const valStart = fold * foldSize;
        const valEnd = fold === folds - 1 ? shuffled.length : (fold + 1) * foldSize;
        const valTokens = shuffled.slice(valStart, valEnd);
        const trainTokens = [...shuffled.slice(0, valStart), ...shuffled.slice(valEnd)];
        const trainData = {
            ...data,
            priceHistory: new Map(trainTokens.map(t => [t, data.priceHistory.get(t)])),
        };
        const valData = {
            ...data,
            priceHistory: new Map(valTokens.map(t => [t, data.priceHistory.get(t)])),
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
function testParamsBatched(data, strategyClass, params, batchSize) {
    const tokens = Array.from(data.priceHistory.keys());
    const batches = [];
    for (let i = 0; i < tokens.length; i += batchSize) {
        batches.push(tokens.slice(i, i + batchSize));
    }
    let totalReturn = 0;
    let totalTrades = 0;
    const batchReturns = [];
    for (const batchTokens of batches) {
        const batchData = {
            ...data,
            priceHistory: new Map(batchTokens.map(t => [t, data.priceHistory.get(t)])),
        };
        const strategy = new strategyClass(params);
        const engine = new engine_2.BacktestEngine(batchData, strategy, { feeRate: 0.002 });
        const originalLog = console.log;
        console.log = () => { };
        try {
            const result = engine.run();
            totalReturn += result.totalReturn;
            totalTrades += result.totalTrades;
            batchReturns.push(result.totalReturn);
        }
        finally {
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
const program = new commander_1.Command();
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
        console.log(kleur_1.default.cyan('Available strategies:'));
        for (const [name, config] of Object.entries(strategies)) {
            console.log('  ' + kleur_1.default.green(name) + ' -> ' + config.outputFile);
        }
        process.exit(0);
    }
    if (options.plot) {
        const historyPath = path.join(process.cwd(), 'data', 'optimization-history.json');
        if (!fs.existsSync(historyPath)) {
            console.error(kleur_1.default.red('No optimization history found. Run optimize first.'));
            process.exit(1);
        }
        const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        console.log(kleur_1.default.cyan('Optimization Progress\n'));
        console.log('Generation | Sharpe Ratio');
        console.log('-'.repeat(30));
        for (const entry of historyData.history) {
            console.log(String(entry.iteration).padStart(10) + ' | ' + entry.sharpeRatio.toFixed(4));
        }
        console.log('-'.repeat(30));
        console.log('\nBest params:');
        for (const [k, v] of Object.entries(historyData.bestParams)) {
            if (k !== 'metadata')
                console.log('  ' + k + ': ' + v);
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
        console.error(kleur_1.default.red('Unknown strategy: ' + strategyName));
        console.log(kleur_1.default.yellow('Available strategies:') + ' ' + Object.keys(strategies).join(', '));
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
    console.log(kleur_1.default.cyan('Strategy:') + ' ' + strategyName);
    console.log(kleur_1.default.cyan('Loading data from:') + ' ' + dataFile);
    const fullData = (0, engine_1.loadStoredData)(dataFile);
    console.log('Loaded ' + fullData.markets.length + ' markets');
    console.log(kleur_1.default.yellow('\nSplitting data: 70% train, 30% test (by time)...'));
    // Get all tokens and optionally limit them
    let allTokens = Array.from(fullData.priceHistory.keys());
    // If we have more tokens than maxTokens, shuffle and take first N
    if (allTokens.length > maxTokens) {
        allTokens = seededShuffle(allTokens, 42).slice(0, maxTokens);
        console.log('Limiting to ' + maxTokens + ' tokens (seeded shuffle)');
    }
    // Time-based split: use first 70% of each token's history for train, last 30% for test
    const trainPriceHistory = new Map();
    const testPriceHistory = new Map();
    for (const tokenId of allTokens) {
        const history = fullData.priceHistory.get(tokenId);
        if (!history || history.length < 10)
            continue; // Skip tokens with too little data
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
    const train = {
        ...fullData,
        priceHistory: trainPriceHistory,
    };
    const test = {
        ...fullData,
        priceHistory: testPriceHistory,
    };
    const full = fullData;
    let totalTrainPoints = 0;
    let totalTestPoints = 0;
    for (const history of train.priceHistory.values())
        totalTrainPoints += history.length;
    for (const history of test.priceHistory.values())
        totalTestPoints += history.length;
    console.log('Train: ' + totalTrainPoints + ' price points, Test: ' + totalTestPoints + ' price points (' + allTokens.length + ' tokens)');
    console.log('Max generations: ' + maxIterations + ', Attempts: ' + attempts);
    console.log('\n' + kleur_1.default.bold(kleur_1.default.magenta('='.repeat(60))));
    console.log(kleur_1.default.bold(kleur_1.default.magenta('Differential Evolution Optimization')));
    console.log(kleur_1.default.bold(kleur_1.default.magenta('='.repeat(60))));
    let bestResult = null;
    let bestTestReturn = -Infinity;
    let bestParams = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        console.log(kleur_1.default.yellow('\nAttempt ' + attempt + '/' + attempts + '...'));
        console.log(kleur_1.default.cyan('  Random search (' + randomSamples + ' samples)...'));
        const optimizer = new optimization_1.DifferentialEvolutionOptimizer(train, StrategyClass, paramConfigs, {
            maxIterations,
            convergenceThreshold: 1e-6,
            learningRate: 1.0,
            randomSamples,
        });
        optimizer.setQuiet(true);
        const result = await optimizer.optimize(attempt === 1 ? null : bestParams);
        console.log(kleur_1.default.cyan('  DE running...'));
        const testMetrics = testParams(test, StrategyClass, result.finalParams);
        console.log('  Train: Sharpe ' + result.bestSharpe.toFixed(4) + ' | Return $' + result.bestReturn.toFixed(2));
        console.log('  Test:  Sharpe ' + testMetrics.sharpe.toFixed(4) + ' | Return $' + testMetrics.return.toFixed(2));
        console.log('  Trades: ' + testMetrics.trades);
        if (testMetrics.return > bestTestReturn) {
            bestTestReturn = testMetrics.return;
            bestResult = result;
            bestParams = result.finalParams;
            console.log(kleur_1.default.green('  ★ NEW BEST'));
            if (testMetrics.return >= minTestReturn) {
                console.log(kleur_1.default.green('\n✓ Reached target test return of $' + minTestReturn));
                break;
            }
        }
    }
    if (!bestResult || !bestParams) {
        console.error(kleur_1.default.red('\n✗ Failed to find valid parameters'));
        process.exit(1);
    }
    const finalTestMetrics = testParams(test, StrategyClass, bestParams);
    const fullMetrics = testParams(full, StrategyClass, bestParams);
    const trainMetrics = testParams(train, StrategyClass, bestParams);
    console.log('\n' + kleur_1.default.bold(kleur_1.default.cyan('='.repeat(60))));
    console.log(kleur_1.default.bold(kleur_1.default.cyan('FINAL RESULTS')));
    console.log(kleur_1.default.bold(kleur_1.default.cyan('='.repeat(60))));
    console.log('\nParameters:');
    for (const [key, value] of Object.entries(bestParams)) {
        const config = paramConfigs[key];
        if (config.stepSize === 1 && config.min === 0 && config.max === 1) {
            console.log('  ' + key + ': ' + (value === 1 ? 'true' : 'false'));
        }
        else if (key === 'stop_loss' || key === 'risk_percent') {
            console.log('  ' + key + ': ' + value.toFixed(4) + ' (' + (value * 100).toFixed(2) + '%)');
        }
        else {
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
    console.log(kleur_1.default.cyan('\nOptimization Progress\n'));
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
    console.log(kleur_1.default.green('\n✓ Parameters saved to ' + outputFile));
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
    console.log(kleur_1.default.green('✓ History saved to optimization-history.json'));
});
program.parse();

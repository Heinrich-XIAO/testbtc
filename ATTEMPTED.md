# ATTEMPTED.md

## Failed Attempts

### RSI Mean Reversion
- **Strategy**: Buy when RSI < oversold, sell when RSI > overbought
- **Result**: 0 trades - RSI requires warmup period that exceeds available data per token
- **Test Return**: $0.00

### ATR Breakout
- **Strategy**: Buy when price breaks above recent high + ATR multiplier
- **Result**: 0 trades - breakout signals too rare with limited data
- **Test Return**: $0.00

### Support/Resistance Bounce
- **Strategy**: Buy when price bounces off support level
- **Test Return**: $1.91
- **Test Sharpe**: -1.2799
- Worse than baseline

### MA + ATR Stop
- **Strategy**: MA crossover with ATR-based trailing stop
- **Test Return**: $0.73
- **Test Sharpe**: 1.0011
- Worse than baseline

### Bollinger Bands (Mean Reversion)
- **Strategy**: Buy when price touches lower band, sell at upper band
- **Parameters**: period=15, std_dev=1.8, stop_loss=1.05%, trailing_stop=true, mean_reversion=true
- **Train Return**: -$28.94 (stdDev: $51.31)
- **Test Return**: $49.40 (stdDev: $147.34)
- **Full Return**: -$51.36 (stdDev: $71.57)
- **Trades**: 7
- **Verdict**: OVERFIT - Test positive but Train/Full negative, only 7 trades, high variance

### Momentum Simple
- **Strategy**: Buy when price momentum exceeds threshold, sell when negative
- **Parameters**: lookback=14, threshold=3%
- **Train Return**: -$51.47 (stdDev: $55.63)
- **Test Return**: -$20.18 (stdDev: $16.04)
- **Full Return**: -$58.19 (stdDev: $41.37)
- **Trades**: 13
- **Verdict**: FAILED - Negative returns across all sets

### Trend Follow
- **Strategy**: Buy on N consecutive up bars, exit on down bar
- **Parameters**: trend_bars=5, stop_loss=8.86%
- **Train Return**: -$3.13 (stdDev: $9.38)
- **Test Return**: -$0.59 (stdDev: $2.21)
- **Full Return**: -$3.72 (stdDev: $11.41)
- **Trades**: 0 (on test set)
- **Verdict**: FAILED - Not enough trades triggered

## Successful Attempts

### Simple MA (Current Best) - Time-based Split
- **Strategy**: Fast/Slow MA crossover with fixed stop loss
- **Parameters**: fast=20, slow=25, stop_loss=4.06%, risk=10.16%
- **Train Return**: $565.13 (Sharpe: 1.30)
- **Test Return**: $65.07 (Sharpe: 0.38)
- **Full Return**: $267.20 (Sharpe: 1.23)
- **Trades**: 55
- **Data**: test-data.bson (10 tokens, 738 points each)
- **Split**: Time-based (70% train, 30% test)

### Simple MA (Baseline) - Token-based Split
- **Strategy**: Fast/Slow MA crossover with fixed stop loss
- **Test Return**: $24.54
- **Test Sharpe**: 1.0226
- Previous best with token-based splitting

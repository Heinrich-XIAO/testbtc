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

## Successful Attempts

### Simple MA (Baseline)
- **Strategy**: Fast/Slow MA crossover with fixed stop loss
- **Test Return**: $24.54
- **Test Sharpe**: 1.0226
- Best performing strategy so far

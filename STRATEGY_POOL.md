# Strategy Ideas Pool - NOVEL LOGIC ONLY

## Available Novel Strategies to Test

1. **Volume confirmation** - Only enter when volume > average (NEW CONDITION)
2. **Spread filter** - Skip trades where spread is too wide (NEW CONDITION)
3. **RSI filter** - Add RSI filter to entry (DIFFERENT INDICATOR)
4. **MACD entry** - Use MACD crossover instead of stochastic (DIFFERENT INDICATOR)
5. **Bollinger entry** - Use Bollinger Bands for entries (DIFFERENT INDICATOR)
6. **Trailing stop only** - No profit target, only trailing stop exit (NEW EXIT LOGIC)
7. **Time exit only** - Exit after N bars regardless of profit (NEW EXIT LOGIC)
8. **Volatility-adjusted** - Adjust parameters based on ATR (NEW CONDITION)
9. **Range filter** - Only trade in ranging markets (NEW CONDITION)
10. **Mean reversion** - Different approach: buy oversold, sell overbought

## Tested & Won

- iter15_a: Lookback 51 + support confirmation = $181 small, $853 large (STOCH+SR)
- iter20_a: Lookback 51 + max hold 32 = $125 small, $943 large

## Tested & Discarded (parameter-only, not novel)

- Lookback variations (50, 51, 52, 55, 60, 70, 80) - all same logic
- Max hold variations (20, 28, 32, 35, 40) - all same logic
- Risk variations - all same logic
- Stoch period variations - all same logic

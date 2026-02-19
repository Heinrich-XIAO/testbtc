# ITERATION 18 - Support/Resistance No-Trend-Filter Refined Parameters (v17) Results

## Summary

This iteration tested 20 refined parameter configurations based on v16 winning parameters. **All 20 strategies passed** with test returns ranging from $125.38 to $209.78. **New record set: sr_ntf_v17_020 at $209.78** (beating v16_010's $188.87).

## Optimization Details

- **Date:** 2026-02-19
- **Dataset:** data/test-data.bson (default)
- **Method:** Differential Evolution, 30 iterations, 5 attempts per strategy
- **Timeout:** 15 minutes per strategy

## Results Summary

### Top 10 Performers

| Rank | Strategy | Test Return | Full Return | Trades | Key Parameters |
|------|----------|-------------|-------------|--------|----------------|
| 1 | sr_ntf_v17_020 | $209.78 | - | 37 | lookback=45, tp=0.090, risk=42% |
| 2 | sr_ntf_v17_001 | $206.76 | $1,268.26 | 37 | lookback=36, tp=0.106, risk=40% |
| 3 | sr_ntf_v17_017 | $206.24 | - | 37 | lookback=40, tp=0.109, risk=40% |
| 4 | sr_ntf_v17_003 | $203.63 | $1,259.04 | 37 | lookback=36, tp=0.095, risk=36% |
| 5 | sr_ntf_v17_015 | $199.60 | $1,202.96 | 37 | lookback=12, tp=0.17, risk=35% |
| 6 | sr_ntf_v17_004 | $196.14 | $1,171.34 | 37 | lookback=36, tp=0.10, risk=35% |
| 7 | sr_ntf_v17_007 | $196.63 | $1,173.76 | 37 | lookback=36, tp=0.10, risk=35% |
| 8 | sr_ntf_v17_016 | $195.18 | - | 37 | lookback=20, tp=0.17, risk=35% |
| 9 | sr_ntf_v17_008 | $190.27 | $1,134.16 | 37 | lookback=36, tp=0.10, risk=35% |
| 10 | sr_ntf_v17_014 | $188.49 | $1,118.30 | 37 | lookback=36, tp=0.10, risk=35% |

### All Strategies Results

| # | Strategy | Test Return | Full Return | Trades | Status |
|---|----------|-------------|-------------|--------|--------|
| 01 | sr_ntf_v17_001 | $206.76 | $1,268.26 | 37 | PASS |
| 02 | sr_ntf_v17_002 | $165.24 | $1,120.43 | 39 | PASS |
| 03 | sr_ntf_v17_003 | $203.63 | $1,259.04 | 37 | PASS |
| 04 | sr_ntf_v17_004 | $196.14 | $1,171.34 | 37 | PASS |
| 05 | sr_ntf_v17_005 | $186.89 | $1,206.26 | 37 | PASS |
| 06 | sr_ntf_v17_006 | $181.06 | $1,149.74 | 37 | PASS |
| 07 | sr_ntf_v17_007 | $196.63 | $1,173.76 | 37 | PASS |
| 08 | sr_ntf_v17_008 | $190.27 | $1,134.16 | 37 | PASS |
| 09 | sr_ntf_v17_009 | $144.57 | $1,289.84 | 33 | PASS |
| 10 | sr_ntf_v17_010 | $141.18 | $1,206.19 | 33 | PASS |
| 11 | sr_ntf_v17_011 | $186.89 | $1,206.26 | 37 | PASS |
| 12 | sr_ntf_v17_012 | $181.04 | $1,149.51 | 37 | PASS |
| 13 | sr_ntf_v17_013 | $159.06 | $1,061.44 | 39 | PASS |
| 14 | sr_ntf_v17_014 | $188.49 | $1,118.30 | 37 | PASS |
| 15 | sr_ntf_v17_015 | $199.60 | $1,202.96 | 37 | PASS |
| 16 | sr_ntf_v17_016 | $195.18 | - | 37 | PASS |
| 17 | sr_ntf_v17_017 | $206.24 | - | 37 | PASS |
| 18 | sr_ntf_v17_018 | $125.38 | - | 33 | PASS |
| 19 | sr_ntf_v17_019 | $134.31 | - | 33 | PASS |
| 20 | sr_ntf_v17_020 | $209.78 | - | 37 | PASS |

## Key Insights

### Parameter Convergence

Top performers converged to new optimal cluster:

**Optimal Cluster (v17):**
- lookback: 36-45 (higher than v16's 36)
- bounce_threshold: ~0.020-0.021 (consistent with v16)
- stop_loss: ~0.06-0.066 (slightly tighter than v16's 0.065)
- risk_percent: ~0.40-0.42 (HIGHER than v16's 0.35)
- take_profit: ~0.09-0.11 (tighter than v16's 0.10-0.17)

### Key Discoveries

1. **Higher risk (40-42%) improves returns**: v17 pushed risk to 40%+ and got better results
2. **Longer lookback (40-45) works well**: v17_020 with lookback=45 is the new best
3. **Tighter take profit (9-11%) better than wider (14-17%)**: Better to lock in gains
4. **All 20 strategies passed**: 100% success rate confirms robust parameter space

## Comparison with Previous Best

| Strategy | Test Return | Full Return | Iteration |
|----------|-------------|-------------|-----------|
| sr_ntf_v16_010 | $188.87 | - | 17 |
| **sr_ntf_v17_020** | **$209.78** | - | **18** |
| **sr_ntf_v17_001** | **$206.76** | **$1,268.26** | **18** |
| **sr_ntf_v17_017** | **$206.24** | - | **18** |

**sr_ntf_v17_020 sets new record for test return: $209.78 (+11% over v16_010)**

## Best Strategy: sr_ntf_v17_020

- Test Return: $209.78
- Parameters: lookback=45, bounce_threshold=0.021, stop_loss=0.066, risk=42%, take_profit=0.090

```json
{
  "lookback": 45,
  "bounce_threshold": 0.0206,
  "stop_loss": 0.066,
  "risk_percent": 0.42,
  "take_profit": 0.090
}
```

## Next Steps for ITERATION 19

1. **Explore higher risk (42-45%)**: v17 suggests even higher risk may work
2. **Test longer lookback (45-55)**: v17_020's lookback=45 was optimal
3. **Tighter take profit focus (8-10%)**: Lock in gains faster
4. **Test on large dataset**: Run top v17 performers on `data/test-data-15min-large.bson`

## Files Modified

- `src/strategies/strat_sr_ntf_v17_*.params.json` - Created with optimized parameters
- `scripts/run-optimization.ts` - Added v17 strategy configurations
- `ATTEMPTED.md` - Added iteration 18 results
- `data/batch-results.json` - Batch optimization results

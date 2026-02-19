# HANDOFF - Iteration Process Status

## Current Status: ITERATION 18 COMPLETED

**Last completed:** 2026-02-19
**Next iteration:** ITERATION 19 (target: iteration 250)

## What Was Done

### ITERATION 18 Results
- Ran batch optimization for 20 sr_ntf_v17 strategies
- **All 20 strategies passed** (100% success rate)
- Best test return: $209.78 (sr_ntf_v17_020) - NEW RECORD (+11% over v16)
- Key discovery: Higher risk (40-42%) and longer lookback (45) improve returns
- Files updated:
  - `src/strategies/strat_sr_ntf_v17_*.params.json` (all 20)
  - `ATTEMPTED.md` (added iteration 18 results)
  - `ITERATION_18.md` (created)
  - `scripts/run-optimization.ts` (added v17 strategy configs)

## How "The Iteration" Process Works

Based on the pattern in ITERATION_1 through ITERATION_18:

1. **Analyze previous results** - Read the latest ITERATION_*.md
2. **Prepare strategies** - Create new strategy variants or tweak existing ones
3. **Run optimization** - Use batch-optimize.ts:
   ```bash
   bun run scripts/batch-optimize.ts --only strategy1,strategy2,... --iterations 30 --attempts 5 --timeout-minutes 15 --concurrency 1
   ```
4. **Document results** - Update ATTEMPTED.md and create new ITERATION_*.md
5. **Identify next steps** - Plan what to test in next iteration

## Key Files

| File | Purpose |
|------|---------|
| `ITERATION_*.md` | Detailed results for each iteration |
| `ATTEMPTED.md` | Cumulative log of all attempts (successful/failed) |
| `AGENTS.md` | Project rules (always use `bun`, test with `bun run optimize`) |
| `src/strategies/strat_*.ts` | Strategy implementations |
| `src/strategies/strat_*.params.json` | Optimized parameters |

## Current Best Strategy

**sr_ntf_v17_020** - Test Return: $209.78
```
lookback: 45
bounce_threshold: 0.021
stop_loss: 0.066
risk_percent: 0.42
take_profit: 0.090
```

## Next Steps for ITERATION 19

1. Explore higher risk (42-45%) based on v17 findings
2. Test longer lookback (45-55) - v17_020's lookback=45 was optimal
3. Focus on tighter take profit (8-10%)
4. Run top v17 performers on `data/test-data-15min-large.bson`

## Running the Next Iteration

```bash
# To optimize specific strategies:
bun run scripts/batch-optimize.ts --only strategy_name --iterations 30 --attempts 5

# To optimize single strategy:
bun run optimize -s strategy_name -i 30 -a 5
```

## Progress to Goal (250 iterations)

- Current: ITERATION 18
- Target: ITERATION 250
- Remaining: 232 iterations
- Progress: 7.2% complete
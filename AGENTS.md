# Polymarket Trading Agent Guidelines

## Runtime

- **NEVER use `node`** - always use `bun` for running scripts
- Example: `bun .cache/run-optimization.js` NOT `node .cache/run-optimization.js`

## Testing Performance

When adding new logic or making changes to the trading strategy:
1. Always parameterize any new logic so it can be easily toggled and tested
2. Always run `bun run optimize --deterministic-slow` to test performance
2. If performance is worse, always revert the changes and add the attempt to ATTEMPTED.md (failed section)
3. If performance is better, add it to ATTEMPTED.md (successful section)

## ATTEMPTED.md

Keep track of all attempts - both successful and failed.

## Strategy

When asked about a trading strategy, default to simple_ma.

## Dataset Policy

- Large candidate dataset file: `data/test-data-15min-large.bson`
- This file is experimental and MUST NOT replace the default optimization dataset until there is explicit evidence that it improves out-of-sample performance and reduces overfitting.
- Required evidence before promoting this dataset:
  - Run optimization/backtest comparisons on both datasets (`data/test-data.bson` vs `data/test-data-15min-large.bson`)
  - Show improved or comparable test returns with better train/test consistency (lower overfit ratio)
  - Record results in `ATTEMPTED.md`
- Once that evidence exists, ALWAYS run optimization/backtests on `data/test-data-15min-large.bson` by default.

# Iterations

## Definition and Workflow

**Note:** When someone says "do 'the iterations'", it means to perform the full iteration protocol as described in this section.

**Important:** Never stop an iteration partway; always complete the full iteration protocol and only stop at the end of the complete iterations cycle.

An **Iteration** is a coordinated round where subagents independently review, improve, or replace strategy variants from the previous iteration's summary (e.g., `ITERATION_15.md`). Each subagent receives a distinct strategy, has read-access to the full previous summary for context, and must ensure that their approach is distinct from other subagents in the current round.

### Protocol

1. **Input**: The main agent gathers strategy variants that performed well or have an obvious fixable problem from the last iteration.
2. **Assignment**: Each subagent gets a unique strategy. Subagents reference the prior summary, but must avoid converging on the same improvements.
3. **Assessment**: Each subagent determines if their assigned strategy is
   - "Hopeless" (bad performance, no clear fix): mutate extensively or invent a fresh idea
   - "Good/fixable": propose and implement an improvement (wild or incremental)
4. **Test (local)**: Strategies are locally tested for sanity or improvement. 
5. **Document**: Subagents write up rationale, results, and explicit next steps for each strategy. The main agent compiles these into a strict, sectioned `ITERATION_xx.md` (see below).
6. **Global Optimization**: Only strategies clearing local improvement are run with `bun run optimize` for full-scale performance checks.
7. **Reversion Guidance**: If a new version is worse, subagent notes tell the next iteration to reconsider the earlier baseline.

## Strict Markdown Structure for Iterations

Every `ITERATION_xx.md` must contain:
- Metadata (date, assignments)
- Strategy Summary Table: key metrics, actions, notes
- Subagent Actions Section (for each agent/strategy)
- List of "Hopeless/Discarded" strategies and reasons
- Required "Key Insights" / Learnings
- Optional freeform/experimental notes

## Parameter and Permutation Ceiling

In order to support practical iteration and avoid slowdowns from combinatorial explosions:
- Limit the number of parameters varied simultaneously. Most effective strategies (see ITERATION 15) share core parameter values (e.g., tight stochastic + tight momentum).
- When running local tests or generating new variants:
  - **Keep the total number of permutations below 30**.
  - Prefer modifying one parameter at a time unless breakthrough context demands otherwise.
  - Example core parameters to sweep (with typical effective values from prior results):
    - Stochastic oversold: 14 (tight preferred)
    - Stochastic overbought: 84
    - Momentum threshold: 0.012 (tight)
    - Profit target: 18% (optional for variety)
    - Position/risk: generally normal/20%
    - Bounce requirement: 1 (not 2)
    - Multi-exit: Off
- Only after local improvements are seen should broader sweeps or additional permutations be considered.

This ceiling keeps iterations efficient, focused, and empirically guided by what works—while still allowing for creative exploration when appropriate.

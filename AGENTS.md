# Polymarket Trading Agent Guidelines

## Runtime

- **NEVER use `node`** - always use `bun` for running scripts
- Example: `bun .cache/run-optimization.js` NOT `node .cache/run-optimization.js`

## Testing Performance

When adding new logic or making changes to the trading strategy:
1. Always parameterize any new logic so it can be easily toggled and tested
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

An **Iteration** is a coordinated round where the main agent ideates 10 distinct new strategies, and 10 subagents independently implement them. Each subagent receives a unique strategy concept, has read-access to the full previous summary for context, and must ensure their implementation is distinct from other subagents in the current round.

### Protocol

1. **Ideation**: Main agent generates 10 distinct strategy ideas/concepts to explore
2. **Assignment**: Each of 10 subagents receives a unique strategy concept to implement
3. **Implementation**: Each subagent independently implements their assigned strategy, ensuring unique logic and avoiding convergence with other agents
4. **Test (local)**: All 10 strategies are locally tested for sanity or improvement
5. **Document**: Main agent compiles results into `ITERATION_xx.md` with strict markdown structure
6. **Completion**: Only stop iterations after all 10 strategies have been implemented and documented

### What "New Strategy" Means

**Creating a new strategy means CHANGING THE LOGIC, not tweaking parameters.**

Examples of valid "new strategy" changes:
- **Adding conditions**: "Only enter if volume > average" or "Skip trades where spread is too wide"
- **Removing conditions**: "Remove the trend filter" or "Drop the momentum requirement"
- **Changing entry/exit logic**: "Exit on RSI overbought instead of profit target" or "Add trailing stop"
- **Complete rewrites**: If a strategy is hopeless, create something fundamentally different

**NOT valid (parameter tweaking):**
- Changing `stop_loss` from 0.08 to 0.06
- Changing `risk_percent` from 0.30 to 0.45
- Changing `lookback` from 18 to 36

Parameter tweaks can be part of testing, but the CORE of iteration work is LOGIC changes - new conditions, new rules, new behaviors that address specific observed problems in trades.

## Strict Markdown Structure for Iterations

Every `ITERATION_xx.md` must contain:
- Metadata (date, number of strategies)
- Strategy Summary Table: key metrics, actions, notes for all 10 strategies
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

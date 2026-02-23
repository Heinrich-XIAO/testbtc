# Polymarket Trading Agent Guidelines

## Runtime

- **NEVER use `node`** - always use `bun` for running scripts
- Example: `bun scripts/run-backtest.ts` NOT `node scripts/run-backtest.ts`

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

- Default dataset: `data/test-data.bson`
- Validation dataset: `data/test-data-15min-large.bson`
- Always test on both datasets before declaring a winner

# Iterations

## Definition and Workflow

**Note:** When someone says "do 'the iterations'", it means to perform the full iteration protocol as described in this section.

**Important:** Never stop an iteration partway; always complete the full iteration protocol and only stop at the end of the complete iterations cycle.

An **Iteration** is a coordinated round where the main agent ideates 3 distinct new strategies, and 3 subagents independently implement them. Each subagent receives a unique strategy concept and must ensure their implementation is distinct from other agents in the current round.

## Proven Effective Patterns (From 26 Prior Iterations)

These patterns have been validated through extensive testing. Use them as building blocks:

### What WORKS
1. **No trend filter** - Trend filters hurt performance; remove them
2. **Tight stochastic entry** - oversold: 14-18, overbought: 82-86
3. **Tight momentum filter** - threshold: 0.008-0.012
4. **Wider lookback** - max_lookback: 50 (not default 36)
5. **Support retest requirement** - Require price to test support twice before entry
6. **Simple exit rules** - Single profit target + stop loss (no multi-exit)

### What DOESN'T WORK (Avoid These)
1. **Multi-exit mechanisms** - Overcomplicates and hurts performance
2. **Day/time filters** - Skip Monday/Friday, time-of-day filters don't help
3. **Additional indicators** - ADX, VWAP, Bollinger, RSI exits all failed
4. **Shorter hold times** - max_hold < 20 hurts returns
5. **Higher risk** - risk > 0.30 increases volatility without improving returns
6. **Multiple bounce requirements** - bounce=1 is optimal, bounce=2 is too restrictive

## Phased Iteration Approach

Iterations should follow a logical progression:

### Phase 1: Baseline & Discovery (Iterations 0-5)
- Establish baseline with simple stochastic strategies
- Test core indicator combinations
- Identify what works on both small and large datasets
- Goal: Find initial winners with positive test returns

### Phase 2: Filter Optimization (Iterations 6-12)
- Remove harmful filters (trend filter was key discovery)
- Optimize entry conditions (tight vs loose)
- Test momentum requirements
- Goal: Improve train/test consistency

### Phase 3: Logic Refinement (Iterations 13-20)
- Add entry confirmation logic (retest, bounce quality)
- Optimize lookback periods
- Fine-tune exit conditions
- Goal: Incremental improvements on winner

### Phase 4: Validation (Iterations 21-25)
- Test winners on both small and large datasets
- Verify no overfitting (test return should be positive)
- Final parameter optimization
- Goal: Confirm robust strategy

## Protocol

1. **Ideation**: Main agent generates 3 distinct strategy ideas/concepts to explore
2. **Assignment**: Each of 3 subagents receives a unique strategy concept to implement
3. **Implementation**: Each subagent independently implements their assigned strategy with fundamentally sound logic
4. **Test**: All 3 strategies are tested via backtest
5. **Document**: Main agent compiles results into `ITERATION_xx.md` with strict markdown structure
6. **Completion**: Only stop iterations after all 3 strategies have been implemented and documented

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

## Fundamentally Good Strategy Principles

When creating strategies, follow these principles:

1. **Clear entry signal**: Use well-understood technical indicators (stochastic, RSI, MA crossovers)
2. **Defined risk management**: Always have stop loss and position sizing
3. **Simple is better**: Avoid complex multi-condition logic
4. **Testable hypothesis**: Each strategy should test a specific hypothesis about market behavior
5. **Reasonable defaults**: Start with sensible default parameters based on proven patterns

## Strict Markdown Structure for Iterations

Every `ITERATION_xx.md` must contain:
- Metadata (date, number of strategies, phase)
- Strategy Summary Table: key metrics, actions, notes for all 3 strategies
- Subagent Actions Section (for each agent/strategy)
- List of "Hopeless/Discarded" strategies and reasons
- Required "Key Insights" / Learnings
- Comparison to best known strategy
- Optional freeform/experimental notes

## Testing Requirements

Every strategy must be tested on BOTH:
1. **Small dataset**: `data/test-data.bson` (fast iteration)
2. **Large dataset**: `data/test-data-15min-large.bson` (validation)

A strategy is only considered a winner if:
- Positive return on BOTH datasets
- Large dataset return >= small dataset return (no overfitting)
- At least 15 trades on small dataset (statistical significance)

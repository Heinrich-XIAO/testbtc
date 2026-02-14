# Polymarket Trading Agent Guidelines

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

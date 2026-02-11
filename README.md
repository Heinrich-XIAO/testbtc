# BTC Tools

Collection and training helpers for per-second BTC/USD data. Packaged as a module to be usable via CLI entry points (`btc-collector`, `btc-trainer`) or `python -m btc_tools`.

## Installation

```bash
python -m pip install --upgrade .
```

## Collector

Persists CoinAPI OHLCV data using an async HTTP client and `uvloop` for the event loop. Supply a CoinAPI key with `COINAPI_KEY` or `--api-key`.

Example:

```bash
btc-collector --output data/btc_1s.csv --months 3
```

## Trainer

Consumes the collected CSV to fit a lightweight GRU classifier.

```bash
btc-trainer --data data/btc_1s.csv --epochs 10
```

"""Track yes-token trade averages via py-clob-client."""
from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests
from py_clob_client.client import ClobClient
from py_clob_client.clob_types import BookParams

# Configuration
MARKETS_API_URL = "https://gamma-api.polymarket.com/markets"
CLOB_HOST = "https://clob.polymarket.com"
DEFAULT_MARKETS_TO_SAMPLE = 10
DEFAULT_ITERATIONS = 60
DEFAULT_INTERVAL_SECONDS = 1.0
DEFAULT_VOLATILITY_DURATION_SECONDS = 5.0
DEFAULT_VOLATILITY_INTERVAL_SECONDS = 1.0
DEFAULT_CANDIDATE_MULTIPLIER = 3
EXPORT_DIR = Path("py_clob_samples")
EXPORT_FILENAME_TEMPLATE = "py_clob_samples_{timestamp}.json"


@dataclass
class MarketToken:
    market_id: str
    question: str
    token_id: str
    history: List[Dict[str, Optional[float]]] = field(default_factory=list)


def _float_env(name: str, default: float) -> float:
    try:
        value = os.environ.get(name)
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _int_env(name: str, default: int) -> int:
    try:
        value = os.environ.get(name)
        if value is None:
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _load_markets(limit: int) -> List[dict]:
    response = requests.get(
        MARKETS_API_URL,
        params={"limit": limit, "closed": "false"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _normalize_token_ids(values: Optional[str | list]) -> List[str]:
    if not values:
        return []
    if isinstance(values, list):
        return [str(item) for item in values if item]
    text = values.strip()
    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed if item]
        except json.JSONDecodeError:
            pass
    return [text]


def select_markets(limit: int) -> List[MarketToken]:
    markets = _load_markets(limit * 3)
    selected: List[MarketToken] = []
    seen: set[str] = set()

    for market in markets:
        if len(selected) >= limit:
            break
        for token_id in _normalize_token_ids(market.get("clobTokenIds")):
            if not token_id or token_id in seen:
                continue
            selected.append(
                MarketToken(
                    market_id=str(market.get("id")),
                    question=market.get("question", "Untitled market"),
                    token_id=token_id,
                )
            )
            seen.add(token_id)
            break

    return selected


def average_last_yes_trades(
    client: ClobClient, tokens: List[MarketToken]
) -> Dict[str, float]:
    params = [BookParams(token_id=token.token_id) for token in tokens]
    trades = client.get_last_trades_prices(params)
    by_token: Dict[str, List[float]] = {}
    for trade in trades:
        token_id = trade.get("token_id")
        price = trade.get("price")
        if not token_id or price is None:
            continue
        try:
            by_token.setdefault(token_id, []).append(float(price))
        except (TypeError, ValueError):
            continue

    averages: Dict[str, float] = {}
    for token in tokens:
        prices = by_token.get(token.token_id, [])[:10]
        if not prices:
            continue
        averages[token.token_id] = sum(prices) / len(prices)

    return averages


def _measure_volatility(
    client: ClobClient,
    tokens: List[MarketToken],
    duration_seconds: float,
    interval_seconds: float,
) -> Dict[str, float]:
    if duration_seconds <= 0:
        duration_seconds = interval_seconds if interval_seconds > 0 else DEFAULT_VOLATILITY_DURATION_SECONDS
    if interval_seconds <= 0:
        interval_seconds = DEFAULT_VOLATILITY_INTERVAL_SECONDS

    stats: Dict[str, dict[str, float]] = {
        token.token_id: {"min": float("inf"), "max": float("-inf"), "seen": False}
        for token in tokens
    }
    end_time = time.time() + duration_seconds

    while time.time() < end_time:
        loop_start = time.time()
        averages = average_last_yes_trades(client, tokens)
        for token_id, avg in averages.items():
            state = stats.get(token_id)
            if state is None or avg is None:
                continue
            state["seen"] = True
            state["min"] = min(state["min"], avg)
            state["max"] = max(state["max"], avg)
        elapsed = time.time() - loop_start
        sleep_time = interval_seconds - elapsed
        if sleep_time > 0:
            time.sleep(sleep_time)

    volatility: Dict[str, float] = {}
    for token_id, state in stats.items():
        if not state["seen"]:
            volatility[token_id] = 0.0
            continue
        volatility[token_id] = max(0.0, state["max"] - state["min"])
    return volatility


def _fetch_market_changes(market_ids: List[str]) -> Dict[str, float]:
    if not market_ids:
        return {}
    params = {"marketIds": ",".join(market_ids), "closed": "false"}
    response = requests.get(MARKETS_API_URL, params=params, timeout=15)
    response.raise_for_status()
    changes: Dict[str, float] = {}
    for market in response.json():
        market_id = str(market.get("id"))
        change = market.get("oneHourPriceChange")
        try:
            changes[market_id] = float(change) if change is not None else 0.0
        except (TypeError, ValueError):
            continue
    return changes


def dump_history(tokens: List[MarketToken]) -> Path:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = EXPORT_DIR / EXPORT_FILENAME_TEMPLATE.format(timestamp=timestamp)
    payload = [
        {
            "market_id": token.market_id,
            "question": token.question,
            "token_id": token.token_id,
            "history": token.history,
        }
        for token in tokens
    ]
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    return path


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sample yes-token averages with optional volatility-based filtering."
    )
    parser.add_argument(
        "-m",
        "--markets",
        type=int,
        default=None,
        help="Markets to sample (env: PY_CLOB_MARKETS, default: 10)",
    )
    parser.add_argument(
        "-i",
        "--iterations",
        type=int,
        default=None,
        help="Sampling iterations (env: PY_CLOB_ITERATIONS, default: 60)",
    )
    parser.add_argument(
        "-s",
        "--interval-seconds",
        type=float,
        default=None,
        help="Delay between samples (env: PY_CLOB_INTERVAL_SECONDS, default: 1.0)",
    )
    parser.add_argument(
        "--volatility-duration-seconds",
        type=float,
        default=None,
        help="Seconds to measure volatility before sampling (env: PY_CLOB_VOLATILITY_DURATION_SECONDS, default: 5.0)",
    )
    parser.add_argument(
        "--volatility-interval-seconds",
        type=float,
        default=None,
        help="Cadence when measuring volatility (env: PY_CLOB_VOLATILITY_INTERVAL_SECONDS, default: 1.0)",
    )
    parser.add_argument(
        "--candidate-multiplier",
        type=int,
        default=None,
        help="Candidates per final market (env: PY_CLOB_CANDIDATE_MULTIPLIER, default: 3)",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    limit = max(
        1,
        args.markets if args.markets is not None else _int_env("PY_CLOB_MARKETS", DEFAULT_MARKETS_TO_SAMPLE),
    )
    iterations = max(
        1,
        args.iterations if args.iterations is not None else _int_env("PY_CLOB_ITERATIONS", DEFAULT_ITERATIONS),
    )
    interval_seconds = max(
        0.0,
        args.interval_seconds
        if args.interval_seconds is not None
        else _float_env("PY_CLOB_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS),
    )
    candidate_multiplier = max(
        1,
        args.candidate_multiplier
        if args.candidate_multiplier is not None
        else _int_env("PY_CLOB_CANDIDATE_MULTIPLIER", DEFAULT_CANDIDATE_MULTIPLIER),
    )
    candidate_limit = max(limit * candidate_multiplier, limit)

    tokens = select_markets(candidate_limit)
    if not tokens:
        print("No markets/tokens found.")
        return

    client = ClobClient(CLOB_HOST)
    volatility_duration = (
        args.volatility_duration_seconds
        if args.volatility_duration_seconds is not None
        else _float_env("PY_CLOB_VOLATILITY_DURATION_SECONDS", DEFAULT_VOLATILITY_DURATION_SECONDS)
    )
    volatility_interval = (
        args.volatility_interval_seconds
        if args.volatility_interval_seconds is not None
        else _float_env("PY_CLOB_VOLATILITY_INTERVAL_SECONDS", DEFAULT_VOLATILITY_INTERVAL_SECONDS)
    )
    print(
        f"Measuring volatility for {len(tokens)} candidates over {volatility_duration:.1f}s..."
    )
    volatility = _measure_volatility(client, tokens, volatility_duration, volatility_interval)
    market_ids = [token.market_id for token in tokens if token.market_id]
    market_changes = _fetch_market_changes(market_ids)
    ranked = sorted(
        tokens,
        key=lambda token: (
            volatility.get(token.token_id, 0.0),
            market_changes.get(token.market_id, 0.0),
        ),
        reverse=True,
    )
    tokens = ranked[:limit]
    if volatility:
        max_vol = max(volatility.get(token.token_id, 0.0) for token in tokens)
        print(f"Selected {len(tokens)} markets (max volatility {max_vol:.6f}).")
    else:
        print(f"Selected {len(tokens)} markets (no volatility captured).")

    print(
        f"Sampling {len(tokens)} yes-token averages every "
        f"{interval_seconds:.1f}s for {iterations} iterations."
    )

    for index in range(1, iterations + 1):
        start = time.time()
        averages = average_last_yes_trades(client, tokens)
        elapsed = time.time() - start
        timestamp = datetime.now(timezone.utc).isoformat()

        for token in tokens:
            avg = averages.get(token.token_id)
            token.history.append({"ts": timestamp, "avg": avg})
            if avg is not None:
                print(
                    f"[{index}/{iterations}] {token.market_id} avg={avg:.3f} "
                    f"(API {elapsed:.2f}s)"
                )

        sleep_time = interval_seconds - elapsed
        if sleep_time > 0:
            time.sleep(sleep_time)

    path = dump_history(tokens)
    print(f"\nSaved yes-trade averages to {path}")


if __name__ == "__main__":
    main()

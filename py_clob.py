"""Track yes-token trade averages via py-clob-client."""
from __future__ import annotations

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


def main() -> None:
    limit = _int_env("PY_CLOB_MARKETS", DEFAULT_MARKETS_TO_SAMPLE)
    iterations = _int_env("PY_CLOB_ITERATIONS", DEFAULT_ITERATIONS)
    interval_seconds = _float_env("PY_CLOB_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS)

    tokens = select_markets(limit)
    if not tokens:
        print("No markets/tokens found.")
        return

    client = ClobClient(CLOB_HOST)
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

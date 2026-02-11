"""Monitor markets for 60 minutes and record prices every 30 seconds."""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests

# Configuration
MARKETS_API_URL = "https://gamma-api.polymarket.com/markets"
DEFAULT_MARKETS_TO_SAMPLE = 100
DEFAULT_SAMPLE_INTERVAL_SECONDS = 30
DEFAULT_DURATION_MINUTES = 60
EXPORT_DIR = Path("market_samples")
EXPORT_FILENAME_TEMPLATE = "market_samples_{timestamp}.json"


@dataclass
class MarketSample:
    market_id: Optional[str]
    question: str
    samples: List[Dict[str, float]] = field(default_factory=list)


def _int_env(name: str, default: int) -> int:
    try:
        value = os.environ.get(name)
        if value is None:
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _float_env(name: str, default: float) -> float:
    try:
        value = os.environ.get(name)
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_token_ids(token_ids: Optional[str | list]) -> List[str]:
    if not token_ids:
        return []
    if isinstance(token_ids, list):
        return [str(token) for token in token_ids if token]
    if isinstance(token_ids, str):
        token_ids = token_ids.strip()
        if token_ids.startswith("[") and token_ids.endswith("]"):
            try:
                parsed = json.loads(token_ids)
                if isinstance(parsed, list):
                    return [str(token) for token in parsed if token]
            except json.JSONDecodeError:
                pass
        return [token_ids]
    return [str(token_ids)]


def fetch_markets(limit: int) -> List[dict]:
    response = requests.get(
        MARKETS_API_URL,
        params={"limit": limit, "closed": "false"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def select_markets() -> List[MarketSample]:
    limit = _int_env("MARKETS_TO_SAMPLE", DEFAULT_MARKETS_TO_SAMPLE)
    markets = fetch_markets(limit=limit * 2)
    selected: List[MarketSample] = []

    for market in markets:
        if len(selected) >= limit:
            break
        market_id = str(market.get("id"))
        token_ids = _normalize_token_ids(market.get("clobTokenIds"))
        if not token_ids:
            continue
        selected.append(
            MarketSample(
                market_id=market_id,
                question=market.get("question", "Untitled market"),
            )
        )

    return selected[:limit]


def sample_prices(
    markets: List[MarketSample], duration_minutes: float, interval_seconds: float
) -> None:
    if duration_minutes <= 0:
        duration_minutes = DEFAULT_DURATION_MINUTES
    if interval_seconds <= 0:
        interval_seconds = DEFAULT_SAMPLE_INTERVAL_SECONDS

    iterations = max(1, int((duration_minutes * 60) // interval_seconds))
    deadline = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)

    for index in range(iterations):
        loop_start = time.time()
        api_start = time.time()
        available = fetch_markets(limit=max(200, len(markets)))
        api_elapsed = time.time() - api_start
        lookup = {str(market["id"]): market for market in available}
        timestamp = datetime.now(timezone.utc).isoformat()

        for market in markets:
            if not market.market_id:
                continue
            data = lookup.get(market.market_id)
            if not data:
                continue
            price = data.get("lastTradePrice")
            if price is None:
                continue
            market.samples.append({"ts": timestamp, "price": float(price)})

        completed = sum(len(market.samples) for market in markets)
        print(
            f"[{index+1}/{iterations}] "
            f"collected ~{completed} price points (API took {api_elapsed:.2f}s, next sample in {interval_seconds}s)"
        )

        elapsed = time.time() - loop_start
        sleep_time = interval_seconds - elapsed
        if sleep_time > 0:
            time.sleep(sleep_time)
        if datetime.now(timezone.utc) >= deadline:
            break


def dump_samples(markets: List[MarketSample]) -> Path:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = EXPORT_DIR / EXPORT_FILENAME_TEMPLATE.format(timestamp=timestamp)

    payload = [
        {"market_id": market.market_id, "question": market.question, "samples": market.samples}
        for market in markets
        if market.market_id
    ]

    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    return path


def main() -> None:
    selected_markets = select_markets()
    if not selected_markets:
        print("No markets available to sample.")
        return

    duration_minutes = _float_env("SAMPLE_DURATION_MINUTES", DEFAULT_DURATION_MINUTES)
    interval_seconds = _float_env("SAMPLE_INTERVAL_SECONDS", DEFAULT_SAMPLE_INTERVAL_SECONDS)

    print(
        f"Sampling {len(selected_markets)} markets every {interval_seconds:.0f}s for {duration_minutes:.1f} minutes."
    )
    sample_prices(selected_markets, duration_minutes, interval_seconds)

    print("\nCompleted sampling. Summary:")
    for market in selected_markets:
        count = len(market.samples)
        print(f"- {market.market_id[:8]}: {count} samples ({market.question[:50]})")

    export_path = dump_samples(selected_markets)
    print(f"\nSaved full sample set to {export_path}")


if __name__ == "__main__":
    main()

"""Monitor current prices for selected markets over time."""
from __future__ import annotations

import json
import os

import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

import json


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
    market_id: str
    question: str
    samples: List[Dict[str, str]] = field(default_factory=list)


def fetch_markets(limit: int) -> List[Dict]:
    """Return up to `limit` markets from the API."""
    response = requests.get(
        MARKETS_API_URL,
        params={"limit": limit, "closed": "false"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _positive_float(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    try:
        converted = float(value)
    except (TypeError, ValueError):
        return None
    if converted > 0:
        return converted
    return None


def _has_active_price(market: Dict) -> bool:
    for key in ("lastTradePrice", "bestBid", "bestAsk"):
        if _positive_float(market.get(key)) is not None:
            return True
    return False


def _float_env(name: str, default: float) -> float:
    try:
        value = os.environ.get(name)
        if value is None:
            return default
        return float(value)
    except ValueError:
        return default


def _int_env(name: str, default: int) -> int:
    try:
        value = os.environ.get(name)
        if value is None:
            return default
        return int(float(value))
    except ValueError:
        return default


def select_markets() -> List[MarketSample]:
    """Preselect the markets that will be sampled."""
    limit = _int_env("MARKETS_TO_SAMPLE", DEFAULT_MARKETS_TO_SAMPLE)
    fetch_limit = max(limit * 3, limit)
    markets = fetch_markets(limit=fetch_limit)
    selected: List[MarketSample] = []
    seen_ids: set[str] = set()

    for market in markets:
        if len(selected) >= limit:
            break
        market_id = market.get("id")
        if not market_id or market_id in seen_ids:
            continue
        if not _has_active_price(market):
            continue

        selected.append(
            MarketSample(
                market_id=market_id,
                question=market.get("question", "Untitled market"),
            )
        )
        seen_ids.add(market_id)

    if len(selected) < limit:
        for market in markets:
            if len(selected) >= limit:
                break
            market_id = market.get("id")
            if not market_id or market_id in seen_ids:
                continue
            selected.append(
                MarketSample(
                    market_id=market_id,
                    question=market.get("question", "Untitled market"),
                )
            )
            seen_ids.add(market_id)

    return selected


def sample_prices(
    overall_markets: List[MarketSample], duration_minutes: float, interval_seconds: float
) -> None:
    """Poll the API at the configured cadence and record lastTradePrice."""
    if duration_minutes <= 0:
        duration_minutes = DEFAULT_DURATION_MINUTES
    if interval_seconds <= 0:
        interval_seconds = DEFAULT_SAMPLE_INTERVAL_SECONDS

    iterations = max(1, int((duration_minutes * 60) // interval_seconds))
    deadline = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)

    for index in range(iterations):
        loop_start = time.time()
        api_start = time.time()
        available = fetch_markets(limit=max(200, len(overall_markets)))
        api_elapsed = time.time() - api_start
        lookup = {market["id"]: market for market in available}
        timestamp = datetime.now(timezone.utc).isoformat()

        for market in overall_markets:
            if not market.market_id:
                continue
            data = lookup.get(market.market_id)
            if not data:
                continue
            price = data.get("lastTradePrice")
            if price is None:
                continue
            market.samples.append({"ts": timestamp, "price": price})

        completed = sum(len(market.samples) for market in overall_markets)
        print(
            f"[{index+1}/{iterations}] "
            f"collected ~{completed} price points "
            f"(API took {api_elapsed:.2f}s, next sample in {interval_seconds}s)"
        )

        elapsed = time.time() - loop_start
        sleep_time = interval_seconds - elapsed
        if sleep_time > 0:
            time.sleep(sleep_time)
        if datetime.now(timezone.utc) >= deadline:
            break


def dump_samples(markets: List[MarketSample], export_dir: Path = EXPORT_DIR) -> Path:
    """Serialize collected samples so the run can be inspected later."""
    export_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    target_path = export_dir / EXPORT_FILENAME_TEMPLATE.format(timestamp=timestamp)

    payload: List[Dict[str, Optional[str]]] = []
    for market in markets:
        if not market.market_id:
            continue

        payload.append(
            {
                "market_id": market.market_id,
                "question": market.question,
                "samples": market.samples,
            }
        )

    with target_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    return target_path


def main() -> None:
    selected_markets = select_markets()
    if not selected_markets:
        print("No markets available to sample.")
        return

    duration_minutes = _float_env("SAMPLE_DURATION_MINUTES", DEFAULT_DURATION_MINUTES)
    interval_seconds = _float_env("SAMPLE_INTERVAL_SECONDS", DEFAULT_SAMPLE_INTERVAL_SECONDS)

    print(
        f"Sampling {len(selected_markets)} markets every "
        f"{interval_seconds:.0f}s for {duration_minutes:.1f} minutes."
    )
    sample_prices(selected_markets, duration_minutes, interval_seconds)

    print("\nCompleted sampling. Summary:")
    for market in selected_markets:
        print(f"- {market.market_id[:8]}: {len(market.samples)} samples ({market.question[:50]})")

    export_path = dump_samples(selected_markets)
    print(f"\nSaved full sample set to {export_path}")


if __name__ == "__main__":
    main()

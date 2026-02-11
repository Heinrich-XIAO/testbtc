"""Assess the yes-trade averages JSON and simulate two simple strategies."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, List, Optional


def _find_latest_dump(directory: Path) -> Optional[Path]:
    files = sorted(directory.glob("py_clob_samples_*.json"))
    return files[-1] if files else None


def _load_history(path: Path) -> List[dict]:
    with path.open() as handle:
        return json.load(handle)


def _extract_prices(history: Iterable[dict]) -> List[float]:
    prices = []
    for sample in history:
        avg = sample.get("avg")
        if isinstance(avg, (int, float)):
            prices.append(float(avg))
    return prices


def simulate(prices: List[float]) -> tuple[Optional[float], Optional[float]]:
    if len(prices) < 2:
        return None, None

    start_price = prices[0]
    end_price = prices[-1]
    always_yes = end_price - start_price
    dynamic = end_price - start_price if end_price >= 0.5 else start_price - end_price
    return always_yes, dynamic


def main() -> None:
    dump_dir = Path("py_clob_samples")
    path = _find_latest_dump(dump_dir)
    if not path:
        print(f"No dump files found in {dump_dir}.")
        return

    data = _load_history(path)
    total_yes = 0.0
    total_dynamic = 0.0
    markets_with_data = 0
    print(f"Analyzing {path}")

    for entry in data:
        history = _extract_prices(entry.get("history", []))
        yes_profit, dynamic_profit = simulate(history)
        if yes_profit is None:
            continue

        markets_with_data += 1
        total_yes += yes_profit
        total_dynamic += dynamic_profit
        print(
            f"{entry['market_id']}: yes_profit={yes_profit:.4f}, "
            f"dynamic_profit={dynamic_profit:.4f}, "
            f"current_avg={history[-1]:.4f}"
        )

    if markets_with_data == 0:
        print("No markets had enough data to simulate.")
        return

    print("\nSummary:")
    print(f"- Always say yes total profit: {total_yes:.4f} over {markets_with_data} markets")
    print(
        f"- Say yes/no based on expensive side total profit: {total_dynamic:.4f} "
        f"over {markets_with_data} markets"
    )


if __name__ == "__main__":
    main()

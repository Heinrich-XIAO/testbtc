"""Async CoinAPI collector for BTC OHLCV data."""
from __future__ import annotations

import argparse
import asyncio
import csv
import datetime
import os
import sys
from typing import Iterator

import httpx

COINAPI_URL = "https://rest.coinapi.io/v1/ohlcv/BITSTAMP_SPOT_BTC_USD/history"
DEFAULT_CHUNK_SECONDS = 100_000
MAX_RETRIES = 6
RETRY_BACKOFF = 5
FIELD_ORDER = [
    "time_period_start",
    "time_period_end",
    "time_open",
    "time_close",
    "price_open",
    "price_high",
    "price_low",
    "price_close",
    "volume_traded",
    "trades_count",
]


def isoformat(dt: datetime.datetime) -> str:
    return dt.astimezone(datetime.timezone.utc).isoformat(timespec="milliseconds")


def parse_iso(ts: str) -> datetime.datetime:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return datetime.datetime.fromisoformat(ts)


def range_chunks(
    start: datetime.datetime, end: datetime.datetime, chunk_seconds: int
) -> Iterator[tuple[datetime.datetime, datetime.datetime]]:
    current = start
    while current < end:
        nxt = min(current + datetime.timedelta(seconds=chunk_seconds), end)
        yield current, nxt
        current = nxt


def read_last_timestamp(path: str) -> datetime.datetime | None:
    if not os.path.exists(path):
        return None
    with open(path, "rb") as handle:
        handle.seek(0, os.SEEK_END)
        pos = handle.tell() - 1
        while pos > 0:
            handle.seek(pos)
            if handle.read(1) == b"\n":
                break
            pos -= 1
        handle.seek(pos + 1)
        line = handle.read().decode("utf-8").strip()
        if not line or line.startswith("time_period_start"):
            return None
        parts = list(csv.reader([line]))[0]
        return parse_iso(parts[0])


def append_rows(writer: csv.writer, rows: list[dict[str, object]], last: datetime.datetime | None) -> datetime.datetime | None:
    current = last
    for row in rows:
        timestamp = parse_iso(row["time_period_start"])
        if current and timestamp <= current:
            continue
        writer.writerow([row[field] for field in FIELD_ORDER])
        current = timestamp
    return current


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Collect per-second BTC price history using CoinAPI.")
    parser.add_argument("--output", "-o", default="btc_1s.csv", help="CSV target file relative to cwd")
    parser.add_argument("--months", type=int, default=6, help="How many months of history to fetch")
    parser.add_argument("--end", help="ISO timestamp for collection end; defaults to now (UTC)")
    parser.add_argument("--chunk", type=int, default=DEFAULT_CHUNK_SECONDS, help="seconds of data per request (<=100000)")
    parser.add_argument("--limit", type=int, default=100_000, help="CoinAPI limit parameter (<=100000)")
    parser.add_argument("--resume", action="store_true", help="continue from last timestamp in output file")
    parser.add_argument("--api-key", help="override COINAPI_KEY environment variable")
    return parser


def install_uvloop() -> None:
    try:
        import uvloop
    except ImportError:
        return
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())


async def fetch_chunk(
    client: httpx.AsyncClient, start: datetime.datetime, end: datetime.datetime, limit: int
) -> list[dict[str, object]]:
    params = {
        "period_id": "1SEC",
        "time_start": isoformat(start),
        "time_end": isoformat(end),
        "limit": limit,
    }
    for attempt in range(MAX_RETRIES):
        response = await client.get(COINAPI_URL, params=params)
        if response.status_code == 429:
            wait = RETRY_BACKOFF * (attempt + 1)
            await asyncio.sleep(wait)
            continue
        response.raise_for_status()
        return response.json()
    raise RuntimeError("exceeded retry limit due to rate limiting")


async def run_collection(
    *,
    output: str,
    months: int,
    chunk: int,
    limit: int,
    resume: bool,
    end: str | None,
    api_key: str,
) -> int:
    if end:
        end_ts = datetime.datetime.fromisoformat(end)
        if not end_ts.tzinfo:
            end_ts = end_ts.replace(tzinfo=datetime.timezone.utc)
    else:
        end_ts = datetime.datetime.now(datetime.timezone.utc)
    start_ts = end_ts - datetime.timedelta(days=30 * months)

    existing_ts = read_last_timestamp(output) if resume else None
    if existing_ts:
        start_ts = max(start_ts, existing_ts + datetime.timedelta(seconds=1))

    os.makedirs(os.path.dirname(output) or ".", exist_ok=True)
    mode = "a" if resume and os.path.exists(output) else "w"
    total = 0
    last_ts = existing_ts
    headers = {"X-CoinAPI-Key": api_key}

    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        with open(output, mode, newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            if mode == "w":
                writer.writerow(FIELD_ORDER)
            for chunk_start, chunk_end in range_chunks(start_ts, end_ts, chunk):
                print(f"Fetching {chunk_start} to {chunk_end}...", file=sys.stderr)
                rows = await fetch_chunk(client, chunk_start, chunk_end, limit)
                last_ts = append_rows(writer, rows, last_ts)
                total += len(rows)
                await asyncio.sleep(0.1)
    print(f"Wrote {total} rows to {output}")
    return total


def collect_main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    api_key = args.api_key or os.environ.get("COINAPI_KEY")
    if not api_key:
        parser.error("CoinAPI requires an API key set via --api-key or COINAPI_KEY")
    install_uvloop()
    asyncio.run(
        run_collection(
            output=args.output,
            months=args.months,
            chunk=args.chunk,
            limit=args.limit,
            resume=args.resume,
            end=args.end,
            api_key=api_key,
        )
    )


if __name__ == "__main__":
    collect_main()

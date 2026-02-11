"""Entry points used in pyproject scripts."""
from __future__ import annotations

from btc_tools.collector import collect_main
from btc_tools.trainer import train_main

__all__ = ["collect_main", "train_main"]

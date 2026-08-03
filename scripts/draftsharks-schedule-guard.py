#!/usr/bin/env python3
"""Allow one scheduled refresh at 8:00 AM America/Los_Angeles across DST."""

from __future__ import annotations

import argparse
import datetime as dt
from zoneinfo import ZoneInfo


PACIFIC = ZoneInfo("America/Los_Angeles")


def parse_now(value: str | None) -> dt.datetime:
    if not value:
        return dt.datetime.now(dt.timezone.utc)
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("--now must include a UTC offset or Z.")
    return parsed


def should_refresh(now: dt.datetime) -> bool:
    local = now.astimezone(PACIFIC)
    # GitHub may start a cron job a few minutes late; allow the scheduled 8 AM
    # hour while the paired UTC candidate is 7 AM or 9 AM and remains blocked.
    return local.hour == 8


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--now", help="ISO-8601 timestamp for deterministic validation")
    parser.add_argument("--github-output", help="Optional GitHub Actions output file")
    args = parser.parse_args()

    now = parse_now(args.now)
    local = now.astimezone(PACIFIC)
    allowed = should_refresh(now)
    message = (
        f"Pacific time: {local.isoformat()} | "
        f"scheduled refresh {'allowed' if allowed else 'skipped'}."
    )
    print(message)
    if args.github_output:
        with open(args.github_output, "a", encoding="utf-8") as output:
            output.write(f"should_refresh={'true' if allowed else 'false'}\n")
            output.write(f"pacific_time={local.isoformat()}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

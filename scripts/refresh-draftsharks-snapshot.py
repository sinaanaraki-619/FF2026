#!/usr/bin/env python3
"""Fetch and validate a public DraftSharks ADP snapshot without changing core rankings."""

from __future__ import annotations

import argparse
import datetime as dt
import html.parser
import json
import re
import sys
import urllib.request
from pathlib import Path


class TableParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self.current_table: list[list[str]] | None = None
        self.current_row: list[str] | None = None
        self.current_cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self.current_table = []
        elif tag == "tr" and self.current_table is not None:
            self.current_row = []
        elif tag in {"td", "th"} and self.current_row is not None:
            self.current_cell = []

    def handle_data(self, data: str) -> None:
        if self.current_cell is not None:
            self.current_cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.current_cell is not None and self.current_row is not None:
            self.current_row.append(" ".join("".join(self.current_cell).split()))
            self.current_cell = None
        elif tag == "tr" and self.current_row is not None and self.current_table is not None:
            if self.current_row:
                self.current_table.append(self.current_row)
            self.current_row = None
        elif tag == "table" and self.current_table is not None:
            if self.current_table:
                self.tables.append(self.current_table)
            self.current_table = None


def normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def parse_number(value: str) -> float | None:
    match = re.search(r"\d+(?:\.\d+)?", value)
    return float(match.group()) if match else None


def parse_public_tables(document: str) -> list[dict[str, object]]:
    parser = TableParser()
    parser.feed(document)
    for table in parser.tables:
        if not table:
            continue
        headers = [normalize_header(value) for value in table[0]]
        player_index = next((index for index, value in enumerate(headers) if "player" in value or "name" in value), None)
        adp_index = next((index for index, value in enumerate(headers) if value == "adp" or "consensus" in value), None)
        if player_index is None or adp_index is None:
            continue

        records: list[dict[str, object]] = []
        for row in table[1:]:
            if len(row) <= max(player_index, adp_index):
                continue
            player = row[player_index].strip()
            adp = parse_number(row[adp_index])
            if player and adp and adp > 0:
                records.append({"player": player, "adp": adp})
        if len({record["player"].casefold() for record in records}) >= 20:
            return records
    return []


def parse_source_updated_at(document: str) -> str | None:
    match = re.search(
        r"last\s+(?:updated|update)\s*(?:on|:|-)?\s*([^<\r\n]{3,100})",
        document,
        flags=re.IGNORECASE,
    )
    if not match:
        return None

    candidate = " ".join(match.group(1).split())
    iso_match = re.search(
        r"\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})",
        candidate,
    )
    if iso_match:
        try:
            return dt.datetime.fromisoformat(iso_match.group().replace("Z", "+00:00")).isoformat()
        except ValueError:
            return None

    named_match = re.search(
        r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}\s+(?:at\s+)?\d{1,2}:\d{2}\s+[AP]M\s+(PST|PDT|UTC))",
        candidate,
        flags=re.IGNORECASE,
    )
    if not named_match:
        return None

    timestamp = named_match.group(1)
    timezone_name = named_match.group(2).upper()
    offsets = {
        "PST": dt.timezone(dt.timedelta(hours=-8)),
        "PDT": dt.timezone(dt.timedelta(hours=-7)),
        "UTC": dt.timezone.utc,
    }
    for date_format in ("%B %d, %Y at %I:%M %p %Z", "%b %d, %Y at %I:%M %p %Z", "%B %d, %Y %I:%M %p %Z", "%b %d, %Y %I:%M %p %Z"):
        try:
            parsed = dt.datetime.strptime(timestamp, date_format)
            return parsed.replace(tzinfo=offsets[timezone_name]).isoformat()
        except ValueError:
            continue
    return None


def fetch_document(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Draft-Compass-Refresh/1.0 (+https://github.com/sinaanaraki-619/FF2026)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"DraftSharks returned HTTP {response.status}.")
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scoring", choices=("ppr", "half-ppr"), required=True)
    parser.add_argument("--teams", choices=("10", "12", "14"), required=True)
    parser.add_argument("--snapshot-path", type=Path, required=True)
    parser.add_argument("--report-path", type=Path, required=True)
    parser.add_argument("--html-path", type=Path)
    args = parser.parse_args()

    source_url = f"https://www.draftsharks.com/adp/{args.scoring}/consensus/{args.teams}"
    try:
        document = args.html_path.read_text(encoding="utf-8") if args.html_path else fetch_document(source_url)
        records = parse_public_tables(document)
        if len(records) < 20:
            raise RuntimeError(
                "The public response did not contain a stable table with at least 20 unique player/ADP records. "
                "No snapshot or dashboard data was changed."
            )
        source_updated_at = parse_source_updated_at(document)

        payload = {"snapshots": []}
        if args.snapshot_path.exists():
            payload = json.loads(args.snapshot_path.read_text(encoding="utf-8"))
        snapshots = [
            snapshot for snapshot in payload.get("snapshots", [])
            if not (snapshot.get("scoring") == args.scoring and str(snapshot.get("teams")) == args.teams)
        ]
        snapshots.append(
            {
                "scoring": args.scoring,
                "teams": int(args.teams),
                "sourceUrl": source_url,
                "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                "sourceUpdatedAt": source_updated_at,
                "sourceTimestampStatus": "validated" if source_updated_at else "unavailable",
                "validated": True,
                "recordCount": len(records),
                "records": records,
            }
        )
        payload["snapshots"] = sorted(snapshots, key=lambda snapshot: (snapshot["scoring"], snapshot["teams"]))
        args.snapshot_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
        args.report_path.write_text(
            f"## DraftSharks refresh succeeded\n\n"
            f"- Source: {source_url}\n"
            f"- Filter: {args.scoring}, {args.teams} teams\n"
            f"- Validated player/ADP records: {len(records)}\n"
            f"- Source page last updated: {source_updated_at or 'unavailable in the validated public response'}\n"
            f"- Snapshot: `{args.snapshot_path}`\n\n"
            "The core Yahoo-primary ranking board was not modified.\n",
            encoding="utf-8",
        )
        return 0
    except Exception as error:
        args.report_path.write_text(
            f"## DraftSharks refresh did not update data\n\n"
            f"- Source attempted: {source_url}\n"
            f"- Filter: {args.scoring}, {args.teams} teams\n"
            f"- Reason: {error}\n\n"
            "The existing source-backed dashboard data was left unchanged. Open the source URL and use the documented "
            "manual import workflow if DraftSharks does not expose a stable public table.\n",
            encoding="utf-8",
        )
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

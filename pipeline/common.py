"""Shared helpers for the Køen data pipeline.

Every network fetch goes through `fetch()`, which caches the raw bytes under
data/raw/ and records url, fetch time, sha256 and size in data/raw/_fetchlog.json.
Set KOEN_OFFLINE=1 to run from cache only (make data-offline).
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
BUILD = ROOT / "data" / "build"
SITE_DATA = ROOT / "site" / "public" / "data"
FETCHLOG = RAW / "_fetchlog.json"

# Generic project name only. No personal contact details in requests.
USER_AGENT = "koen-open-data-pipeline/1.0 (+https://github.com/lamapony/koen)"
OFFLINE = os.environ.get("KOEN_OFFLINE") == "1"

for p in (RAW, BUILD, SITE_DATA):
    p.mkdir(parents=True, exist_ok=True)


def _load_log() -> dict[str, Any]:
    if FETCHLOG.exists():
        return json.loads(FETCHLOG.read_text("utf-8"))
    return {}


def _save_log(log: dict[str, Any]) -> None:
    FETCHLOG.write_text(json.dumps(log, indent=2, ensure_ascii=False, sort_keys=True), "utf-8")


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def fetch(
    key: str,
    url: str,
    *,
    method: str = "GET",
    json_body: Any = None,
    refresh: bool = False,
    timeout: int = 120,
) -> bytes:
    """Fetch url (or POST json_body) and cache under data/raw/{key}.

    `key` is a relative path such as "dst/BOL101_ejer.csv".
    Returns the raw bytes. Raises on HTTP errors so callers can mark a source missing.
    """
    path = RAW / key
    log = _load_log()
    if path.exists() and not refresh:
        return path.read_bytes()
    if OFFLINE:
        raise FileNotFoundError(f"offline and not cached: {key}")
    headers = {"User-Agent": USER_AGENT}
    for attempt in range(3):
        try:
            if method == "POST":
                r = requests.post(url, json=json_body, headers=headers, timeout=timeout)
            else:
                r = requests.get(url, headers=headers, timeout=timeout)
            if 400 <= r.status_code < 500:
                raise requests.HTTPError(f"{r.status_code} for {url}: {r.text[:300]}", response=r)
            r.raise_for_status()
            break
        except requests.RequestException as e:
            if attempt == 2 or (e.response is not None and 400 <= e.response.status_code < 500):
                raise
            time.sleep(2 * (attempt + 1))
    data = r.content
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    log[key] = {
        "url": url,
        "method": method,
        "body": json_body,
        "fetchedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "sha256": sha256(data),
        "bytes": len(data),
        "httpStatus": r.status_code,
    }
    _save_log(log)
    time.sleep(0.3)  # be polite, sequential requests
    return data


def fetch_info(key: str) -> dict[str, Any] | None:
    return _load_log().get(key)


def write_json(path: Path, obj: Any, *, compact: bool = True) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    else:
        s = json.dumps(obj, ensure_ascii=False, indent=2)
    path.write_text(s, "utf-8")
    return len(s.encode())


def read_json(path: Path) -> Any:
    return json.loads(path.read_text("utf-8"))


# The 98 kommuner. Codes are DST/DAGI kommunekoder without the leading zero
# as DST returns them; we pad to 4 digits in outputs ("0101").
# Christiansø (411) is not a kommune and is excluded.
def is_kommune_code(code: str) -> bool:
    return len(code) == 3 and code.isdigit() and code not in ("000", "411", "997") and not code.startswith("08")

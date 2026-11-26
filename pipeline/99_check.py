"""make check: schema, coverage, honesty and budget checks on site/public/data. Exit 1 on failure."""

from __future__ import annotations

import gzip
import json
import re
import struct
import sys
from pathlib import Path

from common import ROOT, SITE_DATA

errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        errors.append(msg)


def gz(p: Path) -> int:
    return len(gzip.compress(p.read_bytes(), 9))


def main() -> int:
    k = json.loads((SITE_DATA / "kommuner.json").read_text("utf-8"))
    meta = json.loads((SITE_DATA / "indicators.json").read_text("utf-8"))
    src = json.loads((SITE_DATA / "sources.json").read_text("utf-8"))["sources"]

    check(len(k) == 98 and len({x["kode"] for x in k}) == 98, "98 unique kommuner")
    ids = [m["id"] for m in meta["indicators"]]
    for m in meta["indicators"]:
        vals = [x["ind"].get(m["id"]) for x in k]
        known = [v for v in vals if v is not None]
        zeros = sum(1 for v in known if v == 0)
        check(len(known) >= 90, f"{m['id']}: {len(known)}/98 known")
        # Real zeros reported by DST are allowed for counts/shares that can be 0 (e.g. no co-ops on Læsø).
        if m["id"] not in ("NETFLYT", "NYBYG_AA", "ANDEL_N", "ANDEL_PCT"):
            check(zeros == 0, f"{m['id']}: no silent zeros ({zeros})")
        check(bool(m.get("period")) and bool(m.get("sources")), f"{m['id']}: has period and source")
    check(all(0 <= x["koetryk"] <= 1 and x["koetrykBand"][0] <= x["koetryk"] <= x["koetrykBand"][1] for x in k),
          "koetryk in [0,1] and inside its band")
    loo = meta["index"]["loo"]
    check(min(loo.values()) >= meta["index"]["params"]["looMin"], f"leave-one-out min {min(loo.values())} >= {meta['index']['params']['looMin']}")

    v = meta["index"].get("validation")
    check(v is not None, "validation summary exported (55_validate.py)")
    if v:
        a, b = v["after"], v["before"]
        check(a["owner3"]["auc"] >= max(0.9, b["owner3"]["auc"]), f"Køtryk v2 owner3 AUC {a['owner3']['auc']} >= 0.9 and >= v1 {b['owner3']['auc']}")
        check(a["ventelistevalg"]["auc"] >= 0.9, f"Køtryk v2 Ventelistevalg AUC {a['ventelistevalg']['auc']} >= 0.9")
        check(a["aarhusbolig"]["rho"] >= b["aarhusbolig"]["rho"], f"Aarhusbolig rho v2 {a['aarhusbolig']['rho']} >= v1 {b['aarhusbolig']['rho']}")

    for res in (7, 6):
        b = (SITE_DATA / f"hex{res}.bin").read_bytes()
        n, r = struct.unpack_from("<IB", b)
        owners = set(b[8 + 8 * n:])
        check(r == res and len(b) == 8 + 9 * n, f"hex{res}.bin layout ({n} cells)")
        check(owners == set(range(98)), f"hex{res}.bin: every kommune owns a cell")

    check(gz(SITE_DATA / "kommuner.json") < 60_000, f"kommuner.json gzip {gz(SITE_DATA / 'kommuner.json')} < 60 KB")
    check(gz(SITE_DATA / "hex7.bin") < 350_000, f"hex7.bin gzip {gz(SITE_DATA / 'hex7.bin')} < 350 KB")
    check(gz(SITE_DATA / "kommuner.geojson") < 150_000, f"kommuner.geojson gzip {gz(SITE_DATA / 'kommuner.geojson')} < 150 KB")
    if (SITE_DATA / "kk_almene.geojson").exists():
        check(gz(SITE_DATA / "kk_almene.geojson") < 250_000, f"kk_almene.geojson gzip {gz(SITE_DATA / 'kk_almene.geojson')} < 250 KB")
    total = sum(p.stat().st_size for p in SITE_DATA.iterdir() if p.is_file())
    check(total < 5_000_000, f"site data total {total/1e6:.2f} MB < 5 MB")

    tables = {t for m in meta["indicators"] for t in m["tables"]}
    have = {s["id"].split("-")[1].upper() for s in src if s["id"].startswith("dst-") and s["status"] == "ok"}
    check(tables <= have, f"every indicator table in sources.json ({sorted(tables - have) or 'all'})")
    check(all(s.get("status") for s in src), "every source has a status")
    for s in src:
        if s["status"] == "ok":
            check(bool(s.get("licence")) and bool(s.get("fetchedAt")) and bool(s.get("period")), f"{s['id']}: licence, period, fetchedAt")

    measured = json.loads((SITE_DATA / "measured.json").read_text("utf-8"))
    check(measured["aarhusbolig"]["observedAt"].startswith("2017"), "Aarhusbolig labelled 2017")
    check(measured.get("ventelistevalg") is None, "Ventelistevalg data not shipped (flag off)")

    # No em or en dashes in user-facing copy and docs.
    bad = []
    for p in list((ROOT / "site" / "src").rglob("*")) + list((ROOT / "docs").rglob("*.md")) + [ROOT / "README.md", ROOT / "site" / "index.html"]:
        if p.is_file() and p.suffix in (".ts", ".md", ".html", ".css"):
            for i, line in enumerate(p.read_text("utf-8").splitlines(), 1):
                if re.search("[–—]", line):
                    bad.append(f"{p.relative_to(ROOT)}:{i}")
    check(not bad, f"no em/en dashes in copy and docs {bad[:5]}")
    print(f"\n{len(errors)} failure(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

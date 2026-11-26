"""Fetch kommune boundaries.

Adapter seam: BOUNDARY_SOURCE selects the provider.
- "geoboundaries" (default, now): geoBoundaries DNK ADM2, Public Domain, coarse (year 2018,
  derived from a Wikimedia Commons SVG). Good enough for the hex terrain.
- "dagi": TODO. Datafordeler DAGI kommuneinddeling via WFS. Needs a free Datafordeler user
  ("kendt adgang"). Credentials come from env vars DATAFORDELER_USER / DATAFORDELER_PASS and are
  never committed. Implement `fetch_dagi()` to return the same normalised GeoJSON
  (FeatureCollection, properties: kode "0101", navn) and everything downstream keeps working.

Output: data/raw/boundaries/kommuner.geojson (normalised) plus the raw source file.
"""

from __future__ import annotations

import json
import os
import sys

from common import RAW, fetch

SOURCE = os.environ.get("BOUNDARY_SOURCE", "geoboundaries")
GB_META = "https://www.geoboundaries.org/api/current/gbOpen/DNK/ADM2/"

# geoBoundaries shapeName -> DST navn where they differ.
NAME_FIX = {"Copenhagen": "København", "Vesthimmerland": "Vesthimmerlands", "Nordfyn": "Nordfyns"}


def dst_kommune_names() -> dict[str, str]:
    """navn -> 3-digit code, from the cached BOL101 tableinfo (run 00 first)."""
    info = json.loads((RAW / "dst" / "BOL101.tableinfo.json").read_text("utf-8"))
    omr = next(v for v in info["variables"] if v["id"] == "OMRÅDE")
    out = {}
    for x in omr["values"]:
        c = x["id"]
        if len(c) == 3 and c not in ("000", "411") and not c.startswith("08"):
            out[x["text"]] = c
    assert len(out) == 98, len(out)
    return out


def fetch_geoboundaries() -> dict:
    meta = json.loads(fetch("boundaries/geoboundaries_meta.json", GB_META))
    gj = json.loads(fetch("boundaries/geoBoundaries-DNK-ADM2.geojson", meta["gjDownloadURL"]))
    names = dst_kommune_names()
    feats = []
    for f in gj["features"]:
        n = NAME_FIX.get(f["properties"]["shapeName"], f["properties"]["shapeName"])
        if n not in names:
            raise SystemExit(f"unmatched geoBoundaries name: {n}")
        feats.append({"type": "Feature", "properties": {"kode": names[n].zfill(4), "navn": n}, "geometry": f["geometry"]})
    assert len({f["properties"]["kode"] for f in feats}) == 98
    return {
        "type": "FeatureCollection",
        "features": feats,
        "_source": {
            "id": "geoboundaries-dnk-adm2",
            "url": GB_META,
            "download": meta["gjDownloadURL"],
            "licence": meta["boundaryLicense"],
            "year": meta["boundaryYearRepresented"],
            "origin": meta["boundarySource"],
        },
    }


def fetch_dagi() -> dict:
    # TODO(datafordeler): implement once the author has a Datafordeler user.
    # WFS base (verified HTTP 401 without credentials 2026-11-26): https://wfs.datafordeler.dk/DAGIM/...
    raise SystemExit("BOUNDARY_SOURCE=dagi is not implemented yet. See TODO in 01_fetch_boundaries.py.")


def main() -> int:
    fc = fetch_geoboundaries() if SOURCE == "geoboundaries" else fetch_dagi()
    out = RAW / "boundaries" / "kommuner.geojson"
    out.write_text(json.dumps(fc, ensure_ascii=False), "utf-8")
    print(f"{out}: {len(fc['features'])} kommuner from {fc['_source']['id']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""H3 hex grid per kommune (cell centre in polygon), PLAN.md section 2.1.

Writes site/public/data/hex7.bin (desktop) and hex6.bin (mobile), plus kommuner.geojson outlines.

hex.bin layout (little endian):
  bytes 0..3   uint32 count
  byte  4      uint8 resolution
  bytes 5..7   padding
  then count * uint64 H3 index
  then count * uint8 kommune index (position in kommuner.json order)

No population mask (the Eurostat grid licence has not been reviewed), so every hex in a kommune
has the same height: honest flat mesas. Values are looked up per kommune on the client, so the
per-hex Float32 columns from the plan are not needed.
"""

from __future__ import annotations

import json
import struct
import sys

import h3
from shapely.geometry import mapping, shape

from common import RAW, SITE_DATA


def main() -> int:
    fc = json.loads((RAW / "boundaries" / "kommuner.geojson").read_text("utf-8"))
    order = [k["kode"] for k in json.loads((RAW / "clean" / "dst.json").read_text("utf-8"))["kommuner"]]
    idx = {k: i for i, k in enumerate(order)}
    geoms = {f["properties"]["kode"]: shape(f["geometry"]) for f in fc["features"]}

    for res in (7, 6):
        owner: dict[str, int] = {}
        for kode in order:
            g = geoms[kode]
            cells = set(h3.geo_to_cells(mapping(g), res))
            if not cells:  # tiny kommune: give it the cell at its representative point
                p = g.representative_point()
                cells = {h3.latlng_to_cell(p.y, p.x, res)}
            for c in cells:
                owner.setdefault(c, idx[kode])
        # every kommune must own at least one cell
        counts = [0] * len(order)
        for v in owner.values():
            counts[v] += 1
        # Small kommuner at coarse resolution: take the nearest cell whose owner can spare one.
        for kode in order:
            if counts[idx[kode]] > 0:
                continue
            p = geoms[kode].representative_point()
            centre = h3.latlng_to_cell(p.y, p.x, res)
            for ring in range(0, 4):
                cand = [c for c in h3.grid_ring(centre, ring) if c not in owner or counts[owner[c]] > 1]
                if cand:
                    c = cand[0]
                    if c in owner:
                        counts[owner[c]] -= 1
                    owner[c] = idx[kode]
                    counts[idx[kode]] = 1
                    break
        cells = sorted(owner)
        buf = struct.pack("<IB3x", len(cells), res)
        buf += b"".join(struct.pack("<Q", h3.str_to_int(c)) for c in cells)
        buf += bytes(owner[c] for c in cells)
        (SITE_DATA / f"hex{res}.bin").write_bytes(buf)
        small = sorted(((counts[idx[k]], k) for k in order))[:4]
        print(f"res {res}: {len(cells)} cells, {len(buf)/1024:.0f} KB, fewest cells {small}")

    # Outlines, simplified and rounded, for strokes and picking fallback.
    feats = []
    for f in fc["features"]:
        g = shape(f["geometry"]).simplify(0.0015, preserve_topology=True)
        gj = json.loads(json.dumps(mapping(g)), parse_float=lambda s: round(float(s), 4))
        feats.append({"type": "Feature", "properties": {"kode": f["properties"]["kode"]}, "geometry": gj})
    s = json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":"))
    (SITE_DATA / "kommuner.geojson").write_text(s, "utf-8")
    print(f"kommuner.geojson: {len(s)/1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

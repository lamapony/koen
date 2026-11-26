"""Measured ("Rigtige køer") layers. Aggregates only, nothing person-level.

Aarhusbolig 2017 (CC BY 4.0): each Ventelister row is one waiting list (afdeling x dwelling type x
room count) with AntalPaaVenteliste = people on that list. One person can be on many lists, so sums
across lists are "tilmeldinger" (sign-ups), never unique people. We publish per postnummer:
number of lists, sum of sign-ups, the longest single list, and per afdeling its longest list.
Postnummer points come from OpenStreetMap Nominatim (ODbL).

KK almene boliger (CC BY 4.0): afdeling polygons with counts of dwellings (supply, not queues).

Outputs (site/public/data): measured.json, kk_almene.geojson
"""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict

from shapely.geometry import Point, mapping, shape

from common import RAW, SITE_DATA, fetch_info

AARHUS_PKG = "https://www.opendata.dk/city-of-aarhus/aarhusbolig"
AARHUS_API = "https://admin.opendata.dk/api/3/action/package_show?id=01e0ac24-ac3c-4d04-81b7-cb193df334f9"


def rows(name: str) -> list[dict]:
    root = ET.fromstring((RAW / "aarhusbolig" / name).read_bytes())
    return [{c.tag: (c.text or "").strip() for c in r} for r in root]


def ventelister_modified() -> str:
    pkg = json.loads((RAW / "aarhusbolig" / "package.json").read_text("utf-8"))["result"]
    res = next(r for r in pkg["resources"] if r.get("name") == "Ventelister.xml")
    return res["last_modified"][:10]


def aarhus() -> dict:
    afd = {r["AfdId"]: r for r in rows("Afdelinger.xml")}
    sel = {r["SelId"]: r["Navn"] for r in rows("Selskaber.xml")}
    lists = rows("Ventelister.xml")
    fc = json.loads((RAW / "boundaries" / "kommuner.geojson").read_text("utf-8"))
    polys = [(f["properties"]["kode"], shape(f["geometry"])) for f in fc["features"]]

    by_pn: dict[str, dict] = defaultdict(lambda: {"lists": 0, "signups": 0, "maxList": 0, "afdelinger": set()})
    by_afd: dict[str, dict] = {}
    skipped = 0
    for r in lists:
        a = afd.get(r["AfdId"])
        try:
            n = int(r["AntalPaaVenteliste"])
        except ValueError:
            skipped += 1
            continue
        if a is None:
            skipped += 1
            continue
        pn = a["Postby"][:4]
        p = by_pn[pn]
        p["lists"] += 1
        p["signups"] += n
        p["maxList"] = max(p["maxList"], n)
        p["afdelinger"].add(r["AfdId"])
        # Some rows carry only the postnummer ("8520"); keep the first town name seen, never overwrite it with "".
        if not p.get("by"):
            p["by"] = a["Postby"][4:].strip()
        d = by_afd.setdefault(r["AfdId"], {"navn": a["Navn"], "selskab": sel.get(a["SelId"], ""), "postnummer": pn, "lists": 0, "maxList": 0, "maxType": ""})
        d["lists"] += 1
        if n > d["maxList"]:
            d["maxList"] = n
            d["maxType"] = f"{r['Lejemaalstype']}, {r['Rum']} rum"

    points = []
    for pn, p in sorted(by_pn.items()):
        nom = json.loads((RAW / "nominatim" / f"postcode_{pn}.json").read_text("utf-8"))
        if not nom:
            print(f"  postcode {pn}: no Nominatim hit, left out of the map (still counted in totals)")
            continue
        lat, lon = float(nom[0]["lat"]), float(nom[0]["lon"])
        kode = next((k for k, g in polys if g.contains(Point(lon, lat))), None)
        if kode is None:  # coarse boundaries: take the nearest kommune
            kode = min(polys, key=lambda kg: kg[1].distance(Point(lon, lat)))[0]
        points.append({"postnummer": pn, "by": p["by"], "lat": round(lat, 5), "lon": round(lon, 5), "kode": kode,
                       "lists": p["lists"], "signups": p["signups"], "maxList": p["maxList"], "afdelinger": len(p["afdelinger"])})

    top_afd = sorted(by_afd.values(), key=lambda d: -d["maxList"])[:25]
    info = fetch_info("aarhusbolig/Ventelister.xml") or {}
    return {
        "source": "aarhusbolig-2017",
        "label_da": "Aarhusbolig, øjebliksbillede 2017",
        "label_en": "Aarhusbolig, 2017 snapshot",
        "sourceUrl": AARHUS_PKG,
        "apiUrl": AARHUS_API,
        "licence": "CC BY 4.0",
        # Not an observation date: the publisher gives none. This is the CKAN last_modified of Ventelister.xml.
        "fileModifiedAt": ventelister_modified(),
        "fetchedAt": info.get("fetchedAt"),
        "totals": {"lists": sum(p["lists"] for p in by_pn.values()), "signups": sum(p["signups"] for p in by_pn.values()),
                   "afdelinger": len(by_afd), "maxList": max(p["maxList"] for p in by_pn.values()), "skippedRows": skipped},
        "points": points,
        "topAfdelinger": top_afd,
        "geocoder": "OpenStreetMap Nominatim, postnummer centroid (ODbL)",
    }


def kk() -> dict | None:
    p = RAW / "kk" / "almene_boliger_kk.geojson"
    if not p.exists():
        return None
    gj = json.loads(p.read_text("utf-8"))
    feats = []
    for f in gj["features"]:
        pr = f["properties"]
        g = shape(f["geometry"]).simplify(0.00003, preserve_topology=True)
        geom = json.loads(json.dumps(mapping(g)), parse_float=lambda s: round(float(s), 5))
        fam, ung, ald, pl = (pr.get(k) or 0 for k in ("antal_familie_boliger", "antal_ungdomsboliger", "antal_aeldre_boliger", "antal_plejeboliger"))
        feats.append({"type": "Feature", "geometry": geom, "properties": {
            "afd": pr.get("afdelingsnavn"), "sel": pr.get("selskabsnavn"), "fam": fam, "ung": ung, "ald": ald, "pl": pl, "tot": fam + ung + ald + pl}})
    s = json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":"))
    (SITE_DATA / "kk_almene.geojson").write_text(s, "utf-8")
    print(f"kk_almene.geojson: {len(feats)} afdelinger, {len(s)/1024:.0f} KB")
    info = fetch_info("kk/almene_boliger_kk.geojson") or {}
    return {"source": "kk-almene", "label_da": "Københavns Kommune, almene boligafdelinger", "label_en": "City of Copenhagen, social housing estates",
            "sourceUrl": "https://www.opendata.dk/city-of-copenhagen/almene-boligforeninger", "licence": "CC BY 4.0",
            "fetchedAt": info.get("fetchedAt"), "features": len(feats), "dwellings": sum(f["properties"]["tot"] for f in feats)}


def main() -> int:
    a = aarhus()
    k = kk()
    out = {"aarhusbolig": a, "kk": k, "ventelistevalg": None}
    s = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    (SITE_DATA / "measured.json").write_text(s, "utf-8")
    t = a["totals"]
    print(f"aarhusbolig: {t['lists']} lists, {t['signups']} sign-ups, {t['afdelinger']} afdelinger, {len(a['points'])} postnummer points, longest list {t['maxList']}")
    print("kommuner of points:", sorted({p["kode"] for p in a["points"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

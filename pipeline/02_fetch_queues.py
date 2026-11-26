"""Fetch measured queue data and almene supply.

- Aarhusbolig (opendata.dk, CC BY 4.0): Ventelister.xml, Afdelinger.xml. ISO-8859-1 XML, 2017 snapshot.
- Københavns Kommune almene boliger (opendata.dk / WFS, CC BY 4.0): afdeling polygons with dwelling counts.

Resource URLs are resolved through the CKAN package API at fetch time.
"""

from __future__ import annotations

import json
import sys

from common import fetch

CKAN = "https://admin.opendata.dk/api/3/action/package_show?id="
AARHUS_ID = "01e0ac24-ac3c-4d04-81b7-cb193df334f9"
KK_ID = "almene-boligforeninger"


def main() -> int:
    ok = True
    pkg = json.loads(fetch("aarhusbolig/package.json", CKAN + AARHUS_ID))["result"]
    for r in pkg["resources"]:
        if r["name"] in ("Ventelister.xml", "Afdelinger.xml", "Selskaber.xml"):
            data = fetch(f"aarhusbolig/{r['name']}", r["url"])
            print(f"aarhusbolig/{r['name']}: {len(data)} bytes, resource last_modified {r.get('last_modified')}")
    # Aarhusbolig has no coordinates. We place measured needles at postnummer level, using
    # OpenStreetMap Nominatim postcode lookups (ODbL), one request per postcode, cached, >1 s apart.
    import time
    import xml.etree.ElementTree as ET

    from common import RAW

    root = ET.fromstring((RAW / "aarhusbolig" / "Afdelinger.xml").read_bytes())
    postnumre = sorted({(r.findtext("Postby") or "").strip()[:4] for r in root} - {""})
    for pn in postnumre:
        key = f"nominatim/postcode_{pn}.json"
        if not (RAW / key).exists():
            time.sleep(1.2)
        fetch(key, f"https://nominatim.openstreetmap.org/search?postalcode={pn}&country=dk&format=json&limit=1")
    print(f"nominatim: {len(postnumre)} postcodes cached")
    try:
        kk = json.loads(fetch("kk/package.json", CKAN + KK_ID))["result"]
        url = next(r["url"] for r in kk["resources"] if r.get("format", "").upper() == "GEOJSON")
        data = fetch("kk/almene_boliger_kk.geojson", url)
        print(f"kk/almene_boliger_kk.geojson: {len(json.loads(data)['features'])} features")
    except Exception as e:  # mark missing, do not fake
        print(f"KK almene boliger FAILED: {e}")
        ok = False
    return 0 if ok else 0  # missing KK layer is tolerated; 50_measured marks it missing


if __name__ == "__main__":
    sys.exit(main())

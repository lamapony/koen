"""Write site/public/data/sources.json: every dataset with source, licence, period, fetch date, sha256, rows.

Every number in the UI traces back to an entry here.
"""

from __future__ import annotations

import json
import sys

from common import RAW, SITE_DATA, fetch_info, write_json

DST_LICENCE = {"name": "CC 4.0 BY", "url": "https://www.dst.dk/da/presse/kildeangivelse"}
DST_TEXT = {
    "BOL101": "Boliger efter område, beboertype, ejerforhold",
    "FOLK1A": "Befolkningen den 1. i kvartalet",
    "FRKM126": "Befolkningsfremskrivning 2026",
    "EJDFOE1": "Formue i fast ejendom (andelsboliger og ejerlejligheder, markedsværdi)",
    "BEV107": "Befolkningens udvikling (tilflyttede og indvandrede)",
    "INDKP106": "Disponibel indkomst",
    "BYGV33": "Boliger i det samlede boligbyggeri",
    "BOST63": "Boligstøtte",
    "FLY66": "Flytninger mellem kommuner",
    "BOL106": "Boligareal og beboere pr. bolig",
}
# Titles per query where one table feeds two different indicators.
QUERY_TEXT = {
    ("EJDFOE1", "andel"): "Formue i fast ejendom (andelsboliger, markedsværdi)",
    ("EJDFOE1", "ejerlejl"): "Formue i fast ejendom (ejerlejligheder, markedsværdi)",
}


def kk_period() -> str:
    """The KK dataset has no period field. Report the CKAN resource date so readers can judge its age."""
    base = "ikke angivet i datasættet"
    p = RAW / "kk" / "package.json"
    if not p.exists():
        return base
    pkg = json.loads(p.read_text("utf-8"))
    pkg = pkg.get("result", pkg)
    lm = next((r.get("last_modified") for r in pkg.get("resources", []) if r.get("name") == "almene_boliger_kk.geojson"), None)
    return f"{base} (ressourcen på Open Data DK sidst ændret {lm[:10]}; data hentes fra KK's WFS)" if lm else base


def tid_values(body: dict) -> list[str]:
    for v in body["variables"]:
        if v["code"] == "Tid":
            return v["values"]
    return []


def main() -> int:
    log = json.loads((RAW / "_fetchlog.json").read_text("utf-8"))
    out = []

    for key, e in sorted(log.items()):
        if not key.startswith("dst/") or not key.endswith(".csv"):
            continue
        table, query = key[4:-4].split("_", 1)
        text = (RAW / key).read_text("utf-8-sig").splitlines()
        periods = sorted({line.split(";")[-2] for line in text[1:]})
        info = json.loads((RAW / "dst" / f"{table}.tableinfo.json").read_text("utf-8"))
        out.append({
            "id": f"dst-{table.lower()}-{query}",
            "kind": "statistics",
            "publisher": "Danmarks Statistik",
            "title": f"{table} {QUERY_TEXT.get((table, query)) or DST_TEXT.get(table, info.get('text', ''))}",
            "url": f"https://www.statistikbanken.dk/{table}",
            "api": e["url"],
            "licence": DST_LICENCE,
            "attribution": "Kilde: Danmarks Statistik. Afledte tal: egne beregninger baseret på tal fra Danmarks Statistik.",
            "period": f"{periods[0]} til {periods[-1]}" if len(periods) > 1 else periods[0],
            "tableUpdated": info.get("updated"),
            "fetchedAt": e["fetchedAt"],
            "sha256": e["sha256"],
            "rows": len(text) - 1,
            "status": "ok",
        })

    def entry(id_, key, **kw):
        e = fetch_info(key) or {}
        d = {"id": id_, "fetchedAt": e.get("fetchedAt"), "sha256": e.get("sha256"), "api": e.get("url"),
             "status": "ok" if e else "missing"}
        d.update(kw)
        return d

    gb = json.loads((RAW / "boundaries" / "geoboundaries_meta.json").read_text("utf-8"))
    out.append(entry("geoboundaries-dnk-adm2", "boundaries/geoBoundaries-DNK-ADM2.geojson", kind="boundaries",
                     publisher="geoBoundaries (William & Mary geoLab)", title="Denmark ADM2 (kommuner), gbOpen",
                     url="https://www.geoboundaries.org/api/current/gbOpen/DNK/ADM2/",
                     licence={"name": gb["boundaryLicense"], "url": gb["licenseSource"]},
                     attribution=f"Kommunegrænser: geoBoundaries, {gb['boundarySource']}. Grove grænser (år {gb['boundaryYearRepresented']}).",
                     period=gb["boundaryYearRepresented"], rows=int(gb["admUnitCount"]),
                     note="Midlertidig grov kilde. Skal erstattes af DAGI fra Datafordeler (se pipeline/01_fetch_boundaries.py)."))

    m = json.loads((SITE_DATA / "measured.json").read_text("utf-8"))
    a = m["aarhusbolig"]
    for name in ("Ventelister.xml", "Afdelinger.xml", "Selskaber.xml"):
        out.append(entry(f"aarhusbolig-{name.split('.')[0].lower()}", f"aarhusbolig/{name}", kind="measured-queue",
                         publisher="Aarhusbolig via Open Data DK", title=f"Aarhusbolig {name}", url=a["sourceUrl"],
                         licence={"name": "CC BY 4.0", "url": "https://creativecommons.org/licenses/by/4.0/"},
                         attribution="Kilde: Aarhusbolig, Open Data DK (CC BY 4.0). Øjebliksbillede 2017.",
                         period="2017 (filer sidst ændret 2017-11-21)",
                         rows=a["totals"]["lists"] if name == "Ventelister.xml" else None))
    if m.get("kk"):
        out.append(entry("kk-almene-boliger", "kk/almene_boliger_kk.geojson", kind="supply",
                         publisher="Københavns Kommune via Open Data DK", title="Almene boligforeninger (afdelinger)",
                         url=m["kk"]["sourceUrl"], licence={"name": "CC BY 4.0", "url": "https://creativecommons.org/licenses/by/4.0/"},
                         attribution="Kilde: Københavns Kommune, Open Data DK (CC BY 4.0).",
                         period=kk_period(),
                         rows=m["kk"]["features"]))
    else:
        out.append({"id": "kk-almene-boliger", "status": "missing", "title": "Almene boligforeninger (afdelinger)",
                    "licence": {"name": "CC BY 4.0", "url": "https://creativecommons.org/licenses/by/4.0/"},
                    "period": "ikke angivet i datasættet"})

    noms = [k for k in log if k.startswith("nominatim/")]
    out.append({"id": "osm-nominatim-postnumre", "kind": "geocoding", "publisher": "OpenStreetMap Nominatim",
                "title": f"Postnummer-centroider til Aarhusbolig ({len(noms)} opslag)", "url": "https://nominatim.openstreetmap.org/",
                "licence": {"name": "ODbL 1.0", "url": "https://www.openstreetmap.org/copyright"},
                "attribution": "© OpenStreetMap-bidragydere (ODbL).", "period": "aktuel",
                "fetchedAt": max(log[k]["fetchedAt"] for k in noms) if noms else None, "rows": len(noms),
                "status": "ok" if noms else "missing"})
    out.append({"id": "openfreemap", "kind": "basemap", "publisher": "OpenFreeMap", "title": "Vektorfliser (runtime)",
                "url": "https://openfreemap.org/", "licence": {"name": "ODbL (OSM data), MIT (OpenFreeMap)", "url": "https://openfreemap.org/tos/"},
                "attribution": "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", "period": "aktuel", "fetchedAt": None,
                "status": "runtime", "note": "Hentes af browseren ved visning. Kortet virker også uden (data-lagene er lokale)."})
    out.append({"id": "ventelistevalg", "kind": "measured-queue", "publisher": "Ventelistevalg", "title": "Offentligt katalog, København og Frederiksberg",
                "url": "https://ventelistevalg.dk/lister/andels", "licence": {"name": "Ikke afklaret", "url": None},
                "period": "ikke hentet", "status": "flag-off",
                "note": "Ikke hentet. Afventer forfatterens godkendelse (PLAN.md, åbent spørgsmål 1). Laget er skjult bag et flag."})

    write_json(SITE_DATA / "sources.json", {"generated": max(e["fetchedAt"] for e in log.values()), "sources": out}, compact=False)
    print(f"sources.json: {len(out)} entries, {sum(1 for s in out if s['status'] == 'ok')} ok, "
          f"{[s['id'] for s in out if s['status'] not in ('ok', 'runtime')]} not ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())

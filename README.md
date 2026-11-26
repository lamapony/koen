# Køen

*Danmarks boligkøer som landskab.*

Køen ("the queue") is an open-source interactive map of Denmark that shows housing waiting-list pressure as terrain: the higher the mountain, the greater the pressure on andelsbolig, almene and private waiting lists. It combines open data from Danmarks Statistik with the few real queue counts that are openly published, and it keeps modelled and measured numbers clearly apart.

Køen is a free showcase made by the people behind [Ventelistevalg](https://ventelistevalg.dk).

## Status

v1 runs locally. Nothing is deployed. The plan is in [PLAN.md](PLAN.md); what was built and how it differs is in [docs/BUILD-NOTES.md](docs/BUILD-NOTES.md); the method (Køtryk v2, with validation) is in [docs/METHOD.md](docs/METHOD.md).

## Run it

```sh
make data-offline      # or: make data (fetches what is not cached)
make check
cd site && npm install && npm run dev
```

The pipeline needs [uv](https://docs.astral.sh/uv/) and Python 3.12. All processed data the site needs is committed in `site/public/data/`, with `sources.json` listing source, licence, period and fetch date for every dataset.

## Licence

- Code: [MIT](LICENSE).
- Data: each source keeps its own licence (for example CC BY 4.0 for Danmarks Statistik and opendata.dk datasets, ODbL for OpenStreetMap). See the source tables in [PLAN.md](PLAN.md) for the full list and required attribution.

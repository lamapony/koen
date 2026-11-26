# Køen data pipeline. Requires uv (https://docs.astral.sh/uv/).
# make data          fetch (cached) and rebuild everything
# make data-offline  rebuild from data/raw cache only, no network
# make refresh       drop the raw cache and fetch fresh
# make check         validate site/public/data

PY := uv run --project . python
P := pipeline

.PHONY: data data-offline fetch process check refresh site

data: fetch process check

fetch:
	cd $(P) && $(PY) 00_fetch_dst.py
	cd $(P) && $(PY) 01_fetch_boundaries.py
	cd $(P) && $(PY) 02_fetch_queues.py

process:
	cd $(P) && $(PY) 10_clean.py
	cd $(P) && $(PY) 20_indicators.py
	cd $(P) && $(PY) 30_index.py
	cd $(P) && $(PY) 40_hexes.py
	cd $(P) && $(PY) 50_measured.py
	cd $(P) && $(PY) 55_validate.py
	cd $(P) && $(PY) 60_export.py
	cd $(P) && $(PY) 90_manifest.py

data-offline:
	KOEN_OFFLINE=1 $(MAKE) fetch process check

check:
	cd $(P) && $(PY) 99_check.py

refresh:
	# Nominatim goes too: the fetch log is dropped, and cached reads do not write log entries (geocoder provenance).
	rm -rf data/raw/dst data/raw/boundaries data/raw/aarhusbolig data/raw/kk data/raw/nominatim data/raw/_fetchlog.json
	$(MAKE) data

site:
	cd site && npm run build

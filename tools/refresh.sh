#!/usr/bin/env bash
# Re-crawl maheralqahtani.org and rebuild data/catalog.json. Refuses to overwrite the
# catalog if the new crawl looks broken (site down, layout changed): fewer than 90% of the old items.
set -euo pipefail
cd "$(dirname "$0")/.."
W=$(mktemp -d)
python3 -I tools/crawl.py "$W/cache" "$W/data.json"
python3 -I tools/date_urls.py "$W/data.json" > "$W/urls.txt"
mkdir -p "$W/dcache" && python3 -I tools/prefetch.py "$W/dcache" "$W/urls.txt" 4
python3 -I tools/build_catalog.py "$W/data.json" "$W/dcache" "$W/catalog.json" "$W/report.json"
# titles for videos the site added since last night (only new ones are looked up), then rebuild with them
python3 -I tools/video_titles.py "$W/catalog.json" data/video_titles.json
python3 -I tools/build_catalog.py "$W/data.json" "$W/dcache" "$W/catalog.json" "$W/report.json"
python3 - "$W/catalog.json" data/catalog.json <<'PY'
import json, sys
tot = lambda p: sum(s['n'] for s in json.load(open(p))['sections'])
new = tot(sys.argv[1])
try: old = tot(sys.argv[2])
except Exception: old = 0
print(f'items: old={old} new={new}')
sys.exit(0 if new >= 0.9 * old else 1)
PY
cp "$W/catalog.json" data/catalog.json
cp "$W/report.json" data/report.json

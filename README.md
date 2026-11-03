# مكتبة دروس الشيخ ماهر القحطاني — skin site

A read-only, modern front end over https://maheralqahtani.org/. It does not change the original site:
it reads its public pages, builds a clean catalog, and links/streams the original audio files.

## Files
- `index.html`, `styles.css`, `app.js` — the static site (no build step; host on any static host)
- `data/catalog.json` — every section, series, chapter and lesson found on the original site
- `data/report.json` — notes where section counts differ from the lessons in sub-chapters, and which lessons were grouped by title (useful to share privately with the site team)
- `tools/crawl.py` — crawls all listing pages (sections, series, sub-chapters, pagination)
- `tools/prefetch.py` — parallel page fetcher (used for detail pages / speeding up long paginations)
- `tools/build_catalog.py` — turns the crawl into `data/catalog.json`

## Refresh the data
`tools/refresh.sh` re-crawls the site and rebuilds `data/catalog.json` (it refuses to overwrite the
catalog if the new crawl has fewer than 90% of the previous items). The GitHub Actions workflow in
`.github/workflows/site.yml` runs it daily, commits any new lessons, and deploys to GitHub Pages.

One-time setup on GitHub: Settings → Pages → Source: **GitHub Actions**.

## Cloudflare Pages (second host)
Cloudflare redeploys automatically on every push to `main`, so the nightly catalog refresh reaches it too.
In Cloudflare: Workers & Pages → Create → Pages → Connect to Git → `Mohamed-AH/sheikhmaher`, then:
- Production branch: `main`
- Framework preset: None
- Build command: `mkdir -p _site && cp -r index.html styles.css app.js data _site/`
- Build output directory: `_site`

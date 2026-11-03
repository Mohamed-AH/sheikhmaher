# مكتبة دروس الشيخ ماهر القحطاني — skin site

A read-only, modern front end over https://maheralqahtani.org/. It doesn't change the original site:
it reads its public pages, builds a clean catalog, and links/streams the original audio files.

## Files
- `index.html`, `styles.css`, `app.js` — the static site (no build step; host on any static host)
- `data/catalog.json` — every section, series, chapter and lesson found on the original site
- `data/report.json` — notes where section counts differ from the lessons in sub-chapters, and which lessons were grouped by title (useful to share privately with the site-team)
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
In Cloudflare: Workers & Pages → your project → Settings → Build:
- Production branch: `main`
- Framework preset: None
- Build command: `python3 -I tools/build_site.py --out _site --base /`
- Build output directory: `_site`
- Environment variable `SITE_URL`: the canonical address (see below)

Cloudflare Pages also serves `_headers` (security headers). Turn on Web Analytics under the project's
Metrics tab; the site's security policy already allows its script.

## Search engines
Every section and book has its own page (`/book/16/`, `/section/fiqh/`), plus `sitemap.xml` and `robots.txt`.
- **Canonical address:** set `SITE_URL` (GitHub: Settings → Secrets and variables → Actions → Variables;
  Cloudflare: project environment variables) to the one address Google should index. Until the custom
  domain exists it defaults to `https://mohamed-ah.github.io/sheikhmaher/`; switch both hosts to the
  custom domain when it is live.
- **Search Console:** add the canonical address as a property. Verify with the HTML-tag method by putting
  the token in a `GSC_VERIFICATION` variable (both hosts), or with DNS once the domain is on Cloudflare.
  Then submit `sitemap.xml`.

## Local preview
`python3 -I tools/build_site.py --out /tmp/site --base /` then serve `/tmp/site` with any static server.
Serving the repo folder itself (without the build step) also works, with `#c-16` style links.

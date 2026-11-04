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
- `tools/titles.json` — display names for series (scholar's title and «رحمه الله»), keyed by the original site's name
- `tools/books.json` — texts (المتون) explained more than once; all their explanations are shown together on one page, each with a short label (place, course or year). Add a text or fix a label here
- `tools/youtube.py` → `data/youtube.json` — the Sheikh's live lessons from the Rajhi mosque in Makkah's YouTube channel (only titles naming him), checked weekly by `.github/workflows/youtube.yml`; they show first among the videos, one series per book
- `tools/video_titles.py` → `data/video_titles.json` — YouTube titles for the videos the original site embeds without a name (nightly, new videos only)
- `tools/video_groups.json` — the topics the video series are shown under, by the original site's series id; a new series lands in «مرئيات متنوعة» until it is placed (listed in `data/report.json` → `video_groups_unplaced`)

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
  Cloudflare: project environment variables) to override the one address Google should index. It
  defaults to `https://sheikhmaheralqahtani.com/` on both hosts, so the GitHub Pages copy and
  sheikhmaher.pages.dev point search engines at the domain. Send visitors there too with a 301 for
  `sheikhmaher.pages.dev` and `www.sheikhmaheralqahtani.com` (Cloudflare Bulk Redirects, keeping the
  path and query); branch previews (`<branch>.sheikhmaher.pages.dev`) are not affected.
- **Search Console:** add the canonical address as a property. Verify with the HTML-tag method by putting
  the token in a `GSC_VERIFICATION` variable (both hosts), or with DNS once the domain is on Cloudflare.
  Then submit `sitemap.xml`.

## Local preview
`python3 -I tools/build_site.py --out /tmp/site --base /` then serve `/tmp/site` with any static server.
Serving the repo folder itself (without the build step) also works, with `#c-16` style links.

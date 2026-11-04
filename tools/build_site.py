"""Build the deployable site: one real HTML page per section and per book, so search engines
can index them, plus sitemap.xml, robots.txt, 404.html and Cloudflare _headers.

Usage:
  python3 -I tools/build_site.py --out _site --base /sheikhmaher/ --site-url https://mohamed-ah.github.io/sheikhmaher/

  --base       path the site is served under ("/" on Cloudflare Pages or a custom domain)
  --site-url   the canonical address (the one you register in Google Search Console)
  SITE_URL (env)          same as --site-url
  CF_BEACON_TOKEN (env)   adds Cloudflare Web Analytics on hosts that don't inject it themselves
  GSC_VERIFICATION (env)  Google Search Console HTML-tag verification token (home page only)
"""
import argparse, html, json, os, re, shutil
from datetime import datetime, timezone

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='_site')
ap.add_argument('--base', default='/')
ap.add_argument('--site-url', default=os.environ.get('SITE_URL', ''))
args = ap.parse_args()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = '/' + args.base.strip('/') + '/' if args.base.strip('/') else '/'
SITE = (args.site_url.rstrip('/') + '/') if args.site_url else ''
OUT = os.path.abspath(args.out)
ORIGIN = 'https://maheralqahtani.org'
SITE_NAME = 'مكتبة معرفة السنن والآثار للشيخ ماهر القحطاني حفظه الله'
SHEIKH = 'فضيلة الشيخ ماهر بن ظافر القحطاني حفظه الله'
BEACON = os.environ.get('CF_BEACON_TOKEN', '').strip()
GSC = os.environ.get('GSC_VERIFICATION', '').strip()  # Google Search Console HTML-tag token

cat = json.load(open(os.path.join(ROOT, 'data', 'catalog.json')))
C = {int(k): v for k, v in cat['cats'].items()}
S = cat['sections']
SEC = {s['key']: s for s in S}
cat_section = {}
for s in S:
    stack = list(s['series'])
    while stack:
        i = stack.pop()
        if i in cat_section or i not in C: continue
        cat_section[i] = s['key']; stack += C[i]['kids']

e = lambda t: html.escape(str(t), quote=True)
AR = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')
def N(n): return f'{n:,}'.translate(AR).replace(',', '٬')
WORDS = {
    'sharh': ('شرح', 'شرحان', 'شروح', 'شرحاً', 'شرح', 'واحد'),
    'lesson': ('درس', 'درسان', 'دروس', 'درساً', 'درس', 'واحد'),
    'clip': ('مقطع', 'مقطعان', 'مقاطع', 'مقطعاً', 'مقطع', 'واحد'),
    'item': ('مادة', 'مادتان', 'مواد', 'مادةً', 'مادة', 'واحدة'),
    'series': ('سلسلة', 'سلسلتان', 'سلاسل', 'سلسلةً', 'سلسلة', 'واحدة'),
    'chapter': ('باب', 'بابان', 'أبواب', 'باباً', 'باب', 'واحد'),
    'article': ('مقالة', 'مقالتان', 'مقالات', 'مقالةً', 'مقالة', 'واحدة'),
}
def cnt(n, w):
    f = WORDS[w]; m = n % 100
    if n == 1: return f'{f[0]} {f[5]}'
    if n == 2: return f[1]
    if 3 <= m <= 10: return f'{N(n)} {f[2]}'
    if 11 <= m <= 99: return f'{N(n)} {f[3]}'
    return f'{N(n)} {f[4]}'
def lesson_title(t):
    m = re.match(r'^\s*[\[(]\s*([^\])]+?)\s*[\])]\s*[-–:]*\s*(.*)$', t)
    rest = (m.group(2) if m else t)
    rest = re.sub(r'^[-–\s]+|[-–\s.]+$', '', rest).strip()
    return rest or t.strip()
def chain(i):
    out, c, g = [], C.get(i), 0
    while c is not None and g < 12:
        out.insert(0, (i, c)); i = c['up']; c = C.get(i) if i is not None else None; g += 1
    return out

tpl = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
head_end = tpl.index('</head>')
main_re = re.compile(r'<main id="app"[^>]*>.*?</main>', re.S)

CSP = ("default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
       "img-src 'self' data: https://i.ytimg.com; media-src https://maheralqahtani.org; "
       "connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; form-action 'self'")

def page(path, title, desc, body, crumbs=None, noindex=False, extra_ld=None):
    url = SITE + path if SITE else ''
    full_title = f'{title} | {SITE_NAME}' if title else SITE_NAME
    ld = []
    if crumbs and SITE:
        ld.append({'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITE + p} for i, (n, p) in enumerate(crumbs)]})
    if extra_ld: ld.append(extra_ld)
    head = [
        f'<base href="{BASE}" data-router="path">',
        f'<meta http-equiv="Content-Security-Policy" content="{CSP}">',
        '<meta name="referrer" content="strict-origin-when-cross-origin">',
        '<meta name="theme-color" content="#0e5a55">',
    ]
    if noindex: head.append('<meta name="robots" content="noindex">')
    if GSC and path == '': head.append(f'<meta name="google-site-verification" content="{e(GSC)}">')
    if url: head.append(f'<link rel="canonical" href="{e(url)}">')
    head += [
        '<meta property="og:type" content="website">', '<meta property="og:locale" content="ar_AR">',
        f'<meta property="og:site_name" content="{e(SITE_NAME)}">', f'<meta property="og:title" content="{e(title or SITE_NAME)}">',
        f'<meta property="og:description" content="{e(desc)}">', '<meta name="twitter:card" content="summary_large_image">',
    ]
    if url: head += [f'<meta property="og:url" content="{e(url)}">', f'<meta property="og:image" content="{e(SITE)}og.png">']
    for x in ld: head.append('<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False).replace('</', '<\\/') + '</script>')
    if BEACON: head.append(f'<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{{"token": "{e(BEACON)}"}}\'></script>')
    base_tag, rest = head[0], head[1:]
    doc = tpl[:head_end] + '\n'.join(rest) + '\n' + tpl[head_end:]
    doc = doc.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + base_tag, 1)  # <base> must precede every relative URL
    doc = re.sub(r'<title>.*?</title>', f'<title>{e(full_title)}</title>', doc, count=1, flags=re.S)
    doc = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{e(desc)}">', doc, count=1)
    doc = main_re.sub(lambda m: f'<main id="app" tabindex="-1" data-prerendered="1">{body}</main>', doc, count=1)
    dest = os.path.join(OUT, path, 'index.html') if not path.endswith('.html') else os.path.join(OUT, path)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, 'w', encoding='utf-8').write(doc)

def crumbs_html(items):
    parts = []
    for n, p in items[:-1]: parts.append(f'<a href="{e(p)}">{e(n)}</a><span aria-hidden="true">/</span>')
    return '<div class="crumbs">' + ''.join(parts) + '</div>'

def book_card(i):
    c = C[i]
    return (f'<a class="book" href="book/{i}/"><div class="spine"><span class="num">{N(c["n"])}</span></div>'
            f'<div><h3>{e(c["t"])}</h3><div class="meta"><span>{cnt(c["n"], "clip" if c["v"] and not c["l"] else "lesson")}</span>'
            + (f'<span>{cnt(len(c["kids"]), "chapter")}</span>' if c['kids'] else '') + '</div></div></a>')

TEXTS = [t for t in cat.get('texts', []) if len([i for i in t['ids'] if i in C]) > 1]
TEXT_OF = {i: t for t in TEXTS for i in t['ids']}
def text_card(t):
    return (f'<a class="book text" href="text/{t["k"]}/"><div class="spine stack"><span class="num">{N(len(t["ids"]))}</span></div>'
            f'<div><h3>{e(t["t"])}</h3><div class="by">{e(t["by"])}</div><div class="meta"><span>{cnt(len(t["ids"]), "sharh")}</span><span>{cnt(t["n"], "lesson")}</span></div></div></a>')
def shelf(ids):
    out, seen = [], set()
    for i in ids:
        if not C[i]['n']: continue
        t = TEXT_OF.get(i)
        if not t: out.append((C[i]['n'], book_card(i)))
        elif t['k'] not in seen: seen.add(t['k']); out.append((t['n'], text_card(t)))
    return ''.join(h for _, h in sorted(out, key=lambda x: -x[0]))

def lessons_html(ls):
    rows, ts = [], [lesson_title(l[1]) for l in ls]
    for i, l in enumerate(ls):
        a = b = i
        while a > 0 and ts[a - 1] == ts[i]: a -= 1
        while b < len(ts) - 1 and ts[b + 1] == ts[i]: b += 1
        part = f' <span class="part">({N(i - a + 1)} من {N(b - a + 1)})</span>' if b > a and b - a + 1 < len(ls) else ''
        rows.append(f'<div class="lesson"><span class="play" aria-hidden="true"></span><div><div class="t">{e(ts[i])}{part}</div>'
                    f'<div class="sub"><span>الدرس {N(i + 1)}</span></div></div>'
                    f'<div class="acts"><a href="{ORIGIN}/details/{int(l[0])}" target="_blank" rel="noopener">صفحة الدرس</a></div></div>')
    return '<div class="lessons">' + ''.join(rows) + '</div>'

if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
for f in ['styles.css', 'app.js', 'favicon.svg', 'og.png']:
    if os.path.exists(os.path.join(ROOT, f)): shutil.copy(os.path.join(ROOT, f), OUT)
shutil.copytree(os.path.join(ROOT, 'data'), os.path.join(OUT, 'data'), ignore=shutil.ignore_patterns('report.json'))

total = sum(s['n'] for s in S)
home_desc = f'{SHEIKH}: شروح المتون والمحاضرات والخطب المنشورة في موقع معرفة السنن والآثار، مرتبة حسب الكتب والأبواب. {cnt(total, "item")}.'
sitemap = [('', 1.0)]

# home
home = (f'<section class="hero"><div class="wrap"><div><div class="eyebrow">{e(SHEIKH)}</div>'
        '<h1>دروس الشيخ بواجهة جديدة، <span>مرتبة كتاباً كتاباً</span></h1>'
        '<p class="lede">واجهة مساندة لموقع معرفة السنن والآثار، تعرض شروح المتون والمحاضرات والخطب المنشورة فيه مرتبةً حسب الكتب والأبواب، تيسيراً على طلاب العلم.</p></div></div></section>'
        '<section class="block"><div class="wrap"><div class="block-head"><h2>أقسام المكتبة</h2></div><div class="shelf">'
        + ''.join(f'<a class="subject" href="section/{s["key"]}/"><h3>{e(s["t"])}</h3><div class="meta num">{cnt(s["n"], "article" if s["kind"] == "articles" else "item")}</div></a>' for s in S if s['n'])
        + '</div></div></section>')
site_ld = {'@context': 'https://schema.org', '@type': 'WebSite', 'name': SITE_NAME, 'inLanguage': 'ar'}
if SITE: site_ld.update(url=SITE, potentialAction={'@type': 'SearchAction', 'target': f'{SITE}search/?q={{q}}', 'query-input': 'required name=q'})
page('', '', home_desc, home, extra_ld=site_ld)

# simple app pages (rendered by the app; noindex for personal / dynamic ones)
page('library/', 'المكتبة', f'كل الكتب والسلاسل المشروحة ل{SHEIKH}، مرتبة حسب الأقسام.',
     '<div class="page-head"><div class="wrap"><h1 class="kufi">المكتبة كاملة</h1></div></div><div class="wrap">'
     + ''.join(f'<section class="block"><h2>{e(s["t"])}</h2><div class="series-list">' + shelf(s['series']) + '</div></section>' for s in S if s['series'])
     + '</div>', crumbs=[('الرئيسية', ''), ('المكتبة', 'library/')])
sitemap.append(('library/', .8))
page('start/', 'ابدأ من هنا', f'طريق مقترح لطالب العلم الجديد في دروس {SHEIKH}: متون مختصرة مرتبة من الأيسر إلى الأوسع.',
     '<div class="page-head"><div class="wrap"><h1 class="kufi">طريق مقترح لطالب العلم الجديد</h1></div></div>', crumbs=[('الرئيسية', ''), ('ابدأ من هنا', 'start/')])
sitemap.append(('start/', .8))
page('mine/', 'متابعتي', 'الكتب المحفوظة وآخر ما استمعت إليه.', '<div class="page-head"><div class="wrap"><h1 class="kufi">متابعتي</h1></div></div>', noindex=True)
page('search/', 'البحث', 'ابحث في عناوين الكتب والدروس.', '<div class="page-head"><div class="wrap"><h1 class="kufi">البحث في المكتبة</h1></div></div>', noindex=True)

# sections
for s in S:
    if not s['n']: continue
    path = f'section/{s["key"]}/'
    cr = [('الرئيسية', ''), ('المكتبة', 'library/'), (s['t'], path)]
    body = (f'<div class="page-head"><div class="wrap">{crumbs_html(cr)}<h1 class="kufi">{e(s["t"])}</h1>'
            f'<div class="meta"><span class="pill num">{cnt(s["n"], "item")}</span></div></div></div><div class="wrap" style="padding-block:24px">'
            + (f'<div class="series-list">' + shelf(s['series']) + '</div>' if s['series'] else '')
            + (lessons_html(s['l'][:300]) if s['l'] else '')
            + (''.join(f'<a class="article" href="{ORIGIN}/details/{int(a[0])}" target="_blank" rel="noopener"><h3>{e(a[1])}</h3><p>{e(a[2])}</p></a>' for a in s['a']) if s['a'] else '')
            + '</div>')
    desc = f'{s["t"]} — {cnt(s["n"], "article" if s["kind"] == "articles" else "item")} ل{SHEIKH}' + (f'، في {cnt(len(s["series"]), "series")}' if s['series'] else '') + '.'
    page(path, s['t'], desc, body, crumbs=cr)
    sitemap.append((path, .7))

# texts explained more than once
for t in TEXTS:
    path = f'text/{t["k"]}/'
    sk = cat_section.get(t['ids'][0])
    cr = [('الرئيسية', '')] + ([(SEC[sk]['t'], f'section/{sk}/')] if sk else []) + [(t['t'], path)]
    items = ''.join(f'<a class="exp" href="book/{i}/"><span class="no num" aria-hidden="true">{N(n + 1)}</span><div><h3>{e(t.get("h", {}).get(str(i)) or C[i]["t"])}</h3>'
                    + (f'<div class="full">{e(C[i]["t"])}</div>' if not t.get('h', {}).get(str(i), C[i]['t']).startswith(C[i]['t']) else '') + f'<div class="chips num"><span>{cnt(C[i]["n"], "lesson")}</span></div></div></a>'
                    for n, i in enumerate(t['ids']) if i in C)
    body = (f'<div class="page-head"><div class="wrap">{crumbs_html(cr)}<h1>{e(t["t"])}</h1><p class="byline">{e(t["by"])}</p>'
            f'<div class="meta"><span class="pill num">{cnt(len(t["ids"]), "sharh")}</span><span class="pill num">{cnt(t["n"], "lesson")}</span></div></div></div>'
            f'<div class="wrap" style="padding-block:24px"><h2 class="sr-only">الشروح</h2><div class="exps">{items}</div></div>')
    desc = f'شروح «{t["t"]}» {t["by"]}، ل{SHEIKH}: {cnt(len(t["ids"]), "sharh")} في أماكن وأعوام مختلفة، {cnt(t["n"], "lesson")}.'
    page(path, t['t'], desc, body, crumbs=cr, extra_ld={'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': t['t'], 'inLanguage': 'ar', 'description': desc})
    sitemap.append((path, .7))

# books and chapters
for i, c in C.items():
    path = f'book/{i}/'
    ch = chain(i)
    sk = cat_section.get(ch[0][0])
    tx = TEXT_OF.get(ch[0][0])
    cr = [('الرئيسية', '')] + ([(SEC[sk]['t'], f'section/{sk}/')] if sk else []) + ([(tx['t'], f'text/{tx["k"]}/')] if tx else []) + [(x['t'], f'book/{j}/') for j, x in ch]
    kids = [k for k in c['kids'] if k in C and C[k]['n']]  # chapters with no lessons yet are folded below
    empty = [k for k in c['kids'] if k in C and not C[k]['n']]
    unit = 'clip' if c['v'] and not c['l'] else 'lesson'
    body = (f'<div class="page-head"><div class="wrap">{crumbs_html(cr)}<h1>{e(c["t"])}</h1>'
            f'<div class="meta"><span class="pill num">{cnt(c["n"], unit)}</span>' + (f'<span class="pill num">{cnt(len(kids), "chapter")}</span>' if kids else '') + '</div></div></div>'
            '<div class="wrap" style="padding-block:24px">'
            + ('<nav class="chapters" aria-label="الأبواب"><h2>أبواب الكتاب</h2>' + ''.join(f'<a href="book/{k}/"><span>{e(C[k]["t"])}</span><span class="c num">{N(C[k]["n"])}</span></a>' for k in kids)
               + (f'<details class="empties"><summary>أبواب لم تُرفع دروسها بعد <span class="num">({N(len(empty))})</span></summary><ul>' + ''.join(f'<li>{e(C[k]["t"])}</li>' for k in empty) + '</ul></details>' if empty else '')
               + '</nav>' if kids or empty else '')
            + ('<h2 class="sr-only">الدروس</h2>' + lessons_html(c['l']) if c['l'] else '')
            + (''.join(f'<a class="article" href="{ORIGIN}/details/{int(a[0])}" target="_blank" rel="noopener"><h3>{e(a[1])}</h3></a>' for a in c['a']) if c['a'] else '')
            + '</div>')
    parent = f' من «{ch[0][1]["t"]}»' if len(ch) > 1 else ''
    desc = f'«{c["t"]}»{parent}: {cnt(c["n"], unit)} ل{SHEIKH}، للاستماع والتنزيل' + (f'، في {cnt(len(kids), "chapter")}' if kids else '') + '.'
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': c['t'], 'inLanguage': 'ar', 'description': desc,
          'author': {'@type': 'Person', 'name': 'ماهر بن ظافر القحطاني'}, 'isBasedOn': f'{ORIGIN}/page/{c["p"]}' + ('' if c.get('x') else f'?category_id={i}')}
    page(path, c['t'], desc, body, crumbs=[(n, p) for n, p in cr], noindex=c['n'] == 0, extra_ld=ld)
    if c['n']: sitemap.append((path, .6 if c['up'] is None else .5))

# 404: same shell; the app routes it client-side, and unknown paths show its "not found" view
page('404.html', 'الصفحة غير موجودة', 'الصفحة غير موجودة.', '<div class="wrap"><div class="empty-note">الصفحة غير موجودة. <a href="">العودة للرئيسية</a></div></div>', noindex=True)

today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
if SITE:
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p, pr in sitemap: xml.append(f'<url><loc>{e(SITE + p)}</loc><lastmod>{today}</lastmod><priority>{pr}</priority></url>')
    xml.append('</urlset>')
    open(os.path.join(OUT, 'sitemap.xml'), 'w').write('\n'.join(xml))
open(os.path.join(OUT, 'robots.txt'), 'w').write('User-agent: *\nAllow: /\nDisallow: ' + BASE + 'search/\nDisallow: ' + BASE + 'mine/\n' + (f'Sitemap: {SITE}sitemap.xml\n' if SITE else ''))
# Cloudflare Pages reads _headers; GitHub Pages ignores it (the CSP meta tag covers the essentials there)
open(os.path.join(OUT, '_headers'), 'w').write(f"""/*
  Content-Security-Policy: {CSP}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  X-Frame-Options: DENY
/data/*
  Cache-Control: public, max-age=0, must-revalidate
""")
print(f'built {len(sitemap)} indexable pages into {OUT} (base {BASE}, canonical {SITE or "none"})')

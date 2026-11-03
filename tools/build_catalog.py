"""Turn the raw crawl into the compact catalog the skin site loads.

Usage:
  python3 -I build_catalog.py data.json dcache_dir ../data/catalog.json ../data/report.json

How counts are derived:
  * counts are recomputed from the lessons actually found on every subpage (and summed over sub-chapters)
  * lessons that sit in a subject's flat list but belong to no series are regrouped into
    "recovered" series using the [ book name ] prefix in their titles
"""
import json, sys, re, os, glob, hashlib, datetime

raw = json.load(open(sys.argv[1]))
DCACHE, OUT, REPORT = sys.argv[2], sys.argv[3], sys.argv[4]
BASE = 'https://maheralqahtani.org'

SECTIONS = [  # page id, key, label, kind
    (7,  'aqeedah', 'العقيدة',               'tree'),
    (8,  'tafsir',  'التفسير وعلوم القرآن',   'tree'),
    (9,  'hadith',  'الحديث',                 'tree'),
    (10, 'fiqh',    'الفقه',                  'tree'),
    (11, 'seerah',  'السيرة النبوية',          'tree'),
    (13, 'manhaj',  'المحاضرات المنهجية',      'flat'),
    (12, 'raqaiq',  'الرقائق والمواعظ',        'flat'),
    (2,  'khutab',  'خطب الجمعة',             'flat'),
    (3,  'videos',  'المرئيات',               'videos'),
    (14, 'fawaid',  'فوائد قحطانية',           'articles'),
    (4,  'articles','المقالات',               'articles'),
    (15, 'books',   'الكتب والرسائل العلمية',   'flat'),
]

# ---------- upload dates from detail pages (only the ones fetched) ----------
MONTHS = ['محرم', 'صفر', 'ربيع الاول', 'ربيع الاخر', 'جمادي الاول', 'جمادي الاخر', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعده', 'ذو الحجه']
def norm(s):
    s = re.sub(r'[ً-ٰٟـ]', '', s)
    return s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
dates = {}
for fn in glob.glob(os.path.join(DCACHE, '*.html')):
    s = open(fn, encoding='utf-8', errors='replace').read()
    did = None
    m2 = re.search(r'<meta property="og:url" content="https://maheralqahtani\.org/details/(\d+)"', s)
    if m2: did = m2.group(1)
    d = re.search(r'fa-circle"></i>\s*[^،]+،\s*(\d+)\s+([^،]+?)\s*،\s*(\d{4})هـ', s)
    if not d: continue
    mon = norm(d.group(2)).strip()
    mi = next((i for i, x in enumerate(MONTHS) if mon.startswith(x) or x.startswith(mon)), None)
    if mi is None: continue
    if not did: continue
    dates[did] = f"{int(d.group(3))}-{mi + 1:02d}-{int(d.group(1)):02d}"

cats = {int(k): v for k, v in raw['cats'].items()}
secs = {int(k): v for k, v in raw['sections'].items()}
# the crawler's 'title' is the page banner (the subject name); the series name is the link text
link_title = {}
for holder in list(secs.values()) + list(cats.values()):
    for x in holder.get('cats', []):
        link_title.setdefault(x['id'], x['title'])
for cid, c in cats.items():
    c['title'] = link_title.get(cid, c['title'])

# Lessons whose audio link points at the site's home page are placeholders for recordings that
# were never found; the site's team keeps them unpublished, so they are left out here (counts too).
# They reappear on their own once a file is attached.
has_file = lambda u: bool(re.match(r'^https?://[^/]+/.+', u or ''))
for holder in list(cats.values()) + list(secs.values()):
    holder['files'] = [f for f in holder.get('files', []) if has_file(f['url'])]

def dedupe(items, key):
    seen, out = set(), []
    for it in items:
        k = key(it)
        if k in seen: continue
        seen.add(k); out.append(it)
    return out

children = {cid: list(dict.fromkeys(s['id'] for s in c['cats'] if s['id'] != cid and s['id'] in cats)) for cid, c in cats.items()}
parent = {}
for cid, kids in children.items():
    for k in kids: parent.setdefault(k, cid)

def lesson(f):
    d = dates.get(str(f['id']))
    return [f['id'], f['title'], f['url']] + ([d] if d else [])
def article(a):
    d = dates.get(str(a['id']))
    return [a['id'], a['title'], a.get('excerpt', '')] + ([d] if d else [])

def total(cid, stack=()):
    if cid in stack: return 0
    c = cats[cid]
    own = len({f['id'] for f in c['files']}) + len({a['id'] for a in c['articles']}) + len(set(c['videos']))
    return own + sum(total(k, stack + (cid,)) for k in children.get(cid, []))

out_cats, report = {}, {'counts': [], 'recovered': []}
for cid, c in cats.items():
    t = total(cid)
    out_cats[cid] = {
        't': c['title'], 'p': c['page'], 'up': parent.get(cid), 'kids': children.get(cid, []), 'n': t,
        'listed': c['listed_count'],
        'l': [lesson(f) for f in dedupe(c['files'], lambda f: f['id'])],
        'a': [article(a) for a in dedupe(c['articles'], lambda a: a['id'])],
        'v': list(dict.fromkeys(c['videos'])),
    }
    if c['listed_count'] != t:
        report['counts'].append({'id': cid, 'title': c['title'], 'site_says': c['listed_count'], 'actual': t,
                                 'url': f"{BASE}/page/{c['page']}?category_id={cid}"})

in_series = set()
for c in cats.values(): in_series |= {f['id'] for f in c['files']}

PREFIX = re.compile(r'^\s*[\[(]\s*([^\])]+?)\s*[\])]')
next_id = 900001
sections = []
roots_by_page = {}
for x in secs.get(1, {}).get('cats', []) + secs.get(5, {}).get('cats', []):
    if x['id'] in cats and x['id'] not in parent:
        roots_by_page.setdefault(x['page'], []).append(x['id'])
for x in secs.get(3, {}).get('cats', []):
    if x['id'] in cats and x['id'] not in parent:
        roots_by_page.setdefault(3, []).append(x['id'])

for pid, key, label, kind in SECTIONS:
    s = secs.get(pid, {})
    roots = list(dict.fromkeys(roots_by_page.get(pid, [])))
    loose = [f for f in dedupe(s.get('files', []), lambda f: f['id']) if f['id'] not in in_series]
    flat = []
    if kind == 'tree' and loose:
        groups = {}
        for f in loose:
            m = PREFIX.match(f['title'])
            groups.setdefault(m.group(1).strip() if m else '', []).append(f)
        misc = []
        for name, fs in sorted(groups.items(), key=lambda kv: -len(kv[1])):
            if not name or len(fs) < 3:
                misc += fs; continue
            fs.sort(key=lambda f: f['id'])
            out_cats[next_id] = {'t': name, 'p': pid, 'up': None, 'kids': [], 'n': len(fs), 'listed': len(fs), 'x': 1,
                                 'l': [lesson(f) for f in fs], 'a': [], 'v': []}
            report['recovered'].append({'section': label, 'title': name, 'lessons': len(fs)})
            roots.append(next_id); next_id += 1
        if misc:
            misc.sort(key=lambda f: f['id'])
            out_cats[next_id] = {'t': f'دروس متفرقة في {label}', 'p': pid, 'up': None, 'kids': [], 'n': len(misc), 'listed': len(misc), 'x': 1,
                                 'l': [lesson(f) for f in misc], 'a': [], 'v': []}
            report['recovered'].append({'section': label, 'title': f'دروس متفرقة في {label}', 'lessons': len(misc)})
            roots.append(next_id); next_id += 1
    else:
        flat = loose
    arts = dedupe(s.get('articles', []), lambda a: a['id'])
    n = sum(out_cats[r]['n'] for r in roots) + len(flat) + len(arts)
    sections.append({'id': pid, 'key': key, 't': label, 'kind': kind, 'series': roots,
                     'l': [lesson(f) for f in flat], 'a': [article(a) for a in arts], 'n': n})

built = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
json.dump({'built': built, 'sections': sections, 'cats': out_cats}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
report['counts'].sort(key=lambda r: -(r['actual'] - r['site_says']))
json.dump(report, open(REPORT, 'w'), ensure_ascii=False, indent=1)
print('dates', len(dates))
print('sections', [(s['key'], s['n'], len(s['series']), len(s['l']), len(s['a'])) for s in sections])
print('total', sum(s['n'] for s in sections), 'cats', len(out_cats), 'count fixes', len(report['counts']),
      'recovered series', len(report['recovered']), 'recovered lessons', sum(r['lessons'] for r in report['recovered']))

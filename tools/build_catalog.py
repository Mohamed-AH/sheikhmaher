"""Turn the raw crawl into the compact catalog the skin site loads.

Usage:
  python3 -I build_catalog.py data.json dcache_dir ../data/catalog.json ../data/report.json

How counts are derived:
  * counts are recomputed from the lessons actually found on every subpage (and summed over sub-chapters)
  * lessons that sit in a subject's flat list but belong to no series are regrouped into
    "recovered" series using the [ book name ] prefix in their titles
"""
import json, sys, re, os, glob, hashlib, datetime, urllib.parse

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

# ---------- regrouping loose lessons into courses ----------
# A book is often taught more than once (different years, mosques, cities). Each course's recordings
# live in their own folder on the site, so lessons are grouped by course folder first and by the
# "[ book ]" prefix of their titles second. Repeated books get the course's year in the heading.
GENERIC_DIR = re.compile(r'^(\d{4}|admin|abaymene|العقيدة|الفقه|الحديث|التفسير|السيرة|السيرة النبوية|محاضرات منهجية|خطب|الرقائق)$')
def course_key(u):
    p = urllib.parse.unquote(urllib.parse.urlparse(u).path)
    p = re.sub(r'[\u200e\u200f\u2066-\u2069]', '', p).strip('/')
    segs = p.split('/')[:-1]
    if segs[:3] == ['lfm', 'files', 'admin']: segs = segs[3:]
    elif segs[:2] == ['lfm', 'files']: segs = segs[2:]
    out = []
    for x in segs:
        out.append(x.strip())
        if not GENERIC_DIR.match(x.strip()): return '/'.join(out)
    return None
def book_norm(t):
    t = norm(t)
    t = re.sub(r'^(شرح|التعليق علي|كتاب)\s+', '', t)
    return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', ' ', t)).strip()
def same_book(a, b):
    a, b = book_norm(a), book_norm(b)
    return bool(a and b) and (a == b or a.startswith(b + ' ') or b.startswith(a + ' '))
AR_DIGITS = str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩')
def year_label(fs):
    ys = sorted({dates[str(f['id'])][:4] for f in fs if str(f['id']) in dates})
    if not ys: return ''
    y = ys[0] if ys[0] == ys[-1] else f'{ys[0]}–{ys[-1]}'
    return f'{y}هـ'.translate(AR_DIGITS)

def course_groups(loose, label):
    """Split loose lessons into courses. Returns [{'title', 'files', 'folders'}] in display order."""
    for f in loose:
        m = PREFIX.match(f['title'])
        f['_book'] = m.group(1).strip() if m else ''
        f['_key'] = course_key(f['url'])
    # lessons with no "[ book ]" prefix take the book of their course folder
    by_key = {}
    for f in loose:
        if f['_key']: by_key.setdefault(f['_key'], []).append(f)
    for k, fs in by_key.items():
        named = [f['_book'] for f in fs if f['_book']]
        if named:
            top = max(set(named), key=named.count)
            for f in fs:
                if not f['_book']: f['_book'] = top
    # books: cluster spellings of the same book name
    books = []  # [[names...]]
    for f in loose:
        if not f['_book']: continue
        for b in books:
            if same_book(b[0], f['_book']): b.append(f['_book']); break
        else: books.append([f['_book']])
    book_of = {}
    for i, b in enumerate(books):
        for n in b: book_of[n] = i
    units = {}
    for f in loose:
        if not f['_book']: units.setdefault(('misc',), []).append(f); continue
        units.setdefault((book_of[f['_book']], f['_key']), []).append(f)
    misc = units.pop(('misc',), [])
    # a stray lesson (or lessons stored outside any course folder) joins the largest course of the same book
    per_book = {}
    for (b, k), fs in units.items(): per_book.setdefault(b, []).append((k, fs))
    groups = []
    for b, us in per_book.items():
        us.sort(key=lambda u: -len(u[1]))
        keep = [u for u in us if u[0] and len(u[1]) >= 2] or [us[0]]
        for u in us:
            if any(u is x for x in keep): continue
            keep[0][1].extend(u[1])
        if sum(len(u[1]) for u in keep) < 3:
            for u in keep: misc.extend(u[1])
            continue
        for k, fs in keep:
            fs.sort(key=lambda f: f['id'])
            names = [f['_book'] for f in fs]
            title = max(set(names), key=lambda n: (names.count(n), len(n)))
            groups.append({'book': b, 'title': title, 'files': fs, 'size': sum(len(u[1]) for u in keep),
                           'folders': sorted({f['_key'] or '-' for f in fs})})
    # repeated books: same base title, distinguished by year, oldest first
    by_book = {}
    for g in groups: by_book.setdefault(g['book'], []).append(g)
    for b, gs in by_book.items():
        gs.sort(key=lambda g: (dates.get(str(g['files'][0]['id']), '9999'), g['files'][0]['id']))
        # folders started in the same month are chapters of one course (e.g. الصيام then الإعتكاف in Ramadan)
        merged = []
        for g in gs:
            m0 = dates.get(str(g['files'][0]['id']), '')[:7]
            if merged and m0 and m0 == dates.get(str(merged[-1]['files'][0]['id']), '')[:7]:
                merged[-1]['files'] = sorted(merged[-1]['files'] + g['files'], key=lambda f: f['id'])
                merged[-1]['folders'] = sorted(set(merged[-1]['folders']) | set(g['folders']))
            else: merged.append(g)
        gs[:] = merged
        if len(gs) > 1:
            base = max((g['title'] for g in gs), key=lambda t: (sum(g['title'] == t for g in gs), -len(t)))
            labels = [year_label(g['files']) for g in gs]
            dup = [bool(l) and labels.count(l) > 1 for l in labels]
            for i, g in enumerate(gs):  # same year: name the month the course started
                d0 = dates.get(str(g['files'][0]['id']))
                if dup[i] and d0:
                    labels[i] = f'{HMONTHS[int(d0[5:7]) - 1]} {d0[:4]}هـ'.translate(AR_DIGITS)
            final = [l if l and labels.count(l) == 1 else (l + ' - ' if l else '') + f'الدورة {ORD[i] if i < len(ORD) else i + 1}'
                     for i, l in enumerate(labels)]
            for g, lab in zip(gs, final):
                g['title'] = f'{g["title"]} ({lab})'
    order = sorted(by_book.values(), key=lambda gs: -gs[0]['size'])
    groups = [g for gs in order for g in gs]
    out = [g for gs in order for g in gs]
    if misc:
        misc.sort(key=lambda f: f['id'])
        out.append({'title': f'دروس متفرقة في {label}', 'files': misc, 'folders': sorted({f['_key'] or '-' for f in misc})})
    return out
HMONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة']
ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة']
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
        for g in course_groups(loose, label):
            fs, name = g['files'], g['title']
            next_id = 9000000 + fs[0]['id']  # stable across refreshes: tied to the group's first lesson
            out_cats[next_id] = {'t': name, 'p': pid, 'up': None, 'kids': [], 'n': len(fs), 'listed': len(fs), 'x': 1,
                                 'l': [lesson(f) for f in fs], 'a': [], 'v': []}
            report['recovered'].append({'section': label, 'title': name, 'lessons': len(fs), 'folders': g['folders']})
            roots.append(next_id)
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

"""Turn the raw crawl into the compact catalog the skin site loads.

Usage:
  python3 -I build_catalog.py data.json dcache_dir ../data/catalog.json ../data/report.json

How counts are derived:
  * counts are recomputed from the lessons actually found on every subpage (and summed over sub-chapters)
  * lessons that sit in a subject's flat list but belong to no series are regrouped into
    "recovered" series using the [ book name ] prefix in their titles
"""
import json, sys, re, os, glob, hashlib, datetime, urllib.parse, collections

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
# scholars' titles and honorifics for series names (see tools/titles.json)
TITLES = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'titles.json'), encoding='utf-8')).items() if not k.startswith('_')}
BOOKS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'books.json'), encoding='utf-8'))
for cid, c in cats.items():
    c['title'] = link_title.get(cid, c['title'])
    c['title'] = TITLES.get(c['title'].strip(), c['title'])

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

# YouTube titles of the site's videos (tools/video_titles.py), without the Sheikh's name, which every page
# already shows: «… || لفضيلة الشيخ ماهر بن ظافر القحطاني حفظه الله» → «…»
VT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'video_titles.json')
VTITLES = json.load(open(VT, encoding='utf-8')) if os.path.exists(VT) else {}
HON = r'(ل?فضيلة|ل?ل?شي[خح]?(نا)?|ال?شي[خح]?|الفاضل|القارئ|الهُ?مام|بصوت|أ?\.?د\.|\|\||[|/:"(])'
NAME_TAIL = re.compile(r'\s*(\|\||\||//|[-–/:،,"(])?\s*(' + HON + r'\s*)+(أبو|أبي)?\s*(عبد ?الله)?\s*'
                       r'(ماهر(\s*(بن\s*)?(ظافر|ظاهر))?(\s*آل\s*ظافر)?(\s*(ال)?قحطان[يى])?|(ال)?قحطان[يى])'
                       r'(\s|حفظه|حفظهُ|ا?الله|اللّٰه|ﷲ|ورعاه|تعالى|[".)])*$')
def vtitle(i):
    t = (VTITLES.get(i) or {}).get('t', '').replace('_', ' ')
    t = re.sub(r'[\u200e\u200f\u202a-\u202e]|\s*YouTube\s*$|\.(wmv|mp4|avi|flv)\b', '', t)
    t = re.sub(r'\s+', ' ', NAME_TAIL.sub('', t)).strip(' .-–|/')
    return t
def video(i):  # [id, title, Hijri upload date] as far as known
    t, h = vtitle(i), (VTITLES.get(i) or {}).get('h', '')
    return [i, t, h] if h else [i, t] if t else i

out_cats, report = {}, {'counts': [], 'recovered': [], 'attached': [], 'nested': []}
for cid, c in cats.items():
    t = total(cid)
    out_cats[cid] = {
        't': c['title'], 'p': c['page'], 'up': parent.get(cid), 'kids': children.get(cid, []), 'n': t,
        'listed': c['listed_count'],
        'l': [lesson(f) for f in dedupe(c['files'], lambda f: f['id'])],
        'a': [article(a) for a in dedupe(c['articles'], lambda a: a['id'])],
        'v': [video(i) for i in dict.fromkeys(c['videos'])],
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


# prefixes such as "[ الدورة العلمية ]" name a course, not a book
COURSE_NAME = re.compile(r'^(الدوره العلميه( الموحده)?|الدورات العلميه|الدوره|دوره)$')
CONT_DIR = re.compile(r'^(تابع|جديد|فرعي|ملف|مجلد|\d{1,4}|\d+ إلى \d+)$')
def folder_segs(u):
    p = urllib.parse.unquote(urllib.parse.urlparse(u).path)
    p = re.sub(r'[\u200e\u200f\u2066-\u2069]', '', p).strip('/')
    segs = [x.strip() for x in p.split('/')[:-1]]
    if segs[:3] == ['lfm', 'files', 'admin']: segs = segs[3:]
    elif segs[:2] == ['lfm', 'files']: segs = segs[2:]
    return segs
def lesson_dir(u):
    segs = folder_segs(u)
    while segs and CONT_DIR.match(segs[-1]): segs = segs[:-1]
    return '/'.join(segs)
def bnorm(t):
    return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]|[_\d٠-٩]', ' ', norm(t))).strip()
def known_books(loose):
    names = {}
    for b in BOOKS['texts']:
        for ph in b['match']: names[ph] = ph
    for f in loose:
        m = PREFIX.match(f['title'])
        if m and not COURSE_NAME.match(norm(m.group(1).strip())): names[m.group(1).strip()] = m.group(1).strip()
    return sorted(((bnorm(k), v) for k, v in names.items() if len(bnorm(k)) >= 5), key=lambda kv: -len(kv[0]))
def book_in(texts, known, single=False):
    """the known book named in these texts (folder names, or a title); with single, ignore a title naming two books"""
    for t in texts:
        n = bnorm(t)
        if len(n) < 5: continue
        exact = [v for k, v in known if k == n]
        inside = [v for k, v in known if re.search(r'(^| )و?' + re.escape(k) + r'( |$)', n)]  # longest first
        around = [v for k, v in sorted(known, key=lambda kv: len(kv[0])) if not single and len(n.split()) >= 2 and ' ' + n + ' ' in ' ' + k + ' ']
        if single:
            core = {bnorm(h) for h in inside}
            core = {c for c in core if not any(c != o and c in o for o in core)}
            if len(core) > 1: return ''
        hits = exact or inside or around
        if hits: return canonical(hits[0])
    return ''
def canonical(name):
    """the books.json name for a book when it is one of the listed texts"""
    n = ' ' + bnorm(name) + ' '
    for b in BOOKS['texts']:
        for ph in b['match']:
            if ' ' + bnorm(ph) + ' ' in n and bnorm(name) in (bnorm(ph), bnorm('شرح ' + ph), bnorm('كتاب ' + ph), bnorm('رسالة ' + ph)): return b['t']
    return name
def course_key_for(segs, book):
    """folder path down to the folder that names the book, e.g. "دورة جازان/كشف الشبهات" """
    if not book: return None
    b = bnorm(book)
    for i, x in enumerate(segs):
        n = bnorm(x)
        if n and not GENERIC_DIR.match(x) and (n in b or b in n) and len(n) >= 5: return '/'.join(segs[:i + 1])
    return None

def course_place(g):
    """the trip or course folder above the book's folder, e.g. «دورة جازان» in "دورة جازان/كشف الشبهات" """
    keys = collections.Counter(f['_key'] for f in g['files'] if f['_key'])
    if not keys: return ''
    segs = keys.most_common(1)[0][0].split('/')[:-1]
    segs = [x for x in segs if not GENERIC_DIR.match(x) and not COURSE_NAME.match(norm(x)) and not re.search(r'\d', x)]
    return segs[-1].replace('_', ' ') if segs else ''
def course_topic(g, book):
    """the part of the book a course folder names, e.g. «الإعتكاف» in "العمدة الإعتكاف", «الحج» in "الدورة العلمية في الحج" """
    keys = collections.Counter(f['_key'] for f in g['files'] if f['_key'])
    if not keys: return ''
    leaf = keys.most_common(1)[0][0].split('/')[-1].replace('_', ' ')
    leaf = re.sub(r'^(الدورة العلمية|الدورات العلمية|الدورة|دورة)( في| فى)?\s*', '', leaf.strip())
    strip = lambda w: re.sub(r'^ال', '', bnorm(w))
    names = {book} | {f['_book'] for f in g['files'] if f['_book']}
    names |= {canonical(n) for n in names}
    names |= {ph for b in BOOKS['texts'] if b['t'] in names for ph in b['match']}
    bw = {strip(w) for n in names for w in n.split()} - {'', 'شرح', 'كتاب'}
    rest = [w for w in leaf.split() if strip(w) and strip(w) not in bw and not re.search(r'\d', w)]
    if not rest or len(rest) > 3 or all(strip(w) in ('كتاب', 'شرح', 'رساله', 'متن') for w in rest): return ''
    return ' '.join(rest)
def course_groups(loose, label):
    """Split loose lessons into courses. Returns [{'title', 'files', 'folders'}] in display order."""
    known = known_books(loose)
    for f in loose:
        m = PREFIX.match(f['title'])
        p = m.group(1).strip() if m else ''
        segs = folder_segs(f['url'])
        book = p if p and not COURSE_NAME.match(norm(p)) else ''
        # the file's folders often name the book (".../الدورات العلمية/لمعة الإعتقاد/..."), and so does the title
        if not book: book = book_in(segs[::-1], known) or (book_in([f['title']], known, single=True) if not p else '')
        if not book and p and segs and not COURSE_NAME.match(norm(segs[-1])) and not GENERIC_DIR.match(segs[-1]):
            book = 'الدورة العلمية في شرح ' + segs[-1].replace('_', ' ')  # e.g. "[ الدورة العلمية ]" in "مختصر البخاري/"
        f['_book'] = book or p
        f['_key'] = course_key_for(segs, f['_book']) or course_key(f['url'])
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
    # a folder that is almost all one book keeps its few differently named lessons with it,
    # e.g. «[ مجموع الفتاوى ]» lessons inside "فتاوى ابن تيمية/الجزء السابع"
    homes = collections.defaultdict(set)  # book -> folders it is named in
    for f in loose:
        if f['_book']: homes[bnorm(f['_book'])].add(f['_key'])
    for k, fs in by_key.items():
        named = collections.Counter(f['_book'] for f in fs if f['_book'])
        if len(named) < 2: continue
        top, n = named.most_common(1)[0]
        if n < 0.8 * sum(named.values()) or n < 10: continue
        for f in fs:
            if (f['_book'] and f['_book'] != top and not same_book(f['_book'], top) and bnorm(f['_book']) not in bnorm(k)
                    and homes[bnorm(f['_book'])] == {k}):  # a book with courses of its own elsewhere is not renamed
                report.setdefault('folder_book', []).append({'lesson': f['id'], 'was': f['_book'], 'now': top, 'folder': k})
                f['_book'] = top
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
    # a stray lesson (or lessons stored outside any course folder) joins a course only when its "[ … ]" name
    # points to that one course (e.g. «كتاب التوحيد - بالطائف»); otherwise it stays unsorted, as on the original site
    per_book = {}
    for (b, k), fs in units.items(): per_book.setdefault(b, []).append((k, fs))
    groups = []
    for b, us in per_book.items():
        us.sort(key=lambda u: -len(u[1]))
        keep = [u for u in us if u[0] and len(u[1]) >= 2] or [us[0]]
        raw = lambda f: (PREFIX.match(f['title']) or [None, ''])[1].strip() if PREFIX.match(f['title']) else ''
        for u in us:
            if any(u is x for x in keep): continue
            names = {raw(f) for f in u[1]} - {''}
            homes = [x for x in keep if any(raw(f) in names for f in x[1])]
            if len(homes) == 1 and len(keep) > 1: homes[0][1].extend(u[1])
            elif len(keep) == 1 and names and names <= {raw(f) for f in keep[0][1]} and not u[0]: keep[0][1].extend(u[1])
            else: misc.extend(u[1]); report.setdefault('unsorted', []).append([f['id'] for f in u[1]])
        if sum(len(u[1]) for u in keep) < 3:
            for u in keep: misc.extend(u[1])
            continue
        for k, fs in keep:
            fs.sort(key=lambda f: f['id'])
            names = [f['_book'] for f in fs]
            title = max(set(names), key=lambda n: (names.count(n), len(n)))
            title = TITLES.get(title, title)
            if not re.match(r'(شرح|التعليق|الدورة|دروس|فتاوى|مجموع الفتاوى|تفسير|تلاوات|كتاب الحج والعمرة)', title):
                title = 'شرح ' + title  # the lessons explain this book
            groups.append({'book': b, 'title': title, 'files': fs, 'size': sum(len(u[1]) for u in keep),
                           'folders': sorted({f['_key'] or '-' for f in fs})})
    # repeated books: same base title, distinguished by year, oldest first
    by_book = {}
    for g in groups: by_book.setdefault(g['book'], []).append(g)
    for b, gs in by_book.items():
        gs.sort(key=lambda g: (dates.get(str(g['files'][0]['id']), '9999'), g['files'][0]['id']))
        if len(gs) > 1:
            base = max((g['title'] for g in gs), key=lambda t: (sum(g['title'] == t for g in gs), -len(t)))
            labels = [year_label(g['files']) for g in gs]
            dup = [bool(l) and labels.count(l) > 1 for l in labels]
            for i, g in enumerate(gs):  # same year: name the month the course started
                d0 = dates.get(str(g['files'][0]['id']))
                if dup[i] and d0:
                    labels[i] = f'{HMONTHS[int(d0[5:7]) - 1]} {d0[:4]}هـ'.translate(AR_DIGITS)
            full = [(course_topic(g, g['title']), l) for g, l in zip(gs, labels)]
            final = [l if l and full.count(full[i]) == 1 else (l + ' - ' if l else '') + f'الدورة {ORD[i] if i < len(ORD) else i + 1}'
                     for i, l in enumerate(labels)]
            for g, lab in zip(gs, final):
                place = course_place(g)
                # the folder's topic, only where the dates alone leave two courses looking alike
                yr = lambda h: (dates.get(str(h['files'][0]['id']), '')[:4], dates.get(str(h['files'][-1]['id']), '')[:4])
                a0, a1 = yr(g)
                close = any(h is not g and a0 and (yr(h)[0] or '0') <= a1 and a0 <= (yr(h)[1] or '9') for h in gs)
                topic = course_topic(g, g['title']) if close else ''
                if topic and place and bnorm(topic) in bnorm(place): topic = ''
                pre = '، '.join(x for x in (topic, place) if x)
                g['title'] = f'{g["title"]} ({pre + "، " if pre else ""}{lab})'
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


def all_lessons(cid, seen=()):
    c = out_cats.get(cid)
    if not c or cid in seen: return []
    return c['l'] + [l for k in c['kids'] for l in all_lessons(k, seen + (cid,))]
def attach_to_site_series(roots, loose, label):
    """A loose lesson stored in the same folder as one of the site's own series (and not naming another
    book) belongs to that series, e.g. a stray «فضل الإسلام» lesson filed under «فضل_الإسلام»."""
    where = collections.defaultdict(collections.Counter)
    def walk(cid, seen=()):
        if cid in seen or cid not in out_cats: return
        for l in out_cats[cid]['l']: where[lesson_dir(l[2])][cid] += 1
        for k in out_cats[cid]['kids']: walk(k, seen + (cid,))
    for r in roots: walk(r)
    owner = {}
    for d, cn in where.items():
        cid, n = cn.most_common(1)[0]
        if d and n >= 3 and n >= 0.8 * sum(cn.values()): owner[d] = cid
    known = known_books(loose)
    keep = []
    for f in loose:
        cid = owner.get(lesson_dir(f['url']))
        m = PREFIX.match(f['title'])
        book = canonical(m.group(1).strip()) if m else book_in([f['title']], known, single=True)
        if cid and (not book or bnorm(book) in bnorm(out_cats[cid]['t'])):
            out_cats[cid]['l'] = sorted(out_cats[cid]['l'] + [lesson(f)], key=lambda l: l[0])
            c = cid
            while c is not None: out_cats[c]['n'] += 1; c = out_cats[c]['up']
            report['attached'].append({'section': label, 'lesson': f['id'], 'title': f['title'], 'series': out_cats[cid]['t'], 'folder': lesson_dir(f['url'])})
        else: keep.append(f)
    return keep
def nest_site_series(roots, made, loose, label):
    """A small series of the site whose recordings sit in the folder of a larger grouped book is a part of
    that book, e.g. «الفصل الثاني عشر …» in the folder of «الفرقان بين الحق والبطلان»."""
    known = known_books(loose)
    gdirs = {g: collections.Counter(lesson_dir(l[2]) for l in out_cats[g]['l']) for g in made}
    for r in list(roots):
        c = out_cats[r]
        if c.get('x') or r in made: continue
        ls = all_lessons(r)
        if not ls or len(ls) > 40: continue
        ds = collections.Counter(lesson_dir(l[2]) for l in ls)
        best = max(made, key=lambda g: sum(ds[d] for d in gdirs[g]), default=None)
        if best is None: continue
        share = sum(ds[d] for d in gdirs[best])
        if share < 0.8 * len(ls) or len(out_cats[best]['l']) <= len(ls): continue
        other = book_in([c['t']], known, single=True)
        if other and bnorm(other) not in bnorm(out_cats[best]['t']): continue
        out_cats[best]['kids'].append(r); c['up'] = best; out_cats[best]['n'] += c['n']; roots.remove(r)
        out_cats[best]['kids'].sort(key=lambda k: min((l[0] for l in all_lessons(k)), default=0))
        report['nested'].append({'section': label, 'series': c['t'], 'id': r, 'into': out_cats[best]['t'], 'into_id': best})

for pid, key, label, kind in SECTIONS:
    s = secs.get(pid, {})
    roots = list(dict.fromkeys(roots_by_page.get(pid, [])))
    loose = [f for f in dedupe(s.get('files', []), lambda f: f['id']) if f['id'] not in in_series]
    flat = []
    if kind == 'tree' and loose:
        loose = attach_to_site_series(roots, loose, label)
        made = []
        for g in course_groups(loose, label):
            fs, name = g['files'], g['title']
            next_id = 9000000 + fs[0]['id']  # stable across refreshes: tied to the group's first lesson
            out_cats[next_id] = {'t': name, 'p': pid, 'up': None, 'kids': [], 'n': len(fs), 'listed': len(fs), 'x': 1,
                                 'l': [lesson(f) for f in fs], 'a': [], 'v': []}
            report['recovered'].append({'section': label, 'title': name, 'lessons': len(fs), 'folders': g['folders']})
            roots.append(next_id); made.append(next_id)
        nest_site_series(roots, made, loose, label)
    else:
        flat = loose
    arts = dedupe(s.get('articles', []), lambda a: a['id'])
    n = sum(out_cats[r]['n'] for r in roots) + len(flat) + len(arts)
    sections.append({'id': pid, 'key': key, 't': label, 'kind': kind, 'series': roots,
                     'l': [lesson(f) for f in flat], 'a': [article(a) for a in arts], 'n': n})

# ---------- texts explained more than once (see tools/books.json) ----------
def loose_re(phrase):
    """regex for a phrase that tolerates hamza/ta-marbuta/alif-maqsura spellings and diacritics"""
    alt = {'ا': '[اأإآ]', 'أ': '[اأإآ]', 'إ': '[اأإآ]', 'آ': '[اأإآ]', 'ة': '[ةه]', 'ه': '[ةه]', 'ى': '[ىي]', 'ي': '[ىي]'}
    return re.compile('[ً-ٰٟـ]*'.join(alt.get(ch, r'\s+' if ch == ' ' else re.escape(ch)) for ch in phrase))
def dates_of(cid, seen=()):
    c = out_cats.get(cid)
    if not c or cid in seen: return []
    return [l[3] for l in c['l'] if len(l) > 3] + [d for k in c['kids'] for d in dates_of(k, seen + (cid,))]
def text_label(title, rx):
    t = re.sub(r'\s*\([^()]*هـ[^()]*\)\s*$', '', title).strip()  # year added to grouped series
    m = rx.search(t)
    pre, post = (t[:m.start()], t[m.end():]) if m else ('', t)
    note = ''
    pm = re.search(r'\(\s*ضمن\s+(برنامج[^)]*?)\s*\)', pre)
    if pm: note = pm.group(1); pre = pre.replace(pm.group(0), '')
    kind = 'دورة علمية' if 'الدورة العلمية' in pre else 'درس أسبوعي' if 'درس أسبوعي' in pre else ''
    cm = re.search(r'(كتاب\s+\S+)\s+من\s+(.*)$', pre)  # "شرح كتاب الصيام من ..." -> a chapter of the text
    chap = cm.group(1) if cm else ''
    if cm: pre = pre[:cm.start()]
    lm = re.search(r'(ب(?:مدينة|جامع|مسجد)\s.*?)\s+في\s+شرح', pre)
    place = lm.group(1) if lm else ''
    if lm: pre = pre.replace(lm.group(1), ' ')
    pre = re.sub(r'الدورة العلمية|درس أسبوعي|التعليق على|شرح|\bفي\b|كتاب|رسالة|[/\-–]', ' ', pre).strip()
    other = pre if pre and len(pre.split()) <= 2 else ''
    if re.search(r'رحمه(ما)? الله', post): post = re.split(r'رحمه(?:ما)? الله', post, maxsplit=1)[-1]
    post = re.sub(r'^\s*(الهادي إلى سبيل الرشاد|من أدلة الأحكام|في اختصار المقنع)\b.*?(?=\s+ب|$)', '', post)
    post = re.sub(r'\bالمقامة\b|[\[\]().]', ' ', post)
    post = re.sub(r'^[\s\-–]+|[\s\-–]+$', '', re.sub(r'\s+', ' ', post))
    km = re.match(r'^(كتاب\s+\S+)$', post)  # "بلوغ المرام ( كتاب الصيام )"
    if km and not chap: chap, post = km.group(1), ''
    parts = [x for x in [kind, other, chap, place, post, note] if x]
    return {'kind': kind, 'other': other, 'chap': chap, 'where': ' '.join(x for x in [place, post] if x), 'note': note,
            'short': '، '.join(parts)}
def text_heading(tt, p, yrs):
    """a proper series name, e.g. «شرح كتاب التوحيد بالطائف» or «الدورة العلمية في شرح كتاب الصيام من عمدة الأحكام»"""
    lead = {'دورة علمية': 'الدورة العلمية في ', 'درس أسبوعي': 'درس أسبوعي في '}.get(p['kind'], '')
    core = lead + 'شرح ' + (p['other'] + ' ' if p['other'] else '') + (p['chap'] + ' من ' if p['chap'] else '') + tt
    return core + (' ' + p['where'] if p['where'] else f' ({yrs})' if yrs else '')
def years_of(cid):
    ys = sorted({d[:4] for d in dates_of(cid)})
    if not ys: return ''
    return (ys[0] if ys[0] == ys[-1] else f'{ys[0]}–{ys[-1]}').translate(AR_DIGITS) + 'هـ'

# Sheikh Maher's live lessons from the Rajhi mosque in Makkah (tools/youtube.py, refreshed weekly):
# one series per book named in the titles, shown first among the videos
ONES = {'الاول': 1, 'الحادي': 1, 'الواحد': 1, 'الثاني': 2, 'الثالث': 3, 'الرابع': 4, 'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10}
TENS = {'عشر': 10, 'العشرون': 20, 'الثلاثون': 30, 'الاربعون': 40, 'الخمسون': 50, 'الستون': 60, 'السبعون': 70, 'الثمانون': 80, 'التسعون': 90}
def session_no(label):
    """«المجلس الثامن والأربعون» → 48, «المجلس 66 والأخير» → 66"""
    t = norm(label)
    m = re.search(r'\d+', t)
    if m: return int(m.group())
    n = 0
    for w in re.sub(r'^(المجلس|الدرس)\s*', '', t).replace(' و', ' ').split():
        n += ONES.get(w, 0) + TENS.get(w, 0) + (TENS.get('ال' + w[2:], 0) if w.startswith('وال') else 0)
    return n
YT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'youtube.json')
if os.path.exists(YT):
    import hashlib
    yt = json.load(open(YT, encoding='utf-8'))
    SESSION = re.compile(r'^(المجلس|الدرس)|^م\s*\d+$|^\d+$|هـ$|ماهر|^(ال)?مرحله')
    series = collections.OrderedDict()
    for v in yt['videos']:
        parts = [p.strip() for p in v['t'].split('|') if p.strip()]
        book = [p for p in parts if not SESSION.search(norm(p)) and not re.search(r'\d{1,2}\s*-\s*\d{1,2}\s*-\s*14\d\d', p)]
        sess = [p for p in parts if re.match(r'^(المجلس|الدرس)', p)]
        k = bnorm(' '.join(book))
        label = re.sub(r'\s+', ' ', sess[0]).translate(AR_DIGITS) if sess else ' - '.join(b for b in book if not b.startswith('الدورة'))
        series.setdefault(k, {'name': ' | '.join(book), 'vs': []})['vs'].append([v['id'], label, v['d'], session_no(label) if sess else 0])
    vsec = next((x for x in sections if x['key'] == 'videos'), None)
    misc, made = [], []
    for k, g in series.items():
        if len(g['vs']) < 2: misc += g['vs']; continue
        made.append((g['name'], g['vs']))
    if misc: made.append(('محاضرات ودروس متفرقة', misc))
    PLACE = 'بجامع الراجحي بمكة'
    YT_NAMES = {'شرح كتاب التوحيد لمحمد بن عبدالوهاب': 'شرح كتاب التوحيد', 'شرح كتاب مسائل الجاهلية': 'شرح مسائل الجاهلية',
                'شرح كتاب كشف الشبهات': 'شرح كشف الشبهات', 'منهج الحق | منظومة في العقيدة والأخلاق': 'شرح منظومة منهج الحق'}
    for name, vs in made:
        # «الدورة العلمية الموحدة الثانية | شرح كتاب التوحيد» → «شرح كتاب التوحيد (الدورة العلمية الموحدة الثانية)»
        bits = name.split(' | ')
        course = [b for b in bits if b.startswith('الدورة')]
        main = ' | '.join(b for b in bits if not b.startswith('الدورة')) or name
        title = YT_NAMES.get(main, main).replace(' | ', ' - ')
        title = f'{title} {PLACE}' + (f' ({course[0]})' if course else '')
        cid = 9500000 + int(hashlib.sha1(name.encode()).hexdigest()[:6], 16) % 100000
        vs.sort(key=lambda x: (x[2], x[3], x[0]))  # by date, then the session number in the title
        vs[:] = [x[:3] for x in vs]
        out_cats[cid] = {'t': title, 'p': 3, 'up': None, 'kids': [], 'n': len(vs), 'listed': len(vs), 'l': [], 'a': [],
                         'v': vs, 'x': 1, 'top': 1, 'src': yt['channel'] + '/streams'}
        if vsec: vsec['series'].insert(len([1 for c in vsec['series'] if out_cats.get(c, {}).get('top')]), cid); vsec['n'] += len(vs)
    report['youtube'] = {'videos': len(yt['videos']), 'series': [(t, len(v)) for t, v in made], 'review': yt.get('review', [])}

texts = []
for b in BOOKS['texts']:
    rxs = [loose_re(m) for m in b['match']]
    ids = []
    for s in sections:
        if s['kind'] == 'videos': continue  # video series keep their own cards
        for cid in s['series']:
            if any(t['ids'] and cid in t['ids'] for t in texts): continue
            if any(rx.search(out_cats[cid]['t']) for rx in rxs) and out_cats[cid]['n']: ids.append(cid)
    if len(ids) < 2: continue
    ids.sort(key=lambda i: (min(dates_of(i) or ['9999']), i))
    lab, head, note = {}, {}, {}
    for i in ids:
        t = out_cats[i]['t']
        rx = next((r for r in rxs if r.search(t)), rxs[0])
        p = text_label(t, rx)
        lab[i] = p['short']
        ym = re.search(r'\(([^()]*هـ[^()]*)\)\s*$', t)  # grouped series already carry a distinguishing year or month
        fix = BOOKS.get('labels', {}).get(t) or {}
        head[i] = fix.get('h') or text_heading(b['t'], p, ym.group(1) if ym else years_of(i))
        if fix.get('short'): lab[i] = fix['short']
        if p['note']: note[i] = p['note']
        if out_cats[i].get('x'): out_cats[i]['t'] = head[i]  # grouped series take the proper name too
    texts.append({'k': b['key'], 't': b['t'], 'by': b.get('by', ''), 'ids': ids, 'lab': lab, 'h': head, 'note': note,
                  'n': sum(out_cats[i]['n'] for i in ids), **({'also': b['also']} if b.get('also') else {})})

# the videos section has well over a hundred series: show them under topics (tools/video_groups.json, by the
# original site's series id). The Rajhi broadcasts come first; a new series nobody has placed yet goes under
# the last topic (مرئيات متنوعة) and is listed in the report so a person can place it.
VG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tools', 'video_groups.json')
vsec = next((x for x in sections if x['key'] == 'videos'), None)
if vsec and os.path.exists(VG):
    topics = json.load(open(VG, encoding='utf-8'))
    live = [c for c in vsec['series'] if out_cats.get(c, {}).get('src')]
    groups = ([['بث مباشر من جامع الراجحي بمكة', live]] if live else []) + [[g['t'], [c for c in g['ids'] if c in vsec['series']]] for g in topics]
    placed = {c for _, ids in groups for c in ids}
    loose = [c for c in vsec['series'] if c not in placed]
    if loose and groups: groups[-1][1] += loose
    vsec['groups'] = [g for g in groups if g[1]]
    report['video_groups_unplaced'] = [(c, out_cats[c]['t']) for c in loose]

built = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
json.dump({'built': built, 'sections': sections, 'cats': out_cats, 'texts': texts}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
report['counts'].sort(key=lambda r: -(r['actual'] - r['site_says']))
json.dump(report, open(REPORT, 'w'), ensure_ascii=False, indent=1)
print('dates', len(dates)); print('texts', [(t['k'], len(t['ids'])) for t in texts])
print('sections', [(s['key'], s['n'], len(s['series']), len(s['l']), len(s['a'])) for s in sections])
print('total', sum(s['n'] for s in sections), 'cats', len(out_cats), 'count fixes', len(report['counts']),
      'recovered series', len(report['recovered']), 'recovered lessons', sum(r['lessons'] for r in report['recovered']))

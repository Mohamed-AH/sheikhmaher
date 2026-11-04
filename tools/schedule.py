"""Read the weekly lesson schedule from the original site's home page into data/schedule.json.

The home page has one table: a row per day (السبت … الجمعة) and a column per session (بعد الفجر، بعد العصر،
بعد المغرب); a session that is the same on several days is one cell spanning those rows, and Friday is one cell
across all three. Each cell is kept with the days and sessions it covers, and the recorded series it names are
linked through tools/schedule_links.json. If the page can't be read or the table isn't found, the old file is kept.

Usage: python3 -I tools/schedule.py [data/schedule.json]
"""
import html, json, os, re, sys, urllib.request
from html.parser import HTMLParser
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'schedule.json')
CONF = json.load(open(os.path.join(ROOT, 'tools', 'schedule_links.json'), encoding='utf-8'))
DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

def norm(s):
    s = re.sub(r'[ً-ٰٟـ]', '', s)
    for a, b in (('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'), ('ى', 'ي'), ('ة', 'ه')): s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()

class Table(HTMLParser):
    """rows of [text, rowspan, colspan, is_heading] inside <div id="LectureTimesTable">; the <li> notes after it"""
    def __init__(self):
        super().__init__(); self.depth = 0; self.inside = False; self.rows = []; self.cell = None
        self.notes = []; self.in_notes = False; self.li = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id') == 'LectureTimesTable': self.inside = True
        if 'tablesnotes' in (a.get('class') or ''): self.in_notes = True
        if self.inside and tag == 'tr': self.rows.append([])
        if self.inside and tag in ('td', 'th'):
            self.cell = ['', int(a.get('rowspan') or 1), int(a.get('colspan') or 1), 'celHeading' in (a.get('class') or '') or tag == 'th']
        if self.inside and tag == 'br' and self.cell: self.cell[0] += '\n'
        if self.in_notes and tag == 'li': self.li = ''
        if self.in_notes and tag == 'a' and self.li is not None and a.get('href'): self.li += ' ' + a['href'] + ' '
    def handle_endtag(self, tag):
        if self.inside and tag in ('td', 'th') and self.cell: self.rows[-1].append(self.cell); self.cell = None
        if self.inside and tag == 'table': self.inside = False
        if self.in_notes and tag == 'li' and self.li is not None: self.notes.append(self.li); self.li = None
        if self.in_notes and tag == 'ul': self.in_notes = False
    def handle_data(self, d):
        if self.cell is not None: self.cell[0] += d
        if self.li is not None: self.li += d

def clean(t):
    lines = [re.sub(r'[ \t ]+', ' ', x).strip(' ,،') for x in html.unescape(t).replace('\r', '').split('\n')]
    lines = [re.sub(r'^-\s*', '', x) for x in lines if x.strip(' -')]
    return '\n'.join(lines).replace(' ,', '،').replace(' ،', '،').replace('،', '، ').replace('،  ', '، ').strip()

def links(t):
    """[route, phrase, the words as the schedule writes them] for each recorded series the text names"""
    keep = [i for i, ch in enumerate(t) if not re.match(r'[\u064B-\u065F\u0670\u0640]', ch)]  # norm() drops only these marks
    flat = ''.join(t[i] for i in keep)
    for a, b in (('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'), ('ى', 'ي'), ('ة', 'ه')): flat = flat.replace(a, b)
    out, seen = [], set()
    for phrase, route in CONF['links']:
        k = flat.find(norm(phrase))
        if k < 0 or route in seen: continue
        seen.add(route); a, b = keep[k], keep[k + len(norm(phrase)) - 1] + 1
        out.append([route, phrase, t[a:b]])
    return out

def main():
    try:
        req = urllib.request.Request('https://maheralqahtani.org/', headers={'User-Agent': 'Mozilla/5.0 (skin-site indexer)'})
        page = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'replace')
    except Exception as ex:
        print('schedule: could not read the home page, keeping the old schedule:', ex); return
    p = Table(); p.feed(page)
    rows = [r for r in p.rows if r]
    title = clean(rows[0][0][0]) if rows and len(rows[0]) == 1 else ''
    head = next((r for r in rows if [norm(c[0]) for c in r][:1] == [norm('اليوم')]), None)
    if not head:
        print('schedule: table not found on the home page, keeping the old schedule'); return
    cols = [clean(c[0]) for c in head[1:]]
    taken, cells = {}, []  # (day, col) -> cell index
    for r in rows[rows.index(head) + 1:]:
        if not r or not r[0][3]: continue
        d = next((i for i, x in enumerate(DAYS) if norm(x) == norm(r[0][0])), None)
        if d is None: continue
        c = 0
        for text, rs, cs, _ in r[1:]:
            while (d, c) in taken: c += 1
            t = clean(text)
            cells.append({'d': [d, min(6, d + rs - 1)], 'c': [c, min(len(cols) - 1, c + cs - 1)], 't': t, 'l': links(t)})
            for dd in range(d, d + rs):
                for cc in range(c, c + cs): taken[(dd, cc)] = len(cells) - 1
            c += cs
    if len(cells) < 4:
        print('schedule: too few cells read, keeping the old schedule'); return
    notes = [re.sub(r'\s+', ' ', html.unescape(n)).strip() for n in p.notes]
    place = next((n for n in notes if 'جامع' in n or 'مسجد' in n), '')
    place = re.sub(r'\s*-?\s*إنتقل إلى الرابط\s*-?', '', re.sub(r'https?://\S+', '', place)).strip(' -')
    email = next((m.group(0) for n in notes for m in [re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', n)] if m), '')
    phone = next((m.group(0) for n in notes for m in [re.search(r'\+?\d[\d ]{8,}\d', n)] if m), '')
    out = {'title': title, 'cols': cols, 'days': DAYS, 'cells': cells, 'place': place, 'email': email.lower(), 'phone': phone.replace(' ', ''),
           'live': bool(CONF.get('live')), 'live_url': CONF.get('live_url', ''), 'map_url': CONF.get('map_url', '')}
    old = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else None
    if old != out:
        json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'schedule: {len(cells)} cells, {sum(len(c["l"]) for c in cells)} links' + (' (changed)' if old != out else ''))

main()

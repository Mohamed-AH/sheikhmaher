"""Look up the YouTube title of every video the original site embeds, into data/video_titles.json.
The site lists its videos without titles, so the series pages would otherwise say «مقطع ١، ٢…».
Uses YouTube's public oEmbed endpoint (no key) for the title and the watch page for the upload date,
stored in Gregorian and Hijri (needs: pip install hijridate). A video already in the file is not looked up again;
one that is private or removed is stored as "" and retried after 30 days.

Usage: python3 -I tools/video_titles.py [data/catalog.json] [data/video_titles.json]
"""
import json, os, re, sys, time, datetime, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'catalog.json')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'data', 'video_titles.json')
today = datetime.date.today()

ids = set()
for c in json.load(open(CAT, encoding='utf-8'))['cats'].values():
    if c.get('src'): continue  # the Rajhi channel's videos already carry their titles
    for v in c.get('v', []): ids.add(v[0] if isinstance(v, list) else v)
old = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}

def stale(i):
    e = old.get(i)
    if not e: return True
    return not e['t'] and (today - datetime.date.fromisoformat(e['d'])).days > 30

def title(i):
    url = 'https://www.youtube.com/oembed?format=json&url=' + urllib.parse.quote(f'https://www.youtube.com/watch?v={i}', safe='')
    for n in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20) as r:
                return i, json.load(r).get('title', '').strip()
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404): return i, ''  # private, removed or not embeddable
            time.sleep(2 ** n)
        except Exception:
            time.sleep(2 ** n)
    return i, None  # network trouble: try again next run

todo = sorted(i for i in ids if stale(i))
with ThreadPoolExecutor(6) as ex:
    for i, t in ex.map(title, todo):
        if t is not None: old[i] = {**old.get(i, {}), 't': t, 'd': today.isoformat()}

# the upload date, from the watch page («publishDate»), kept as Gregorian (g) and Hijri (h)
MONTHS = {m: n for n, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(), 1)}
def published(i):
    try:
        req = urllib.request.Request(f'https://www.youtube.com/watch?v={i}', headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9'})
        page = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    except Exception:
        return i, None
    m = re.search(r'"publishDate":\{"simpleText":"[^"]*?([A-Z][a-z]{2}) (\d{1,2}), (\d{4})"', page) or re.search(r'"uploadDate":"(\d{4})-(\d\d)-(\d\d)', page)
    if not m: return i, ''
    y, mo, d = (int(m.group(3)), MONTHS[m.group(1)], int(m.group(2))) if not m.group(1).isdigit() else map(int, m.groups())
    return i, f'{y:04d}-{mo:02d}-{d:02d}'
def hijri(g):
    from hijridate import Gregorian
    h = Gregorian(*map(int, g.split('-'))).to_hijri()
    return f'{h.year:04d}-{h.month:02d}-{h.day:02d}'
need = sorted(i for i in ids if old.get(i, {}).get('t') and 'g' not in old[i])
with ThreadPoolExecutor(4) as ex:  # gently: YouTube refuses bursts
    for i, g in ex.map(published, need):
        if g is None: continue  # network trouble: try again next run
        old[i]['g'] = g
        if g: old[i]['h'] = hijri(g)
json.dump(dict(sorted(old.items())), open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f'{len(ids)} videos, looked up {len(todo)}, {sum(1 for i in ids if old.get(i, {}).get("t"))} with a title')

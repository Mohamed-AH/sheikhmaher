"""Collect Sheikh Maher's recorded live lessons from the Rajhi mosque in Makkah's YouTube channel
into data/youtube.json. The channel streams many scholars, so only titles that name the Sheikh are kept;
titles that only say «القحطاني» are listed in the report for a person to check, never added.

Usage: python3 -I tools/youtube.py [data/youtube.json]
Needs yt-dlp (pip install yt-dlp hijridate). Runs weekly; a video already in the file is not fetched again.
"""
import json, os, re, subprocess, sys, datetime

CHANNEL = 'https://www.youtube.com/@alrajhimakkah'
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'youtube.json')

def norm(s):
    s = re.sub(r'[ً-ْـ]', '', s or '')
    for a, b in (('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'), ('ة', 'ه'), ('ى', 'ي')): s = s.replace(a, b)
    return re.sub(r'\s+', ' ', s).strip()
# «ماهر القحطاني», «ماهر بن ظافر القحطاني», «ماهر بن ظافر», «ماهر ظافر», with or without الشيخ/د.
SHEIKH = re.compile(r'ماهر\s*(بن\s*)?(ظافر\s*)?(ال)?قحطاني|ماهر\s*(بن\s*)?ظافر')

def ytdlp(*args):
    r = subprocess.run([sys.executable, '-m', 'yt_dlp', '--no-warnings', *args], capture_output=True, text=True, timeout=1800)
    return r.stdout

def hijri(g):
    from hijridate import Gregorian
    y, m, d = map(int, g.split('-'))
    h = Gregorian(y, m, d).to_hijri()
    return f'{h.year:04d}-{h.month:02d}-{h.day:02d}'

old = {}
if os.path.exists(OUT):
    for v in json.load(open(OUT, encoding='utf-8'))['videos']: old[v['id']] = v

listed = []
for tab in ('streams', 'videos'):
    out = ytdlp('--flat-playlist', '-J', f'{CHANNEL}/{tab}')
    if out.strip(): listed += json.loads(out).get('entries') or []
if not listed:
    sys.exit('the channel list came back empty; keeping the old file')

seen, videos, review = set(), [], []
for e in listed:
    if e['id'] in seen: continue
    seen.add(e['id'])
    t = norm(e.get('title', ''))
    if SHEIKH.search(t):
        if (e.get('duration') or 0) < 60: continue  # broken stream stubs of a few seconds
        videos.append(e)
    elif 'قحطاني' in t and 'ماهر' not in t:
        review.append({'id': e['id'], 't': e.get('title', '')})

today = datetime.date.today().isoformat()
rows = []
for e in videos:
    v = old.get(e['id'])
    if not v:
        g = ''
        meta = ytdlp('--skip-download', '--ignore-no-formats-error', '-O', '%(upload_date)s', f'https://www.youtube.com/watch?v={e["id"]}').strip()
        if re.fullmatch(r'\d{8}', meta): g = f'{meta[:4]}-{meta[4:6]}-{meta[6:]}'
        v = {'id': e['id'], 'g': g or today}
    v['t'] = e.get('title', '').strip()
    v['dur'] = int(e.get('duration') or v.get('dur') or 0)
    # a Hijri date written in the title wins over the upload date
    m = re.search(r'(\d{1,2})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(14\d\d)', v['t'])
    v['d'] = f'{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}' if m else hijri(v['g'])
    rows.append(v)
rows.sort(key=lambda v: (v['g'], v['id']))
json.dump({'channel': CHANNEL, 'updated': today, 'videos': rows, 'review': review},
          open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(rows)} lessons by the Sheikh ({len(rows) - len(set(old) & {v["id"] for v in rows})} new), {len(review)} titles to check')

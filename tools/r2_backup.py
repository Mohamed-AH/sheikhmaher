"""Back up to Cloudflare R2: every audio file the catalog links to, and a full copy of this repo.

Audio: each file on maheralqahtani.org is stored under its own path (lfm/files/...), so the player can
fall back to <public_url>/<same path> when the original fails. Only files not yet in the bucket are copied,
a few at a time and within a nightly size and time budget, so the first full copy is spread over several
nights and the original server is never pushed hard.

Repo: a git bundle (the whole history; `git clone <file>` restores it) at repo/daily/<date>.bundle, and on
the 1st of the month also at repo/monthly/<yyyy-mm>.bundle. Old copies are removed by the bucket's lifecycle
rules (daily after 30 days, monthly after 365), set once in Cloudflare.

Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY; without them it says so and does nothing.
Settings (bucket, budget) are in tools/backup.json.

Usage: python3 -I tools/r2_backup.py [data/catalog.json]
"""
import datetime, json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = json.load(open(os.path.join(ROOT, 'tools', 'backup.json'), encoding='utf-8'))
CAT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'catalog.json')
ORIGIN = 'https://maheralqahtani.org/'
AUDIO = re.compile(r'\.(mp3|m4a|aac|wav|ogg|wma)$', re.I)
TYPES = {'mp3': 'audio/mpeg', 'm4a': 'audio/mp4', 'aac': 'audio/aac', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'wma': 'audio/x-ms-wma'}


def audio_urls(cat):
    """every audio link in the catalog, newest lessons first (they're the likeliest to be played)"""
    out, seen = [], set()
    def walk(o):
        if isinstance(o, dict):
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
        elif isinstance(o, str) and o.startswith(ORIGIN) and AUDIO.search(o) and o not in seen:
            seen.add(o); out.append(o)
    walk(cat)
    return out[::-1]


def key_of(url):
    return urllib.parse.unquote(urllib.parse.urlsplit(url).path).lstrip('/')


def fetch_url(url):
    p = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, urllib.parse.quote(urllib.parse.unquote(p.path)), p.query, ''))


def main():
    need = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    if not all(os.environ.get(k) for k in need):
        print('backup: R2 secrets are not set, nothing to do'); return 0
    import boto3
    from botocore.config import Config
    s3 = boto3.client('s3', endpoint_url=os.environ.get('R2_ENDPOINT') or f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                      aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'], aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
                      region_name='auto', config=Config(retries={'max_attempts': 5, 'mode': 'standard'}))
    bucket = CONF['bucket']

    # 1) the repo
    today = datetime.datetime.now(datetime.timezone.utc).date()
    with tempfile.TemporaryDirectory() as d:
        b = os.path.join(d, 'repo.bundle')
        subprocess.run(['git', '-C', ROOT, 'bundle', 'create', b, '--all'], check=True, capture_output=True)
        s3.upload_file(b, bucket, f'repo/daily/{today}.bundle')
        if today.day == 1:
            s3.upload_file(b, bucket, f'repo/monthly/{today:%Y-%m}.bundle')
        print(f'backup: repo copied ({os.path.getsize(b) / 1e6:.1f} MB)')

    # 2) the audio not yet in the bucket
    have = {}
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket, Prefix='lfm/'):
        for o in page.get('Contents', []): have[o['Key']] = o['Size']
    urls = [u for u in audio_urls(json.load(open(CAT, encoding='utf-8'))) if key_of(u) not in have]
    print(f'backup: {len(have)} audio files already in R2, {len(urls)} to copy')
    budget, deadline = CONF['max_gb_per_run'] * 1e9, time.time() + CONF['max_minutes_per_run'] * 60
    done = failed = 0; sent = 0.0

    def copy(url):
        k = key_of(url)
        req = urllib.request.Request(fetch_url(url), headers={'User-Agent': 'Mozilla/5.0 (sheikhmaher backup)'})
        with urllib.request.urlopen(req, timeout=120) as r:
            size = int(r.headers.get('Content-Length') or 0)
            s3.upload_fileobj(r, bucket, k, ExtraArgs={
                'ContentType': TYPES.get(k.rsplit('.', 1)[-1].lower(), 'application/octet-stream'),
                'CacheControl': 'public, max-age=31536000'})
        got = s3.head_object(Bucket=bucket, Key=k)['ContentLength']
        if size and got != size:  # cut off mid-way: don't keep half a file
            s3.delete_object(Bucket=bucket, Key=k); raise IOError(f'size {got} != {size}')
        return got

    with ThreadPoolExecutor(CONF['parallel']) as pool:
        it = iter(urls); running = {}
        def more():
            while len(running) < CONF['parallel'] and sent < budget and time.time() < deadline:
                u = next(it, None)
                if u is None: return
                running[pool.submit(copy, u)] = u
        more()
        while running:
            f = next(as_completed(running)); u = running.pop(f)
            try:
                sent += f.result(); done += 1
                if done % 200 == 0: print(f'backup: {done} copied so far ({sent / 1e9:.1f} GB)', flush=True)
            except Exception as ex:
                failed += 1
                if failed <= 20: print('backup: could not copy', u, '-', ex)
            more()
    left = len(urls) - done - failed
    print(f'backup: copied {done} files ({sent / 1e9:.1f} GB), {failed} failed, {left} left for the next run')
    return 0


if __name__ == '__main__':
    sys.exit(main())

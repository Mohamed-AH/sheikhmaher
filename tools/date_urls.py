"""List the detail pages whose upload date we want: first and last lesson of every series/group."""
import json, re, sys
d = json.load(open(sys.argv[1]))
files, ids = set(), set()
for c in d['cats'].values():
    fs = sorted(f['id'] for f in c['files'])
    if fs: ids |= {fs[0], fs[-1]}
    files |= set(fs)
for p in ['7', '8', '9', '10', '11', '12', '13', '2', '15']:
    groups = {}
    for f in d['sections'].get(p, {}).get('files', []):
        if f['id'] in files: continue
        m = re.match(r'\s*[\[(]\s*([^\])]+?)\s*[\])]', f['title'])
        groups.setdefault(m.group(1) if m else '', []).append(f['id'])
    for g in groups.values():
        g.sort(); ids |= {g[0], g[-1]}
print('\n'.join(f'https://maheralqahtani.org/details/{i}' for i in sorted(ids)))

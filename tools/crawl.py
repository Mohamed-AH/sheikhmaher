import re, html, json, os, hashlib, sys, time, threading
import urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor
BASE='https://maheralqahtani.org'
CACHE=sys.argv[1]; OUT=sys.argv[2]
os.makedirs(CACHE,exist_ok=True)
def fetch(url):
    fn=os.path.join(CACHE,hashlib.md5(url.encode()).hexdigest()+'.html')
    if os.path.exists(fn): return open(fn,encoding='utf-8',errors='replace').read()
    for i in range(5):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (skin-site indexer)'})
            s=urllib.request.urlopen(req,timeout=60).read().decode('utf-8','replace')
            open(fn,'w',encoding='utf-8').write(s); return s
        except Exception as e:
            err=e; time.sleep(2**i)
    print('FAIL',url,err,file=sys.stderr); return ''
def region(s):
    a=s.find('id="main-content"'); b=s.find('class="innerSideBar"')
    if b<0: b=s.find('id="rateingSection"')
    return s[a:b] if a>=0 else ''
def clean(t): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',t))).strip()
CAT_RE=re.compile(r'<a[^>]*href="https://maheralqahtani\.org/page/(\d+)\?category_id=(\d+)"[^>]*>(.*?)</a>(?:\s*<i[^>]*></i>)?\s*</td>\s*<td[^>]*>\s*(\d+)\s*</td>',re.S)
FILE_RE=re.compile(r'<tr>\s*<th scope="row">\d+</th>\s*<td><a href="https://maheralqahtani\.org/details/(\d+)"[^>]*>(.*?)</a></td>\s*<td[^>]*>\s*<a href="([^"]*)"',re.S)
ART_RE=re.compile(r'<a\s+href="https://maheralqahtani\.org/details/(\d+)">([^<]+)</a>(.*?)class="btn-more"',re.S)
YT_RE=re.compile(r'<iframe[^>]*src="https?://(?:www\.)?youtube\.com/embed/([\w-]+)"')
NEXT_RE=re.compile(r'<a class="page-link" href="([^"]+)" rel="next"')
def crawl_listing(url):
    """returns dict with cats, files, articles, videos following pagination"""
    res={'cats':[],'files':[],'articles':[],'videos':[],'pages':0,'title':''}
    seen=set()
    while url and url not in seen:
        seen.add(url); s=fetch(url); r=region(s); res['pages']+=1
        if not res['title']:
            m=re.search(r'<h1 class="text-uppercase">(.*?)</h1>',r,re.S); res['title']=clean(m.group(1)) if m else ''
        if 'خطأ 404' in r: res['404']=True; break
        for m in CAT_RE.finditer(r):
            res['cats'].append({'page':int(m.group(1)),'id':int(m.group(2)),'title':clean(m.group(3)),'count':int(m.group(4))})
        for m in FILE_RE.finditer(r):
            res['files'].append({'id':int(m.group(1)),'title':clean(m.group(2)),'url':html.unescape(m.group(3))})
        for m in ART_RE.finditer(r):
            body=clean(m.group(3)); ago=re.match(r'(منذ [^\s]+ [^\s]+)',body)
            res['articles'].append({'id':int(m.group(1)),'title':clean(m.group(2)),'ago':ago.group(1) if ago else '','excerpt':body[len(ago.group(1)) if ago else 0:].strip()[:300]})
        for m in YT_RE.finditer(r): res['videos'].append(m.group(1))
        n=NEXT_RE.search(r); url=html.unescape(n.group(1)) if n else None
    return res
data={'sections':{},'cats':{}}
lock=threading.Lock()
pool=ThreadPoolExecutor(6)
# sections are independent: crawl them side by side (each one's pagination is still sequential)
for p,res in zip(range(1,16), pool.map(lambda p: crawl_listing(f'{BASE}/page/{p}/x'), range(1,16))):
    data['sections'][p]=res
    print('section',p,res['title'],len(res['cats']),len(res['files']),len(res['articles']),file=sys.stderr)
# BFS categories
frontier={}
for p,sec in data['sections'].items():
    for c in sec['cats']: frontier.setdefault(c['id'],c)
done={}
while frontier:
    batch=[c for cid,c in frontier.items() if cid not in done]; frontier={}
    if not batch: break
    results=list(pool.map(lambda c:(c,crawl_listing(f"{BASE}/page/{c['page']}?category_id={c['id']}")),batch))
    for c,res in results:
        done[c['id']]={'id':c['id'],'page':c['page'],'title':c['title'],'listed_count':c['count'],**res}
        for sc in res['cats']:
            if sc['id'] not in done: frontier.setdefault(sc['id'],sc)
    print('done cats',len(done),file=sys.stderr)
data['cats']=done
json.dump(data,open(OUT,'w'),ensure_ascii=False)

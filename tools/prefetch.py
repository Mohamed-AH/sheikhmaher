import sys,os,hashlib,urllib.request,time
from concurrent.futures import ThreadPoolExecutor
CACHE=sys.argv[1]; urls=[l.strip() for l in open(sys.argv[2]) if l.strip()]
def f(url):
    fn=os.path.join(CACHE,hashlib.md5(url.encode()).hexdigest()+'.html')
    if os.path.exists(fn): return
    for i in range(4):
        try:
            s=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (skin-site indexer)'}),timeout=60).read().decode('utf-8','replace')
            open(fn+'.tmp','w').write(s); os.rename(fn+'.tmp',fn); return
        except Exception: time.sleep(2**i)
list(ThreadPoolExecutor(int(sys.argv[3]) if len(sys.argv)>3 else 8).map(f,urls))

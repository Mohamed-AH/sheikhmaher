"""Build a single-page preview (artifact.html) from index.html + styles.css + app.js."""
import re, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
h = open(os.path.join(root, 'index.html')).read()
css = open(os.path.join(root, 'styles.css')).read()
js = open(os.path.join(root, 'app.js')).read()
title = re.search(r'<title>.*?</title>', h).group(0)
fonts = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', h).group(0)
body = h[h.index('<body>') + 6:h.index('<script src="app.js">')]
out = f'''{title}
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>{css}
html{{direction:rtl}}</style>
<div dir="rtl" lang="ar">{body}</div>
<script>{js}</script>
'''
open(sys.argv[1], 'w').write(out)

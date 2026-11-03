/* Skin site for maheralqahtani.org — reads data/catalog.json built by tools/ */
(() => {
'use strict';
const ORIGIN = 'https://maheralqahtani.org';
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const nf = new Intl.NumberFormat('ar-SA');
const N = n => nf.format(n);
const yf = new Intl.NumberFormat('ar-SA', { useGrouping: false });
const Y = n => yf.format(n);
// Arabic number agreement: [one, two, few (3–10), many (11–99), other (0, 100+)], plus gender of «واحد»
const PR = new Intl.PluralRules('ar');
const WORDS = {
  lesson: ['درس', 'درسان', 'دروس', 'درساً', 'درس', 'واحد'],
  clip: ['مقطع', 'مقطعان', 'مقاطع', 'مقطعاً', 'مقطع', 'واحد'],
  item: ['مادة', 'مادتان', 'مواد', 'مادةً', 'مادة', 'واحدة'],
  series: ['سلسلة', 'سلسلتان', 'سلاسل', 'سلسلةً', 'سلسلة', 'واحدة'],
  chapter: ['باب', 'بابان', 'أبواب', 'باباً', 'باب', 'واحد'],
  article: ['مقالة', 'مقالتان', 'مقالات', 'مقالةً', 'مقالة', 'واحدة'],
  result: ['نتيجة', 'نتيجتان', 'نتائج', 'نتيجةً', 'نتيجة', 'واحدة'],
};
function cnt(n, w) {
  const f = WORDS[w], c = PR.select(n);
  if (c === 'one') return `${f[0]} ${f[5]}`;
  if (c === 'two') return f[1];
  return `${N(n)} ${c === 'few' ? f[2] : c === 'many' ? f[3] : f[4]}`;
}
// only ever link or stream http(s) URLs taken from the source site
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
const hasFile = u => !!safeUrl(u) && !/^https?:\/\/[^/]+\/?$/i.test(u);

// ---------- routing: clean paths on the real site (/book/16/), #c-16 in the single-file preview ----------
const PATH_MODE = !!document.querySelector('base[data-router="path"]');
const BASE = PATH_MODE ? new URL(document.baseURI).pathname : '';
const toPath = r => !r ? '' : r.startsWith('c-') ? `book/${r.slice(2)}/` : r.startsWith('s-') ? `section/${r.slice(2)}/` : r + '/';
function fromPath() {
  let p = decodeURIComponent(location.pathname);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  p = p.replace(/^\/+|\/+$/g, '').replace(/(^|\/)index\.html$/, '');
  let m;
  if ((m = p.match(/^book\/(\d+)$/))) return 'c-' + m[1];
  if ((m = p.match(/^section\/([\w-]+)$/))) return 's-' + m[1];
  return p;
}
const L = r => PATH_MODE ? BASE + toPath(r) : '#' + r;
const current = () => PATH_MODE ? fromPath() : decodeURIComponent(location.hash.slice(1));
function go(r) {
  if (PATH_MODE) { history.pushState(null, '', L(r) + (r === 'search' && lastQuery ? '?q=' + encodeURIComponent(lastQuery) : '')); route(); }
  else if (location.hash === '#' + r) route(); else location.hash = r;
}
function fixLinks(root) { if (PATH_MODE) root.querySelectorAll('a[href^="#"]:not(.skip)').forEach(a => a.setAttribute('href', L(a.getAttribute('href').slice(1)))); }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HMONTHS = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const hdate = d => { if (!d) return ''; const [y, m, day] = d.split('-').map(Number); return `${N(day)} ${HMONTHS[m - 1] || ''} ${Y(y)}هـ`; };
const hyear = d => d ? Number(d.split('-')[0]) : null;

// ---------- storage (per-browser conveniences only) ----------
const store = {
  get(k, def) { try { const v = localStorage.getItem('smq:' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('smq:' + k, JSON.stringify(v)); } catch { } }
};
let heard = new Set(store.get('heard', []));
let saved = new Set(store.get('saved', []));
let resume = store.get('resume', {}); // lessonId -> seconds
let recent = store.get('recent', []); // [catId]

// ---------- icons ----------
const I = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  yt: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,.55)"/><path d="M10 8v8l6-4z" fill="#fff"/></svg>',
};
const GLYPH = {
  aqeedah: '<path d="M12 3l2.6 6.2L21 12l-6.4 2.8L12 21l-2.6-6.2L3 12l6.4-2.8z"/>',
  tafsir: '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
  hadith: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  fiqh: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
  seerah: '<path d="M3 20h18M5 20V10l7-6 7 6v10"/><path d="M10 20v-5h4v5"/>',
  manhaj: '<path d="M12 3v6M8 7l4 2 4-2"/><rect x="4" y="11" width="16" height="9" rx="2"/>',
  raqaiq: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  khutab: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  videos: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9v6l5-3z"/>',
  fawaid: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  articles: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>',
  books: '<path d="M4 4h5v16H4zM10 4h4v16h-4zM15 5l4 1-3 15-4-1z"/>',
  fatawa: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
};
const glyph = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${GLYPH[k] || GLYPH.books}</svg>`;

// ---------- Arabic normalisation for search ----------
const norm = s => String(s || '').replace(/[ً-ٰٟـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// ---------- data ----------
let C, S, secByKey = {}, catSection = {}, lessonIndex = new Map(), searchIndex = [];
function prep(data) {
  C = data.cats; S = data.sections;
  S.forEach(s => {
    secByKey[s.key] = s;
    const walk = (id, depth) => { if (catSection[id] || !C[id] || depth > 12) return; catSection[id] = s.key; C[id].kids.forEach(k => walk(k, depth + 1)); };
    s.series.forEach(id => walk(id, 0));
  });
  for (const id in C) {
    const c = C[id];
    c.id = Number(id);
    const ds = c.l.map(l => l[3]).filter(Boolean).sort();
    c.d0 = ds[0]; c.d1 = ds[ds.length - 1];
    c.l.forEach(l => { l[2] = hasFile(l[2]) ? l[2] : ''; lessonIndex.set(l[0], { l, cat: c.id }); });
    c.a.forEach(a => lessonIndex.set(a[0], { a, cat: c.id }));
    searchIndex.push({ type: 'cat', id: c.id, n: norm(c.t) });
  }
  // year range aggregated over descendants
  const agg = (id, seen = new Set()) => {
    const c = C[id]; if (!c || seen.has(id)) return [null, null]; seen.add(id);
    let a = c.d0, b = c.d1;
    c.kids.forEach(k => { const [x, y] = agg(k, seen); if (x && (!a || x < a)) a = x; if (y && (!b || y > b)) b = y; });
    c.r0 = a; c.r1 = b; return [a, b];
  };
  for (const id in C) agg(Number(id));
  S.forEach(s => {
    s.l.forEach(l => { l[2] = hasFile(l[2]) ? l[2] : ''; lessonIndex.set(l[0], { l, sec: s.key }); });
    s.a.forEach(a => lessonIndex.set(a[0], { a, sec: s.key }));
  });
  lessonIndex.forEach((v, id) => searchIndex.push({ type: 'item', id, n: norm((v.l || v.a)[1]) }));
}
const total = () => S.reduce((n, s) => n + s.n, 0);
const allSeries = () => Object.values(C).filter(c => c.up == null && catSection[c.id] && secByKey[catSection[c.id]].kind !== 'videos');

// strip a repeated "[ series ]" prefix so lesson rows read cleanly
function lessonTitle(t) {
  const m = t.match(/^\s*[\[(]\s*([^\])]+?)\s*[\])]\s*[-–:]*\s*(.*)$/);
  let rest = m ? m[2] : t;
  rest = rest.replace(/^[-–\s]+|[-–\s.]+$/g, '').trim();
  return rest || t.trim();
}
const lessonNo = t => { const m = t.match(/(?:^|[\s\-–(])([0-9٠-٩]{1,4})(?:[\s\-–).]|$)/); return m ? m[1] : ''; };
const yearsLabel = c => { const a = hyear(c.r0), b = hyear(c.r1); if (!a) return ''; return 'نُشرت ' + (a === b ? `${Y(a)}هـ` : `${Y(a)}–${Y(b)}هـ`); };
const isPdf = u => /\.pdf$/i.test(u || '');

const crumbsFor = id => { const out = []; let c = C[id], guard = 0; while (c && guard++ < 12) { out.unshift(c); c = C[c.up]; } return out; };
const origCat = c => c.x ? `${ORIGIN}/page/${c.p}` : `${ORIGIN}/page/${c.p}?category_id=${c.id}`;
const origItem = id => `${ORIGIN}/details/${id}`;

// ---------- rendering helpers ----------
function bookCard(c, alt) {
  const sec = secByKey[catSection[c.id]];
  const yrs = yearsLabel(c);
  return `<a class="book" href="#c-${c.id}">
    <div class="spine ${alt ? 'alt' : ''}"><span class="num">${N(c.n)}</span></div>
    <div><h3>${esc(c.t)}</h3><div class="meta">
      <span>${cnt(c.n, c.v.length && !c.l.length ? 'clip' : 'lesson')}</span>
      ${c.kids.length ? `<span>${cnt(c.kids.length, 'chapter')}</span>` : ''}
      ${yrs ? `<span>${yrs}</span>` : ''}
      ${c.up != null && C[c.up] ? `<span class="pill">ضمن: ${esc(C[crumbsFor(c.id)[0].id].t)}</span>` : sec ? `<span class="pill">${esc(sec.t)}</span>` : ''}

      ${c.x ? `<span class="pill" title="مجموعة حسب اسم الكتاب في عناوين الدروس">مجموعة حسب العنوان</span>` : ''}
    </div></div></a>`;
}
function lessonRow(l, catId, queueKey) {
  const [id, t, raw, d] = l;
  const url = hasFile(raw) ? safeUrl(raw) : '';
  const pdf = isPdf(url);
  const h = heard.has(id);
  if (!url) return `<div class="lesson nofile" data-id="${id}"><span class="play" aria-hidden="true">${I.play}</span>
    <div><div class="t">${esc(lessonTitle(t))}</div><div class="sub"><span>التسجيل الصوتي لهذا الدرس غير متوفر</span></div></div>
    <div class="acts"><a href="${origItem(id)}" target="_blank" rel="noopener" aria-label="صفحة الدرس في الموقع الأصلي">${I.ext}</a></div></div>`;
  return `<div class="lesson ${h ? 'heard' : ''}" data-id="${id}">
    ${pdf ? `<a class="play" href="${esc(url)}" target="_blank" rel="noopener" aria-label="فتح الكتاب">${I.pdf}</a>`
      : `<button class="play" type="button" data-play="${id}" data-q="${esc(queueKey)}" aria-label="تشغيل">${I.play}</button>`}
    <div><div class="t">${esc(lessonTitle(t))}</div><div class="sub">${d ? `<span>${hdate(d)}</span>` : ''}${resume[id] ? `<span>توقفت عند ${fmt(resume[id])}</span>` : ''}</div></div>
    <div class="acts">
      ${!pdf ? `<button type="button" data-heard="${id}" aria-pressed="${h}" aria-label="تمّ الاستماع">${I.check}</button>` : ''}
      <a href="${esc(url)}" target="_blank" rel="noopener" aria-label="تنزيل">${I.dl}</a>
      <a href="${origItem(id)}" target="_blank" rel="noopener" aria-label="في الموقع الأصلي">${I.ext}</a>
    </div></div>`;
}
function articleRow(a) {
  const [id, t, ex, d] = a;
  return `<a class="article" href="${origItem(id)}" target="_blank" rel="noopener"><h3>${esc(t)}</h3>${ex ? `<p>${esc(ex)}</p>` : ''}${d ? `<p>${hdate(d)}</p>` : ''}</a>`;
}
function paged(items, render, step = 80) {
  const id = 'pg' + Math.random().toString(36).slice(2, 8);
  const first = items.slice(0, step).map(render).join('');
  pagers[id] = { items, render, shown: step, step };
  return first + (items.length > step ? `<div class="more" id="${id}"><button class="btn" type="button" data-more="${id}">عرض المزيد (بقي ${N(items.length - step)})</button></div>` : '');
}
let pagers = {};
const fmt = s => { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

// ---------- views ----------
const START = [
  ['الأصول الثلاثة', 'معرفة العبد ربه ودينه ونبيه محمداً صلى الله عليه وسلم'],
  ['القواعد الأربع', 'معرفة القواعد التي يتميز بها توحيد أهل الإسلام عن توحيد أهل الشرك والجاهلية'],
  ['الاصول الستة', 'أصول عظيمة جليلة ضل فيها أكثر علماء الدنيا والعوام'],
  ['كشف الشبهات', 'إبطال حجج أهل الشرك والرد على شبهاتهم في توحيد الألوهية'],
  ['كتاب التوحيد', 'إفراد الله بالعبادة وبيان ما ينافي ذلك أو ينقصه من الشرك الأكبر والأصغر'],
  ['لمعة الإعتقاد', 'بيان عقيدة السلف الصالح باختصار ووضوح'],
  ['أصول السنة للإمام أحمد', 'تقرير معتقد أهل السنة والجماعة والتمسك بالسنة والرد على أهل البدع'],
  ['عمدة الفقه', 'مختصر فقهي اقتصر فيه مؤلفه ابن قدامة على القول الراجح وأودعه أحاديث صحيحة تبركاً بها واعتماداً عليها'],
  ['بلوغ المرام', 'جمع أدلة الأحكام الشرعية لاستنباط المسائل الفقهية من أحاديث النبي صلى الله عليه وسلم'],
];
function findSeries(q) {
  const nq = norm(q);
  return allSeries().filter(c => norm(c.t).includes(nq)).sort((a, b) => b.n - a.n)[0]
    || Object.values(C).filter(c => norm(c.t).includes(nq)).sort((a, b) => b.n - a.n)[0];
}
function viewHome() {
  const series = allSeries();
  const chapters = Object.values(C).filter(c => c.up != null).length;
  const biggest = series.slice().sort((a, b) => b.n - a.n).slice(0, 6);
  const latest = [...lessonIndex.entries()].filter(([, v]) => v.l && v.cat).sort((a, b) => b[0] - a[0]).slice(0, 8);
  const cont = recent.map(id => C[id]).filter(Boolean).slice(0, 3);
  return `
  <section class="hero"><div class="wrap">
    <div>
      <div class="eyebrow">فضيلة الشيخ ماهر بن ظافر القحطاني حفظه الله</div>
      <h1>دروس الشيخ بواجهة جديدة، <span>مرتبة كتاباً كتاباً</span></h1>
      <p class="lede">واجهة مساندة لموقع معرفة السنن والآثار، تعرض شروح المتون والمحاضرات والخطب المنشورة فيه مرتبةً حسب الكتب والأبواب، تيسيراً على طلاب العلم.</p>
      <form class="searchbox" id="heroSearch" role="search">${I.search}<input id="q" type="search" placeholder="ابحث عن كتاب أو درس، مثل: كتاب التوحيد" autocomplete="off"><kbd>/</kbd></form>
      <div class="chips">${['التوحيد', 'الصيام', 'الحج', 'الطهارة', 'السيرة', 'الخوارج'].map(w => `<button class="chip" type="button" data-q="${w}">${w}</button>`).join('')}</div>
    </div>
    <div class="stats">
      <div class="stat"><b class="num">${N(total())}</b><span>مادة علمية</span></div>
      <div class="stat"><b class="num">${N(series.length)}</b><span>سلسلة وكتاب مشروح</span></div>
      <div class="stat"><b class="num">${N(chapters)}</b><span>باباً وفصلاً داخل الكتب</span></div>
      <div class="stat"><b class="num">${N(S.filter(s => s.n).length)}</b><span>قسماً علمياً</span></div>
    </div>
  </div></section>
  ${cont.length ? `<section class="block"><div class="wrap"><div class="block-head"><h2>تابع من حيث توقفت</h2></div><div class="series-list">${cont.map(c => bookCard(c, true)).join('')}</div></div></section>` : ''}
  <section class="block"><div class="wrap">
    <div class="block-head"><h2>أقسام المكتبة</h2><p>اختر فنّاً لترى كل الكتب المشروحة فيه</p></div>
    <div class="shelf">${S.filter(s => s.n).map(s => `<a class="subject" href="#s-${s.key}"><div class="glyph">${glyph(s.key)}</div><h3>${esc(s.t)}</h3>
      <div class="meta num">${cnt(s.n, s.kind === 'articles' ? 'article' : 'item')}${s.series.length ? ` · ${cnt(s.series.length, 'series')}` : ''}</div></a>`).join('')}</div>
  </div></section>
  <section class="block"><div class="wrap">
    <div class="block-head"><h2>جديد على الدروس؟ ابدأ من هنا</h2><p>ترتيب مقترح للمتون من الأيسر إلى الأوسع</p></div>
    ${startPath()}
  </div></section>
  <section class="block"><div class="wrap">
    <div class="block-head"><h2>أوسع السلاسل</h2><a class="btn" href="#library">كل الكتب</a></div>
    <div class="series-list">${biggest.map(c => bookCard(c)).join('')}</div>
  </div></section>
  <section class="block"><div class="wrap">
    <div class="block-head"><h2>أحدث ما أضيف</h2></div>
    <div class="lessons">${latest.map(([id, v]) => {
      const c = C[v.cat]; return `<div class="lesson" data-id="${id}"><button class="play" type="button" data-play="${id}" data-q="c-${c.id}" aria-label="تشغيل">${I.play}</button>
      <div><div class="t">${esc(lessonTitle(v.l[1]))}</div><div class="sub"><a href="#c-${c.id}">${esc(c.t)}</a>${v.l[3] ? `<span>${hdate(v.l[3])}</span>` : ''}</div></div><div class="acts"><a href="${origItem(id)}" target="_blank" rel="noopener" aria-label="في الموقع الأصلي">${I.ext}</a></div></div>`;
    }).join('')}</div>
  </div></section>`;
}
function startPath() {
  const items = START.map(([q, why]) => [findSeries(q), why]).filter(([c]) => c);
  return `<div class="path">${items.map(([c, why]) => `<a class="step" href="#c-${c.id}"><div><h3>${esc(c.t)}</h3><p>${why} · ${cnt(c.n, 'lesson')}${yearsLabel(c) ? ' · ' + yearsLabel(c) : ''}</p></div></a>`).join('')}</div>`;
}
function viewStart() {
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span><span>ابدأ من هنا</span></div>
    <h1 class="kufi">طريق مقترح لطالب العلم الجديد</h1>
    <p style="color:var(--muted);max-width:62ch">هذه متون مختصرة شرحها الشيخ، مرتبة من الأيسر إلى الأوسع. ابدأ بالأول، واستمع للدروس بالترتيب، وعلّم ما أنهيته ليظهر تقدمك.</p></div></div>
    <div class="wrap" style="padding-block:24px"><h2 class="sr-only">الكتب المقترحة بالترتيب</h2>${startPath()}</div>`;
}
function viewLibrary() {
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span><span>المكتبة</span></div>
    <h1 class="kufi">المكتبة كاملة</h1>
    <div class="toolbar"><input class="filter" id="libFilter" type="search" placeholder="صفِّ الكتب بالاسم" aria-label="تصفية"></div></div></div>
    <div class="wrap" id="libBody">${libraryBody('')}</div>`;
}
function libraryBody(q) {
  const nq = norm(q);
  return S.filter(s => s.series.length || s.n).map(s => {
    const list = s.series.map(id => C[id]).filter(c => c && (!nq || norm(c.t).includes(nq)));
    if (!list.length && (nq || !s.n)) return '';
    return `<section class="block"><div class="block-head"><h2>${esc(s.t)}</h2><a class="btn" href="#s-${s.key}">${cnt(s.n, 'item')}</a></div>
      ${list.length ? `<div class="series-list">${list.sort((a, b) => b.n - a.n).map(c => bookCard(c)).join('')}</div>` : `<p style="color:var(--muted)">مواد هذا القسم غير مقسّمة إلى سلاسل. <a href="#s-${s.key}" style="color:var(--brand)">تصفحها</a></p>`}</section>`;
  }).join('');
}
function viewSection(key) {
  const s = secByKey[key]; if (!s) return notFound();
  const list = s.series.map(id => C[id]).filter(Boolean).sort((a, b) => b.n - a.n);
  const withLessons = list.filter(c => c.n), empty = list.filter(c => !c.n);
  let body = '';
  if (list.length) body += `<div class="series-list">${withLessons.map(c => bookCard(c)).join('')}</div>`;
  if (s.l.length) body += `<div class="lessons" style="margin-top:20px">${paged(s.l, l => lessonRow(l, null, 's-' + key))}</div>`;
  if (s.a.length) body += `<div class="lessons" style="margin-top:20px">${paged(s.a, articleRow, 40)}</div>`;
  if (empty.length) body += `<p style="color:var(--muted);margin-top:22px">سلاسل أخرى في هذا القسم: ${empty.map(c => esc(c.t)).join('، ')}</p>`;
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span><a href="#library">المكتبة</a><span aria-hidden="true">/</span><span>${esc(s.t)}</span></div>
    <h1 class="kufi">${esc(s.t)}</h1><div class="meta"><span class="pill num">${cnt(s.n, 'item')}</span>${list.length ? `<span class="pill num">${cnt(list.length, 'series')}</span>` : ''}
    <a class="pill" href="${ORIGIN}/page/${s.id}" target="_blank" rel="noopener">القسم في الموقع الأصلي ↗</a></div></div></div>
    <div class="wrap" style="padding-block:24px"><h2 class="sr-only">محتوى القسم</h2>${body || '<div class="empty-note">لا توجد مواد في هذا القسم.</div>'}</div>`;
}
function chaptersNav(root, current) {
  const item = (c, depth) => `<a href="#c-${c.id}" class="${c.n ? '' : 'zero'}" ${c.id === current ? 'aria-current="true"' : ''}><span>${esc(c.t.replace(/^\s*\[[^\]]+\]\s*/, ''))}</span><span class="c num">${N(c.n)}</span></a>
    ${c.kids.length && depth < 4 ? `<div class="sub">${c.kids.map(k => C[k]).filter(Boolean).map(k => item(k, depth + 1)).join('')}</div>` : ''}`;
  return `<nav class="chapters" aria-label="الأبواب"><h2>أبواب الكتاب</h2><a href="#c-${root.id}" ${root.id === current ? 'aria-current="true"' : ''}><span>الكل</span><span class="c num">${N(root.n)}</span></a>${root.kids.map(k => C[k]).filter(Boolean).map(k => item(k, 0)).join('')}</nav>`;
}
function collectLessons(c, seen = new Set()) {
  if (!c || seen.has(c.id)) return []; seen.add(c.id);
  return [...c.l, ...c.kids.flatMap(k => collectLessons(C[k], seen))];
}
function viewCat(id) {
  const c = C[id]; if (!c) return notFound();
  recent = [id, ...recent.filter(x => x !== id)].slice(0, 6); store.set('recent', recent);
  const chain = crumbsFor(id), root = chain[0];
  const sec = secByKey[catSection[root.id]];
  const all = collectLessons(c);
  const audioCount = all.filter(l => l[2] && !isPdf(l[2])).length;
  const done = all.filter(l => heard.has(l[0])).length;
  const isVideo = c.v.length || (sec && sec.key === 'videos');
  let body = '';
  if (c.v.length) body += `<div class="videos">${c.v.map((v, i) => `<a class="video" href="https://www.youtube.com/watch?v=${esc(v)}" target="_blank" rel="noopener"><div class="th" style="background-image:url(https://i.ytimg.com/vi/${esc(v)}/mqdefault.jpg)">${I.yt}</div><span>مقطع ${N(i + 1)}</span></a>`).join('')}</div>`;
  const groups = [];
  if (c.l.length) groups.push([null, c.l]);
  const addKids = (cc, seen = new Set([cc.id])) => cc.kids.forEach(k => { const kc = C[k]; if (!kc || seen.has(k)) return; seen.add(k); if (kc.l.length) groups.push([kc, kc.l]); addKids(kc, seen); });
  addKids(c);
  if (groups.length) {
    body += `<div class="lessons">${groups.map(([g, ls]) => (g ? `<div class="group-title"><a href="#c-${g.id}">${esc(g.t)}</a></div>` : '') + paged(ls, l => lessonRow(l, g ? g.id : c.id, 'c-' + c.id), 120)).join('')}</div>`;
  }
  if (c.a.length) body += `<div class="lessons">${paged(c.a, articleRow, 40)}</div>`;
  if (!body) body = `<div class="lessons"><div class="empty-note">لا توجد دروس في هذا الباب حالياً.<br><a href="${origCat(c)}" target="_blank" rel="noopener" style="color:var(--brand)">تحقق في الموقع الأصلي ↗</a></div></div>`;
  const yrs = yearsLabel(c);
  const showNav = root.kids.length > 0;
  return `<div class="page-head"><div class="wrap">
    <div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span>${sec ? `<a href="#s-${sec.key}">${esc(sec.t)}</a><span aria-hidden="true">/</span>` : ''}${chain.slice(0, -1).map(x => `<a href="#c-${x.id}">${esc(x.t)}</a><span aria-hidden="true">/</span>`).join('')}</div>
    <h1>${esc(c.t)}</h1>
    <div class="meta"><span class="pill num">${cnt(c.n, isVideo ? 'clip' : 'lesson')}</span>${c.kids.length ? `<span class="pill num">${cnt(c.kids.length, 'chapter')}</span>` : ''}${yrs ? `<span class="pill">${yrs}</span>` : ''}
      </div>
    ${c.x ? `<p style="color:var(--muted);max-width:68ch;margin:12px 0 0;font-size:.92rem">دروس منشورة في القائمة العامة لقسم «${esc(secByKey[catSection[c.id]]?.t || '')}»، جُمعت هنا حسب اسم الكتاب الوارد في عناوينها لتسهيل متابعتها.</p>` : ''}
    <div class="toolbar">
      ${audioCount ? `<button class="btn primary" type="button" data-playall="c-${c.id}">${I.play} استمع من البداية</button>` : ''}
      ${audioCount ? `<button class="btn" type="button" data-continue="c-${c.id}">تابع أول درس لم تسمعه</button>` : ''}
      <button class="btn" type="button" data-save="${c.id}" aria-pressed="${saved.has(c.id)}">${I.bookmark} ${saved.has(c.id) ? 'محفوظ' : 'احفظ'}</button>
      <a class="btn" href="${origCat(c)}" target="_blank" rel="noopener">${I.ext} في الموقع الأصلي</a>
    </div>
    ${audioCount ? `<div class="progress" title="${N(done)} من ${N(audioCount)}"><i style="width:${(done / audioCount * 100).toFixed(1)}%"></i></div><div style="font-size:.8rem;color:var(--muted);margin-top:4px">${N(done)} من ${N(audioCount)} درساً استمعت إليه</div>` : ''}
  </div></div>
  <div class="wrap">${showNav ? `<div class="layout">${chaptersNav(root, c.id)}<div>${body}</div></div>` : `<div style="padding-block:24px">${body}</div>`}</div>`;
}
function viewSearch(q) {
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span><span>البحث</span></div>
    <h1 class="sr-only">البحث في المكتبة</h1>
    <form class="searchbox" id="pageSearch" role="search">${I.search}<input id="q2" type="search" value="${esc(q)}" placeholder="ابحث في عناوين الكتب والدروس" autocomplete="off"></form></div></div>
    <div class="wrap" id="results">${results(q)}</div>`;
}
function results(q) {
  const nq = norm(q);
  if (nq.length < 2) return '<div class="empty-note">اكتب كلمتين على الأقل، مثل: الأصول الثلاثة، الصيام، الربا.</div>';
  const terms = nq.split(' ');
  const hits = searchIndex.filter(x => terms.every(t => x.n.includes(t)));
  const cats = hits.filter(h => h.type === 'cat').map(h => C[h.id]).sort((a, b) => (a.n ? 0 : 1) - (b.n ? 0 : 1) || (a.up == null ? 0 : 1) - (b.up == null ? 0 : 1) || b.n - a.n);
  const items = hits.filter(h => h.type === 'item').map(h => [h.id, lessonIndex.get(h.id)]);
  const mark = t => { let s = esc(t); return s; };
  let html = '';
  if (cats.length) html += `<div class="results-group"><h2>الكتب والأبواب: ${cnt(cats.length, 'result')}</h2><div class="series-list">${cats.slice(0, 30).map(c => bookCard(c)).join('')}</div></div>`;
  if (items.length) html += `<div class="results-group"><h2>الدروس والمقالات: ${cnt(items.length, 'result')}</h2><div class="lessons">${paged(items, ([id, v]) => {
    if (v.a) return articleRow(v.a);
    const where = v.cat ? `<a href="#c-${v.cat}">${esc(C[v.cat].t)}</a>` : `<a href="#s-${v.sec}">${esc(secByKey[v.sec].t)}</a>`;
    if (!v.l[2]) return lessonRow(v.l);
    const pdf = isPdf(v.l[2]);
    return `<div class="lesson" data-id="${id}">${pdf ? `<a class="play" href="${esc(v.l[2])}" target="_blank" rel="noopener" aria-label="فتح">${I.pdf}</a>` : `<button class="play" type="button" data-play="${id}" data-q="${v.cat ? 'c-' + v.cat : 's-' + v.sec}" aria-label="تشغيل">${I.play}</button>`}
      <div><div class="t">${mark(v.l[1])}</div><div class="sub">${where}${v.l[3] ? `<span>${hdate(v.l[3])}</span>` : ''}</div></div>
      <div class="acts"><a href="${esc(v.l[2])}" target="_blank" rel="noopener" aria-label="تنزيل">${I.dl}</a><a href="${origItem(id)}" target="_blank" rel="noopener" aria-label="في الموقع الأصلي">${I.ext}</a></div></div>`;
  }, 60)}</div></div>`;
  return html || `<div class="empty-note">لا نتائج لـ «${esc(q)}». جرّب كلمة أقصر أو بدون ال التعريف.</div>`;
}
function viewMine() {
  const sv = [...saved].map(id => C[id]).filter(Boolean), rc = recent.map(id => C[id]).filter(Boolean);
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span><span>متابعتي</span></div><h1 class="kufi">متابعتي</h1>
    <p style="color:var(--muted)">تُحفظ في هذا المتصفح فقط: الكتب المحفوظة، وآخر ما فتحته، والدروس التي علّمتها مسموعة (${N(heard.size)}).</p></div></div>
    <div class="wrap"><section class="block"><div class="block-head"><h2>المحفوظات</h2></div>${sv.length ? `<div class="series-list">${sv.map(c => bookCard(c, true)).join('')}</div>` : '<p style="color:var(--muted)">لم تحفظ شيئاً بعد. اضغط «احفظ» في صفحة أي كتاب.</p>'}</section>
    <section class="block"><div class="block-head"><h2>آخر ما فتحته</h2></div>${rc.length ? `<div class="series-list">${rc.map(c => bookCard(c)).join('')}</div>` : '<p style="color:var(--muted)">لا شيء بعد.</p>'}</section></div>`;
}
const notFound = () => `<div class="wrap"><div class="empty-note">الصفحة غير موجودة. <a href="#" style="color:var(--brand)">العودة للرئيسية</a></div></div>`;

// ---------- router ----------
let lastQuery = '';
function route() {
  pagers = {};
  const h = current();
  let html, nav = '', title = '';
  if (!h) { html = viewHome(); nav = 'home'; }
  else if (h === 'start') { html = viewStart(); nav = 'start'; }
  else if (h === 'library') { html = viewLibrary(); nav = 'library'; }
  else if (h === 'mine') { html = viewMine(); nav = 'mine'; }

  else if (h === 'search') {
    if (PATH_MODE && !lastQuery) lastQuery = new URLSearchParams(location.search).get('q') || '';
    html = viewSearch(lastQuery); nav = 'search'; title = 'البحث';
  }
  else if (h.startsWith('s-')) { html = viewSection(h.slice(2)); nav = 'library'; title = secByKey[h.slice(2)]?.t; }
  else if (h.startsWith('c-')) { html = viewCat(Number(h.slice(2))); nav = 'library'; title = C[Number(h.slice(2))]?.t; }
  else html = notFound();
  if (!title) title = { start: 'ابدأ من هنا', library: 'المكتبة', mine: 'متابعتي' }[h] || '';
  document.title = (title ? title + ' | ' : '') + SITE_NAME;
  app.innerHTML = html;
  fixLinks(app);
  document.querySelectorAll('[data-nav]').forEach(a => a.dataset.nav === nav ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  markPlaying();
  if (h === 'search') { const i = $('#q2'); i && (i.focus(), i.setSelectionRange(i.value.length, i.value.length)); }
  else {
    window.scrollTo(0, 0);
    // move screen-reader and keyboard focus to the new page's heading, except on first load
    if (routed) { const h1 = app.querySelector('h1'); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } }
  }
  routed = true;
}
let routed = false;
const SITE_NAME = 'مكتبة معرفة السنن والآثار للشيخ ماهر القحطاني حفظه الله';

// ---------- player ----------
const audio = $('#audio'), player = $('#player');
let queue = [], qi = -1, cur = null;
const speeds = [1, 1.25, 1.5, 1.75, 2]; let sp = store.get('speed', 0);
function queueFor(key) {
  if (key.startsWith('c-')) return collectLessons(C[Number(key.slice(2))]).filter(l => l[2] && !isPdf(l[2]));
  if (key.startsWith('s-')) return (secByKey[key.slice(2)]?.l || []).filter(l => l[2] && !isPdf(l[2]));
  return [];
}
function playLesson(id, key) {
  queue = queueFor(key); qi = queue.findIndex(l => l[0] === id);
  if (qi < 0) { const v = lessonIndex.get(id); if (!v || !v.l || !v.l[2]) return; queue = [v.l]; qi = 0; }
  load(true);
}
function load(autoplay) {
  const l = queue[qi]; if (!l) return;
  if (cur && audio.currentTime > 5) { resume[cur[0]] = audio.currentTime; store.set('resume', resume); }
  cur = l; const v = lessonIndex.get(l[0]);
  player.hidden = false; document.body.classList.add('has-player'); $('#pErr').hidden = true;
  $('#pTitle').textContent = lessonTitle(l[1]);
  const where = v && v.cat ? C[v.cat] : null;
  $('#pSeries').textContent = where ? where.t : (v && v.sec ? secByKey[v.sec].t : '');
  $('#pSeries').href = L(where ? 'c-' + where.id : (v && v.sec ? 's-' + v.sec : ''));
  $('#pDl').href = l[2];
  audio.src = l[2]; audio.playbackRate = speeds[sp];
  const startAt = resume[l[0]] || 0;
  audio.addEventListener('loadedmetadata', () => { if (startAt && startAt < audio.duration - 5) audio.currentTime = startAt; }, { once: true });
  if (autoplay) audio.play().catch(() => { });
  store.set('last', { id: l[0] });
  markPlaying();
}
function markPlaying() {
  document.querySelectorAll('.lesson.playing').forEach(e => e.classList.remove('playing'));
  document.querySelectorAll('[data-play]').forEach(b => b.innerHTML = I.play);
  if (!cur) return;
  document.querySelectorAll(`.lesson[data-id="${cur[0]}"]`).forEach(e => { e.classList.add('playing'); const b = e.querySelector('[data-play]'); if (b && !audio.paused) b.innerHTML = I.pause; });
  $('#pPlay').innerHTML = audio.paused ? I.play : I.pause;
}
audio.addEventListener('play', markPlaying); audio.addEventListener('pause', markPlaying);
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  $('#pSeek').value = Math.round(audio.currentTime / audio.duration * 1000);
  $('#pCur').textContent = fmt(audio.currentTime); $('#pDur').textContent = fmt(audio.duration);
  if (Math.floor(audio.currentTime) % 10 === 0 && cur) { resume[cur[0]] = audio.currentTime; store.set('resume', resume); }
});
audio.addEventListener('ended', () => {
  if (cur) { heard.add(cur[0]); delete resume[cur[0]]; store.set('heard', [...heard]); store.set('resume', resume); }
  if (qi < queue.length - 1) { qi++; load(true); }
});
audio.addEventListener('error', () => { if (!cur) return; const e = $('#pErr'); e.hidden = false; e.innerHTML = `تعذّر تشغيل الملف هنا. <a href="${esc(cur[2])}" target="_blank" rel="noopener">افتحه مباشرة ↗</a>`; });
$('#pPlay').onclick = () => audio.paused ? audio.play().catch(() => { }) : audio.pause();
$('#pNext').onclick = () => { if (qi < queue.length - 1) { qi++; load(true); } };
$('#pPrev').onclick = () => { if (audio.currentTime > 8) audio.currentTime = 0; else if (qi > 0) { qi--; load(true); } };
$('#pSeek').oninput = e => { if (audio.duration) audio.currentTime = e.target.value / 1000 * audio.duration; };
const spLabel = () => $('#pSpeed').textContent = N(speeds[sp]) + '×';
$('#pSpeed').onclick = () => { sp = (sp + 1) % speeds.length; audio.playbackRate = speeds[sp]; store.set('speed', sp); spLabel(); };
spLabel();
if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('nexttrack', () => $('#pNext').click());
    navigator.mediaSession.setActionHandler('previoustrack', () => $('#pPrev').click());
  } catch { }
}

// ---------- events ----------
document.addEventListener('click', e => {
  if (e.target.closest('a.skip')) { e.preventDefault(); app.focus(); return; }
  const t = e.target.closest('button,[data-q]'); if (!t) return;
  if (t.dataset.play) { const id = Number(t.dataset.play); if (cur && cur[0] === id) { audio.paused ? audio.play().catch(() => { }) : audio.pause(); } else playLesson(id, t.dataset.q || ''); return; }
  if (t.dataset.playall) { queue = queueFor(t.dataset.playall); qi = 0; load(true); return; }
  if (t.dataset.continue) { queue = queueFor(t.dataset.continue); qi = Math.max(0, queue.findIndex(l => !heard.has(l[0]))); load(true); return; }
  if (t.dataset.heard) {
    const id = Number(t.dataset.heard); heard.has(id) ? heard.delete(id) : heard.add(id); store.set('heard', [...heard]);
    t.setAttribute('aria-pressed', heard.has(id)); t.closest('.lesson').classList.toggle('heard', heard.has(id)); return;
  }
  if (t.dataset.save) { const id = Number(t.dataset.save); saved.has(id) ? saved.delete(id) : saved.add(id); store.set('saved', [...saved]); route(); return; }
  if (t.dataset.more) {
    const p = pagers[t.dataset.more], box = document.getElementById(t.dataset.more); if (!p) return;
    const next = p.items.slice(p.shown, p.shown + p.step); p.shown += p.step;
    box.insertAdjacentHTML('beforebegin', next.map(p.render).join(''));
    fixLinks(box.parentNode);
    if (p.shown >= p.items.length) box.remove(); else t.textContent = `عرض المزيد (بقي ${N(p.items.length - p.shown)})`;
    markPlaying(); return;
  }
  if (t.classList.contains('chip') && t.dataset.q) { lastQuery = t.dataset.q; go('search'); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const i = e.target.querySelector('input'); lastQuery = i.value;
  if (current() !== 'search') go('search'); else { $('#results').innerHTML = results(lastQuery); fixLinks($('#results')); if (PATH_MODE) history.replaceState(null, '', L('search') + '?q=' + encodeURIComponent(lastQuery)); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q2') { lastQuery = e.target.value; clearTimeout(window.__st); window.__st = setTimeout(() => { pagers = {}; $('#results').innerHTML = results(lastQuery); fixLinks($('#results')); markPlaying(); if (PATH_MODE) history.replaceState(null, '', L('search') + (lastQuery ? '?q=' + encodeURIComponent(lastQuery) : '')); }, 200); }
  if (e.target.id === 'libFilter') { $('#libBody').innerHTML = libraryBody(e.target.value); fixLinks($('#libBody')); }
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); const i = $('#q') || $('#q2'); if (i) i.focus(); else go('search'); }
});
const toggleTheme = () => {
  const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark'; store.set('theme', r.dataset.theme);
};
$('#theme').onclick = toggleTheme;
$('#theme2').onclick = toggleTheme;

// ---------- player close ----------
$('#pClose').onclick = () => {
  if (cur && audio.currentTime > 5) { resume[cur[0]] = audio.currentTime; store.set('resume', resume); }
  audio.pause(); audio.removeAttribute('src'); audio.load();
  cur = null; queue = []; qi = -1;
  player.hidden = true; document.body.classList.remove('has-player');
  store.set('last', null); markPlaying();
};

// ---------- mobile menu ----------
const drawer = $('#drawer'), scrim = $('#scrim'), menuBtn = $('#menuBtn');
function setMenu(open) {
  drawer.hidden = !open; scrim.hidden = !open; menuBtn.setAttribute('aria-expanded', open);
  document.querySelectorAll('body > header, body > main, body > footer, .bottom-nav, #player').forEach(el => { el.inert = open; });
  document.body.classList.toggle('no-scroll', open);
  if (open) $('#menuClose').focus(); else if (document.activeElement && drawer.contains(document.activeElement)) menuBtn.focus();
}
menuBtn.onclick = () => setMenu(true);
$('#menuClose').onclick = () => setMenu(false);
scrim.onclick = () => setMenu(false);
drawer.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => {
  if (drawer.hidden) return;
  if (e.key === 'Escape') setMenu(false);
  if (e.key === 'Tab') { // keep focus inside the open menu
    const f = [...drawer.querySelectorAll('a[href],button')]; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
{ const t = store.get('theme', null); if (t) document.documentElement.dataset.theme = t; }
if (PATH_MODE) {
  window.addEventListener('popstate', route);
  // internal links navigate without a full page load
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.classList.contains('skip') || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || !u.pathname.startsWith(BASE) || /\.(json|xml|txt|png)$/.test(u.pathname)) return;
    e.preventDefault();
    if (u.pathname + u.search !== location.pathname + location.search) history.pushState(null, '', u.pathname + u.search);
    route();
  });
  // old #c-16 style links still work
  const legacy = location.hash.slice(1);
  if (/^(c-\d+|s-[\w-]+|start|library|mine|search)$/.test(legacy)) history.replaceState(null, '', L(legacy));
} else window.addEventListener('hashchange', route);

// ---------- boot ----------
function boot(data) {
  prep(data);
  $('#drawerSections').innerHTML = S.filter(s => s.n).map(s => `<a href="#s-${s.key}"><span>${esc(s.t)}</span><span class="num">${N(s.n)}</span></a>`).join('');
  fixLinks(document);
  if (data.built) $('#built').textContent = 'آخر تحديث للفهرس: ' + new Date(data.built).toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'long', day: 'numeric' });
  route();
  const last = store.get('last', null);
  if (last && lessonIndex.get(last.id)?.l) { const v = lessonIndex.get(last.id); queue = v.cat ? queueFor('c-' + v.cat) : [v.l]; qi = Math.max(0, queue.findIndex(l => l[0] === last.id)); load(false); }
}
if (window.CATALOG) boot(window.CATALOG);
else fetch('data/catalog.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(boot).catch(() => {
  // keep any pre-rendered page content; only say so when there is nothing to show
  const note = '<div class="empty-note" role="alert">تعذّر تحميل الفهرس. تحقق من الاتصال ثم حدّث الصفحة.</div>';
  if (app.dataset.prerendered) app.insertAdjacentHTML('afterbegin', note); else app.innerHTML = note;
});
})();

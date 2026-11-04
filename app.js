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
  sharh: ['شرح', 'شرحان', 'شروح', 'شرحاً', 'شرح', 'واحد'],
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
const toPath = r => !r ? '' : r.startsWith('c-') ? `book/${r.slice(2)}/` : r.startsWith('s-') ? `section/${r.slice(2)}/` : r.startsWith('t-') ? `text/${r.slice(2)}/` : r + '/';
function fromPath() {
  let p = decodeURIComponent(location.pathname);
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  p = p.replace(/^\/+|\/+$/g, '').replace(/(^|\/)index\.html$/, '');
  let m;
  if ((m = p.match(/^book\/(\d+)$/))) return 'c-' + m[1];
  if ((m = p.match(/^section\/([\w-]+)$/))) return 's-' + m[1];
  if ((m = p.match(/^text\/([\w-]+)$/))) return 't-' + m[1];
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
let spos = store.get('spos', []);     // [{k: 'c-<series>' | 's-<section>', id: lessonId}], the latest first: where each series was left
let mylist = store.get('mylist', []); // lesson ids, in the order they were added

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
  addq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h11M4 11h11M4 16h7"/><path d="M17.5 13v8M13.5 17h8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
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
let SCH = null, C, S, T = [], textByKey = {}, textOf = {}, secByKey = {}, catSection = {}, lessonIndex = new Map(), searchIndex = null;
const FILES = 'https://maheralqahtani.org/lfm/files/admin/';  // the catalog shortens this common start of audio links to "~"
const fileUrl = u => u && u[0] === '~' ? FILES + u.slice(1) : u;
function prep(data) {
  C = data.cats; S = data.sections; SCH = data.schedule || null;
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
    c.l.forEach(l => { l[2] = fileUrl(l[2]); l[2] = hasFile(l[2]) ? l[2] : ''; lessonIndex.set(l[0], { l, cat: c.id }); });
    c.a.forEach(a => lessonIndex.set(a[0], { a, cat: c.id }));
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
    s.l.forEach(l => { l[2] = fileUrl(l[2]); l[2] = hasFile(l[2]) ? l[2] : ''; lessonIndex.set(l[0], { l, sec: s.key }); });
    s.a.forEach(a => lessonIndex.set(a[0], { a, sec: s.key }));
  });
  // texts explained more than once: all their explanations under one heading
  T = (data.texts || []).map(t => ({ ...t, ids: t.ids.filter(i => C[i]) })).filter(t => t.ids.length > 1);
  T.forEach(t => {
    textByKey[t.k] = t; t.ids.forEach(i => { textOf[i] = t; });
    const ds = t.ids.flatMap(i => [C[i].r0, C[i].r1]).filter(Boolean).sort(); t.r0 = ds[0]; t.r1 = ds[ds.length - 1];
  });
}
// built on the first search, so pages that never search don't pay for it
function getSearchIndex() {
  if (searchIndex) return searchIndex;
  searchIndex = [];
  for (const id in C) searchIndex.push({ type: 'cat', id: C[id].id, n: norm(C[id].t) });
  lessonIndex.forEach((v, id) => searchIndex.push({ type: 'item', id, n: norm((v.l || v.a)[1]) }));
  T.forEach(t => searchIndex.push({ type: 'text', k: t.k, n: norm(t.t + ' ' + t.by) }));
  return searchIndex;
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
const origCat = c => c.src ? c.src : c.x ? `${ORIGIN}/page/${c.p}` : `${ORIGIN}/page/${c.p}?category_id=${c.id}`;
const origItem = id => `${ORIGIN}/details/${id}`;

// ---------- rendering helpers ----------
function bookCard(c, alt) {
  const sec = secByKey[catSection[c.id]];
  const yrs = yearsLabel(c);
  return `<a class="book" href="#c-${c.id}">
    <div class="spine ${alt ? 'alt' : ''}"><span class="num">${N(c.n)}</span></div>
    <div><h3>${esc(c.t)}</h3><div class="meta">
      <span>${cnt(c.n, c.v.length && !c.l.length ? 'clip' : 'lesson')}</span>
      ${liveKids(c).length ? `<span>${cnt(liveKids(c).length, 'chapter')}</span>` : ''}
      ${yrs ? `<span>${yrs}</span>` : ''}
      ${c.up != null && C[c.up] ? `<span class="pill">ضمن: ${esc(C[crumbsFor(c.id)[0].id].t)}</span>` : sec ? `<span class="pill">${esc(sec.t)}</span>` : ''}

      ${c.src ? `<span class="pill">بث مباشر من جامع الراجحي بمكة</span>` : c.x ? `<span class="pill" title="مجموعة حسب اسم الكتاب والدورة التي سُجّلت فيها">مجموعة حسب الدورة</span>` : ''}
    </div></div></a>`;
}
// position in the series, and "(2 of 4)" when consecutive lessons share the same title
function numberLessons(groups) {
  let pos = 0;
  return groups.map(([g, ls]) => {
    const titles = ls.map(l => norm(lessonTitle(l[1])));
    return [g, ls.map((l, i) => {
      let a = i, b = i;
      while (a > 0 && titles[a - 1] === titles[i]) a--;
      while (b < ls.length - 1 && titles[b + 1] === titles[i]) b++;
      return { l, pos: ++pos, k: i - a + 1, of: b - a + 1, all: b - a + 1 === ls.length };
    })];
  });
}
const expLabel = c => { const t = textOf[c.id]; const lab = t && t.lab[c.id]; const y = yearsLabel(c).replace('نُشرت ', ''); return lab || (y ? `شرح ${y}` : c.t); };
function textCard(t) {
  return `<a class="book text" href="#t-${t.k}">
    <div class="spine stack"><span class="num">${N(t.ids.length)}</span></div>
    <div><h3>${esc(t.t)}</h3><div class="by">${esc(t.by)}</div><div class="meta">
      <span>${cnt(t.ids.length, 'sharh')}</span><span>${cnt(t.n, 'lesson')}</span>
    </div></div></a>`;
}
// a section's series with every multi-explained text folded into one card
function shelfItems(list, key) {
  const out = [], seen = new Set();
  list.forEach(c => {
    const t = textOf[c.id];
    if (!t) out.push([c.top ? 1e9 + c.n : c.n, bookCard(c)]);
    else if (!seen.has(t.k)) { seen.add(t.k); out.push([t.n, textCard(t)]); }
  });
  T.forEach(t => { if (key && (t.also || []).includes(key) && !seen.has(t.k)) { seen.add(t.k); out.push([t.n, textCard(t)]); } });  // books of two subjects
  return out.sort((a, b) => b[0] - a[0]).map(x => x[1]).join('');
}
function lessonRow(l, catId, queueKey, m) {
  const [id, t, raw, d] = l;
  const part = m && m.of > 1 && !m.all ? ` <span class="part num">(${N(m.k)} من ${N(m.of)})</span>` : '';
  const pos = (m ? `<span class="num">الدرس ${N(m.pos)}</span>` : '') + (m && m.flat && m.g ? `<span>${esc(chapterName(m.g))}</span>` : '');
  const url = hasFile(raw) ? safeUrl(raw) : '';
  const pdf = isPdf(url);
  const h = heard.has(id);
  if (!url) return `<div class="lesson nofile" data-id="${id}"><span class="play" aria-hidden="true">${I.play}</span>
    <div><div class="t">${esc(lessonTitle(t))}${part}</div><div class="sub">${pos}<span>التسجيل الصوتي لهذا الدرس غير متوفر</span></div></div>
    <div class="acts"><a href="${origItem(id)}" target="_blank" rel="noopener" aria-label="صفحة الدرس في الموقع الأصلي">${I.ext}</a></div></div>`;
  return `<div class="lesson ${h ? 'heard' : ''}" data-id="${id}">
    ${pdf ? `<a class="play" href="${esc(url)}" target="_blank" rel="noopener" aria-label="فتح الكتاب">${I.pdf}</a>`
      : `<button class="play" type="button" data-play="${id}" data-q="${esc(queueKey)}" aria-label="تشغيل">${I.play}</button>`}
    <div><div class="t">${esc(lessonTitle(t))}${part}</div><div class="sub">${pos}${d ? `<span>${hdate(d)}</span>` : ''}${resume[id] ? `<span>توقفت عند ${fmt(resume[id])}</span>` : ''}</div></div>
    <div class="acts">
      ${!pdf ? `<button type="button" data-mylist="${id}" aria-pressed="${mylist.includes(id)}" aria-label="أضف إلى قائمتي">${I.addq}</button><button type="button" data-heard="${id}" aria-pressed="${h}" aria-label="تمّ الاستماع">${I.check}</button>` : ''}
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
      <div class="eyebrow">دروس ومحاضرات</div>
      <h1>فضيلة الشيخ ماهر بن ظافر القحطاني <small>حفظه الله</small></h1>
      <p class="tagline">مرتبة كتاباً كتاباً، بواجهة جديدة</p>
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
  ${todayStrip()}
  ${listening(4) ? `<section class="block"><div class="wrap"><div class="block-head"><h2>تابع الاستماع</h2><a class="btn" href="#mine">متابعتي</a></div><div class="series-list">${listening(4)}</div></div></section>`
    : cont.length ? `<section class="block"><div class="wrap"><div class="block-head"><h2>تابع من حيث توقفت</h2></div><div class="series-list">${cont.map(c => bookCard(c, true)).join('')}</div></div></section>` : ''}
  <section class="block"><div class="wrap">
    <div class="block-head"><h2>أقسام المكتبة</h2><p>اختر فنّاً لترى كل الكتب المشروحة فيه</p></div>
    <div class="shelf">${S.filter(s => s.n).map(s => `<a class="subject" href="#s-${s.key}"><div class="glyph">${glyph(s.key)}</div><h3>${esc(s.t)}</h3>
      <div class="meta chips num"><span>${cnt(s.n, s.kind === 'articles' ? 'article' : 'item')}</span>${s.series.length ? `<span>${cnt(s.series.length, 'series')}</span>` : ''}</div></a>`).join('')}</div>
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
  return `<div class="path">${items.map(([c, why]) => `<a class="step" href="#c-${c.id}"><div><h3>${esc(c.t)}</h3><p>${why}</p><div class="chips num"><span>${cnt(c.n, 'lesson')}</span>${yearsLabel(c) ? `<span>${yearsLabel(c)}</span>` : ''}</div></div></a>`).join('')}</div>`;
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
    const list = s.series.map(id => C[id]).filter(c => c && (!nq || norm(c.t).includes(nq) || (textOf[c.id] && norm(textOf[c.id].t).includes(nq))));
    if (!list.length && (nq || !s.n)) return '';
    return `<section class="block"><div class="block-head"><h2>${esc(s.t)}</h2><a class="btn" href="#s-${s.key}">${cnt(s.n, 'item')}</a></div>
      ${list.length ? `<div class="series-list">${shelfItems(list, nq ? null : s.key)}</div>` : `<p style="color:var(--muted)">مواد هذا القسم غير مقسّمة إلى سلاسل. <a href="#s-${s.key}" style="color:var(--brand)">تصفحها</a></p>`}</section>`;
  }).join('');
}
function viewSection(key) {
  const s = secByKey[key]; if (!s) return notFound();
  const ser = s.series.map(id => C[id]).filter(Boolean).sort((a, b) => (b.top | 0) - (a.top | 0) || b.n - a.n);
  const withLessons = ser.filter(c => c.n), empty = ser.filter(c => !c.n);
  let body = '';
  if (s.groups) body += s.groups.map(([t, ids], gi) => {  // the videos section: series under topics, folded
    const cs = ids.map(i => C[i]).filter(c => c && c.n); if (!cs.length) return '';
    return `<details class="vgroup"><summary><span class="t">${esc(t)}</span><span class="c num">${cnt(cs.length, 'series')}، ${cnt(cs.reduce((a, c) => a + c.n, 0), 'clip')}</span></summary>
      <div class="series-list">${shelfItems(cs, key)}</div></details>`;
  }).join('');
  else if (ser.length) body += `<div class="series-list">${shelfItems(withLessons, key)}</div>`;
  list = null;
  if (s.l.length) {
    list = { id: null, q: 's-' + key, plain: true, rows: s.l.map((l, i) => ({ l, pos: i + 1 })) };
    const audio = s.l.filter(playable).length, k = 's-' + key;
    const btns = audio > 1 ? `<div class="toolbar" style="margin:0 0 14px"><button class="btn primary" type="button" data-playall="${k}">${I.play} استمع للقائمة متتابعة</button>
      <button class="btn" type="button" data-continue="${k}">${spos.some(e => e.k === k) ? 'تابع من حيث توقفت' : 'تابع أول مادة لم تسمعها'}</button></div>` : '';
    body += `<div style="margin-top:20px">${btns}${s.l.length >= 15 ? lessonTools(list.rows, true) : ''}<div class="lessons" id="lessonList">${lessonList(true)}</div></div>`;
  }
  if (s.a.length) body += `<div class="lessons" style="margin-top:20px">${paged(s.a, articleRow, 40)}</div>`;
  if (empty.length) body += `<p style="color:var(--muted);margin-top:22px">سلاسل أخرى في هذا القسم: ${empty.map(c => esc(c.t)).join('، ')}</p>`;
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span><a href="#library">المكتبة</a><span aria-hidden="true">/</span><span>${esc(s.t)}</span></div>
    <h1 class="kufi">${esc(s.t)}</h1><div class="meta"><span class="pill num">${cnt(s.n, 'item')}</span>${ser.length ? `<span class="pill num">${cnt(ser.length, 'series')}</span>` : ''}
    <a class="pill" href="${ORIGIN}/page/${s.id}" target="_blank" rel="noopener">القسم في الموقع الأصلي ↗</a></div></div></div>
    <div class="wrap" style="padding-block:24px"><h2 class="sr-only">محتوى القسم</h2>${body || '<div class="empty-note">لا توجد مواد في هذا القسم.</div>'}</div>`;
}
function viewText(k) {
  const t = textByKey[k]; if (!t) return notFound();
  const sec = secByKey[catSection[t.ids[0]]];
  const a = hyear(t.r0), b = hyear(t.r1);
  const items = t.ids.map((id, i) => {
    const c = C[id], y = yearsLabel(c);
    return `<a class="exp" href="#c-${id}"><span class="no num" aria-hidden="true">${N(i + 1)}</span>
      <div><h3>${esc((t.h && t.h[id]) || c.t)}</h3>${t.h && t.h[id] && !t.h[id].startsWith(c.t) ? `<div class="full">${esc(c.t)}</div>` : ''}${t.note && t.note[id] ? `<div class="full">ضمن ${esc(t.note[id])}</div>` : ''}
      <div class="chips num"><span>${cnt(c.n, 'lesson')}</span>${y ? `<span>${y}</span>` : ''}${secByKey[catSection[id]] !== sec ? `<span>${esc(secByKey[catSection[id]].t)}</span>` : ''}</div></div></a>`;
  }).join('');
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span>${sec ? `<a href="#s-${sec.key}">${esc(sec.t)}</a><span aria-hidden="true">/</span>` : ''}<span>${esc(t.t)}</span></div>
    <h1>${esc(t.t)}</h1><p class="byline">${esc(t.by)}</p><p class="byline sheikh">شروح فضيلة الشيخ <b>ماهر بن ظافر القحطاني</b> حفظه الله</p>
    <div class="meta"><span class="pill num">${cnt(t.ids.length, 'sharh')}</span><span class="pill num">${cnt(t.n, 'lesson')}</span>${a ? `<span class="pill">${a === b ? Y(a) : Y(a) + '–' + Y(b)}هـ</span>` : ''}</div>
    <p style="color:var(--muted);max-width:68ch;margin:12px 0 0;font-size:.92rem">شرح الشيخ هذا الكتاب أكثر من مرة، في أماكن وأعوام مختلفة. اختر الشرح الذي تريد متابعته؛ الترتيب من الأقدم إلى الأحدث.</p></div></div>
    <div class="wrap" style="padding-block:24px"><h2 class="sr-only">الشروح</h2><div class="exps">${items}</div></div>`;
}
const chapterName = c => c.t.replace(/^\s*\[[^\]]+\]\s*/, '').replace(/^[-–]\s*/, '');
const liveKids = c => c.kids.map(k => C[k]).filter(k => k && k.n);
function emptyKids(c, depth = 0, out = []) {  // chapters the original site lists with no lessons yet, in book order
  c.kids.map(k => C[k]).filter(Boolean).forEach(k => { if (!k.n) out.push(k); else if (depth < 4) emptyKids(k, depth + 1, out); });
  return out;
}
// whose lessons these are, under every series title: «شرح» for explanations of a book, «لفضيلة» otherwise
const byline = c => `<p class="byline sheikh">${/^\s*(\[[^\]]*\]\s*)?(شرح|التعليق|الدورة العلمية في شرح|تفسير)/.test(c.t) ? 'شرح ' : 'ل'}فضيلة الشيخ <b>ماهر بن ظافر القحطاني</b> حفظه الله</p>`;
function chaptersNav(root, current, asked = current) {
  const item = (c, depth) => `<a href="#c-${c.id}" ${c.id === current ? 'aria-current="true"' : ''}><span>${esc(chapterName(c))}</span><span class="c num">${N(c.n)}</span></a>
    ${depth < 4 && liveKids(c).length ? `<div class="sub">${liveKids(c).map(k => item(k, depth + 1)).join('')}</div>` : ''}`;
  const empty = emptyKids(root);
  const folded = empty.length ? `<details class="empties"${empty.some(k => k.id === asked) ? ' open' : ''}><summary>أبواب لم تُرفع دروسها بعد <span class="num">(${N(empty.length)})</span></summary>
    <ul>${empty.map(k => `<li${k.id === asked ? ' aria-current="true"' : ''}>${esc(chapterName(k))}</li>`).join('')}</ul></details>` : '';
  return `<nav class="chapters" aria-label="الأبواب"><h2>أبواب الكتاب</h2><a href="#c-${root.id}" ${root.id === current ? 'aria-current="true"' : ''}><span>الكل</span><span class="c num">${N(root.n)}</span></a>${liveKids(root).map(k => item(k, 0)).join('')}${folded}</nav>`;
}
// ---------- video tools on a series page: search the titles, sort ----------
let vlist = null;
const videoCard = ([v, i]) => { const [vid, vt, vd] = Array.isArray(v) ? v : [v], w = vheard.has(vid), at = !w && vresume[vid];
  return `<a class="video${w ? ' watched' : ''}" href="https://www.youtube.com/watch?v=${esc(vid)}" target="_blank" rel="noopener" data-vid="${esc(vid)}"><div class="th" style="background-image:url(https://i.ytimg.com/vi/${esc(vid)}/mqdefault.jpg)">${I.yt}${w ? '<i class="seen">شوهد</i>' : at ? `<i class="seen num">${fmt(at)}</i>` : ''}</div><span>${vt ? esc(vt) : `مقطع ${N(i + 1)}`}</span>${vd ? `<small class="num">${hdate(vd)}</small>` : ''}</a>`; };
function videoTools() {
  return `<div class="list-tools" role="search" aria-label="أدوات قائمة المقاطع">
    <label class="field">${I.search}<input type="search" id="videoQ" placeholder="ابحث في عناوين ${N(vlist.rows.length)} مقطعاً" autocomplete="off" aria-label="ابحث في مقاطع هذه السلسلة"></label>
    <select id="videoSort" aria-label="ترتيب المقاطع">
      <option value="site">ترتيب السلسلة</option>
      ${vlist.dated ? '<option value="new">الأحدث نشراً أولاً</option><option value="old">الأقدم نشراً أولاً</option>' : '<option value="rev">عكس الترتيب</option>'}
    </select>
    <span class="count num" id="videoCount" aria-live="polite"></span>
  </div>`;
}
function videoRows(fresh) {
  const q = fresh ? '' : norm($('#videoQ')?.value || ''), terms = q ? q.split(' ') : [];
  let rows = vlist.rows.filter(m => !terms.length || terms.every(t => (m.n ??= norm(Array.isArray(m[0]) ? m[0][1] || '' : '')).includes(t)));
  const sort = fresh ? 'site' : $('#videoSort')?.value || 'site';
  if (sort === 'rev') rows = rows.slice().reverse();
  if (sort === 'new' || sort === 'old') {  // undated videos go last either way
    const d = m => (Array.isArray(m[0]) && m[0][2]) || '';
    rows = rows.slice().sort((a, b) => !d(a) - !d(b) || (sort === 'new' ? d(b).localeCompare(d(a)) : d(a).localeCompare(d(b))));
  }
  return { rows, terms };
}
function videoList(fresh) {
  if (!vlist) return '';
  const { rows, terms } = videoRows(fresh);
  const box = !fresh && $('#videoCount'); if (box) box.textContent = terms.length ? `${N(rows.length)} من ${N(vlist.rows.length)}` : '';
  return rows.length ? paged(rows, videoCard, 48) : `<div class="empty-note" style="grid-column:1/-1">لا توجد مقاطع تطابق البحث.</div>`;
}
function refreshVideos() { const box = $('#videoList'); if (box) { box.innerHTML = videoList(); markVideo(); } }
// ---------- lesson tools on a series page: search within it, sort, only what I haven't heard ----------
let list = null;
const sortPref = () => { const v = store.get('sort', 'book'); return ['book', 'new', 'old'].includes(v) ? v : 'book'; };
function lessonTools(rows, plain) {
  const s = sortPref();
  return `<div class="list-tools" role="search" aria-label="أدوات قائمة الدروس">
    <label class="field">${I.search}<input type="search" id="lessonQ" placeholder="${plain ? `ابحث في ${N(rows.length)} مادة` : `ابحث في ${N(rows.length)} درساً، أو اكتب رقم الدرس`}" autocomplete="off" aria-label="${plain ? 'ابحث في مواد هذا القسم' : 'ابحث في دروس هذه السلسلة'}"></label>
    <select id="lessonSort" aria-label="ترتيب الدروس">
      <option value="book"${s === 'book' ? ' selected' : ''}>${plain ? 'ترتيب الموقع الأصلي' : 'ترتيب الكتاب'}</option>
      <option value="new"${s === 'new' ? ' selected' : ''}>الأحدث نشراً أولاً</option>
      <option value="old"${s === 'old' ? ' selected' : ''}>الأقدم نشراً أولاً</option>
    </select>
    <label class="toggle"><input type="checkbox" id="lessonUnheard"> لم أستمع إليها</label>
    <span class="count num" id="lessonCount" aria-live="polite"></span>
  </div>`;
}
function listRows(fresh) {
  const q = fresh ? '' : norm($('#lessonQ')?.value || ''), only = !fresh && $('#lessonUnheard')?.checked, sort = fresh || !$('#lessonSort') ? sortPref() : $('#lessonSort').value;
  const terms = q ? q.split(' ') : [], num = !list.plain && /^\d+$/.test(q) ? Number(q) : 0;
  let rows = list.rows.filter(m => (!only || !heard.has(m.l[0])) && (!terms.length || m.pos === num || terms.every(t => (m.n ??= norm(m.l[1] + ' ' + (m.g ? m.g.t : ''))).includes(t))));
  if (sort !== 'book') {
    const key = m => (m.l[3] || '') + String(m.l[0]).padStart(8, '0');
    rows = rows.slice().sort((a, b) => sort === 'new' ? (key(a) < key(b) ? 1 : -1) : (key(a) < key(b) ? -1 : 1));
  }
  return { rows, terms, only, flat: sort !== 'book' || terms.length > 0 || only };
}
function lessonList(fresh) {
  if (!list) return '';
  const { rows, terms, only, flat } = listRows(fresh);
  const box = $('#lessonCount');
  if (box && !fresh) box.textContent = terms.length || only ? `${N(rows.length)} من ${N(list.rows.length)}` : '';
  if (!rows.length) return `<div class="empty-note">لا توجد دروس تطابق البحث.</div>`;
  let lastG;
  if (list.plain) return paged(rows, m => lessonRow(m.l, null, list.q), 60);
  return paged(rows, m => {
    m.flat = flat;
    const head = !flat && m.g !== lastG ? (m.g ? `<div class="group-title"><a href="#c-${m.g.id}">${esc(m.g.t)}</a></div>` : '') : '';
    lastG = m.g;
    return head + lessonRow(m.l, m.g ? m.g.id : list.id, list.q, m);
  }, 60);
}
function refreshList() {
  const box = $('#lessonList'); if (!box || !list) return;
  box.innerHTML = lessonList(); fixLinks(box); markPlaying();
}
function collectLessons(c, seen = new Set()) {
  if (!c || seen.has(c.id)) return []; seen.add(c.id);
  return [...c.l, ...c.kids.flatMap(k => collectLessons(C[k], seen))];
}
function viewCat(id, asking) {
  if (!C[id]) return notFound();
  const asked = C[id], top = crumbsFor(id)[0];
  if (!asked.n && asked.up != null && top.n) return viewCat(top.id, id).replace('<!--note-->', `<p class="notice">لم تُرفع دروس «${esc(chapterName(asked))}» بعد، فهذه أبواب الكتاب التي فيها دروس. <a href="${origCat(asked)}" target="_blank" rel="noopener">تحقق في الموقع الأصلي ↗</a></p>`);
  const c = asked; list = null;
  recent = [id, ...recent.filter(x => x !== id)].slice(0, 6); store.set('recent', recent);
  const chain = crumbsFor(id), root = chain[0];
  const sec = secByKey[catSection[root.id]];
  const all = collectLessons(c);
  const audioCount = all.filter(l => l[2] && !isPdf(l[2])).length;
  const done = all.filter(l => heard.has(l[0])).length;
  const isVideo = c.v.length || (sec && sec.key === 'videos');
  let body = '';
  vlist = c.v.length ? { id: c.id, rows: c.v.map((v, i) => [v, i]), dated: c.v.some(v => Array.isArray(v) && v[2]) } : null;
  if (c.v.length) body += videoStage(c) + (c.v.length >= 15 ? videoTools() : '') + `<div class="videos" id="videoList">${videoList(true)}</div>`;
  const groups = [];
  if (c.l.length) groups.push([null, c.l]);
  const addKids = (cc, seen = new Set([cc.id])) => cc.kids.forEach(k => { const kc = C[k]; if (!kc || seen.has(k)) return; seen.add(k); if (kc.l.length) groups.push([kc, kc.l]); addKids(kc, seen); });
  addKids(c);
  if (groups.length) {
    const rows = [];
    numberLessons(groups).forEach(([g, ls]) => ls.forEach(m => { m.g = g; rows.push(m); }));
    list = { id: c.id, q: 'c-' + c.id, rows };
    body += (rows.length >= 15 ? lessonTools(rows) : '') + `<div class="lessons" id="lessonList">${lessonList(true)}</div>`;
  }
  if (c.a.length) body += `<div class="lessons">${paged(c.a, articleRow, 40)}</div>`;
  if (!body) body = `<div class="lessons"><div class="empty-note">لا توجد دروس في هذا الباب حالياً.<br><a href="${origCat(c)}" target="_blank" rel="noopener" style="color:var(--brand)">تحقق في الموقع الأصلي ↗</a></div></div>`;
  const yrs = yearsLabel(c);
  const showNav = root.kids.length > 0;
  return `<div class="page-head"><div class="wrap">
    <div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span>${sec ? `<a href="#s-${sec.key}">${esc(sec.t)}</a><span aria-hidden="true">/</span>` : ''}${textOf[root.id] ? `<a href="#t-${textOf[root.id].k}">${esc(textOf[root.id].t)}</a><span aria-hidden="true">/</span>` : ''}${chain.slice(0, -1).map(x => `<a href="#c-${x.id}">${esc(x.t)}</a><span aria-hidden="true">/</span>`).join('')}</div>
    <h1>${esc(c.t)}</h1>${byline(c)}<!--note-->
    ${textOf[root.id] && root.id === c.id ? `<nav class="others" aria-label="شروح أخرى لهذا الكتاب"><span>شروح أخرى لـ«${esc(textOf[root.id].t)}»:</span>${textOf[root.id].ids.filter(i => i !== c.id).map(i => `<a href="#c-${i}">${esc(expLabel(C[i]))}</a>`).join('')}</nav>` : ''}
    <div class="meta"><span class="pill num">${cnt(c.n, isVideo ? 'clip' : 'lesson')}</span>${liveKids(c).length ? `<span class="pill num">${cnt(liveKids(c).length, 'chapter')}</span>` : ''}${yrs ? `<span class="pill">${yrs}</span>` : ''}
      </div>
    ${c.src ? `<p style="color:var(--muted);max-width:68ch;margin:12px 0 0;font-size:.92rem">مجالس الشيخ المسجّلة من البث المباشر على قناة جامع الراجحي بمكة في يوتيوب، مرتبة حسب تاريخ البث.</p>` : ''}
    ${c.x && !c.src ? `<p style="color:var(--muted);max-width:68ch;margin:12px 0 0;font-size:.92rem">دروس منشورة في القائمة العامة لقسم «${esc(secByKey[catSection[c.id]]?.t || '')}»، جُمعت هنا حسب اسم الكتاب والدورة التي سُجّلت فيها لتسهيل متابعتها.</p>` : ''}
    <div class="toolbar">
      ${audioCount ? `<button class="btn primary" type="button" data-playall="c-${c.id}">${I.play} استمع من البداية</button>` : ''}
      ${c.v.length > 1 ? `<button class="btn primary" type="button" data-vplay="all">${I.play} شاهد المقاطع متتابعة</button>
        ${vpos[c.id] && c.v.some(v => vidOf(v) === vpos[c.id]) ? `<button class="btn" type="button" data-vplay="cont">تابع من حيث توقفت</button>` : ''}
        <a class="btn" href="https://www.youtube.com/watch_videos?video_ids=${c.v.slice(0, 50).map(vidOf).map(encodeURIComponent).join(',')}" target="_blank" rel="noopener">${I.ext} ${c.v.length > 50 ? 'أول ٥٠ مقطعاً على يوتيوب' : 'شغّلها على يوتيوب'}</a>` : ''}
      ${audioCount ? `<button class="btn" type="button" data-continue="c-${c.id}">${spos.some(e => e.k === 'c-' + root.id) ? 'تابع من حيث توقفت' : 'تابع أول درس لم تسمعه'}</button>` : ''}
      <button class="btn" type="button" data-save="${c.id}" aria-pressed="${saved.has(c.id)}">${I.bookmark} ${saved.has(c.id) ? 'محفوظ' : 'احفظ'}</button>
      <a class="btn" href="${origCat(c)}" target="_blank" rel="noopener">${I.ext} ${c.src ? 'قناة الجامع على يوتيوب' : 'في الموقع الأصلي'}</a>
    </div>
    ${audioCount ? `<div class="progress" title="${N(done)} من ${N(audioCount)}"><i style="width:${(done / audioCount * 100).toFixed(1)}%"></i></div><div style="font-size:.8rem;color:var(--muted);margin-top:4px">${N(done)} من ${N(audioCount)} درساً استمعت إليه</div>` : ''}
  </div></div>
  <div class="wrap">${showNav ? `<div class="layout">${chaptersNav(root, c.id, asking)}<div>${body}</div></div>` : `<div style="padding-block:24px">${body}</div>`}</div>`;
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
  const hits = getSearchIndex().filter(x => terms.every(t => x.n.includes(t)));
  const texts = hits.filter(h => h.type === 'text').map(h => textByKey[h.k]).filter(Boolean);
  const cats = hits.filter(h => h.type === 'cat').map(h => C[h.id]).filter(c => c && (c.n || c.up == null)).sort((a, b) => (a.n ? 0 : 1) - (b.n ? 0 : 1) || (a.up == null ? 0 : 1) - (b.up == null ? 0 : 1) || b.n - a.n);
  const items = hits.filter(h => h.type === 'item').map(h => [h.id, lessonIndex.get(h.id)]);
  const mark = t => { let s = esc(t); return s; };
  let html = '';
  if (cats.length || texts.length) html += `<div class="results-group"><h2>الكتب والأبواب: ${cnt(cats.length + texts.length, 'result')}</h2><div class="series-list">${texts.map(textCard).join('')}${cats.slice(0, 30).map(c => bookCard(c)).join('')}</div></div>`;
  if (items.length) html += `<div class="results-group"><h2>الدروس والمقالات: ${cnt(items.length, 'result')}</h2><div class="lessons">${paged(items, ([id, v]) => {
    if (v.a) return articleRow(v.a);
    const where = v.cat ? `<a href="#c-${v.cat}">${esc(C[v.cat].t)}</a>` : `<a href="#s-${v.sec}">${esc(secByKey[v.sec].t)}</a>`;
    if (!v.l[2]) return lessonRow(v.l);
    const pdf = isPdf(v.l[2]);
    return `<div class="lesson" data-id="${id}">${pdf ? `<a class="play" href="${esc(v.l[2])}" target="_blank" rel="noopener" aria-label="فتح">${I.pdf}</a>` : `<button class="play" type="button" data-play="${id}" data-q="${v.cat ? 'c-' + v.cat : 's-' + v.sec}" aria-label="تشغيل">${I.play}</button>`}
      <div><div class="t">${mark(v.l[1])}</div><div class="sub">${where}${v.l[3] ? `<span>${hdate(v.l[3])}</span>` : ''}</div></div>
      <div class="acts">${pdf ? '' : `<button type="button" data-mylist="${id}" aria-pressed="${mylist.includes(id)}" aria-label="أضف إلى قائمتي">${I.addq}</button>`}<a href="${esc(v.l[2])}" target="_blank" rel="noopener" aria-label="تنزيل">${I.dl}</a><a href="${origItem(id)}" target="_blank" rel="noopener" aria-label="في الموقع الأصلي">${I.ext}</a></div></div>`;
  }, 60)}</div></div>`;
  return html || `<div class="empty-note">لا نتائج لـ «${esc(q)}». جرّب كلمة أقصر أو بدون ال التعريف.</div>`;
}
function viewMine() {
  const sv = [...saved].map(id => C[id]).filter(Boolean), rc = recent.map(id => C[id]).filter(Boolean);
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span><span>متابعتي</span></div><h1 class="kufi">متابعتي</h1>
    <p style="color:var(--muted)">تُحفظ في هذا المتصفح فقط: أين توقفت في كل سلسلة، وقائمتك، والكتب المحفوظة، وآخر ما فتحته، والدروس التي علّمتها مسموعة (${N(heard.size)}).</p></div></div>
    <div class="wrap">
    ${listening(12) ? `<section class="block"><div class="block-head"><h2>تابع الاستماع</h2></div><div class="series-list">${listening(12)}</div></section>` : ''}
    <section class="block"><div class="block-head"><h2>قائمتي</h2><div class="toolbar" id="myTools">${myTools()}</div></div>
      <div id="myList">${myListBody()}</div></section>
    <section class="block"><div class="block-head"><h2>الكتب المحفوظة</h2></div>${sv.length ? `<div class="series-list">${sv.map(c => bookCard(c, true)).join('')}</div>` : '<p style="color:var(--muted)">لم تحفظ شيئاً بعد. اضغط «احفظ» في صفحة أي كتاب.</p>'}</section>
    <section class="block"><div class="block-head"><h2>آخر ما فتحته</h2></div>${rc.length ? `<div class="series-list">${rc.map(c => bookCard(c)).join('')}</div>` : '<p style="color:var(--muted)">لا شيء بعد.</p>'}</section></div>`;
}
// ---------- continue listening: one card per series, where it was left ----------
const seriesKey = id => { const v = lessonIndex.get(id); return v && v.cat ? 'c-' + crumbsFor(v.cat)[0].id : v && v.sec ? 's-' + v.sec : ''; };
function listening(max) {
  return spos.slice(0, max).map(e => {
    const v = lessonIndex.get(e.id); if (!playable(v && v.l)) return '';
    const c = e.k.startsWith('c-') ? C[Number(e.k.slice(2))] : null, s = c ? null : secByKey[e.k.slice(2)];
    if (!c && !s) return '';
    const all = (c ? collectLessons(c) : s.l).filter(playable), done = all.filter(l => heard.has(l[0])).length, at = resume[e.id];
    return `<div class="resume-card"><button class="play" type="button" data-resume="${esc(e.k)}" aria-label="تابع الاستماع: ${esc(lessonTitle(v.l[1]))}">${I.play}</button>
      <div><a class="t" href="#${esc(e.k)}">${esc(c ? c.t : s.t)}</a>
      <div class="sub"><span>${esc(lessonTitle(v.l[1]))}</span>${at ? `<span class="num">توقفت عند ${fmt(at)}</span>` : ''}</div>
      <div class="progress" title="${N(done)} من ${N(all.length)}"><i style="width:${all.length ? (done / all.length * 100).toFixed(1) : 0}%"></i></div>
      <div class="sub num">${N(done)} من ${N(all.length)} درساً</div></div></div>`;
  }).join('');
}
function noteSeries(id) {
  const k = seriesKey(id); if (!k) return;
  spos = [{ k, id }, ...spos.filter(x => x.k !== k)].slice(0, 20); store.set('spos', spos);
}
// ---------- my list: lessons from any series, played in the order they were added ----------
const myLessons = () => mylist.map(id => lessonIndex.get(id)?.l).filter(playable);
function myTools() {
  return myLessons().length ? `<button class="btn primary" type="button" data-playall="m">${I.play} استمع للقائمة</button><button class="btn" type="button" data-myclear="1">${I.x} أفرغ القائمة</button>` : '';
}
function myListBody() {
  const ls = myLessons();
  if (!ls.length) return `<p style="color:var(--muted)">أضف أي درس بزر ${I.addq.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:middle"')} بجانبه، ثم استمع للقائمة متتابعة.</p>`;
  return `<div class="lessons">${ls.map((l, i) => {
    const v = lessonIndex.get(l[0]), id = l[0];
    const where = v.cat ? `<a href="#c-${v.cat}">${esc(C[v.cat].t)}</a>` : `<a href="#s-${v.sec}">${esc(secByKey[v.sec].t)}</a>`;
    return `<div class="lesson ${heard.has(id) ? 'heard' : ''}" data-id="${id}"><button class="play" type="button" data-play="${id}" data-q="m" aria-label="تشغيل">${I.play}</button>
      <div><div class="t">${esc(lessonTitle(l[1]))}</div><div class="sub"><span class="num">${N(i + 1)}</span>${where}${resume[id] ? `<span>توقفت عند ${fmt(resume[id])}</span>` : ''}</div></div>
      <div class="acts">${i ? `<button type="button" data-mymove="${id}" data-dir="-1" aria-label="قدّمه في القائمة">${I.up}</button>` : ''}${i < ls.length - 1 ? `<button type="button" data-mymove="${id}" data-dir="1" aria-label="أخّره في القائمة">${I.down}</button>` : ''}
      <button type="button" data-mylist="${id}" aria-label="احذفه من قائمتي">${I.x}</button></div></div>`;
  }).join('')}</div>`;
}
function setMine(next) {
  mylist = next; store.set('mylist', mylist);
  document.querySelectorAll('[data-mylist]').forEach(b => { if (!b.closest('#myList')) b.setAttribute('aria-pressed', mylist.includes(Number(b.dataset.mylist))); });
  if (cur) $('#qMine').setAttribute('aria-pressed', mylist.includes(cur[0]));
  const box = $('#myList'); if (box) { box.innerHTML = myListBody(); $('#myTools').innerHTML = myTools(); fixLinks(box); markPlaying(); }
}
// ---------- the weekly lesson schedule (read nightly from the original home page) ----------
// approximate prayer times for the mosque in Jeddah (Umm al-Qura's Fajr angle; Asr at one shadow length), in minutes after midnight, Makkah time
const JED = { lat: 21.55, lng: 39.2, tz: 3 };
function prayerTimes(y, m, d) {
  const rad = x => x * Math.PI / 180, deg = x => x * 180 / Math.PI, fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), jd0 = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + 2 - A + Math.floor(A / 4) - 1524.5 - JED.lng / (15 * 24);
  const sun = t => {
    const D = jd0 + t / 24 - 2451545, g = fix(357.529 + .98560028 * D, 360), q = fix(280.459 + .98564736 * D, 360);
    const L = fix(q + 1.915 * Math.sin(rad(g)) + .02 * Math.sin(rad(2 * g)), 360), e = 23.439 - .00000036 * D;
    const ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
    return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - ra };
  };
  const noon = t => fix(12 - sun(t).eqt, 24);
  const at = (angle, t, ccw) => { const { decl } = sun(t); const x = 1 / 15 * deg(Math.acos((-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(JED.lat))) / (Math.cos(rad(decl)) * Math.cos(rad(JED.lat))))); return noon(t) + (ccw ? -x : x); };
  const asrAngle = t => -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(JED.lat - sun(t).decl))))));
  const local = h => Math.round((h + JED.tz - JED.lng / 15) * 60);
  return { fajr: local(at(18.5, 5, true)), dhuhr: local(noon(12)), asr: local(at(asrAngle(15), 15)), maghrib: local(at(.833, 18)) };
}
const makkahNow = () => { const d = new Date(Date.now() + 3 * 3600e3); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), day: (d.getUTCDay() + 1) % 7, min: d.getUTCHours() * 60 + d.getUTCMinutes(), t: d }; };
const dayDate = (now, k) => { const t = new Date(now.t.getTime() + k * 864e5); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
const clock = min => { const h = Math.floor(min / 60), m = min % 60, pm = h >= 12; return `${N(((h + 11) % 12) + 1)}:${N(m).padStart(2, '٠')} ${pm ? 'م' : 'ص'}`; };
const inMin = n => n < 60 ? `بعد ${N(n)} دقيقة` : `بعد ${N(Math.floor(n / 60))} س${n % 60 ? ` و${N(n % 60)} د` : ''}`;
const schedCells = d => { const seen = new Set(); return SCH.cells.filter(x => x.d[0] <= d && d <= x.d[1]).sort((a, b) => a.c[0] - b.c[0]).filter(x => !seen.has(x) && seen.add(x)); };
const slotName = x => x.c[1] > x.c[0] ? (x.d[0] === 6 ? 'بعد صلاة الجمعة' : SCH.cols.slice(x.c[0], x.c[1] + 1).join(' و')) : SCH.cols[x.c[0]];
// the start of a cell's session on a given day, from that day's prayer times; Friday's is after the Friday prayer
function slotStart(x, date, day) {
  const p = prayerTimes(date.y, date.m, date.d);
  if (day === 6 && x.c[1] > x.c[0]) return p.dhuhr;
  return [p.fajr, p.asr, p.maghrib][x.c[0]] ?? p.maghrib;
}
// the lesson on now, or the next one: up to a week ahead
function nextLesson() {
  const now = makkahNow();
  for (let k = 0; k < 8; k++) {
    const day = (now.day + k) % 7, date = dayDate(now, k);
    for (const x of schedCells(day)) {
      const st = slotStart(x, date, day), left = k * 1440 + st - now.min;
      if (left > -60) return { x, k, day, st, left };
    }
  }
  return null;
}
const dayRange = x => x.d[0] === x.d[1] ? '' : `من ${SCH.days[x.d[0]]} إلى ${SCH.days[x.d[1]]}`;
const schedRef = r => r.startsWith('c-') ? C[Number(r.slice(2))] : r.startsWith('t-') ? textByKey[r.slice(2)] : null;
function schedLinks(x, limit) {
  return x.l.slice(0, limit || 9).map(([r, label]) => {
    const c = schedRef(r);
    if (!c) return '';
    return `<a class="sched-link" href="#${esc(r)}" title="${esc(c.t)}"><span>${esc(label)}</span><b class="num">${cnt(c.n, 'lesson')}</b></a>`;
  }).join('');
}
// the text as the schedule writes it; inline, the names of recorded series become links in place
function schedText(x, inline) {
  const t = x.t, hits = [];
  if (inline) for (const [r, , sub] of x.l) {
    const c = schedRef(r), k = c && sub ? t.indexOf(sub) : -1;
    if (k >= 0 && !hits.some(h => k < h.e && h.k < k + sub.length)) hits.push({ k, e: k + sub.length, r, c });
  }
  hits.sort((p, q) => p.k - q.k);
  let h = '', at = 0;
  for (const { k, e, r, c } of hits) {
    h += esc(t.slice(at, k)) + `<a class="in-link" href="#${esc(r)}" title="${esc(c.t)} · ${cnt(c.n, 'lesson')}">${esc(t.slice(k, e))}</a>`;
    at = e;
  }
  return (h + esc(t.slice(at))).replace(/\n/g, '<br>');
}
function slotCard(x, day, now, nx) {
  const today = day === now.day, st = slotStart(x, today ? now : dayDate(now, (day - now.day + 7) % 7), day);
  let tag = '', cls = '';
  if (today) {
    if (now.min > st + 60) { tag = '<span class="tag done">انتهى</span>'; cls = ' done'; }
    else if (now.min >= st) { tag = '<span class="tag now">الآن تقريباً</span>'; cls = ' next'; }
    else if (nx && nx.x === x && nx.k === 0) { tag = `<span class="tag next">التالي · ${inMin(st - now.min)}</span>`; cls = ' next'; }
  }
  return `<article class="slot${cls}"><div class="slot-head"><b>${esc(slotName(x))} <span class="num">≈ ${clock(st)}</span></b>${tag}</div>
    <div class="slot-t">${schedText(x)}</div>${dayRange(x) ? `<div class="slot-days">${dayRange(x)}</div>` : ''}
    ${x.l.length ? `<div class="sched-links">${schedLinks(x)}</div>` : ''}</article>`;
}
let schedDay = null;
function schedDayBody(day) {
  const now = makkahNow(), nx = nextLesson();
  return schedCells(day).map(x => slotCard(x, day, now, nx)).join('') || '<div class="empty-note">لا دروس في هذا اليوم.</div>';
}
function liveBtn(cls) {
  return SCH.live && SCH.live_url ? `<a class="btn ${cls || ''}" href="${esc(SCH.live_url)}" target="_blank" rel="noopener">${I.live} البث المباشر</a>`
    : `<span class="btn off ${cls || ''}" aria-disabled="true" title="البث المباشر متوقف حالياً">${I.live} البث متوقف حالياً</span>`;
}
function viewSchedule() {
  if (!SCH) return notFound();
  const now = makkahNow(), nx = nextLesson();
  if (schedDay == null) schedDay = now.day;
  const p = prayerTimes(now.y, now.m, now.d);
  const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date());
  const next = nx ? `<section class="sched-next" aria-label="الدرس التالي">
      <div class="row"><span class="pill">${nx.left <= 0 ? 'الآن تقريباً' : nx.k === 0 ? 'الدرس التالي · اليوم' : nx.k === 1 ? 'الدرس التالي · غداً' : `الدرس التالي · ${SCH.days[nx.day]}`} ${esc(slotName(nx.x))}</span>
      ${nx.left > 0 ? `<span>${inMin(nx.left)}</span>` : ''}</div>
      <div class="t">${schedText(nx.x)}</div>
      <div class="row sub"><span>${esc(slotName(nx.x))} ≈ ${clock(nx.st)} بتوقيت مكة</span></div>
      <div class="acts">${liveBtn('light')}${nx.x.l.length ? schedLinks(nx.x, 2).replace(/class="sched-link"/g, 'class="sched-link light"') : ''}</div></section>` : '';
  // the week: sessions down, days across; a session that repeats is one bar across its days
  const grid = `<div class="week" role="table" aria-label="جدول الأسبوع">
    <div class="wk-corner" role="presentation"></div>
    ${SCH.days.map((d, i) => `<div class="wk-day${i === now.day ? ' today' : ''}${i === 6 ? ' fri' : ''}" role="columnheader" style="grid-column:${i + 2};grid-row:1">${esc(d)}${i === now.day ? '<small>اليوم</small>' : ''}</div>`).join('')}
    ${SCH.cols.map((c, i) => `<div class="wk-slot" role="rowheader" style="grid-row:${i + 2};grid-column:1"><b>${esc(c)}</b><small class="num">≈ ${clock([p.fajr, p.asr, p.maghrib][i])}</small></div>`).join('')}
    ${SCH.cells.map(x => {
      const isNext = nx && nx.x === x, today = x.d[0] <= now.day && now.day <= x.d[1];
      return `<div class="wk-cell${x.d[0] === 6 ? ' fri' : ''}${isNext ? ' next' : ''}${today ? ' today' : ''}" role="cell" style="grid-column:${x.d[0] + 2}/${x.d[1] + 3};grid-row:${x.c[0] + 2}/${x.c[1] + 3}">
        ${isNext ? `<span class="tag next">${nx.left <= 0 ? 'الآن تقريباً' : 'التالي'}</span>` : ''}${x.d[0] === 6 ? '<b class="fri-h">بعد صلاة الجمعة</b>' : ''}
        ${dayRange(x) ? `<div class="slot-days">${dayRange(x)}</div>` : ''}<div class="slot-t">${schedText(x, true)}</div></div>`;
    }).join('')}</div>`;
  const tel = SCH.phone ? `<a class="btn" href="tel:${esc(SCH.phone)}">اتصل</a>` : '', mail = SCH.email ? `<a class="btn" href="mailto:${esc(SCH.email)}">راسلنا بالبريد</a>` : '';
  return `<div class="page-head"><div class="wrap"><div class="crumbs"><a href="#">الرئيسية</a><span aria-hidden="true">/</span><span>جدول الدروس</span></div>
    <h1 class="kufi">جدول الدروس العلمية</h1>
    <p class="byline sheikh">لفضيلة الشيخ <b>ماهر بن ظافر القحطاني</b> حفظه الله</p>
    <p style="color:var(--muted);margin:6px 0 0">${esc(SCH.place)} · ${esc(hijri)}</p></div></div>
  <div class="wrap sched">
    ${next}
    <div class="sched-days" role="group" aria-label="أيام الأسبوع">${SCH.days.map((d, i) => `<button type="button" class="chip${i === now.day ? ' is-today' : ''}" data-sday="${i}" aria-pressed="${i === schedDay}">${esc(d)}</button>`).join('')}</div>
    <div class="sched-day" id="schedDay">${schedDayBody(schedDay)}</div>
    ${grid}
    <section class="sched-info" aria-label="الحضور والاستماع">
      ${SCH.live ? `<a class="info-card" href="${esc(SCH.live_url)}" target="_blank" rel="noopener"><span class="ic">${I.live}</span><span><b>البث المباشر</b><small>إذاعة معرفة السنن والآثار ↗</small></span></a>`
        : `<div class="info-card off" aria-disabled="true"><span class="ic">${I.live}</span><span><b>البث المباشر</b><small>متوقف حالياً، ويعود هنا حين يُستأنف</small></span></div>`}
      ${SCH.map_url ? `<a class="info-card" href="${esc(SCH.map_url)}" target="_blank" rel="noopener"><span class="ic warm">${I.pin}</span><span><b>${esc(SCH.place.replace(/^جميع الدروس (في|فى)\s*/, '')) || 'موقع المسجد'}</b><small>افتح الموقع في الخرائط ↗</small></span></a>` : ''}
      ${tel || mail ? `<div class="info-card"><span><b>للتواصل</b><small>من الموقع الأصلي</small></span><span class="acts">${mail}${tel}</span></div>` : ''}
    </section>
    <p class="sched-note">الجدول منقول من <a href="${ORIGIN}/" target="_blank" rel="noopener">الصفحة الرئيسية للموقع الأصلي</a> ويُحدَّث معه كل ليلة. الأوقات تقريبية لمدينة جدة، محسوبة من مواقيت الصلاة، وكل رابط يفتح ما سُجّل من الكتاب في المكتبة.</p>
  </div>`;
}
// the home page: today's sessions
function todayStrip() {
  if (!SCH) return '';
  const now = makkahNow(), nx = nextLesson(), cells = schedCells(now.day);
  if (!cells.length) return '';
  return `<section class="block"><div class="wrap"><div class="block-head"><h2>دروس اليوم</h2><a class="btn" href="#schedule">جدول الأسبوع</a></div>
    <div class="sched-strip">${cells.map(x => slotCard(x, now.day, now, nx)).join('')}</div></div></section>`;
}
const notFound = () => `<div class="wrap"><div class="empty-note">الصفحة غير موجودة. <a href="#" style="color:var(--brand)">العودة للرئيسية</a></div></div>`;

// ---------- router ----------
let lastQuery = '';
function route() {
  pagers = {}; closeVideo();
  const h = current();
  let html, nav = '', title = '';
  if (!h) { html = viewHome(); nav = 'home'; }
  else if (h === 'start') { html = viewStart(); nav = 'start'; }
  else if (h === 'library') { html = viewLibrary(); nav = 'library'; }
  else if (h === 'mine') { html = viewMine(); nav = 'mine'; }
  else if (h === 'schedule') { html = viewSchedule(); nav = 'schedule'; }

  else if (h === 'search') {
    if (PATH_MODE && !lastQuery) lastQuery = new URLSearchParams(location.search).get('q') || '';
    html = viewSearch(lastQuery); nav = 'search'; title = 'البحث';
  }
  else if (h.startsWith('s-')) { html = viewSection(h.slice(2)); nav = 'library'; title = secByKey[h.slice(2)]?.t; }
  else if (h.startsWith('t-')) { html = viewText(h.slice(2)); nav = 'library'; title = textByKey[h.slice(2)]?.t; }
  else if (h.startsWith('c-')) { html = viewCat(Number(h.slice(2))); nav = 'library'; title = C[Number(h.slice(2))]?.t; }
  else html = notFound();
  if (!title) title = { start: 'ابدأ من هنا', library: 'المكتبة', mine: 'متابعتي', schedule: 'جدول الدروس' }[h] || '';
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
let queue = [], qi = -1, cur = null, qkey = '';
const speeds = [1, 1.25, 1.5, 1.75, 2]; let sp = store.get('speed', 0);
const playable = l => !!(l && l[2] && !isPdf(l[2]));
// the list a play button belongs to, in the order (and with the search) the visitor has on screen
function queueFor(key) {
  if (list && list.q === key && $('#lessonList')) return listRows().rows.map(m => m.l).filter(playable);
  if (key.startsWith('c-')) return collectLessons(C[Number(key.slice(2))]).filter(playable);
  if (key.startsWith('s-')) return (secByKey[key.slice(2)]?.l || []).filter(playable);
  if (key === 'm') return myLessons();
  return [];
}
function setQueue(key, ls, i) {
  queue = ls; qi = i; qkey = key;
  store.set('queue', { k: key, ids: ls.map(l => l[0]) });
  if (!qPanel.hidden) renderQueue();
}
function playLesson(id, key) {
  const ls = queueFor(key), i = ls.findIndex(l => l[0] === id);
  if (i >= 0) setQueue(key, ls, i);
  else { const v = lessonIndex.get(id); if (!playable(v?.l)) return; setQueue('', [v.l], 0); }
  load(true);
}
// a lesson counts as heard once it reaches its last 5% or last 30 seconds
const nearEnd = () => audio.duration > 60 && (audio.currentTime >= audio.duration * .95 || audio.duration - audio.currentTime <= 30);
function savePos() {
  if (!cur || audio.currentTime <= 5) return;
  if (nearEnd()) { if (resume[cur[0]]) { delete resume[cur[0]]; store.set('resume', resume); } return; }
  resume[cur[0]] = audio.currentTime; store.set('resume', resume);
}
function setHeard(id, on) {
  if (on === heard.has(id)) return;
  on ? heard.add(id) : heard.delete(id); store.set('heard', [...heard]);
  document.querySelectorAll(`.lesson[data-id="${id}"]`).forEach(e => { e.classList.toggle('heard', on); const b = e.querySelector('[data-heard]'); if (b) b.setAttribute('aria-pressed', on); });
  document.querySelectorAll(`#qList [data-qi]`).forEach(b => { if (queue[b.dataset.qi]?.[0] === id) b.classList.toggle('heard', on); });
}
function load(autoplay) {
  const l = queue[qi]; if (!l) return;
  savePos();
  cur = l; const v = lessonIndex.get(l[0]);
  player.hidden = false; document.body.classList.add('has-player'); $('#pErr').hidden = true;
  $('#pTitle').textContent = lessonTitle(l[1]);
  const where = v && v.cat ? C[v.cat] : null;
  $('#pSeries').textContent = where ? where.t : (v && v.sec ? secByKey[v.sec].t : '');
  $('#pSeries').href = L(where ? 'c-' + where.id : (v && v.sec ? 's-' + v.sec : ''));
  $('#pDl').href = l[2]; $('#qDl').href = l[2];
  audio.src = l[2]; audio.playbackRate = speeds[sp]; audio.volume = 1;
  const startAt = resume[l[0]] || 0;
  audio.addEventListener('loadedmetadata', () => { if (startAt && startAt < audio.duration - 30) audio.currentTime = startAt; }, { once: true });
  if (autoplay) audio.play().catch(() => { });
  store.set('last', { id: l[0] }); noteSeries(l[0]);
  $('#qMine').setAttribute('aria-pressed', mylist.includes(l[0]));
  setMeta($('#pSeries').textContent);
  markPlaying();
}
// lock screen, headphones and car: the lesson's name, its series and the site's mark
function setMeta(series) {
  if (!('mediaSession' in navigator) || !cur || typeof MediaMetadata === 'undefined') return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: lessonTitle(cur[1]), artist: 'الشيخ ماهر بن ظافر القحطاني', album: series || '',
      artwork: [{ src: new URL('icon-512.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }] });
  } catch { }
}
const skip = s => { if (audio.duration) audio.currentTime = Math.max(0, Math.min(audio.duration - 1, audio.currentTime + s)); };
function markPlaying() {
  document.querySelectorAll('.lesson.playing').forEach(e => e.classList.remove('playing'));
  document.querySelectorAll('[data-play]').forEach(b => b.innerHTML = I.play);
  if (!cur) return;
  document.querySelectorAll(`.lesson[data-id="${cur[0]}"]`).forEach(e => { e.classList.add('playing'); const b = e.querySelector('[data-play]'); if (b && !audio.paused) b.innerHTML = I.pause; });
  $('#pPlay').innerHTML = audio.paused ? I.play : I.pause;
  $('#pPlay').setAttribute('aria-label', audio.paused ? 'تشغيل' : 'إيقاف مؤقت');
  document.querySelectorAll('#qList [data-qi]').forEach(b => Number(b.dataset.qi) === qi ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'));
  $('#qPos').textContent = queue.length > 1 ? `الدرس ${N(qi + 1)} من ${N(queue.length)}` : '';
}
audio.addEventListener('play', markPlaying); audio.addEventListener('pause', markPlaying);
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  $('#pSeek').value = Math.round(audio.currentTime / audio.duration * 1000);
  $('#pCur').textContent = fmt(audio.currentTime); $('#pDur').textContent = fmt(audio.duration);
  if (cur && nearEnd()) setHeard(cur[0], true);
  if (cur && (Math.floor(audio.currentTime) % 10 === 0 || nearEnd())) savePos();
  sleepTick();
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && Math.floor(audio.currentTime) % 5 === 0) {
    try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: audio.playbackRate }); } catch { }
  }
});
audio.addEventListener('ended', () => {
  if (cur) { setHeard(cur[0], true); if (resume[cur[0]]) { delete resume[cur[0]]; store.set('resume', resume); } }
  if (sleep && sleep.lesson) { setSleep(''); return; }
  if (qi < queue.length - 1) { qi++; load(true); }
});
audio.addEventListener('error', () => { if (!cur) return; const e = $('#pErr'); e.hidden = false; e.innerHTML = `تعذّر تشغيل الملف هنا. <a href="${esc(cur[2])}" target="_blank" rel="noopener">افتحه مباشرة ↗</a>`; });
$('#pPlay').onclick = () => audio.paused ? audio.play().catch(() => { }) : audio.pause();
$('#pNext').onclick = () => { if (qi < queue.length - 1) { qi++; load(true); } };
document.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => skip(Number(b.dataset.skip)));
$('#pPrev').onclick = () => { if (audio.currentTime > 8) audio.currentTime = 0; else if (qi > 0) { qi--; load(true); } };
$('#pSeek').oninput = e => { if (audio.duration) audio.currentTime = e.target.value / 1000 * audio.duration; };
const spLabel = () => { $('#pSpeed').textContent = $('#qSpeed').textContent = N(speeds[sp]) + '×'; };
$('#pSpeed').onclick = $('#qSpeed').onclick = () => { sp = (sp + 1) % speeds.length; audio.playbackRate = speeds[sp]; store.set('speed', sp); spLabel(); };
spLabel();
if ('mediaSession' in navigator) {
  const on = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { } };
  on('nexttrack', () => $('#pNext').click());
  on('previoustrack', () => $('#pPrev').click());
  on('seekbackward', d => skip(-(d && d.seekOffset || 15)));
  on('seekforward', d => skip(d && d.seekOffset || 15));
  on('seekto', d => { if (d && d.seekTime != null) audio.currentTime = d.seekTime; });
  on('play', () => audio.play().catch(() => { }));
  on('pause', () => audio.pause());
}

// ---------- the playlist panel ----------
const qPanel = $('#qPanel'), qBtn = $('#pQueue');
function renderQueue() {
  $('#qList').innerHTML = queue.map((l, i) => `<li><button type="button" data-qi="${i}" class="${heard.has(l[0]) ? 'heard' : ''}"${i === qi ? ' aria-current="true"' : ''}>
    <span class="n num">${N(i + 1)}</span><span class="t">${esc(lessonTitle(l[1]))}</span>${I.check}</button></li>`).join('');
  markPlaying();
}
function openQueue(open) {
  qPanel.hidden = !open; qBtn.setAttribute('aria-expanded', open);
  if (open) { renderQueue(); const c = $('#qList [aria-current]'); if (c) c.scrollIntoView({ block: 'center' }); $('#qClose').focus(); }
  else $('#qList').innerHTML = '';
}
qBtn.onclick = () => openQueue(qPanel.hidden);
$('#qClose').onclick = () => { openQueue(false); qBtn.focus(); };
$('#qList').onclick = e => { const b = e.target.closest('[data-qi]'); if (!b) return; const i = Number(b.dataset.qi); if (i === qi) { audio.paused ? audio.play().catch(() => { }) : audio.pause(); } else { qi = i; load(true); } };
qPanel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); openQueue(false); qBtn.focus(); } });

// ---------- sleep timer: after this lesson, or after some minutes (the last 8 seconds fade out) ----------
let sleep = null, sleepIv = 0;
function setSleep(v) {
  sleep = !v ? null : v === 'lesson' ? { lesson: true } : { at: Date.now() + Number(v) * 60000 };
  $('#qSleep').value = v; audio.volume = 1;
  qBtn.querySelector('.dot').hidden = !sleep;
  clearInterval(sleepIv); if (sleep && sleep.at) sleepIv = setInterval(sleepTick, 1000);
  sleepTick();
}
function sleepTick() {
  const left = $('#qSleepLeft');
  if (!sleep) { left.textContent = ''; return; }
  if (sleep.lesson) { left.textContent = 'يتوقف بعد انتهاء هذا الدرس'; return; }
  const ms = sleep.at - Date.now();
  if (ms <= 0) { audio.pause(); setSleep(''); left.textContent = 'توقف المؤقت'; return; }
  if (ms < 8000 && !audio.paused) audio.volume = Math.max(0, ms / 8000);
  left.textContent = 'يتوقف بعد ' + fmt(ms / 1000);
}
$('#qSleep').onchange = e => setSleep(e.target.value);
$('#qMine').onclick = () => { if (cur) setMine(mylist.includes(cur[0]) ? mylist.filter(x => x !== cur[0]) : [...mylist, cur[0]]); };

// ---------- video playlist: YouTube's player in privacy mode, on the series page ----------
let vheard = new Set(store.get('vheard', [])), vresume = store.get('vresume', {}), vpos = store.get('vpos', {});  // watched ids, id -> seconds, series -> last id
let yt = null, ytOk = false, ytNext = null, ytApi = null, vq = [], vi = -1, vIv = 0, vErrT = 0;
function vidOf(v) { return Array.isArray(v) ? v[0] : v; }
const vtitleOf = (v, i) => (Array.isArray(v) && v[1]) || `مقطع ${N(i + 1)}`;
function videoStage(c) {
  return `<div class="vstage" id="vStage" hidden><div class="vframe"><div id="ytp"></div></div>
    <div class="vbar"><div class="vinfo"><b id="vTitle"></b><span id="vPos" class="num"></span></div>
    <div class="vbtns"><button class="icon-btn" type="button" id="vPrev" aria-label="المقطع السابق">${I.up.replace('<svg', '<svg style="transform:rotate(90deg)"')}</button>
    <button class="icon-btn" type="button" id="vNext" aria-label="المقطع التالي">${I.up.replace('<svg', '<svg style="transform:rotate(-90deg)"')}</button>
    <a class="icon-btn" id="vYt" href="#" target="_blank" rel="noopener" aria-label="افتح المقطع في يوتيوب">${I.ext}</a>
    <button class="icon-btn" type="button" id="vClose" aria-label="أغلق المشغّل">${I.x}</button></div></div>
    <div class="verr" id="vErr" role="status" hidden></div></div>`;
}
function loadYT() {
  if (ytApi) return ytApi;
  ytApi = new Promise((res, rej) => {
    if (window.YT && YT.Player) return res();
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => { ytApi = null; rej(); };
    document.head.appendChild(s);
  });
  return ytApi;
}
function saveVideo() {
  if (!yt || !ytOk || !yt.getCurrentTime || vi < 0) return;
  const id = vidOf(vq[vi]), t = yt.getCurrentTime() || 0, d = yt.getDuration() || 0;
  if (d > 60 && (t >= d * .95 || d - t <= 30)) { vheard.add(id); delete vresume[id]; store.set('vheard', [...vheard]); }
  else if (t > 5) vresume[id] = t;
  store.set('vresume', vresume);
}
function markVideo() {
  document.querySelectorAll('.video[data-vid]').forEach(a => {
    const id = a.dataset.vid; a.classList.toggle('playing', vi >= 0 && vidOf(vq[vi]) === id); a.classList.toggle('watched', vheard.has(id));
  });
}
async function playVideo(i) {
  const st = $('#vStage'); if (!st || !vq[i]) return;
  clearTimeout(vErrT); saveVideo();
  vi = i; const id = vidOf(vq[i]);
  st.hidden = false; $('#vErr').hidden = true;
  $('#vTitle').textContent = vtitleOf(vq[i], vlist ? vlist.rows.findIndex(m => vidOf(m[0]) === id) : i);
  $('#vPos').textContent = vq.length > 1 ? `المقطع ${N(i + 1)} من ${N(vq.length)}` : '';
  $('#vYt').href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
  $('#vPrev').disabled = i === 0; $('#vNext').disabled = i >= vq.length - 1;
  if (vlist) { vpos[vlist.id] = id; store.set('vpos', vpos); }
  if (!audio.paused) audio.pause();
  markVideo(); st.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const start = Math.floor(vresume[id] || 0);
  try { await loadYT(); } catch { return videoError(); }
  if (!$('#ytp') && !yt) return;  // left the page while the player loaded
  if (yt && ytOk) yt.loadVideoById({ videoId: id, startSeconds: start });
  else if (yt) ytNext = { videoId: id, startSeconds: start };  // still starting up: play this one once it is ready
  else yt = new YT.Player('ytp', { host: 'https://www.youtube-nocookie.com', videoId: id,
    playerVars: { autoplay: 1, start, rel: 0, playsinline: 1, modestbranding: 1, hl: 'ar' },
    events: { onReady: () => { ytOk = true; if (ytNext) { yt.loadVideoById(ytNext); ytNext = null; } }, onStateChange: videoState, onError: videoError } });
}
function videoState(e) {
  clearInterval(vIv);
  if (e.data === 1) { if (!audio.paused) audio.pause(); vIv = setInterval(saveVideo, 5000); }
  if (e.data === 2) saveVideo();
  if (e.data === 0) {
    const id = vidOf(vq[vi]); vheard.add(id); delete vresume[id]; store.set('vheard', [...vheard]); store.set('vresume', vresume); markVideo();
    if (vi < vq.length - 1) playVideo(vi + 1);
  }
}
function videoError() {  // embedding turned off, removed, or YouTube unreachable: offer it on YouTube and move on
  const box = $('#vErr'); if (!box) return;
  const at = vi, more = vi < vq.length - 1;
  box.hidden = false; box.innerHTML = `تعذّر تشغيل هذا المقطع هنا. <a href="https://www.youtube.com/watch?v=${esc(vidOf(vq[vi]))}" target="_blank" rel="noopener">شاهده على يوتيوب ↗</a>${more ? ' ، وسيبدأ المقطع التالي بعد لحظات.' : ''}`;
  if (more) vErrT = setTimeout(() => { if (vi === at) playVideo(vi + 1); }, 6000);
}
function closeVideo() {
  clearInterval(vIv); clearTimeout(vErrT); saveVideo();
  if (yt) { try { yt.destroy(); } catch { } yt = null; } ytOk = false; ytNext = null;
  vi = -1; const st = $('#vStage'); if (st) { st.hidden = true; st.querySelector('.vframe').innerHTML = '<div id="ytp"></div>'; } markVideo();
}
function startVideos(fromId) {
  const rows = videoRows().rows; vq = rows.map(m => m[0]); if (!vq.length) return;
  let i = fromId ? vq.findIndex(v => vidOf(v) === fromId) : 0; if (i < 0) i = 0;
  playVideo(i);
}
document.addEventListener('click', e => {
  const a = e.target.closest('.video[data-vid]');
  if (a && $('#vStage') && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); startVideos(a.dataset.vid); return; }
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.vplay === 'all') startVideos();
  else if (b.dataset.vplay === 'cont') { const id = vlist && vpos[vlist.id]; startVideos(id && vheard.has(id) ? (() => { const r = videoRows().rows, k = r.findIndex(m => vidOf(m[0]) === id); return r[k + 1] ? vidOf(r[k + 1][0]) : id; })() : id); }
  else if (b.id === 'vNext') playVideo(vi + 1);
  else if (b.id === 'vPrev') playVideo(vi - 1);
  else if (b.id === 'vClose') closeVideo();
});
audio.addEventListener('play', () => { if (yt && yt.pauseVideo) try { yt.pauseVideo(); } catch { } });
addEventListener('pagehide', saveVideo);

// ---------- events ----------
document.addEventListener('click', e => {
  if (e.target.closest('a.skip')) { e.preventDefault(); app.focus(); return; }
  const t = e.target.closest('button,[data-q]'); if (!t) return;
  if (t.dataset.play) { const id = Number(t.dataset.play); if (cur && cur[0] === id) { audio.paused ? audio.play().catch(() => { }) : audio.pause(); } else playLesson(id, t.dataset.q || ''); return; }
  if (t.dataset.sday) {
    schedDay = Number(t.dataset.sday); const box = $('#schedDay'); if (box) { box.innerHTML = schedDayBody(schedDay); fixLinks(box); }
    document.querySelectorAll('[data-sday]').forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.sday) === schedDay)); return;
  }
  if (t.dataset.playall) { const k = t.dataset.playall, ls = queueFor(k); if (!ls.length) return; setQueue(k, ls, 0); load(true); return; }
  if (t.dataset.continue) {  // where this series was left, else its first lesson not yet heard
    const k = t.dataset.continue, ls = queueFor(k); if (!ls.length) return;
    const e = spos.find(x => x.k === seriesKey(ls[0][0]));
    let i = e && !heard.has(e.id) ? ls.findIndex(l => l[0] === e.id) : -1;
    if (i < 0) i = Math.max(0, ls.findIndex(l => !heard.has(l[0])));
    setQueue(k, ls, i); load(true); return;
  }
  if (t.dataset.resume) {  // a card on the home page: the same lesson and second, in the order it was being played
    const k = t.dataset.resume, e = spos.find(x => x.k === k); if (!e) return;
    const sq = store.get('queue', null);
    let ls = sq && Array.isArray(sq.ids) && sq.ids.includes(e.id) ? sq.ids.map(id => lessonIndex.get(id)?.l).filter(playable) : queueFor(k), i = ls.findIndex(l => l[0] === e.id);
    if (i < 0) { ls = queueFor(k); i = ls.findIndex(l => l[0] === e.id); }
    if (i < 0) return;
    if (heard.has(e.id) && i < ls.length - 1) i++;  // that lesson was finished: go on to the next
    setQueue(sq && sq.ids && sq.ids.includes(e.id) ? sq.k : k, ls, i); load(true); return;
  }
  if (t.dataset.mylist) { const id = Number(t.dataset.mylist); setMine(mylist.includes(id) ? mylist.filter(x => x !== id) : [...mylist, id]); return; }
  if (t.dataset.mymove) {
    const id = Number(t.dataset.mymove), i = mylist.indexOf(id), j = i + Number(t.dataset.dir); if (i < 0 || j < 0 || j >= mylist.length) return;
    const next = mylist.slice(); [next[i], next[j]] = [next[j], next[i]]; setMine(next); return;
  }
  if (t.dataset.myclear) { if (confirm('إفراغ قائمتك؟')) setMine([]); return; }
  if (t.dataset.heard) { const id = Number(t.dataset.heard); setHeard(id, !heard.has(id)); return; }
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
  if (e.target.id === 'lessonQ') { clearTimeout(window.__lt); window.__lt = setTimeout(refreshList, 150); }
  if (e.target.id === 'lessonSort') { store.set('sort', e.target.value); refreshList(); }
  if (e.target.id === 'lessonUnheard') refreshList();
  if (e.target.id === 'videoQ') { clearTimeout(window.__vt); window.__vt = setTimeout(refreshVideos, 150); }
  if (e.target.id === 'videoSort') refreshVideos();
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
  savePos(); setSleep(''); openQueue(false);
  audio.pause(); audio.removeAttribute('src'); audio.load();
  cur = null; queue = []; qi = -1; qkey = '';
  player.hidden = true; document.body.classList.remove('has-player');
  store.set('last', null); store.set('queue', null); markPlaying();
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
  if (/^(c-\d+|[st]-[\w-]+|start|library|mine|search)$/.test(legacy)) history.replaceState(null, '', L(legacy));
} else window.addEventListener('hashchange', route);

// ---------- boot ----------
function boot(data) {
  prep(data);
  $('#drawerSections').innerHTML = S.filter(s => s.n).map(s => `<a href="#s-${s.key}"><span>${esc(s.t)}</span><span class="num">${N(s.n)}</span></a>`).join('');
  fixLinks(document);
  if (data.built) $('#built').textContent = 'آخر تحديث للفهرس: ' + new Date(data.built).toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'long', day: 'numeric' });
  route();
  const last = store.get('last', null);
  if (last && playable(lessonIndex.get(last.id)?.l)) {
    const v = lessonIndex.get(last.id), sq = store.get('queue', null);
    let ls = sq && Array.isArray(sq.ids) ? sq.ids.map(id => lessonIndex.get(id)?.l).filter(playable) : [];
    if (!ls.some(l => l[0] === last.id)) ls = queueFor(v.cat ? 'c-' + v.cat : 's-' + v.sec);  // older visits saved no queue
    const i = ls.findIndex(l => l[0] === last.id);
    if (i >= 0) setQueue(sq && sq.k || '', ls, i); else setQueue('', [v.l], 0);
    load(false);
  }
}
if (window.CATALOG) boot(window.CATALOG);
else fetch(document.querySelector('meta[name="catalog"]')?.content || 'data/catalog.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(boot).catch(() => {
  // keep any pre-rendered page content; only say so when there is nothing to show
  const note = '<div class="empty-note" role="alert">تعذّر تحميل الفهرس. تحقق من الاتصال ثم حدّث الصفحة.</div>';
  if (app.dataset.prerendered) app.insertAdjacentHTML('afterbegin', note); else app.innerHTML = note;
});
})();

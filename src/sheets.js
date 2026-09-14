const SOURCES = {
  reacenti: {
    id: 'reacenti', name: "Reacenti's Collection", shortName: 'Kumu',
    spreadsheetId: '1JZZja1RyHS4JmGBzzu--W6j9lfkOUYPnD2xjagN-pC4', gid: '601608137'
  },
  exclusives: {
    id: 'exclusives', name: 'Exclusives', shortName: 'Exclusives',
    spreadsheetId: '1_h1zmnYDbR1-wZChniL0via3rIGwllFToICrPazq2UU', gid: '601608137'
  },
  concerts: {
    id: 'concerts', name: 'Concerts', shortName: 'Concerts',
    spreadsheetId: '1hkmzf16DZs5Vc0tCYg-oKXkEGHl7afzuy0B6IRpdaQ0', gid: '601608137'
  },
  misc: {
    id: 'misc', name: 'Misc Appearances', shortName: 'Misc',
    spreadsheetId: '16_op-yy6NjgTnkN44TZb-RZjVURO7I1R0LoIhOKKLSk', gid: '0'
  },
  fancams: {
    id: 'fancams', name: 'BINI Fancams', shortName: 'Fancams',
    spreadsheetId: '1Dtfcy8Be-e1wGUw4oVwJextqjGYcYQOel0O0uqyARcw', gid: '0'
  }
};

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 15000;

function csvUrl(source) {
  return `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/export?format=csv&gid=${source.gid}`;
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { cell += '"'; i++; }
      else quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v.trim())) rows.push(row);
      row = []; continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); if (row.some(v => v.trim())) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}

function clean(value = '') { return value.replace(/\s+/g, ' ').trim(); }
function tags(value = '') { return value.split(',').map(clean).filter(Boolean); }
function htmlImage(value = '') {
  const m = value.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] || null;
}
function youtubeId(url = '') {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || '';
    return u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : '') || (u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : '');
  } catch { return ''; }
}
function isVideo(row) { return Boolean(clean(row.duration) || clean(row.link) || clean(row.ORIGINAL)); }

function normalizeRow(row, source, index) {
  const link = clean(row.link), original = clean(row.ORIGINAL);
  const url = link || original || null;
  const thumbFromDescription = htmlImage(row.description);
  const yt = youtubeId(url || '');
  return {
    id: clean(row.uid) || `${source.id}-${index}`,
    sourceId: source.id,
    sourceName: source.name,
    type: isVideo(row) ? 'video' : 'article',
    title: clean(row.title),
    chapter: clean(row.chapter),
    duration: clean(row.duration) || null,
    description: row.description || '',
    tags: tags(row.tags),
    thumbnail: clean(row.thumbnail) || null,
    descriptionImage: thumbFromDescription,
    youtubeId: yt || null,
    date: clean(row.date) || null,
    year: Number((clean(row.date) || '').slice(0, 4)) || null,
    url,
    originalUrl: original || null,
    linkUrl: link || null
  };
}

function sortVideos(videos) {
  return [...videos].sort((a,b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0) || a.title.localeCompare(b.title, undefined, {numeric:true,sensitivity:'base'}));
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const r = await fetch(url, {signal: controller.signal, headers: {'User-Agent':'BINI-Vault/1.0'}});
    if (!r.ok) throw new Error(`Google Sheets returned HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(timer); }
}

export function getSources() { return Object.values(SOURCES).map(({spreadsheetId,gid,...publicSource}) => publicSource); }

export async function fetchSource(sourceId, {force=false}={}) {
  const source = SOURCES[sourceId];
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  const existing = cache.get(sourceId);
  if (!force && existing && Date.now() - existing.cachedAt < CACHE_TTL) return {...existing.data, cached:true};
  const raw = parseCSV(await fetchText(csvUrl(source)));
  const normalized = raw.map((r,i) => normalizeRow(r, source, i));
  const videos = sortVideos(normalized.filter(v => v.type === 'video'));
  const data = {
    source: getSources().find(v => v.id === sourceId),
    count: normalized.length, videoCount: videos.length,
    articleCount: normalized.length - videos.length, videos,
    articles: normalized.filter(v => v.type === 'article'),
    fetchedAt: new Date().toISOString()
  };
  cache.set(sourceId, {cachedAt: Date.now(), data});
  return {...data, cached:false};
}

export async function fetchCatalog({sources, q='', tag='', year='', page=1, limit=24, sort='newest'}={}) {
  const ids = (sources?.length ? sources : Object.keys(SOURCES));
  const results = await Promise.all(ids.map(id => fetchSource(id)));
  const query = q.trim().toLowerCase();
  const tagQuery = tag.trim().toLowerCase();
  const yearNum = Number(year) || null;
  const seen = new Set();
  let videos = results.flatMap(r => r.videos).filter(v => {
    const uniqueKey = `${v.sourceId}:${v.id}`;
    if (seen.has(uniqueKey)) return false;
    seen.add(uniqueKey);
    if (query) {
      const hay = [v.title, v.description, v.sourceName, v.date, ...v.tags].join(' ').toLowerCase();
      if (!hay.includes(query)) return false;
    }
    if (tagQuery && !v.tags.some(t => t.toLowerCase() === tagQuery)) return false;
    if (yearNum && v.year !== yearNum) return false;
    return true;
  });
  if (sort === 'oldest') videos = [...videos].sort((a,b) => (Date.parse(a.date || '') || 0) - (Date.parse(b.date || '') || 0) || a.title.localeCompare(b.title, undefined, {numeric:true,sensitivity:'base'}));
  else if (sort === 'title') videos = [...videos].sort((a,b) => a.title.localeCompare(b.title, undefined, {numeric:true,sensitivity:'base'}));
  else videos = sortVideos(videos);
  const start = (Math.max(1, page) - 1) * limit;
  return {count: videos.length, page, limit, hasMore: start + limit < videos.length, videos: videos.slice(start, start + limit), fetchedAt:new Date().toISOString()};
}

export function getCacheInfo() { return Object.fromEntries([...cache.entries()].map(([id,v]) => [id,{cachedAt:v.cachedAt,ageMs:Date.now()-v.cachedAt,videoCount:v.data.videoCount}])); }

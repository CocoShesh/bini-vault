const state={
  source:'all',tag:'',year:'',query:'',sortMode:'newest',page:0,hasMore:true,loading:false,lastRequestedPage:0,
  videos:[],allLoaded:new Map(),selected:null,catalogCount:0,
  myList:new Set(JSON.parse(localStorage.getItem('bini-vault-list')||'[]')),
  listSnapshots:JSON.parse(localStorage.getItem('bini-vault-list-snapshots')||'{}'),
  watch:JSON.parse(localStorage.getItem('bini-vault-watch')||'{}'),
  heroIndex:0
};
const PAGE_SIZE=24;
const MEMBERS=['Jhoanna','Aiah','Colet','Maloi','Gwen','Mikha','Sheena','Stacey','OT8'];
const YEARS=['2026','2025','2024','2023','2022','2021'];
const SOURCE_LABELS={all:'Recently added',reacenti:'Kumu',exclusives:'Exclusives',concerts:'Concerts',fancams:'Fancams',misc:'Misc Appearances'};
const SOURCE_SUBTITLES={all:'The latest BINI videos from every collection.',reacenti:'Live moments and classic Kumu archives.',exclusives:'Member-only and premium BINI content.',concerts:'Concerts, stages, and special performances.',fancams:'Fan-shot moments and performance cams.',misc:'Appearances, interviews, brands, and TV features.'};
const BRAND_IMAGES=[
  '/assets/gallery/user-gallery-2.jpg','/assets/gallery/user-gallery-3.jpg','/assets/gallery/user-gallery-4.jpg','/assets/gallery/user-gallery-5.jpg','/assets/gallery/user-gallery-6.jpg','/assets/gallery/user-gallery-7.jpg','/assets/gallery/user-gallery-8.jpg','/assets/gallery/user-gallery-9.jpg','/assets/gallery/user-gallery-10.jpg','/assets/gallery/user-gallery-11.jpg','/assets/gallery/user-gallery-12.jpg','/assets/gallery/user-gallery-13.jpg'
];
const WEB_HERO_IMAGES=[
  'https://imageio.forbes.com/specials-images/imageserve/680f431996b5f710ff7bb9ad/BINI/0x0.jpg?format=jpg&height=2700&width=2160',
  'https://bini.abs-cbn.com/_next/image?q=90&url=https%3A%2F%2Fartist-images.abs-cbn.com%2Fwp-content%2Fuploads%2F2025%2F02%2F13205452%2FBINI-GROUP-PHOTO.jpg&w=2160',
  'https://pbs.twimg.com/media/HAyd0guaAAE5vwG.jpg',
  'https://media.philstar.com/photos/2024/08/29/bini_2024-08-29_23-43-16.jpg',
  'https://pbs.twimg.com/media/HDYqWzJaMAEOSUC.jpg',
  'https://media.philstar.com/photos/2026/04/12/bini-1_2026-04-12_12-35-00.jpg'
];
const WEB_HERO_BY_SOURCE={all:0,reacenti:1,exclusives:2,concerts:3,fancams:4,misc:5};
let heroTimer=null,heroRequest=0,endObserver=null;
const el={
 topbar:document.querySelector('#topbar'),home:document.querySelector('#homeBtn'),browse:document.querySelector('#browseBtn'),collections:document.querySelector('#collectionsBtn'),listNav:document.querySelector('#myListBtn'),brand:document.querySelector('#brand'),search:document.querySelector('#search'),searchInput:document.querySelector('#searchInput'),searchToggle:document.querySelector('#searchToggle'),searchClear:document.querySelector('#searchClear'),
 heroBackdrop:document.querySelector('#heroBackdrop'),heroCopy:document.querySelector('#heroCopy'),tabs:document.querySelector('#collectionTabs'),actions:document.querySelector('#filterActions'),stats:document.querySelector('#statsSection'),continueSection:document.querySelector('#continueSection'),myListSection:document.querySelector('#myListSection'),onThisDaySection:document.querySelector('#onThisDaySection'),content:document.querySelector('#content'),sentinel:document.querySelector('#sentinel'),modal:document.querySelector('#modal'),modalTitle:document.querySelector('#modalTitle'),modalTitleLarge:document.querySelector('#modalTitleLarge'),modalMeta:document.querySelector('#modalMeta'),modalDesc:document.querySelector('#modalDesc'),player:document.querySelector('#player'),modalClose:document.querySelector('#modalClose'),listBtn:document.querySelector('#listBtn'),shareBtn:document.querySelector('#shareBtn'),nextBtn:document.querySelector('#nextBtn'),toast:document.querySelector('#toast'),surpriseBtn:document.querySelector('#surpriseBtn'),statsBtn:document.querySelector('#statsBtn')
};
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function strip(v=''){const d=document.createElement('div');d.innerHTML=v;return(d.textContent||'').replace(/\s+/g,' ').trim()}
function ytId(url=''){try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.slice(1).split('/')[0]||'';return u.searchParams.get('v')||(u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:'')||(u.pathname.startsWith('/embed/')?u.pathname.split('/')[2]:'')}catch{return''}}
function isYT(url=''){return Boolean(ytId(url))}
function isDirect(url=''){return /\.(mp4|webm|ogg|m4v|mov)(\?|#|$)/i.test(url)}
function key(v){return `${v.sourceId}:${v.id}`}
function stableIndex(v=''){let h=0;for(let i=0;i<v.length;i++)h=((h<<5)-h+v.charCodeAt(i))|0;return Math.abs(h)}
function brandImage(v={}){return BRAND_IMAGES[stableIndex(`${v.sourceId||''}:${v.id||v.title||''}`)%BRAND_IMAGES.length]}
function sourceHero(v={}){return WEB_HERO_IMAGES[WEB_HERO_BY_SOURCE[v.sourceId]??stableIndex(v.sourceId||'all')%WEB_HERO_IMAGES.length]||brandImage(v)}
function saveList(){localStorage.setItem('bini-vault-list',JSON.stringify([...state.myList]));localStorage.setItem('bini-vault-list-snapshots',JSON.stringify(state.listSnapshots))}
function saveWatch(v,seconds){state.watch[key(v)]={position:Math.max(0,Math.round(seconds)),updatedAt:Date.now(),duration:v.duration||null,title:v.title,sourceName:v.sourceName,sourceId:v.sourceId,id:v.id,thumbnail:v.thumbnail,descriptionImage:v.descriptionImage,youtubeId:v.youtubeId,url:v.url,date:v.date,tags:v.tags};localStorage.setItem('bini-vault-watch',JSON.stringify(state.watch))}
function toast(msg){el.toast.textContent=msg;el.toast.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.toast.classList.add('hidden'),1800)}
function meta(v){return [v.sourceName,v.date,v.duration,...(v.tags||[]).slice(0,3)].filter(Boolean).map(esc).join('<span style="color:#676c75">•</span>')}
function techBits(v){const d=String(v.description||'');const bits=[];for(const re of [/\b(\d{3,4}p)\b/i,/\b(AVC|HEVC|AV1|vp09)\b/i,/\b(AAC LC|AAC|Opus)\b/i,/\b([0-9]+(?:\.[0-9]+)?\s*GB)\b/i]){const m=d.match(re);if(m&&!bits.includes(m[1]))bits.push(m[1])}return bits.slice(0,4)}
function sortVideos(a){const out=[...a];if(state.sortMode==='oldest')return out.sort((x,y)=>(Date.parse(x.date||'')||0)-(Date.parse(y.date||'')||0));if(state.sortMode==='title')return out.sort((x,y)=>x.title.localeCompare(y.title,undefined,{numeric:true,sensitivity:'base'}));return out.sort((x,y)=>(Date.parse(y.date||'')||0)-(Date.parse(x.date||'')||0)||x.title.localeCompare(y.title,undefined,{numeric:true,sensitivity:'base'}))}
async function api(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
function resetState(){state.page=0;state.hasMore=true;state.loading=false;state.lastRequestedPage=0;state.videos=[];state.catalogCount=0}
function currentMatches(){const q=state.query.trim().toLowerCase();return [...state.allLoaded.values()].filter(v=>{if(state.source!=='all'&&v.sourceId!==state.source)return false;if(state.tag&&!(v.tags||[]).some(t=>t.toLowerCase()===state.tag.toLowerCase()))return false;if(state.year&&String(v.year||String(v.date||'').slice(0,4))!==String(state.year))return false;if(q&&!(`${v.title} ${v.description||''} ${(v.tags||[]).join(' ')}`.toLowerCase().includes(q)))return false;return true})}
function firstMatchingLoaded(){return sortVideos(currentMatches())[0]||null}
async function loadPage(reset=false){
 if(state.loading)return;if(!reset&&!state.hasMore)return;if(!reset&&state.lastRequestedPage===state.page+1)return;
 if(reset){resetState()}
 state.loading=true;const requestedPage=state.page+1;state.lastRequestedPage=requestedPage;
 try{
  const p=new URLSearchParams({page:String(requestedPage),limit:String(PAGE_SIZE),sort:state.sortMode});if(state.source!=='all')p.set('sources',state.source);if(state.query)p.set('q',state.query);if(state.tag)p.set('tag',state.tag);if(state.year)p.set('year',state.year);
  const data=await api(`/api/videos?${p}`);state.page=data.page;state.hasMore=data.hasMore;state.catalogCount=data.count;
  for(const v of data.videos)state.allLoaded.set(key(v),v);
  if(reset){state.videos=[...data.videos];renderAll()}else{state.videos.push(...data.videos);appendGridCards(data.videos);renderStats();renderOnThisDay()}
  const hero=firstMatchingLoaded();if(hero)setHero(hero);
 }catch(e){console.error(e);if(reset)el.content.innerHTML=`<div class="empty">Couldn’t connect to BINI Vault API.<br><small>${esc(e.message)}</small></div>`;else toast('Couldn’t load more videos')}
 finally{state.loading=false;el.sentinel.textContent=state.hasMore?'':'You’ve reached the end of this view.'}
}
function collectionName(){return SOURCE_LABELS[state.source]||'BINI Videos'}
function setSource(source){state.source=source;state.tag='';state.year='';state.query='';state.page=0;state.videos=[];renderTabs();renderActions();setHero(firstMatchingLoaded()||{sourceId:source,title:`BINI ${collectionName()}`,sourceName:collectionName()});loadPage(true);scrollTo({top:0,behavior:'smooth'})}
function renderTabs(){const defs=[['all','All'],['reacenti','Kumu'],['exclusives','Exclusives'],['concerts','Concerts'],['fancams','Fancams'],['misc','Misc']];el.tabs.innerHTML=defs.map(([id,label])=>`<button class="tab ${state.source===id?'active':''}" data-source="${id}">${label}</button>`).join('');el.tabs.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>setSource(b.dataset.source))}
function filterButton(label,value){return `<div class="filter-wrap"><button class="filter-btn" data-menu="${value}">${esc(label)} <span>⌄</span></button><div class="filter-menu hidden" data-panel="${value}"></div></div>`}
function renderActions(){
 el.actions.innerHTML=filterButton(state.tag||'Members','members')+filterButton(state.year||'Year','years')+filterButton(state.sortMode==='newest'?'Sort':state.sortMode==='oldest'?'Oldest first':'A–Z','sort');
 const members=el.actions.querySelector('[data-panel="members"]');members.innerHTML=`<div class="menu-title">Filter by member</div><div class="menu-grid">${MEMBERS.map(m=>`<button data-member="${esc(m)}" class="${state.tag===m?'active':''}">${m}</button>`).join('')}<button data-member="">All members</button></div>`;
 const years=el.actions.querySelector('[data-panel="years"]');years.innerHTML=`<div class="menu-title">Archive year</div><div class="menu-grid">${YEARS.map(y=>`<button data-year="${y}" class="${state.year===y?'active':''}">${y}</button>`).join('')}<button data-year="">All years</button></div>`;
 const sort=el.actions.querySelector('[data-panel="sort"]');sort.innerHTML=`<div class="menu-title">Sort results</div><div class="menu-list">${[['newest','Newest first'],['oldest','Oldest first'],['title','Title A–Z']].map(([id,label])=>`<button data-sort="${id}" class="${state.sortMode===id?'active':''}">${label}</button>`).join('')}</div>`;
 el.actions.querySelectorAll('.filter-btn').forEach(btn=>btn.onclick=()=>{const panel=el.actions.querySelector(`[data-panel="${btn.dataset.menu}"]`);const open=panel.classList.contains('hidden');closeMenus();panel.classList.toggle('hidden',!open);btn.classList.toggle('open',open)});
 members.querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>{state.tag=b.dataset.member;state.myListMode=false;closeMenus();loadPage(true);scrollTo({top:0,behavior:'smooth'})});
 years.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{state.year=b.dataset.year;state.myListMode=false;closeMenus();loadPage(true);scrollTo({top:0,behavior:'smooth'})});
 sort.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{state.sortMode=b.dataset.sort;state.myListMode=false;closeMenus();loadPage(true);scrollTo({top:0,behavior:'smooth'})});
}
function closeMenus(){document.querySelectorAll('.filter-menu').forEach(p=>p.classList.add('hidden'));document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('open'))}
document.addEventListener('click',e=>{if(!e.target.closest('.filter-wrap'))closeMenus()});
function preloadHeroPool(){for(const src of [...WEB_HERO_IMAGES,...BRAND_IMAGES]){const im=new Image();im.decoding='async';im.referrerPolicy='no-referrer';im.src=src}}
function setHero(v){
 const token=++heroRequest;clearInterval(heroTimer);if(!v)return;
 const fallback=brandImage(v),remote=sourceHero(v);el.heroBackdrop.classList.remove('loaded');el.heroBackdrop.src=fallback;requestAnimationFrame(()=>el.heroBackdrop.classList.add('loaded'));
 const promote=src=>{if(token!==heroRequest||!src||src===fallback)return;const im=new Image();im.decoding='async';im.referrerPolicy='no-referrer';im.onload=()=>{if(token!==heroRequest)return;el.heroBackdrop.classList.remove('loaded');el.heroBackdrop.src=src;requestAnimationFrame(()=>el.heroBackdrop.classList.add('loaded'))};im.src=src};promote(remote);
 const d=strip(v.description||'');const bits=techBits(v);
 el.heroCopy.innerHTML=`<div class="kicker"><i></i> FEATURED VIDEO · ${esc(v.sourceName||'BINI VAULT')}</div><h1>${esc(v.title||'Featured BINI video')}</h1><div class="hero-meta">${meta(v)}</div>${bits.length?`<div class="hero-tech">${bits.map(b=>`<span class="tech-pill">${esc(b)}</span>`).join('')}</div>`:''}<p class="hero-desc">${esc(d||'Watch this BINI video from the vault.')}</p><div class="hero-actions"><button class="btn btn-primary" id="heroPlay">▶ Play Now</button><button class="btn btn-secondary" id="heroInfo">ⓘ More Info</button><button class="btn btn-tertiary" id="heroList">＋ My List</button></div><div class="hero-credit">BINI Vault · Eight members, one archive.</div><div class="hero-controls"><button class="hero-arrow" id="heroPrev" aria-label="Previous featured video">‹</button><button class="hero-arrow" id="heroNext" aria-label="Next featured video">›</button><div class="hero-dots"><span class="hero-dot active"></span><span class="hero-dot"></span><span class="hero-dot"></span></div></div>`;
 document.querySelector('#heroPlay').onclick=()=>openModal(v);document.querySelector('#heroInfo').onclick=()=>openModal(v);document.querySelector('#heroList').onclick=()=>toggleList(v);
 const pool=currentMatches();const rotate=dir=>{const idx=pool.findIndex(x=>key(x)===key(v));if(idx<0)return;const ni=(idx+(dir==='next'?1:-1)+pool.length)%pool.length;setHero(pool[ni])};document.querySelector('#heroPrev').onclick=()=>rotate('prev');document.querySelector('#heroNext').onclick=()=>rotate('next');
 let timerIndex=stableIndex(key(v))%3;heroTimer=setInterval(()=>{if(document.hidden||token!==heroRequest)return;const matches=currentMatches();if(matches.length<2)return;const idx=matches.findIndex(x=>key(x)===key(v));const ni=(idx+1)%matches.length;setHero(matches[ni])},20000);
}
function hydrateHero(){const hero=firstMatchingLoaded();if(hero)setHero(hero);else setHero({sourceId:state.source,title:'BINI Vault',sourceName:collectionName(),description:'Browse the BINI archive.'})}
function renderStats(){const watched=Object.values(state.watch).filter(w=>w.position>0).length;const saved=state.myList.size;const allLoadedCount=state.allLoaded.size;el.stats.innerHTML=`<div class="statbar"><div class="stat-card"><div class="stat-label">Catalog</div><div class="stat-value">${state.catalogCount||allLoadedCount}</div><div class="stat-sub">videos in this view</div></div><div class="stat-card"><div class="stat-label">Loaded</div><div class="stat-value">${allLoadedCount}</div><div class="stat-sub">ready in this session</div></div><div class="stat-card"><div class="stat-label">My List</div><div class="stat-value">${saved}</div><div class="stat-sub">saved on this device</div></div><div class="stat-card"><div class="stat-label">Watching</div><div class="stat-value">${watched}</div><div class="stat-sub">videos in progress</div></div><div class="stat-card"><div class="stat-label">Archive</div><div class="stat-value">2021–2026</div><div class="stat-sub">BINI eras to browse</div></div></div>`}
function parseDuration(v=''){if(v.includes(':')){const p=v.split(':').map(Number);if(p.length===3)return p[0]*3600+p[1]*60+p[2];if(p.length===2)return p[0]*60+p[1]}return 1e9}
function continueItems(){return Object.entries(state.watch).map(([k,w])=>({key:k,w})).filter(x=>x.w&&x.w.position>0&&x.w.position<parseDuration(x.w.duration||'')).sort((a,b)=>(b.w.updatedAt||0)-(a.w.updatedAt||0)).slice(0,6)}
function storedToVideo(w){return {id:w.id,sourceId:w.sourceId,sourceName:w.sourceName,title:w.title,thumbnail:w.thumbnail,descriptionImage:w.descriptionImage,youtubeId:w.youtubeId,url:w.url,date:w.date,tags:w.tags,duration:w.duration}}
function thumbCandidates(v){const urls=[];if(v.thumbnail)urls.push(v.thumbnail);if(v.descriptionImage)urls.push(v.descriptionImage);const id=v.youtubeId||ytId(v.url||'');if(id){const b=`https://i.ytimg.com/vi/${id}`;urls.push(`${b}/maxresdefault.jpg`,`${b}/hqdefault.jpg`,`${b}/sddefault.jpg`,`https://img.youtube.com/vi/${id}/mqdefault.jpg`)}if(isDirect(v.url||''))urls.push(`/api/frame?url=${encodeURIComponent(v.url)}`);urls.push(brandImage(v));return [...new Set(urls.filter(Boolean))]}
function thumbHtml(v){const k=key(v);return `<div class="thumb"><div class="thumb-placeholder"><div class="ph-kicker">BINI VAULT</div><div class="ph-title">${esc(v.title||'BINI video')}</div></div><img class="thumb-img" loading="lazy" decoding="async" alt="" referrerpolicy="no-referrer" data-key="${esc(k)}"><span class="badge">${esc(v.duration||'VIDEO')}</span><span class="play">▶</span>${state.watch[k]?.position?`<span class="progress-mini"><i style="width:${Math.min(100,(state.watch[k].position/Math.max(1,parseDuration(v.duration||'')))*100)}%"></i></span>`:''}<button class="card-more" aria-label="More">⋯</button></div>`}
function card(v){return `<article class="card" data-key="${esc(key(v))}">${thumbHtml(v)}<div class="card-title">${esc(v.title||'Untitled BINI video')}</div><div class="card-meta">${meta(v)}</div><div class="tagline">${(v.tags||[]).slice(0,2).map((t,i)=>`<span class="tag ${i===0?'accent':''}">${esc(t)}</span>`).join('')}</div></article>`}
function renderContinue(){const items=continueItems();if(!items.length){el.continueSection.innerHTML='';return}el.continueSection.innerHTML=`<section class="section"><div class="section-head"><div class="section-title"><h2>Continue Watching</h2><p>Pick up where you left off.</p></div><small>${items.length} in progress</small></div><div class="mini-grid">${items.map(({key:k,w})=>{const v=storedToVideo(w);return `<article class="card" data-watchcard="${esc(k)}">${thumbHtml(v)}<div class="card-title">${esc(w.title||'BINI video')}</div><div class="card-meta">${esc(w.sourceName||'BINI Vault')} · ${esc(w.position||0)}s watched</div></article>`}).join('')}</div></section>`;el.continueSection.querySelectorAll('[data-watchcard]').forEach(c=>c.onclick=()=>{const w=state.watch[c.dataset.watchcard];if(w)openModal(storedToVideo(w))});observeThumbs(el.continueSection)}
function getMyListItems(){return [...state.myList].map(k=>state.allLoaded.get(k)||state.listSnapshots[k]).filter(Boolean)}
function renderMyList(){const items=sortVideos(getMyListItems());if(!items.length){el.myListSection.innerHTML='';return}el.myListSection.innerHTML=`<section class="section"><div class="section-head"><div class="section-title"><h2>My List</h2><p>Your saved BINI videos, stored locally.</p></div><button class="view-all" id="clearListBtn">Clear all</button></div><div class="mini-grid">${items.slice(0,12).map(card).join('')}</div></section>`;bindCards(el.myListSection);observeThumbs(el.myListSection);document.querySelector('#clearListBtn').onclick=()=>{state.myList.clear();state.listSnapshots={};saveList();renderMyList();renderStats();toast('My List cleared')}}
function renderOnThisDay(){const now=new Date();const mm=String(now.getMonth()+1).padStart(2,'0'),dd=String(now.getDate()).padStart(2,'0');const items=sortVideos([...state.allLoaded.values()].filter(v=>String(v.date||'').slice(5,10)===`${mm}-${dd}`)).slice(0,6);if(!items.length){el.onThisDaySection.innerHTML='';return}el.onThisDaySection.innerHTML=`<section class="section"><div class="section-head"><div class="section-title"><h2>On This Day</h2><p>BINI archive moments from ${now.toLocaleDateString(undefined,{month:'long',day:'numeric'})} in other years.</p></div><small>${items.length} found</small></div><div class="mini-grid">${items.map(card).join('')}</div></section>`;bindCards(el.onThisDaySection);observeThumbs(el.onThisDaySection)}
function renderCatalog(){const title=state.query?`Search results for “${esc(state.query)}”`:state.myListMode?'My List':state.tag?`${esc(state.tag)} videos`:state.year?`BINI ${esc(state.year)}`:collectionName();const subtitle=state.query?'Matching videos from the vault.':state.myListMode?'Your saved videos on this device.':SOURCE_SUBTITLES[state.source]||'BINI videos from the vault.';el.content.innerHTML=state.videos.length?`<section class="section catalog-section"><div class="section-head"><div class="section-title"><h2>${title}</h2><p>${subtitle}</p></div><small>${state.videos.length}${state.hasMore?'+':''} loaded</small></div><div class="video-grid" id="videoGrid">${state.videos.map(card).join('')}</div><div class="grid-loading hidden" id="gridLoading"><div class="spinner"></div></div></section>`:`<div class="empty">No BINI videos found.</div>`;bindCards(el.content);observeThumbs(el.content)}
function renderAll(){renderTabs();renderActions();renderStats();renderContinue();renderMyList();renderOnThisDay();renderCatalog()}
function appendGridCards(videos){const grid=document.querySelector('#videoGrid');if(!grid||!videos.length)return;grid.insertAdjacentHTML('beforeend',videos.map(card).join(''));bindCards(grid);observeThumbs(grid)}
function bindCards(root){root.querySelectorAll('.card').forEach(c=>c.onclick=e=>{if(e.target.closest('.card-more'))return;const v=state.allLoaded.get(c.dataset.key);if(v)openModal(v)}) ;root.querySelectorAll('.card-more').forEach(b=>b.onclick=e=>{e.stopPropagation();const c=e.currentTarget.closest('.card');const v=state.allLoaded.get(c.dataset.key);if(v)openModal(v)})}
function observeThumbs(root=document){const imgs=[...root.querySelectorAll('.thumb-img[data-key]')];if(!('IntersectionObserver'in window)){imgs.forEach(loadThumb);return}const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){loadThumb(e.target);io.unobserve(e.target)}}),{rootMargin:'500px 0px'});imgs.forEach(i=>io.observe(i))}
function loadThumb(img){if(img.dataset.loaded||img.dataset.loading)return;const v=state.allLoaded.get(img.dataset.key);if(!v)return;img.dataset.loading='1';const urls=thumbCandidates(v);let index=0;const tryNext=()=>{if(index>=urls.length){img.dataset.loading='';return}const url=urls[index++];const probe=new Image();probe.referrerPolicy='no-referrer';probe.decoding='async';probe.onload=()=>{img.onload=()=>{img.classList.add('loaded');img.dataset.loaded='1';img.dataset.loading='';};img.src=url};probe.onerror=tryNext;probe.src=url};tryNext()}
function observeEnd(){if(endObserver)endObserver.disconnect();if(!el.sentinel||!('IntersectionObserver'in window))return;endObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!state.loading&&state.hasMore)loadPage(false)},{rootMargin:'700px 0px',threshold:0});endObserver.observe(el.sentinel)}
function findNextVideo(v){const matches=sortVideos(currentMatches());const i=matches.findIndex(x=>key(x)===key(v));return i>=0&&i<matches.length-1?matches[i+1]:null}
function openModal(v){state.selected=v;el.modalTitle.textContent='Now playing';el.modalTitleLarge.textContent=v.title;el.modalMeta.innerHTML=meta(v);el.modalDesc.textContent=strip(v.description||'No description available.');el.listBtn.textContent=state.myList.has(key(v))?'✓ In My List':'＋ My List';el.listBtn.classList.toggle('active',state.myList.has(key(v)));el.player.innerHTML='';const url=v.url||'';if(isYT(url)){const id=ytId(url);const start=state.watch[key(v)]?.position||0;el.player.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1${start>5?`&start=${start}`:''}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`}else if(isDirect(url)){const video=document.createElement('video');video.controls=true;video.autoplay=true;video.playsInline=true;video.src=url;const pos=state.watch[key(v)]?.position||0;video.addEventListener('loadedmetadata',()=>{if(pos>5&&pos<video.duration-5)video.currentTime=pos});video.addEventListener('timeupdate',()=>saveWatch(v,video.currentTime));el.player.append(video)}else if(url){el.player.innerHTML=`<div style="padding:30px;text-align:center">This source opens externally.<br><button class="small-btn" id="openExternal" style="margin-top:12px">Open source</button></div>`;document.querySelector('#openExternal').onclick=()=>window.open(url,'_blank','noopener,noreferrer')}else el.player.innerHTML='<div style="padding:30px;text-align:center;color:#9da2ac">No playable source is available.</div>';el.modal.classList.remove('hidden');document.body.classList.add('modal-open');el.nextBtn.textContent=findNextVideo(v)?'Next ▶':'Close';el.nextBtn.onclick=()=>{const n=findNextVideo(state.selected);if(n)openModal(n);else closeModal()}}
function closeModal(){el.modal.classList.add('hidden');el.player.innerHTML='';document.body.classList.remove('modal-open')}
function toggleList(v=state.selected){if(!v)return;const k=key(v);if(state.myList.has(k)){state.myList.delete(k);delete state.listSnapshots[k];toast('Removed from My List')}else{state.myList.add(k);state.listSnapshots[k]=v;toast('Added to My List')}saveList();if(state.selected&&key(state.selected)===k){el.listBtn.textContent=state.myList.has(k)?'✓ In My List':'＋ My List';el.listBtn.classList.toggle('active',state.myList.has(k))}renderMyList();renderStats()}
function showMyList(){state.myListMode=true;state.source='all';state.tag='';state.year='';state.query='';state.videos=getMyListItems();renderAll();scrollTo({top:0,behavior:'smooth'})}
function searchNow(){state.query=el.searchInput.value.trim();state.tag='';state.year='';state.source='all';state.myListMode=false;loadPage(true);scrollTo({top:0,behavior:'smooth'})}
function surpriseMe(){const pool=currentMatches();if(!pool.length){toast('Load a few videos first');return}const v=pool[Math.floor(Math.random()*pool.length)];openModal(v)}
function setActiveNav(name){
  const map={home:el.home,browse:el.browse,collections:el.collections,list:el.listNav};
  Object.entries(map).forEach(([k,b])=>b?.classList.toggle('active',k===name));
  el.mobileNav?.querySelectorAll('[data-mobile-nav]').forEach(b=>b.classList.toggle('active',b.dataset.mobileNav===name));
}
function navHome(){setActiveNav('home');state.query='';state.tag='';state.year='';state.source='all';state.myListMode=false;loadPage(true);scrollTo({top:0,behavior:'smooth'})}
el.searchToggle.onclick=()=>{el.search.classList.toggle('open');if(el.search.classList.contains('open'))el.searchInput.focus()};el.searchInput.onkeydown=e=>{if(e.key==='Enter')searchNow();if(e.key==='Escape'){el.searchInput.value='';state.query='';el.search.classList.remove('open');loadPage(true)}};el.searchClear.onclick=()=>{el.searchInput.value='';state.query='';el.searchClear.classList.add('hidden');loadPage(true)};el.searchInput.oninput=()=>el.searchClear.classList.toggle('hidden',!el.searchInput.value);el.mobileNav?.querySelectorAll('[data-mobile-nav]').forEach(b=>b.onclick=()=>{const n=b.dataset.mobileNav;if(n==='home')navHome();if(n==='browse'){setActiveNav('browse');document.querySelector('#browsebar')?.scrollIntoView({behavior:'smooth',block:'start'})}if(n==='collections'){setActiveNav('collections');document.querySelector('#browsebar')?.scrollIntoView({behavior:'smooth',block:'start'})}if(n==='list'){setActiveNav('list');showMyList()}});
el.surpriseBtn.onclick=surpriseMe;
el.statsBtn.onclick=()=>el.stats.scrollIntoView({behavior:'smooth',block:'center'});
el.home.onclick=navHome;
el.browse.onclick=()=>{setActiveNav('browse');document.querySelector('#browsebar')?.scrollIntoView({behavior:'smooth',block:'center'});};
el.collections.onclick=()=>{setActiveNav('collections');document.querySelector('#browsebar')?.scrollIntoView({behavior:'smooth',block:'center'});};
el.listNav.onclick=()=>{setActiveNav('list');showMyList()};
el.brand.onclick=e=>{e.preventDefault();navHome()};
el.mobileNav?.querySelectorAll('[data-mobile-nav]').forEach(b=>b.onclick=()=>{
  const n=b.dataset.mobileNav;
  if(n==='home')navHome();
  else if(n==='browse'){setActiveNav('browse');document.querySelector('#browsebar')?.scrollIntoView({behavior:'smooth',block:'start'});}
  else if(n==='collections'){setActiveNav('collections');document.querySelector('#browsebar')?.scrollIntoView({behavior:'smooth',block:'start'});}
  else if(n==='list'){setActiveNav('list');showMyList();}
});
el.searchToggle.onclick=()=>{el.search.classList.toggle('open');if(el.search.classList.contains('open'))el.searchInput.focus()};
el.searchInput.onkeydown=e=>{if(e.key==='Enter')searchNow();if(e.key==='Escape'){el.searchInput.value='';state.query='';el.search.classList.remove('open');loadPage(true)}};
el.searchClear.onclick=()=>{el.searchInput.value='';state.query='';el.searchClear.classList.add('hidden');loadPage(true)};
el.searchInput.oninput=()=>el.searchClear.classList.toggle('hidden',!el.searchInput.value);
el.modalClose.onclick=closeModal;
el.modal.onclick=e=>{if(e.target===el.modal)closeModal()};
el.listBtn.onclick=()=>toggleList();
el.shareBtn.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('Page link copied')}catch{toast('Copy unavailable')}};
window.addEventListener('scroll',()=>el.topbar.classList.toggle('scrolled',scrollY>24));
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();el.search.classList.add('open');el.searchInput.focus()}if(e.key==='Escape'&&!el.modal.classList.contains('hidden'))closeModal()});
setActiveNav('home');
function renderLoadingShell(){
  el.heroCopy.innerHTML=`<div class="hero-skeleton"><div class="sk-line sk-kicker"></div><div class="sk-line sk-title"></div><div class="sk-line sk-title short"></div><div class="sk-line sk-meta"></div><div class="sk-buttons"><span></span><span></span></div></div>`;
  el.tabs.innerHTML=['All','Kumu','Exclusives','Concerts','Fancams','Misc'].map(x=>`<span class="pill-skeleton">${x}</span>`).join('');
  el.actions.innerHTML='<span class="control-skeleton"></span><span class="control-skeleton"></span><span class="control-skeleton"></span>';
  el.stats.innerHTML=`<div class="statbar loading-stats">${Array.from({length:5},()=>'<div class="stat-card skeleton-card"><div class="sk-block"></div><div class="sk-block small"></div></div>').join('')}</div>`;
  el.content.innerHTML=`<section class="section catalog-section"><div class="section-head"><div class="section-title"><h2>Recently Added</h2><p>Preparing the latest videos…</p></div></div><div class="video-grid loading-grid">${Array.from({length:12},()=>'<div class="skeleton-video"><div class="skeleton-thumb"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div>').join('')}</div></section>`;
}
function renderErrorState(err){
  el.content.innerHTML=`<div class="empty error-state"><div class="error-icon">!</div><h3>We couldn’t load the vault</h3><p>Something interrupted the connection. Your saved My List and watch progress are still safe on this device.</p><button class="retry-btn" id="retryBtn">Try again</button></div>`;
  document.querySelector('#retryBtn')?.addEventListener('click',()=>{renderLoadingShell();init()});
}
async function init(){
  renderLoadingShell();
  try{await api('/api/sources');preloadHeroPool();await loadPage(true);observeEnd()}
  catch(e){console.error(e);renderErrorState(e)}
}
init();

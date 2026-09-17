import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { getSources, fetchSource, fetchCatalog, findVideo, getCacheInfo, getSourceHealth } from './src/sheets.js';

function loadDotEnv(filePath){
  try{
    const fs = require('node:fs');
  }catch{}
}

// Lightweight .env loader so the project does not need an additional runtime dependency.
try {
  const fs = await import('node:fs');
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1);
      process.env[m[1]] = value;
    }
  }
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use(express.json({limit:'100kb'}));

const IMAGE_HOSTS = new Set(['i.ibb.co','s12.gifyu.com','s13.gifyu.com','i.ytimg.com','img.youtube.com']);
const imageCache = new Map();
const frameCache = new Map();
const IMAGE_TTL = 30*60*1000;
const FRAME_TTL = 6*60*60*1000;
const RATE_WINDOW = 60*1000;
const RATE_LIMIT = 180;
const MEDIA_RATE_LIMIT = 80;
const rateBuckets = new Map();

function privateIp(ip){
  if(net.isIPv4(ip)){const [a,b]=ip.split('.').map(Number);return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168);}
  if(net.isIPv6(ip)){const n=ip.toLowerCase();return n==='::1'||n.startsWith('fc')||n.startsWith('fd')||n.startsWith('fe80:');}
  return true;
}
async function assertPublicUrl(raw, allowedHosts=null){
  const u=new URL(String(raw));
  if(!['http:','https:'].includes(u.protocol)) throw new Error('Unsupported URL protocol');
  const h=u.hostname.toLowerCase();
  if(allowedHosts&&!allowedHosts.has(h)) throw new Error('Unsupported host');
  if(h==='localhost'||h.endsWith('.local')) throw new Error('Private host blocked');
  if(net.isIP(h)){if(privateIp(h))throw new Error('Private address blocked');return u;}
  const records=await dns.lookup(h,{all:true});
  if(!records.length||records.some(r=>privateIp(r.address))) throw new Error('Private address blocked');
  return u;
}
async function safeFetch(raw, options={}, allowedHosts=null){
  let current=await assertPublicUrl(raw,allowedHosts);
  for(let i=0;i<4;i++){
    const c=new AbortController();
    const t=setTimeout(()=>c.abort(),10000);
    let r;
    try{r=await fetch(current,{...options,redirect:'manual',signal:c.signal});}finally{clearTimeout(t)}
    if(r.status>=300&&r.status<400){
      const location=r.headers.get('location');
      if(!location)throw new Error('Invalid redirect');
      current=await assertPublicUrl(new URL(location,current).toString(),allowedHosts);
      continue;
    }
    return r;
  }
  throw new Error('Too many redirects');
}
function clientKey(req){return req.socket.remoteAddress||'unknown'}
function rateLimit(maxRequests){return (req,res,next)=>{const k=`${maxRequests}:${clientKey(req)}`;const now=Date.now();let b=rateBuckets.get(k);if(!b||now-b.startedAt>=RATE_WINDOW){b={startedAt:now,count:0};rateBuckets.set(k,b)}b.count+=1;if(b.count>maxRequests){res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many requests. Try again shortly.'})}next()}}
setInterval(()=>{const cutoff=Date.now()-RATE_WINDOW*2;for(const [k,b] of rateBuckets)if(b.startedAt<cutoff)rateBuckets.delete(k)},RATE_WINDOW).unref();
function etagJson(payload){return `"${crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex')}"`}
function setCache(res,seconds=20){res.setHeader('Cache-Control',`public,max-age=${seconds},stale-while-revalidate=${seconds*2}`)}

app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  next();
});
const apiLimiter=rateLimit(RATE_LIMIT);
const mediaLimiter=rateLimit(MEDIA_RATE_LIMIT);
app.use('/api',apiLimiter);

app.get('/api/health',(req,res)=>res.json({ok:true,service:'bini-vault-api',time:new Date().toISOString()}));
app.get('/api/sources',(req,res)=>{
  const payload={sources:getSources()};
  const etag=etagJson(payload);
  if(req.headers['if-none-match']===etag)return res.status(304).end();
  res.setHeader('ETag',etag);setCache(res,300);res.json(payload);
});
app.get('/api/source-health',(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({sources:getSourceHealth()})});
app.get('/api/sources/:id',async(req,res)=>{try{res.json(await fetchSource(req.params.id,{force:req.query.refresh==='1'}));}catch(e){res.status(e.message.startsWith('Unknown source')?404:502).json({error:e.message})}});
app.get('/api/video/:sourceId/:id',async(req,res)=>{try{const video=await findVideo(req.params.sourceId,req.params.id);if(!video)return res.status(404).json({error:'Video not found'});res.json({video})}catch(e){res.status(e.message.startsWith('Unknown source')?404:502).json({error:e.message})}});
app.get('/api/videos',async(req,res)=>{
  const sources=String(req.query.sources||'').split(',').map(s=>s.trim()).filter(Boolean);
  const page=Math.max(1,Number(req.query.page||1));
  const limit=Math.min(48,Math.max(1,Number(req.query.limit||24)));
  try{
    const payload=await fetchCatalog({sources,q:String(req.query.q||''),tag:String(req.query.tag||''),year:String(req.query.year||''),sort:String(req.query.sort||'newest'),page,limit});
    const etag=etagJson(payload);
    if(req.headers['if-none-match']===etag)return res.status(304).end();
    res.setHeader('ETag',etag);setCache(res,15);res.json(payload);
  }catch(e){res.status(502).json({error:e.message})}
});
app.get('/api/thumbnail',mediaLimiter,async(req,res)=>{
  try{
    const u=await assertPublicUrl(req.query.url,IMAGE_HOSTS);const key=u.toString();
    const hit=imageCache.get(key);if(hit&&Date.now()-hit.time<IMAGE_TTL){res.setHeader('Content-Type',hit.type);res.setHeader('Cache-Control','public,max-age=1800');return res.end(hit.body)}
    const r=await safeFetch(key,{headers:{'User-Agent':'BINI-Vault/1.0','Accept':'image/avif,image/webp,image/*,*/*;q=0.8'}},IMAGE_HOSTS);
    if(!r.ok)return res.sendStatus(r.status);const type=r.headers.get('content-type')||'image/jpeg';if(!type.startsWith('image/'))return res.status(415).send('Not image');
    const body=Buffer.from(await r.arrayBuffer());if(body.length>8*1024*1024)return res.sendStatus(413);imageCache.set(key,{time:Date.now(),type,body});res.setHeader('Content-Type',type);res.setHeader('Cache-Control','public,max-age=1800');res.end(body);
  }catch(e){res.status(400).send(e.message||'Thumbnail fetch failed')}
});
app.get('/api/frame',mediaLimiter,async(req,res)=>{
  try{
    const u=await assertPublicUrl(req.query.url);const key=u.toString();const hit=frameCache.get(key);
    if(hit&&Date.now()-hit.time<FRAME_TTL){res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','public,max-age=21600');return res.end(hit.body)}
    const buf=await new Promise((resolve,reject)=>{
      const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-ss','2','-i',key,'-frames:v','1','-vf','scale=1280:-2:force_original_aspect_ratio=decrease','-q:v','4','-f','image2pipe','-vcodec','mjpeg','pipe:1'],{stdio:['ignore','pipe','pipe']});
      const chunks=[];let total=0,stderr='';const timer=setTimeout(()=>{p.kill('SIGKILL');reject(new Error('Frame extraction timeout'))},15000);
      p.stdout.on('data',d=>{total+=d.length;if(total<=8*1024*1024)chunks.push(d)});p.stderr.on('data',d=>stderr+=d.toString());p.on('error',e=>{clearTimeout(timer);reject(e)});p.on('close',code=>{clearTimeout(timer);if(code||!chunks.length)reject(new Error(stderr.trim()||'Frame extraction failed'));else resolve(Buffer.concat(chunks))});
    });
    frameCache.set(key,{time:Date.now(),body:buf});res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','public,max-age=21600');res.end(buf);
  }catch(e){res.status(400).send(e.message||'Frame extraction failed')}
});
app.get('/api/cache',(req,res)=>{res.setHeader('Cache-Control','no-store');res.json({sheets:getCacheInfo(),imageEntries:imageCache.size,frameEntries:frameCache.size})});
app.use(express.static(path.join(__dirname,'public'),{maxAge:'1h',etag:true,setHeaders(res,file){if(/\.(html|js|css|json|webmanifest)$/.test(file))res.setHeader('Cache-Control','no-store')}}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`BINI Vault running at http://localhost:${PORT}`));

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns/promises';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { getSources, fetchSource, fetchCatalog, getCacheInfo } from './src/sheets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use(express.json({limit:'100kb'}));

const IMAGE_HOSTS = new Set(['i.ibb.co','s12.gifyu.com','s13.gifyu.com','i.ytimg.com','img.youtube.com']);
const imageCache = new Map();
const frameCache = new Map();
const RES_CACHE = 'no-store';
const IMAGE_TTL = 30*60*1000;
const FRAME_TTL = 6*60*60*1000;

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

app.get('/api/health',(req,res)=>res.json({ok:true,service:'bini-vault-api',time:new Date().toISOString()}));
app.get('/api/sources',(req,res)=>res.json({sources:getSources()}));
app.get('/api/sources/:id',async(req,res)=>{try{res.json(await fetchSource(req.params.id,{force:req.query.refresh==='1'}));}catch(e){res.status(e.message.startsWith('Unknown source')?404:502).json({error:e.message});}});
app.get('/api/videos',async(req,res)=>{
  const sources=String(req.query.sources||'').split(',').map(s=>s.trim()).filter(Boolean);
  const page=Math.max(1,Number(req.query.page||1));
  const limit=Math.min(48,Math.max(1,Number(req.query.limit||24)));
  try{res.json(await fetchCatalog({sources,q:String(req.query.q||''),tag:String(req.query.tag||''),year:String(req.query.year||''),sort:String(req.query.sort||'newest'),page,limit}));}
  catch(e){res.status(502).json({error:e.message});}
});
app.get('/api/thumbnail',async(req,res)=>{
  try{
    const u=await assertPublicUrl(req.query.url,IMAGE_HOSTS); const key=u.toString();
    const hit=imageCache.get(key); if(hit&&Date.now()-hit.time<IMAGE_TTL){res.setHeader('Content-Type',hit.type);res.setHeader('Cache-Control','public,max-age=1800');return res.end(hit.body);}
    const c=new AbortController(), t=setTimeout(()=>c.abort(),10000);
    let r; try{r=await fetch(key,{signal:c.signal,headers:{'User-Agent':'BINI-Vault/1.0','Accept':'image/avif,image/webp,image/*,*/*;q=0.8'}});}finally{clearTimeout(t)}
    if(!r.ok)return res.sendStatus(r.status); const type=r.headers.get('content-type')||'image/jpeg'; if(!type.startsWith('image/'))return res.status(415).send('Not image');
    const body=Buffer.from(await r.arrayBuffer()); if(body.length>8*1024*1024)return res.sendStatus(413);
    imageCache.set(key,{time:Date.now(),type,body}); res.setHeader('Content-Type',type);res.setHeader('Cache-Control','public,max-age=1800');res.end(body);
  }catch(e){res.status(400).send(e.message||'Thumbnail fetch failed');}
});
app.get('/api/frame',async(req,res)=>{
  try{
    const u=await assertPublicUrl(req.query.url), key=u.toString(); const hit=frameCache.get(key);
    if(hit&&Date.now()-hit.time<FRAME_TTL){res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','public,max-age=21600');return res.end(hit.body);}
    const buf=await new Promise((resolve,reject)=>{
      const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-ss','2','-i',key,'-frames:v','1','-vf','scale=1280:-2:force_original_aspect_ratio=decrease','-q:v','4','-f','image2pipe','-vcodec','mjpeg','pipe:1'],{stdio:['ignore','pipe','pipe']});
      const chunks=[];let total=0,stderr='';const timer=setTimeout(()=>{p.kill('SIGKILL');reject(new Error('Frame extraction timeout'));},15000);
      p.stdout.on('data',d=>{total+=d.length;if(total<=8*1024*1024)chunks.push(d)});p.stderr.on('data',d=>stderr+=d.toString());p.on('error',e=>{clearTimeout(timer);reject(e)});p.on('close',code=>{clearTimeout(timer);if(code||!chunks.length)reject(new Error(stderr.trim()||'Frame extraction failed'));else resolve(Buffer.concat(chunks))});
    });
    frameCache.set(key,{time:Date.now(),body:buf});res.setHeader('Content-Type','image/jpeg');res.setHeader('Cache-Control','public,max-age=21600');res.end(buf);
  }catch(e){res.status(400).send(e.message||'Frame extraction failed');}
});
app.get('/api/cache',(req,res)=>res.json({sheets:getCacheInfo(),imageEntries:imageCache.size,frameEntries:frameCache.size}));
app.use(express.static(path.join(__dirname,'public'),{maxAge:'1h',etag:true,setHeaders(res,file){if(/\.(html|js|css)$/.test(file))res.setHeader('Cache-Control',RES_CACHE)}}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`BINI Vault running at http://localhost:${PORT}`));

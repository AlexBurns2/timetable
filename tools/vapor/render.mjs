/* Renders Vaporwave scene parts in headless Chrome (with the GPU) and writes them to <work>/out as PNG (+ JSON: where the piece goes).
   usage: node tools/vapor/render.mjs --work <folder> "scene=tt&mode=l&part=left&n=96" ["…" …]
   options: --port 8795 (serve.mjs), --debug 9343 (Chrome's debugging port), --chrome <path>, --cpu (no GPU: much slower)
   A job is a query for render.html: scene tt|cal|notes|home|stairs|planets|solids, mode l|d, part plate|left|right|phone|<float>, n frames. */
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const argv = process.argv.slice(2), opt = {}, jobs = [];
for (let i = 0; i < argv.length; i++){ if (argv[i] === '--cpu') opt.cpu = true; else if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[++i]; else jobs.push(argv[i]); }
const WORK = path.resolve(opt.work || process.env.VW_WORK || ''), OUT = path.join(WORK, 'out'), PORT = +(opt.debug || 9343), BASE = 'http://127.0.0.1:' + (opt.port || 8795);
const CHROME = opt.chrome || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive:true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const gpu = opt.cpu ? ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(WORK, 'chrome-profile'), '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--disable-extensions', '--window-size=1400,900', ...gpu, 'about:blank'], { stdio:'ignore' });
let ver = null;
for (let i = 0; i < 40 && !ver; i++){ await sleep(250); try { ver = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); } catch {} }
if (!ver){ console.log('Chrome did not start'); ch.kill(); process.exit(1); }
const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method:'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const wait = new Map(), logs = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)){ wait.get(d.id)(d); wait.delete(d.id); }
  else if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.args.map(a => a.value ?? a.description).join(' ')); };
const send = (method, params) => new Promise(res => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id:i, method, params:params || {} })); });
const ev = async e => { const r = await send('Runtime.evaluate', { expression:e, returnByValue:true, awaitPromise:true }); return r.result && r.result.result ? r.result.result.value : undefined; };
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled:true });
for (const job of jobs){
  logs.length = 0; const t0 = Date.now();
  await send('Page.navigate', { url:BASE + '/vw3d/render.html?job=scenes&' + job.replace(/^job=scenes&/, '') });
  let done = false, err = null;
  for (let i = 0; i < 720 && !done && !err; i++){ await sleep(250); done = await ev('!!window.__done'); err = await ev('window.__err || null'); }
  if (err){ console.log('PAGE ERROR', job, String(err).slice(0, 800)); logs.forEach(l => console.log('  |', String(l).slice(0, 300))); continue; }
  if (!done){ console.log('TIMEOUT', job); continue; }
  const n = await ev('(window.__out || []).length');
  for (let k = 0; k < n; k++){
    const o = await ev('window.__out[' + k + ']'), b64 = o.url.split(',')[1];
    fs.writeFileSync(path.join(OUT, o.name + '.png'), Buffer.from(b64, 'base64'));
    if (o.meta) fs.writeFileSync(path.join(OUT, o.name + '.json'), JSON.stringify(o.meta));
    console.log('wrote', o.name, (b64.length * .75 / 1024 | 0) + ' KB');
  }
  console.log('  ' + job + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
ws.close(); ch.kill(); process.exit(0);

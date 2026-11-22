/* Synthwave's still pictures (images/synth/*.webp): each scene's own frame, rendered by fx/synth.js in headless Chrome.

   The page is opened with sessionStorage synth.still = 1 (fx/synth.js's STILL mode: the page itself hidden, a fixed
   moment, no grain flicker, a larger drawing), and the canvas is captured as WebP by Chrome itself.
   localStorage gets only a look: the theme, light or dark, and the moderator flag a mod-only theme needs.
   No account, no timetable, nothing of anyone's.

   usage (Node 22 or later; the site served locally, e.g. python -m http.server 3000 from the repo root):
     node tools/synth/stills.mjs [--base http://localhost:3000] [--out images/synth] [--only drive,bay]
                                 [--t 40] [--quality 70] [--chrome <path to chrome>] [--port 9333]
   Each scene gives four files: <scene>-dusk, <scene>-night (1600 x 900) and the same with -p (a phone, 430 x 932 at 1.5x). */
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:3000').replace(/\/$/, '');
const OUT = path.resolve(arg('out', path.join(HERE, '..', '..', 'images', 'synth')));
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const T = arg('t', '40'), Q = +arg('quality', '70'), PORT = +arg('port', '9333');
const CHROME = arg('chrome', process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome'));
/* the scenes, and a page that shows each (fx/synth.js PAGE) */
const SCENES = [['drive', '/'], ['bay', '/home.html'], ['pyramid', '/games.html'], ['shore-a', '/calendar.html'], ['shore-b', '/notes.html']];
const SIZES = [{ w:1600, h:900, dpr:1, suf:'' }, { w:430, h:932, dpr:1.5, suf:'-p' }];

const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive:true });
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'synth-stills-'));
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-extensions', 'about:blank'], { stdio:'ignore' });
let ok = false;
for (let i = 0; i < 60 && !ok; i++){ await sleep(250); try { ok = !!(await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json()); } catch {} }
if (!ok){ console.error('Chrome did not start (' + CHROME + '); pass --chrome <path>'); ch.kill(); process.exit(1); }

async function tab(){
  const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method:'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)){ wait.get(d.id)(d); wait.delete(d.id); } };
  const send = (method, params) => new Promise(res => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id:i, method, params:params || {} })); });
  return { send, close: async () => { try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + t.id); } catch {} ws.close(); } };
}
const READY = 'new Promise(r => { const t0 = Date.now(); (function w(){ if (window.__synthReady || window.__synthErr || Date.now() - t0 > 120000) r({ ok:!!window.__synthReady, err:window.__synthErr || null }); else setTimeout(w, 250); })(); })';
let failed = 0;
for (const [name, url] of SCENES){
  if (ONLY && !ONLY.includes(name)) continue;
  for (const [mode, label] of [['light', 'dusk'], ['dark', 'night']]) for (const s of SIZES){
    const c = await tab();
    await c.send('Emulation.setDeviceMetricsOverride', { width:s.w, height:s.h, deviceScaleFactor:s.dpr, mobile:s.w < 700 });
    if (s.w < 700) await c.send('Emulation.setTouchEmulationEnabled', { enabled:true });
    await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
    await c.send('Network.setCacheDisabled', { cacheDisabled:true }); await c.send('Network.setBypassServiceWorker', { bypass:true });
    const ls = { 'tt.skin':JSON.stringify('synth'), 'tt.mode':JSON.stringify(mode), 'tt.themes2_note':'1', 'msc.ismod':'1' };
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source:'(() => { try { if (location.origin !== ' + JSON.stringify(new URL(BASE).origin) + ') return; ' +
      'const L = ' + JSON.stringify(ls) + '; for (const k in L) localStorage.setItem(k, L[k]); sessionStorage.setItem("synth.still", "1"); sessionStorage.setItem("synth.t", ' + JSON.stringify(T) + '); } catch (e) {} })();' });
    await c.send('Page.navigate', { url:BASE + url });
    await sleep(1500);
    const r = await c.send('Runtime.evaluate', { expression:READY, awaitPromise:true, returnByValue:true });
    const v = r.result && r.result.result && r.result.result.value;
    const file = name + '-' + label + s.suf + '.webp';
    if (!v || !v.ok){ console.error(file, 'not drawn:', v && v.err); failed++; await c.close(); continue; }
    await sleep(1500);
    const shot = await c.send('Page.captureScreenshot', { format:'webp', quality:Q });
    if (shot.result && shot.result.data){ const b = Buffer.from(shot.result.data, 'base64'); fs.writeFileSync(path.join(OUT, file), b); console.log(file, Math.round(b.length / 1024) + ' KB'); }
    else { console.error(file, 'capture failed'); failed++; }
    await c.close();
  }
}
ch.kill();
await sleep(500); try { fs.rmSync(prof, { recursive:true, force:true }); } catch {}
process.exit(failed ? 1 : 0);

/* node shoot.mjs "<query>" out.png : render render.html in headless Chrome, save the PNG it draws */
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const [q, out] = process.argv.slice(2);
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe', PORT = 9361;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ch = spawn(CH, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + process.cwd() + '/prof', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', 'about:blank'], { stdio:'ignore' });
let ok = null; for (let i = 0; i < 40 && !ok; i++){ await sleep(250); try { ok = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); } catch {} }
const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method:'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const w = new Map(); ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && w.has(d.id)){ w.get(d.id)(d); w.delete(d.id); } else if (d.method === 'Runtime.exceptionThrown') console.log('EXC', JSON.stringify(d.params.exceptionDetails).slice(0, 500)); else if (d.method === 'Runtime.consoleAPICalled') console.log('log', JSON.stringify(d.params.args.map(a => a.value || a.description)).slice(0, 300)); };
const send = (m, p) => new Promise(r => { const i = ++id; w.set(i, r); ws.send(JSON.stringify({ id:i, method:m, params:p || {} })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url:'http://127.0.0.1:8799/render.html?' + q });
let png = null;
for (let i = 0; i < 240 && !png; i++){ await sleep(500); const r = await send('Runtime.evaluate', { expression:'window.__png || null', returnByValue:true }); png = r.result && r.result.result && r.result.result.value; }
if (png) fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64')); console.log(png ? 'saved ' + out : 'no image');
ws.close(); ch.kill();

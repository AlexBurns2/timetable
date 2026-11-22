/* A small static server for rendering the Vaporwave scenes.
   /vw3d/…  this folder (the page and the scene modules)
   /…       the work folder (three/, ph-dl/, photo/: what you downloaded and made; never the repo)
   usage: node tools/vapor/serve.mjs --work <folder> [--port 8795] */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WORK = path.resolve(arg('work', '') || process.env.VW_WORK || ''), PORT = +arg('port', 8795);
if (!fs.existsSync(path.join(WORK, 'three', 'build', 'three.module.js'))){ console.log('no three.js in ' + WORK + ' (see README)'); process.exit(1); }
const T = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.hdr':'application/octet-stream', '.bin':'application/octet-stream', '.gltf':'model/gltf+json', '.glb':'model/gltf-binary' };
http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]), mine = u.startsWith('/vw3d/'), root = mine ? HERE : WORK, f = path.join(root, mine ? u.slice(5) : u);
  if (!f.startsWith(root)){ r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e){ r.writeHead(404); return r.end('not found'); } r.writeHead(200, { 'content-type':T[path.extname(f)] || 'application/octet-stream', 'cache-control':'no-store' }); r.end(d); });
}).listen(PORT, '127.0.0.1', () => console.log('serving ' + HERE + ' and ' + WORK + ' on http://127.0.0.1:' + PORT));

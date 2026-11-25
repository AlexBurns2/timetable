// Runs the site on your computer with a pretend database and sign-in, for trying the games and boards.
//   node tools/local.mjs      then open http://localhost:3000/local-login
// Needs Node 20.6 or newer. Nothing is saved: scores go when you stop it.
import { register } from "node:module";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const fake = new URL("./local-db.mjs", import.meta.url).href;
register("data:text/javascript," + encodeURIComponent(
  `export async function resolve(s, c, next) {
    if (s === "./_supabase.js" && c.parentURL && c.parentURL.includes("/api/")) return { url: ${JSON.stringify(fake)}, shortCircuit: true };
    return next(s, c);
  }`));

const root = fileURLToPath(new URL("..", import.meta.url));
const api = { leaderboard: (await import("../api/leaderboard.js")).default, tetris: (await import("../api/tetris.js")).default };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".woff2": "font/woff2" };
const port = +process.env.PORT || 3000;

const LOGIN = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local sign-in</title>
<body style="font:16px/1.5 system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem">
<h1>Local sign-in</h1><p>Pretend to be anyone. Nothing here touches the real site.</p>
<p><input id="e" placeholder="first.last" style="font:inherit;padding:8px;width:100%;box-sizing:border-box"></p>
<p><button onclick="go(e.value)">Sign in</button> <button onclick="go('alex.burns6')">Sign in as Alex (sees held scores)</button></p>
<p><a href="/games.html">Games</a> · <a href="/tas.html">TAS</a></p>
<script>
const e = document.getElementById("e");
function go(v){ v = String(v || "").trim(); if (!v) return; if (!v.includes("@")) v += "@education.nsw.gov.au";
  localStorage.setItem("tt.creds", JSON.stringify({ email: v, password: "local" })); localStorage.setItem("tt.email", JSON.stringify(v));
  sessionStorage.clear(); location.href = "/games.html"; }
</script>`;

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (u.pathname === "/local-login") { res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.end(LOGIN); }
  if (u.pathname.startsWith("/api/")) {
    const h = api[u.pathname.slice(5).replace(/\/$/, "")];
    let raw = "";
    for await (const c of req) raw += c;
    if (!h) { res.setHeader("Content-Type", "application/json"); return res.end("{}"); }
    let body; try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }
    const out = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(c) { res.statusCode = c; return out; },
      json(d) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(d)); },
      end(d) { res.end(d); }
    };
    try { await h({ method: req.method, headers: req.headers, query: Object.fromEntries(u.searchParams), body }, out); }
    catch (e) { console.error(e); if (!res.writableEnded) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) })); } }
    return;
  }
  let path = u.pathname === "/" ? "/index.html" : u.pathname === "/tas" ? "/tas.html" : decodeURIComponent(u.pathname);
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || file.includes(sep + ".") || path === "/sw.js") { res.statusCode = 404; return res.end(); }
  try { const data = await readFile(file); res.setHeader("Content-Type", TYPES[extname(file)] || "application/octet-stream"); res.end(data); }
  catch { res.statusCode = 404; res.end("Not found"); }
}).listen(port, () => console.log("http://localhost:" + port + "/local-login"));

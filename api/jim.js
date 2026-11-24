/*
 * GET  /api/jim                    → { scores: [{ name, score }, …] }  (highest first)
 * POST /api/jim { name, add }      → { score }   add 1–500 presses to that name
 * POST /api/jim { name, reset:true } → { score:0 }
 *
 * The Jim Button's shared "Hall of Pressers". Unlike every other board this one
 * does NOT use whoami: a player is just the first name they type, exactly as
 * in the original Firebase version, so it keeps working when the school API is
 * down. Anyone can press under any name — that is the game.
 *
 * Presses are batched by the client (one POST per ~second of pressing), and
 * the increment is done in SQL so two tabs pressing at once never lose a press.
 *
 * Jim Together (the multiplayer card) shares this table, under names a Jim
 * player can't type (they must start with a letter or digit):
 *   "~ALL"      every press by everyone, one shared count
 *   "~<email>"  each signed-in player's share of it (whoami; signed-out presses
 *               still count towards ~ALL)
 * GET  /api/jim?together=1          → { total, top: [{ name, score }, …] }
 *      …&me=1 (signed in)           → also me: { name, score }
 * POST /api/jim { together:true, add } → { total, mine, name }
 *
 * Table + function (SQL in SETUP.md):
 *   jim_score(name text primary key, score bigint, updated_at timestamptz)
 *   jim_press(p_name text, p_add int) returns bigint
 */

import { db, whoami } from "./_supabase.js";
import { limited, slowDown, ipOf, crossSite } from "./_limit.js";
import { displayNames, withName, nameFromLocal } from "./_names.js";

const ALL = "~ALL";
const TOP = 20;

/* the shared count and the biggest contributors, by their usual names */
async function together() {
  const [{ data: all, error: e1 }, { data: rows, error: e2 }] = await Promise.all([
    db.from("jim_score").select("score").eq("name", ALL).maybeSingle(),
    db.from("jim_score").select("name, score").like("name", "~%@%").gt("score", 0)
      .order("score", { ascending: false }).limit(TOP)
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  const names = await displayNames();
  return { total: Number(all && all.score) || 0,
           top: (rows || []).map(r => { const email = r.name.slice(1);
             return { name: withName(names, email, nameFromLocal(email.split("@")[0])), score: Number(r.score) || 0 }; }) };
}

const MAX_ADD = 500;          // presses per request; turbo mode at full tilt stays well under
const MAX_ROWS = 1000;

/* same shape the original accepted: up to 18 characters, stored uppercase */
function cleanName(raw) {
  const n = String(raw || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!n || n.length > 18) return null;
  if (!/^[A-Z0-9][A-Z0-9 .'_-]*$/.test(n)) return null;
  return n;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "The scoreboard isn't configured on the server." });

  if (req.method === "GET" && req.query && req.query.together) {
    try {
      const out = await together();
      /* ?me=1: your own row too (signed in), so the page knows your name and share */
      if (req.query.me) {
        const me = await whoami(req).catch(() => null);
        if (me && me.email) {
          const email = me.email.toLowerCase();
          const { data } = await db.from("jim_score").select("score").eq("name", "~" + email).maybeSingle();
          out.me = { name: withName(await displayNames(), email, nameFromLocal(email.split("@")[0])), score: Number(data && data.score) || 0 };
        }
      }
      return res.status(200).json(out);
    }
    catch (e) { console.error("jim together get:", e.message); return res.status(502).json({ error: "Couldn't load the count." }); }
  }

  if (req.method === "GET") {
    const { data, error } = await db.from("jim_score")
      .select("name, score").gt("score", 0).not("name", "like", "~%")
      .order("score", { ascending: false }).limit(MAX_ROWS);
    if (error) { console.error("jim get:", error.message); return res.status(502).json({ error: "Couldn't load the scoreboard." }); }
    return res.status(200).json({ scores: data || [] });
  }

  if (req.method === "POST") {
    /* no sign-in here by design, so: only from this site's own page, and not faster than a keen presser */
    if (crossSite(req)) return res.status(403).json({ error: "Open this from the site itself." });
    if (limited("jim:" + ipOf(req), 600, 60e3)) return slowDown(res);
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }

    if (body && body.together === true) {
      const add = Math.floor(Number(body.add));
      if (!(add >= 1 && add <= MAX_ADD)) return res.status(400).json({ error: "Bad press count." });
      const me = await whoami(req).catch(() => null);
      const [tot, mine] = await Promise.all([
        db.rpc("jim_press", { p_name: ALL, p_add: add }),
        me && me.email ? db.rpc("jim_press", { p_name: "~" + me.email.toLowerCase(), p_add: add }) : Promise.resolve({ data: null })
      ]);
      if (tot.error || mine.error) { console.error("jim together press:", (tot.error || mine.error).message); return res.status(502).json({ error: "Couldn't save the press." }); }
      let name = null;
      if (me && me.email) name = withName(await displayNames(), me.email, nameFromLocal(me.email.split("@")[0]));
      return res.status(200).json({ total: Number(tot.data) || 0, mine: mine.data == null ? null : Number(mine.data) || 0, name });
    }

    const name = cleanName(body && body.name);
    if (!name) return res.status(400).json({ error: "That name can't be used." });

    if (body.reset === true) {
      const { error } = await db.from("jim_score")
        .upsert({ name, score: 0, updated_at: new Date().toISOString() });
      if (error) { console.error("jim reset:", error.message); return res.status(502).json({ error: "Couldn't reset." }); }
      return res.status(200).json({ score: 0 });
    }

    const add = Math.floor(Number(body.add));
    if (!(add >= 1 && add <= MAX_ADD)) return res.status(400).json({ error: "Bad press count." });
    const { data, error } = await db.rpc("jim_press", { p_name: name, p_add: add });
    if (error) { console.error("jim press:", error.message); return res.status(502).json({ error: "Couldn't save the press." }); }
    return res.status(200).json({ score: Number(data) || 0 });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

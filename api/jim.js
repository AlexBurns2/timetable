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
 *   "~<email>"   each signed-in player's presses (whoami)
 *   "~anon:<id>" a signed-out player's, by a random id their browser keeps
 * The shared count is the sum of every "~" row. Each row is only written by
 * its own player, one batch at a time, so a plain read-then-write is safe and
 * it doesn't need the jim_press function (the live database didn't have it).
 * GET  /api/jim?together=1          → { total, anon, top: [{ name, score }, …] }  (anon: signed-out presses)
 *      …&me=1 (signed in)           → also me: { name, score }
 * POST /api/jim { together:true, add, anon } → { total, mine, name }
 *
 * Table + function (SQL in SETUP.md):
 *   jim_score(name text primary key, score bigint, updated_at timestamptz)
 *   jim_press(p_name text, p_add int) returns bigint
 */

import { db, whoami } from "./_supabase.js";
import { limited, slowDown, ipOf, crossSite } from "./_limit.js";
import { displayNames, withName, nameFromLocal, yearTags, withYear } from "./_names.js";
import { isBanned, bannedIn } from "./_settings.js";

/* Bans (moderator page → Bans, game "jimall"): a banned player's presses are refused and they're left off the
   top list. Their row stays as it was, and so does the shared count. */
const BANNED = { error: "A moderator has taken you off Button Pushers.", banned: true };

/* a Together player's name as the board shows it: "Andre Kwok (Year 12)" */
async function boardName(email) {
  const [names, tags] = await Promise.all([displayNames(), yearTags()]);
  return withYear(withName(names, email, nameFromLocal(email.split("@")[0])), tags, email);
}

/* add to one player's row (read, then write the new count) */
async function bump(key, add) {
  const { data: ex, error: e1 } = await db.from("jim_score").select("score").eq("name", key).maybeSingle();
  if (e1) throw new Error(e1.message);
  const score = (Number(ex && ex.score) || 0) + add;
  const { error: e2 } = await db.from("jim_score").upsert({ name: key, score, updated_at: new Date().toISOString() });
  if (e2) throw new Error(e2.message);
  return score;
}
/* every Together row added up (and the signed-out ones on their own), a page of 1000 at a time */
async function totalOf() {
  let sum = 0, anon = 0;
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await db.from("jim_score").select("name, score").like("name", "~%").range(from, from + 999);
    if (error) throw new Error(error.message);
    (data || []).forEach(r => { if (r.name === "~ALL") return; const n = Number(r.score) || 0; sum += n; if (r.name.startsWith("~anon:")) anon += n; });
    if (!data || data.length < 1000) break;
  }
  return { sum, anon };
}
/* Adding every row up on each call was most of this route's server time (24 November 2026), so a server instance keeps
   the last full count for a minute and adds the presses it saves itself on top. Another instance's presses show up
   within a minute (the pages only ask every 5 minutes now); the page only ever moves its count up (Math.max), so a
   slightly old total does no harm. */
const TOTAL_TTL = 60e3;
let TOTAL = null;                                     // { sum, anon, at }
async function totalCached() {
  if (TOTAL && Date.now() - TOTAL.at < TOTAL_TTL) return TOTAL;
  const t = await totalOf();
  TOTAL = { sum: t.sum, anon: t.anon, at: Date.now() };
  return TOTAL;
}
const TOP = 20;

/* the shared count and the biggest contributors, by their usual names */
async function together() {
  const banned = await bannedIn("jimall");
  const [total, { data: rows, error: e2 }] = await Promise.all([
    totalCached(),
    db.from("jim_score").select("name, score").like("name", "~%@%").gt("score", 0)
      .order("score", { ascending: false }).limit(TOP + banned.size)
  ]);
  if (e2) throw new Error(e2.message);
  const [names, tags] = await Promise.all([displayNames(), yearTags()]);
  return { total: total.sum, anon: total.anon,
           top: (rows || []).filter(r => !banned.has(r.name.slice(1).toLowerCase())).slice(0, TOP).map(r => { const email = r.name.slice(1);
             return { name: withYear(withName(names, email, nameFromLocal(email.split("@")[0])), tags, email), score: Number(r.score) || 0 }; }) };
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
          out.me = { name: await boardName(email), score: Number(data && data.score) || 0 };
          if (await isBanned(email, "jimall")) out.banned = true;
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
      /* a banned player is turned away before the sign-in check, which is the costly part (the address they send
         is enough to refuse them: refusing never helps anyone pretending to be someone else) */
      const said = String(req.headers["x-school-email"] || "").trim().toLowerCase();
      if (said.includes("@") && await isBanned(said, "jimall")) return res.status(403).json(BANNED);
      const me = await whoami(req).catch(() => null);
      if (me && me.email && await isBanned(me.email, "jimall")) return res.status(403).json(BANNED);
      const anon = /^[a-z0-9]{8,40}$/.test(String(body.anon || "")) ? String(body.anon) : null;
      const key = me && me.email ? "~" + me.email.toLowerCase() : anon ? "~anon:" + anon : null;
      if (!key) return res.status(400).json({ error: "Who's pressing?" });
      /* the page sends at most every few minutes (more only when it has 500 presses waiting), so a player sending
         much more often than that is a script: slowed down here, before anything is read or written */
      if (limited("jimp:" + key, 20, 60e3)) return slowDown(res);
      let mine, total;
      try {
        mine = await bump(key, add);
        if (TOTAL && Date.now() - TOTAL.at < TOTAL_TTL) { TOTAL.sum += add; if (key.startsWith("~anon:")) TOTAL.anon += add; total = TOTAL.sum; }
        else total = (await totalCached()).sum;
      }
      catch (e) { console.error("jim together press:", e.message); return res.status(502).json({ error: "Couldn't save the press." }); }
      let name = null;
      if (me && me.email) name = await boardName(me.email);
      return res.status(200).json({ total, mine: me && me.email ? mine : null, name });
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

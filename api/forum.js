/*
 * Tiny school forum for the home page — post, reply, and that's it.
 *
 * GET  /api/forum                        → { posts:[ {id,name,body,at,mine,replies:[…]} ] }
 * POST /api/forum {body}                 → new thread, returns { id }
 * POST /api/forum {body, parent}         → reply on that thread
 * POST /api/forum {action:'delete', id}  → author (or an admin) removes a post
 * POST /api/forum {action:'react', id, emoji} → add that reaction, or take it
 *                                         back if you'd already added it
 * A thread can be for everyone, your year, or one of your classes: {body, scope:'all' | 'year' |
 * 'class:<code>'} (you have to be in the class); replies go where their thread is. You only see the
 * ones for you (moderators see all). Needs the scope columns below; until then everything is for
 * everyone, as before.
 * Replies from the moderators to one person, and name-change requests, ride here too (_notice.js):
 *   GET ?notices=1; POST {action:'noticeread' | 'noticesend' | 'requestname' | 'nameapply', …}
 *
 * The weekly anonymous poll on Home rides on this route too (see _poll.js):
 *   GET  /api/forum?poll=1 | history | admin
 *   GET  /api/forum?withpoll=1  → the posts and this week's poll together (Home's first load)
 *   POST /api/forum?scan=<name>&device=&first=&signedin=  → a QR scan noted (q.html; no sign-in)
 *   GET  /api/forum?scans=1     → moderators: QR scans by code
 *   POST /api/forum {action:'pollvote' | 'pollsuggest' | 'pollset' | 'pollsubjects' | 'polldel' | 'suggestdel' | 'featuresuggest', …}
 *   GET  /poll  (rewritten to /api/forum?og=1) → the share link's preview page
 *
 * Same identity model as the rest of the site: whoami() re-verifies the school
 * credentials already being sent, and the display name is derived server-side.
 * Full emails are never returned to the browser; since 25 November 2026 each post
 * carries its poster's login name (`handle`, the part before the @) so people can
 * tag each other ("@alex.burns6", the owner's choice), and `notes` lists replies in
 * your threads and posts tagging you (Home's notifications; worked out, not stored).
 *
 * Table (Supabase → SQL editor):
 *   create table forum_post (
 *     id         text primary key,
 *     email      text not null,
 *     body       text not null,
 *     parent     text,
 *     created_at timestamptz not null default now()
 *   );
 *   create index forum_post_parent_idx on forum_post (parent, created_at);
 *   -- RLS off: the service-role key is the only thing that touches it.
 *
 * Reactions (a separate table, so posts are never rewritten to count them).
 * Until it exists the forum works as before, just without reactions:
 *   create table forum_reaction (
 *     post_id    text not null,
 *     email      text not null,
 *     emoji      text not null,
 *     created_at timestamptz not null default now(),
 *     primary key (post_id, email, emoji)
 *   );
 *   create index forum_reaction_post_idx on forum_reaction (post_id);
 *
 * Who a thread is for (run once; every existing post stays "for everyone"; nothing is deleted):
 *   alter table forum_post add column if not exists scope      text not null default 'all';
 *   alter table forum_post add column if not exists scope_name text;
 *
 * Added 25 November 2026, with no new tables or columns:
 *   As the site: a moderator can post or reply as "MSC Unofficial" ({body, as:'msc'}). The row's email is just
 *     "~msc": nothing on the page or in the database says which moderator wrote it, on purpose. Any moderator
 *     can delete one.
 *   Votes to hide (the owner's design): someone starts a vote on a post, which counts as their YES, and is named
 *     on it ("Vote by: …"). Everyone else answers YES or NO: POST {action:'hidevote', id, vote:'yes'|'no'}. A vote
 *     can't be taken back. HIDE_AT yeses fold the post away behind "Show content"; KEEP_AT noes and it stays; either
 *     way the vote is then over (whichever count got there first). A vote is a forum_reaction row with emoji
 *     "~hide" (yes) or "~keep" (no): no real emoji can be those, so the reactions never show them. Nothing is
 *     deleted. You can't vote on your own posts or the site's. Moderators can clear a post's votes, which also
 *     lets a new vote start: POST {action:'hideclear', id}.
 */

import { db, whoami, isAdmin } from "./_supabase.js";
import { limited, slowDown, ipOf, crossSite } from "./_limit.js";
import { displayNames, withName, rosterList } from "./_names.js";
import { pollGet, pollPost, pollPreview, pollClock, pickFor, hasAudience } from "./_poll.js";
import { resolveYear } from "./_daily.js";
import { fetchAsOwner } from "./timetable.js";
import { noticeGet, noticePost, noticeSent } from "./_notice.js";

/* ── who a thread is for ─────────────────────────────────────────────── */
let scopeCol = { at: 0, ok: null };
async function hasScope() {
  if (scopeCol.ok !== null && Date.now() - scopeCol.at < 10 * 60e3) return scopeCol.ok;
  const { error } = await db.from("forum_post").select("scope").limit(1);
  scopeCol = { at: Date.now(), ok: !error };
  return scopeCol.ok;
}
/* someone's classes, code → subject, from their timetable (read as the server account), kept 6 hours */
const NOT_A_CLASS = /\b(sport|study|wellbeing|mentor|roll ?call|homeroom|pastoral|assembly|tutorial|recess|lunch|break)\b/i;
const tidySubject = name => String(name || "").replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i, "")
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/, "").replace(/^[\s:\-–—]+/, "").trim();
const classCache = new Map();
async function classesOf(email) {
  const hit = classCache.get(email);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.map;
  const raw = await fetchAsOwner("/api/timetable/" + encodeURIComponent(email));
  const rows = Array.isArray(raw) ? raw : (raw && (raw.timetable || raw.Timetable)) || [];
  const map = new Map();
  for (const r of rows) {
    const code = String(r.ClassCode || r.classCode || "").trim(), subject = tidySubject(r.CourseName || r.courseName || "");
    if (code && subject && !NOT_A_CLASS.test(subject) && !map.has(code)) map.set(code, subject);
  }
  if (classCache.size > 2000) classCache.clear();
  classCache.set(email, { at: Date.now(), map });
  return map;
}
/* a student's year when the login didn't carry it: the (cached) directory first,
   so staff, who aren't in it, cost nothing; the slower lookup only if needed */
async function yearOf(me) {
  try {
    const p = (await rosterList()).find(x => x.email === me.email);
    if (!p) return null;
    if (p.year) return String(p.year);
  } catch {}
  return resolveYear(me).catch(() => null);
}

/* everyone's year, email → "12", from the (cached) directory: for "only my year" and the moderators' view */
async function yearsByEmail() {
  try { return new Map((await rosterList()).filter(p => p.year).map(p => [String(p.email).toLowerCase(), String(p.year)])); }
  catch { return new Map(); }
}

/* display-name overrides, loaded per request (see _names.js) */
let NAMES = new Map();

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const local = String(email).split("@")[0];
  const parts = local.split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(local.replace(/\d+$/, "")) || "Someone";
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const MAX_BODY = 1000;
const MAX_THREADS = 60;
const MAX_REACTIONS_EACH = 6;            // different emoji one person can put on one post
const HIDE = "~hide", KEEP = "~keep";    // a YES / NO vote on hiding a post, in forum_reaction (see the top of this file)
const isVote = e => e === HIDE || e === KEEP;
const HIDE_AT = 8, KEEP_AT = 4;          // yeses that fold a post away, noes that keep it (the owner's numbers, 25 November 2026)
/* a post's vote from its rows, oldest first: who started it, the tally, and how it ended (whichever count got there first) */
function voteOf(rows) {
  const list = (rows || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const start = list.find(r => r.emoji === HIDE);
  if (!start) return null;
  let yes = 0, no = 0, over = null;
  for (const r of list) {
    if (r.emoji === HIDE) yes++; else no++;
    if (!over && yes >= HIDE_AT) over = "hidden";
    if (!over && no >= KEEP_AT) over = "kept";
  }
  return { start, yes, no, over };
}
const MSC = "~msc", MSC_NAME = "MSC Unofficial";    // a post made as the site: no trace of which moderator wrote it
const isSite = email => String(email || "") === MSC;
/* someone's tag: their school login name ("@alex.burns6", the owner's choice); MSC Unofficial's is "@msc" */
const handleOf = email => isSite(email) ? "msc" : String(email || "").split("@")[0].toLowerCase();
/* the tags in a post: @ then a login name (dots inside it, not at its end, so "@ava.one12." is ava.one12) */
const tagsIn = text => [...String(text || "").matchAll(/(?:^|[^a-z0-9._@-])@([a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)/gi)].map(m => m[1].toLowerCase());
/* one emoji (with any skin tone, joiners or variation selectors), nothing else */
const isEmoji = e => typeof e === "string" && e.length <= 16 &&
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Emoji_Component}|\u200D|\uFE0F)+$/u.test(e) &&
  /\p{Extended_Pictographic}/u.test(e) &&
  (typeof Intl.Segmenter !== "function" || [...new Intl.Segmenter().segment(e)].length === 1);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  /* the poll's share link: a page with the question in its preview, then on to Home */
  if ((req.method === "GET" || req.method === "HEAD") && req.query.og) return pollPreview(req, res);

  if (!db) return res.status(503).json({ error: "The forum is not configured on the server." });
  /* a QR code was scanned (q.html, from /q/<name>): note it. Nothing about who:
     the name, the time, the kind of device, whether that device had scanned one
     before and whether it's signed in to the site. Table qr_scan (SETUP.md). */
  if (req.method === "POST" && req.query.scan) {
    const code = String(req.query.scan).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32) || "none";
    const device = ["phone", "tablet", "computer"].includes(req.query.device) ? req.query.device : null;
    if (/bot|crawl|spider|preview|facebookexternalhit|slurp/i.test(String(req.headers["user-agent"] || ""))) return res.status(204).end();
    /* it needs no sign-in, so: only from this site's own page, and only so many from one network */
    if (crossSite(req) || limited("qr:" + ipOf(req), 30, 10 * 60e3)) return res.status(204).end();
    const { error } = await db.from("qr_scan").insert({ code, device, first: req.query.first === "1", signed_in: req.query.signedin === "1" });
    if (error) console.error("qr scan:", error.message);
    return res.status(204).end();
  }
  const t0 = Date.now();
  const me = await whoami(req);
  /* signed out (someone opening a friend's link): the question only, to sign in for */
  if (!me && req.method === "GET" && req.query.poll === "1") {
    try {
      const clock = pollClock();
      /* everyone's question (a group's own needs to know whose year you're in, so it waits for you to sign in) */
      const A = await hasAudience();
      const { data: rows } = await db.from("poll").select("week, question, kind, anim, celebrate, reveal" + (A ? ", audience" : "")).eq("week", clock.week);
      const data = (rows || []).find(r => !r.audience || r.audience === "all") || null;
      /* how many people have voted, all years together: a count, nothing more */
      let total = 0;
      if (data) {
        const { data: t } = await db.from("poll_tally").select("votes").eq("week", data.week).eq("choice", "__n");
        total = (t || []).reduce((a, r) => a + (r.votes || 0), 0);
      }
      return res.status(200).json({ clock, poll: data ? { week: data.week, question: data.question, kind: data.kind,
        anim: data.anim || "surprise", celebrate: data.celebrate || "surprise", reveal: data.reveal || "", total, phase: clock.phase, signedOut: true } : null });
    } catch { return res.status(200).json({ poll: null }); }
  }
  if (!me) return res.status(401).json({ error: "Sign in to use the forum." });
  /* the timetable page's small "new poll" note: is there a poll this week, and
     have you voted. Nothing else, so it stays cheap. */
  if (req.method === "GET" && req.query.pollpeek) {
    try {
      const clock = pollClock();
      /* your group's question, or everyone's */
      if (!me.year) me.year = await yearOf(me).catch(() => null);
      const A = await hasAudience();
      const { data: rows } = await db.from("poll").select("week" + (A ? ", audience" : "")).eq("week", clock.week);
      const p = pickFor(rows, me);
      if (!p) return res.status(200).json({ week: clock.week, has: false });
      const { data: v } = await db.from("poll_voter").select("email").eq("week", p.week).eq("email", me.email).maybeSingle();
      return res.status(200).json({ week: p.week, has: true, open: clock.phase === "open", voted: !!v });
    } catch { return res.status(200).json({ has: false }); }
  }
  /* the vault (vault.html, linked from nowhere): POST notes that you found it
     (the first time only) and answers with everyone who has, in order, by the
     names people go by. Table vault_visit (SETUP.md). */
  if (req.query.vault) {
    try {
      if (req.method === "POST") {
        const { error: e1 } = await db.from("vault_visit").upsert({ email: me.email }, { onConflict: "email", ignoreDuplicates: true });
        if (e1) throw new Error(e1.message);
      }
      const { data, error } = await db.from("vault_visit").select("email, at").order("at", { ascending: true }).order("email").limit(5000);
      if (error) throw new Error(error.message);
      const names = await displayNames();
      const list = (data || []).map(r => ({ n: withName(names, r.email, nameFromEmail(r.email)), at: r.at, me: r.email === me.email }));
      return res.status(200).json({ rank: list.findIndex(x => x.me) + 1, total: list.length, list });
    } catch (e) {
      console.error("vault:", e.message);
      return res.status(503).json({ error: "Sealed for now." });
    }
  }
  NAMES = await displayNames();
  const isOwner = isAdmin(me.email);
  /* moderators: QR scans by code, all time, with the last 14 days day by day */
  if (req.method === "GET" && req.query.scans) {
    if (!isOwner) return res.status(403).json({ error: "Moderators only." });
    const { data, error } = await db.from("qr_scan").select("code, at, device, first, signed_in").order("at", { ascending: false }).limit(20000);
    if (error) return res.status(200).json({ codes: [], missing: /does not exist|relation|schema cache/i.test(error.message) });
    const today = new Date(Date.now() + 10 * 3600e3).toISOString().slice(0, 10);           // roughly Sydney's day
    const dayOf = iso => new Date(new Date(iso).getTime() + 10 * 3600e3).toISOString().slice(0, 10);
    const days = Array.from({ length: 14 }, (_, i) => new Date(Date.parse(today) - (13 - i) * 864e5).toISOString().slice(0, 10));
    const by = new Map();
    for (const r of data || []) {
      const c = by.get(r.code) || by.set(r.code, { code: r.code, scans: 0, firsts: 0, signedIn: 0, phone: 0, last: r.at, days: Object.fromEntries(days.map(d => [d, 0])) }).get(r.code);
      c.scans++; if (r.first) c.firsts++; if (r.signed_in) c.signedIn++; if (r.device === "phone") c.phone++;
      const d = dayOf(r.at); if (d in c.days) c.days[d]++;
    }
    return res.status(200).json({ days, codes: [...by.values()].map(c => ({ ...c, days: days.map(d => c.days[d]) })).sort((a, b) => b.scans - a.scans) });
  }

  if (req.method === "GET" && req.query.poll) {
    if (!me.year) me.year = await yearOf(me);
    return pollGet(req, res, me, NAMES);
  }
  if (req.method === "GET" && req.query.notices) {
    if (req.query.notices !== "sent") return noticeGet(req, res, me);
    if (!isOwner) return res.status(403).json({ error: "Moderators only." });
    return noticeSent(res, e => withName(NAMES, e, nameFromEmail(e)));
  }
  /* Home asks for the forum and this week's poll together (?withpoll=1): one trip
     instead of two. The poll is worked out alongside the posts; if it fails, the
     posts still come back and the poll is null (Home then shows no poll card). */
  let pollAlong = null;
  if (req.method === "GET" && req.query.withpoll) pollAlong = (async () => {
    try {
      if (!me.year) me.year = await yearOf(me);
      const cap = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
      await pollGet({ query: { poll: "1" } }, cap, me, NAMES);
      return cap.code === 200 ? cap.body : null;
    } catch (e) { console.error("poll with forum:", e.message); return null; }
  })();

  if (req.method === "GET") {
    const scoped = await hasScope();
    const { data: all, error } = await db.from("forum_post")
      .select("id, email, body, parent, created_at" + (scoped ? ", scope, scope_name" : ""))
      .order("created_at", { ascending: false }).limit(600);
    if (error) { console.error("forum read:", error.message); return res.status(502).json({ error: "Couldn't load the forum." }); }
    /* only the threads for you: everyone's, your year's, your classes'. A moderator sees the forum the
       same way, and every thread with ?all=1 (Home's "All posts", and the moderator page), to check them. */
    const seeAll = isOwner && req.query.all === "1";
    let data = all || [];
    if (scoped && !seeAll && data.some(r => r.scope && r.scope !== "all")) {
      if (!me.year) me.year = await yearOf(me);
      const mine = data.some(r => String(r.scope).startsWith("class:")) ? await classesOf(me.email).catch(() => new Map()) : new Map();
      data = data.filter(r => !r.scope || r.scope === "all" || r.scope === "year:" + me.year || (String(r.scope).startsWith("class:") && mine.has(String(r.scope).slice(6))));
    }
    /* your notifications (Home): replies in your threads, and posts that tag you, by anyone else, from the last three
       weeks of what you can see. Worked out here from the posts already read: nothing is stored. A moderator also hears
       about replies to MSC Unofficial's threads and tags of @msc (which says nothing about who wrote them). */
    const notes = [];
    {
      const minePost = e => e === me.email || (isOwner && isSite(e));
      const myTags = new Set([handleOf(me.email), ...(isOwner ? ["msc"] : [])]);
      const starter = new Map(data.filter(r => !r.parent).map(r => [r.id, r.email]));
      const since = Date.now() - 21 * 864e5;
      for (const r of data) {
        if (notes.length >= 20) break;
        if (minePost(r.email) || Date.parse(r.created_at) < since) continue;
        const tagged = tagsIn(r.body).some(t => myTags.has(t));
        const onMine = !!r.parent && minePost(starter.get(r.parent));
        if (!tagged && !onMine) continue;
        notes.push({ id: r.id, thread: r.parent || r.id, kind: onMine ? "reply" : "tag", at: r.created_at,
          name: isSite(r.email) ? MSC_NAME : withName(NAMES, r.email, nameFromEmail(r.email)),
          text: String(r.body).replace(/\s+/g, " ").slice(0, 120) });
      }
    }
    /* "Only my year" (Home's toggle, ?only=year): threads started by someone in another year are left
       out. Threads from people with no year here (staff) stay, as do threads aimed at a year or a class,
       and a thread kept keeps all its replies, so no conversation is cut in half. */
    const onlyYear = req.query.only === "year" && !seeAll;
    if (!me.year) me.year = await yearOf(me);
    const years = onlyYear && me.year || isOwner ? await yearsByEmail() : null;
    if (onlyYear && me.year) {
      const mineYr = String(me.year);
      data = data.filter(r => r.parent || (r.scope && r.scope !== "all") || !years.has(String(r.email).toLowerCase()) || years.get(String(r.email).toLowerCase()) === mineYr);
    }

    /* everyone's reactions, as counts per emoji plus whether one is yours.
       If the table isn't there yet, posts simply have none. */
    const reacts = new Map(), hides = new Map();
    {
      const ids = (data || []).map(r => r.id);
      const { data: rx, error: rxErr } = ids.length
        ? await db.from("forum_reaction").select("post_id, email, emoji, created_at").in("post_id", ids).limit(20000)
        : { data: [], error: null };
      if (!rxErr) for (const x of rx || []) {
        /* a YES or NO on hiding the post: kept aside for voteOf() */
        if (isVote(x.emoji)) { (hides.get(x.post_id) || hides.set(x.post_id, []).get(x.post_id)).push(x); continue; }
        const list = reacts.get(x.post_id) || reacts.set(x.post_id, []).get(x.post_id);
        let e = list.find(o => o.emoji === x.emoji);
        if (!e) { e = { emoji: x.emoji, count: 0, mine: false, who: [], first: String(x.created_at) }; list.push(e); }
        e.count++;
        /* who reacted, by display name (never email); you are "mine", not a name */
        if (x.email === me.email) e.mine = true;
        else if (e.who.length < 30) e.who.push(withName(NAMES, x.email, nameFromEmail(x.email)));
        if (String(x.created_at) < e.first) e.first = String(x.created_at);
      }
    }
    const reactionsOf = id => (reacts.get(id) || [])
      .sort((a, b) => b.count - a.count || a.first.localeCompare(b.first))
      .map(({ emoji, count, mine, who }) => ({ emoji, count, mine, who }));
    /* the vote on hiding a post: who started it (by name), the tally, your own answer, and whether it's over */
    const hideOf = id => { const rows = hides.get(id), v = voteOf(rows); if (!v) return undefined;
      const mine = (rows || []).find(r => r.email === me.email);
      return { yes: v.yes, no: v.no, by: withName(NAMES, v.start.email, nameFromEmail(v.start.email)), byMe: v.start.email === me.email,
               mine: mine ? (mine.emoji === HIDE ? "yes" : "no") : null, hidden: v.over === "hidden", kept: v.over === "kept" }; };
    const shape = r => ({
      id: r.id, name: isSite(r.email) ? MSC_NAME : withName(NAMES, r.email, nameFromEmail(r.email)), body: r.body, at: r.created_at,
      handle: handleOf(r.email),                    // for tagging them in a reply

      /* mine: yours. canDelete: yours, or anyone's for a moderator (the page
         shows a moderator's delete on other people's posts only on hover) */
      mine: r.email === me.email, canDelete: r.email === me.email || isOwner, reactions: reactionsOf(r.id),
      /* posted as the site (who wrote it isn't kept anywhere) */
      ...(isSite(r.email) ? { official: true } : {}),
      /* votes to hide it (who started them is shown), and whether you can vote: not on your own, not on the site's */
      hide: hideOf(r.id), canHide: !isSite(r.email) && r.email !== me.email,
      /* who it's for, when it isn't everyone */
      for: r.scope && r.scope !== "all" ? (String(r.scope).startsWith("year:") ? (r.scope_name || "Year " + String(r.scope).slice(5)) : (r.scope_name ? r.scope_name + " class" : "One class")) : undefined,
      /* moderators only: who it's for exactly, and the poster's year (the moderator page can change it) */
      ...(isOwner && !r.parent ? { scope: r.scope || "all", pyear: years.get(String(r.email).toLowerCase()) || null } : {})
    });
    const rows = data || [];
    const threads = rows.filter(r => !r.parent).slice(0, MAX_THREADS).map(shape);
    const byParent = new Map();
    for (const r of rows) {
      if (!r.parent) continue;
      if (!byParent.has(r.parent)) byParent.set(r.parent, []);
      byParent.get(r.parent).push(r);
    }
    threads.forEach(t => {
      t.replies = (byParent.get(t.id) || [])
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map(shape);
    });
    if (pollAlong) {
      const poll = await pollAlong, ms = Date.now() - t0;
      if (ms > 2500) console.warn("home load slow: " + ms + "ms");          // to see in the logs if it's still slow
      return res.status(200).json({ posts: threads, poll, scopes: scoped, year: me.year || undefined, only: onlyYear && !!me.year ? "year" : undefined,
        mod: isOwner || undefined, all: seeAll || undefined, hideAt: HIDE_AT, keepAt: KEEP_AT, notes, me: handleOf(me.email) });
    }
    return res.status(200).json({ posts: threads, scopes: scoped, year: me.year || undefined, only: onlyYear && !!me.year ? "year" : undefined,
      mod: isOwner || undefined, all: seeAll || undefined, hideAt: HIDE_AT, keepAt: KEEP_AT, notes, me: handleOf(me.email) });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    body = body || {};

    if (/^(noticeread|noticesend|noticeto|requestname|nameapply)$/.test(String(body.action || ""))) {
      if (body.action === "requestname" && limited("ask:" + me.email, 6, 3600e3)) return slowDown(res);
      return noticePost(body, res, me);
    }
    if (/^(poll|suggestdel$|featuresuggest$)/.test(String(body.action || ""))) {
      if (!me.year) me.year = await yearOf(me);
      return pollPost(body, res, me, NAMES);
    }

    if (body.action === "react") {
      if (limited("react:" + me.email, 90, 60e3)) return slowDown(res);
      const id = String(body.id || ""), emoji = String(body.emoji || "");
      if (!isEmoji(emoji)) return res.status(400).json({ error: "That isn't an emoji." });
      const { data: post } = await db.from("forum_post").select("id").eq("id", id).maybeSingle();
      if (!post) return res.status(404).json({ error: "That post is gone." });
      const { data: had, error: readErr } = await db.from("forum_reaction").select("emoji")
        .eq("post_id", id).eq("email", me.email);
      if (readErr) { console.error("reaction read:", readErr.message); return res.status(502).json({ error: "Reactions aren't set up yet." }); }
      const already = (had || []).some(r => r.emoji === emoji);
      if (!already && (had || []).filter(r => !isVote(r.emoji)).length >= MAX_REACTIONS_EACH)
        return res.status(400).json({ error: "That's enough reactions on one post." });
      const { error } = already
        ? await db.from("forum_reaction").delete().eq("post_id", id).eq("email", me.email).eq("emoji", emoji)
        : await db.from("forum_reaction").insert({ post_id: id, email: me.email, emoji });
      if (error) { console.error("reaction:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
      return res.status(200).json({ ok: true, on: !already });
    }

    /* YES or NO on hiding someone else's post; a YES on a post with no vote starts one (see the top of this file) */
    if (body.action === "hidevote") {
      if (limited("hide:" + me.email, 20, 60e3)) return slowDown(res);
      const id = String(body.id || ""), yes = body.vote !== "no";
      const { data: post } = await db.from("forum_post").select("id, email").eq("id", id).maybeSingle();
      if (!post) return res.status(404).json({ error: "That post is gone." });
      if (post.email === me.email) return res.status(400).json({ error: "You can't vote on hiding your own post." });
      if (isSite(post.email)) return res.status(400).json({ error: "Posts from MSC Unofficial can't be voted on." });
      const { data: rows, error: readErr } = await db.from("forum_reaction").select("email, emoji, created_at").eq("post_id", id).in("emoji", [HIDE, KEEP]);
      if (readErr) { console.error("hide vote read:", readErr.message); return res.status(502).json({ error: "Votes aren't set up yet." }); }
      const v = voteOf(rows);
      if (!v && !yes) return res.status(400).json({ error: "Nobody has started a vote on this post." });
      if ((rows || []).some(r => r.email === me.email)) return res.status(409).json({ error: "You've already voted on this one." });
      if (v && v.over) return res.status(409).json({ error: "That vote is over." });
      const { error } = await db.from("forum_reaction").insert({ post_id: id, email: me.email, emoji: yes ? HIDE : KEEP });
      if (error) { console.error("hide vote:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
      return res.status(200).json({ ok: true, vote: yes ? "yes" : "no" });
    }
    /* moderators: clear the votes on a post, so it shows again (its words and reactions were never touched) */
    if (body.action === "hideclear") {
      if (!isOwner) return res.status(403).json({ error: "Moderators only." });
      const id = String(body.id || "");
      if (!/^[a-z0-9]{1,40}$/i.test(id)) return res.status(400).json({ error: "That isn't a post." });
      const { error } = await db.from("forum_reaction").delete().eq("post_id", id).in("emoji", [HIDE, KEEP]);
      if (error) { console.error("hide clear:", error.message); return res.status(502).json({ error: "Couldn't clear that." }); }
      return res.status(200).json({ ok: true });
    }

    /* moderators: who a thread is for, everyone or a year (its replies follow it). Only who can see it
       changes: the words, the poster, the time and the reactions stay as they are. */
    if (body.action === "scopeset") {
      if (!isOwner) return res.status(403).json({ error: "Moderators only." });
      if (!(await hasScope())) return res.status(409).json({ error: "The forum's new columns aren't there yet (SETUP.md, “Forum: posts for a year or a class”)." });
      const id = String(body.id || ""), want = String(body.scope || "");
      if (!/^[a-z0-9]{1,40}$/i.test(id)) return res.status(400).json({ error: "That isn't a post." });
      let scope, scope_name;
      if (want === "all") { scope = "all"; scope_name = null; }
      else if (/^year:(7|8|9|10|11|12)$/.test(want)) { scope = want; scope_name = "Year " + want.slice(5); }
      else return res.status(400).json({ error: "Pick everyone or a year." });
      const { data: row } = await db.from("forum_post").select("id, parent").eq("id", id).maybeSingle();
      if (!row) return res.status(404).json({ error: "That post is gone." });
      const top = row.parent || row.id;
      const { error: e1 } = await db.from("forum_post").update({ scope, scope_name }).eq("id", top);
      const { error: e2 } = e1 ? { error: null } : await db.from("forum_post").update({ scope, scope_name }).eq("parent", top);
      if (e1 || e2) { console.error("forum scope:", (e1 || e2).message); return res.status(502).json({ error: "Couldn't change that." }); }
      return res.status(200).json({ ok: true, scope });
    }

    if (body.action === "delete") {
      const id = String(body.id || "");
      const { data: row } = await db.from("forum_post").select("email").eq("id", id).maybeSingle();
      if (!row) return res.status(404).json({ error: "That post is already gone." });
      if (row.email !== me.email && !isOwner)
        return res.status(403).json({ error: "You can only delete your own posts." });
      /* its reactions, and its replies' reactions, go too (quietly: the table may not exist) */
      const { data: kids } = await db.from("forum_post").select("id").eq("parent", id);
      await db.from("forum_reaction").delete().in("post_id", [id, ...(kids || []).map(k => k.id)]);
      await db.from("forum_post").delete().eq("parent", id);   // take its replies with it
      const { error } = await db.from("forum_post").delete().eq("id", id);
      if (error) { console.error("forum delete:", error.message); return res.status(502).json({ error: "Couldn't delete that." }); }
      return res.status(200).json({ ok: true });
    }

    const text = String(body.body || "").trim().slice(0, MAX_BODY);
    if (!text) return res.status(400).json({ error: "Write something first." });
    /* a person, not a script: a handful a minute, a few dozen an hour */
    if (limited("post:" + me.email, 8, 60e3) || limited("posth:" + me.email, 60, 3600e3)) return slowDown(res);

    const scoped = await hasScope();
    let parent = null, scope = "all", scope_name = null;
    if (body.parent) {
      parent = String(body.parent);
      const { data: p } = await db.from("forum_post").select("id, parent" + (scoped ? ", scope, scope_name" : "")).eq("id", parent).maybeSingle();
      if (!p) return res.status(404).json({ error: "That thread no longer exists." });
      if (p.parent) parent = p.parent;          // replying to a reply lands on the thread
      /* a reply goes where its thread is, and only someone who can see the thread can reply */
      if (scoped && p.scope && p.scope !== "all") {
        scope = p.scope; scope_name = p.scope_name || null;
        if (!isOwner) {
          if (!me.year) me.year = await yearOf(me);
          const ok = scope === "year:" + me.year || (scope.startsWith("class:") && (await classesOf(me.email).catch(() => new Map())).has(scope.slice(6)));
          if (!ok) return res.status(403).json({ error: "That thread isn't for you." });
        }
      }
    } else if (scoped) {
      const want = String(body.scope || "all");
      if (want === "year") {
        if (!me.year) me.year = await yearOf(me);
        if (!me.year) return res.status(400).json({ error: "Couldn't work out which year you're in." });
        scope = "year:" + me.year; scope_name = "Year " + me.year;
      } else if (want.startsWith("class:")) {
        const code = want.slice(6), mine = await classesOf(me.email).catch(() => new Map());
        if (!mine.has(code)) return res.status(403).json({ error: "You can only post to your own classes." });
        scope = "class:" + code; scope_name = mine.get(code);
      }
    }

    const id = newId();
    /* a moderator posting as the site (MSC Unofficial): the row keeps no trace of which moderator it was */
    if (body.as === "msc" && !isOwner) return res.status(403).json({ error: "Only moderators can post as MSC Unofficial." });
    const row = { id, email: body.as === "msc" ? MSC : me.email, body: text, parent };
    if (scoped) Object.assign(row, { scope, scope_name });
    const { error } = await db.from("forum_post").insert(row);
    if (error) { console.error("forum post:", error.message); return res.status(502).json({ error: "Couldn't post that." }); }
    return res.status(200).json({ id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

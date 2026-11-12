/*
 * Tiny school forum for the home page — post, reply, and that's it.
 *
 * GET  /api/forum                        → { posts:[ {id,name,body,at,mine,replies:[…]} ] }
 * POST /api/forum {body}                 → new thread, returns { id }
 * POST /api/forum {body, parent}         → reply on that thread
 * POST /api/forum {action:'delete', id}  → author (or an admin) removes a post
 * POST /api/forum {action:'react', id, emoji} → add that reaction, or take it
 *                                         back if you'd already added it
 *
 * The weekly anonymous poll on Home rides on this route too (see _poll.js):
 *   GET  /api/forum?poll=1 | history | admin
 *   GET  /api/forum?withpoll=1  → the posts and this week's poll together (Home's first load)
 *   POST /api/forum {action:'pollvote' | 'pollsuggest' | 'pollset' | 'pollsubjects' | 'polldel' | 'suggestdel', …}
 *   GET  /poll  (rewritten to /api/forum?og=1) → the share link's preview page
 *
 * Same identity model as the rest of the site: whoami() re-verifies the school
 * credentials already being sent, the display name is derived server-side, and
 * emails are never returned to the browser.
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
 */

import { db, whoami, isAdmin } from "./_supabase.js";
import { displayNames, withName, rosterList } from "./_names.js";
import { pollGet, pollPost, pollPreview, pollClock } from "./_poll.js";
import { resolveYear } from "./_daily.js";
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
  const t0 = Date.now();
  const me = await whoami(req);
  /* the credits on Home: only for someone signed in (not in any page's source) */
  if (req.method === "GET" && req.query.credits) {
    if (!me) return res.status(401).json({ error: "Sign in to see the credits." });
    return res.status(200).json({ by: ["Alex Burns", "Andre Kwok"] });
  }
  /* signed out (someone opening a friend's link): the question only, to sign in for */
  if (!me && req.method === "GET" && req.query.poll === "1") {
    try {
      const clock = pollClock();
      const { data } = await db.from("poll").select("week, question, kind, anim, celebrate, reveal").eq("week", clock.week).maybeSingle();
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
      const { data: p } = await db.from("poll").select("week").eq("week", clock.week).maybeSingle();
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

  if (req.method === "GET" && req.query.poll) {
    if (!me.year) me.year = await yearOf(me);
    return pollGet(req, res, me, NAMES);
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
    const { data, error } = await db.from("forum_post")
      .select("id, email, body, parent, created_at")
      .order("created_at", { ascending: false }).limit(600);
    if (error) { console.error("forum read:", error.message); return res.status(502).json({ error: "Couldn't load the forum." }); }

    /* everyone's reactions, as counts per emoji plus whether one is yours.
       If the table isn't there yet, posts simply have none. */
    const reacts = new Map();
    {
      const ids = (data || []).map(r => r.id);
      const { data: rx, error: rxErr } = ids.length
        ? await db.from("forum_reaction").select("post_id, email, emoji, created_at").in("post_id", ids).limit(20000)
        : { data: [], error: null };
      if (!rxErr) for (const x of rx || []) {
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
    const shape = r => ({
      id: r.id, name: withName(NAMES, r.email, nameFromEmail(r.email)), body: r.body, at: r.created_at,
      /* mine: yours. canDelete: yours, or anyone's for a moderator (the page
         shows a moderator's delete on other people's posts only on hover) */
      mine: r.email === me.email, canDelete: r.email === me.email || isOwner, reactions: reactionsOf(r.id)
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
      return res.status(200).json({ posts: threads, poll });
    }
    return res.status(200).json({ posts: threads });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    body = body || {};

    if (/^(poll|suggestdel$)/.test(String(body.action || ""))) {
      if (!me.year) me.year = await yearOf(me);
      return pollPost(body, res, me, NAMES);
    }

    if (body.action === "react") {
      const id = String(body.id || ""), emoji = String(body.emoji || "");
      if (!isEmoji(emoji)) return res.status(400).json({ error: "That isn't an emoji." });
      const { data: post } = await db.from("forum_post").select("id").eq("id", id).maybeSingle();
      if (!post) return res.status(404).json({ error: "That post is gone." });
      const { data: had, error: readErr } = await db.from("forum_reaction").select("emoji")
        .eq("post_id", id).eq("email", me.email);
      if (readErr) { console.error("reaction read:", readErr.message); return res.status(502).json({ error: "Reactions aren't set up yet." }); }
      const already = (had || []).some(r => r.emoji === emoji);
      if (!already && (had || []).length >= MAX_REACTIONS_EACH)
        return res.status(400).json({ error: "That's enough reactions on one post." });
      const { error } = already
        ? await db.from("forum_reaction").delete().eq("post_id", id).eq("email", me.email).eq("emoji", emoji)
        : await db.from("forum_reaction").insert({ post_id: id, email: me.email, emoji });
      if (error) { console.error("reaction:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
      return res.status(200).json({ ok: true, on: !already });
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

    let parent = null;
    if (body.parent) {
      parent = String(body.parent);
      const { data: p } = await db.from("forum_post").select("id, parent").eq("id", parent).maybeSingle();
      if (!p) return res.status(404).json({ error: "That thread no longer exists." });
      if (p.parent) parent = p.parent;          // replying to a reply lands on the thread
    }

    const id = newId();
    const { error } = await db.from("forum_post").insert({ id, email: me.email, body: text, parent });
    if (error) { console.error("forum post:", error.message); return res.status(502).json({ error: "Couldn't post that." }); }
    return res.status(200).json({ id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

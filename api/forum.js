/*
 * Tiny school forum for the home page — post, reply, and that's it.
 *
 * GET  /api/forum                        → { posts:[ {id,name,body,at,mine,replies:[…]} ] }
 * POST /api/forum {body}                 → new thread, returns { id }
 * POST /api/forum {body, parent}         → reply on that thread
 * POST /api/forum {action:'delete', id}  → author (or OWNER_EMAIL) removes a post
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
 */

import { db, whoami } from "./_supabase.js";

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const local = String(email).split("@")[0];
  const parts = local.split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(local.replace(/\d+$/, "")) || "Someone";
}

const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "").trim().toLowerCase();
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const MAX_BODY = 1000;
const MAX_THREADS = 60;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "The forum is not configured on the server." });
  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in to use the forum." });
  const isOwner = !!OWNER_EMAIL && String(me.email).toLowerCase() === OWNER_EMAIL;

  if (req.method === "GET") {
    const { data, error } = await db.from("forum_post")
      .select("id, email, body, parent, created_at")
      .order("created_at", { ascending: false }).limit(600);
    if (error) { console.error("forum read:", error.message); return res.status(502).json({ error: "Couldn't load the forum." }); }

    const shape = r => ({
      id: r.id, name: nameFromEmail(r.email), body: r.body, at: r.created_at,
      mine: r.email === me.email || isOwner
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
    return res.status(200).json({ posts: threads });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    body = body || {};

    if (body.action === "delete") {
      const id = String(body.id || "");
      const { data: row } = await db.from("forum_post").select("email").eq("id", id).maybeSingle();
      if (!row) return res.status(404).json({ error: "That post is already gone." });
      if (row.email !== me.email && !isOwner)
        return res.status(403).json({ error: "You can only delete your own posts." });
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

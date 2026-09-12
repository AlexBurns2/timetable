/*
 * Public flashcard decks — students publish a deck under a category and anyone
 * can browse + import it. Same verified-email identity as the other APIs; the
 * author's display name is derived server-side (emails never returned).
 *
 * GET  /api/decks                     → list public decks (newest first)
 * GET  /api/decks?category=Maths      → list within one category
 * GET  /api/decks?id=ID               → one deck with its cards (for import)
 * POST /api/decks {name,category,cards}         → publish, returns { id }
 * POST /api/decks {action:'delete',id}          → author (or owner) removes one
 *
 * Table:
 *   shared_deck(id text primary key, email text, name text, category text,
 *               cards jsonb, created_at timestamptz default now())
 *   RLS off (service-role only).
 */

import { db, whoami } from "./_supabase.js";

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
function nameFromEmail(email) {
  const local = String(email).split("@")[0];
  const parts = local.split(".").filter(Boolean);
  if (parts.length >= 2) return cap(parts[0]) + " " + cap(parts[1].replace(/\d+$/, ""));
  return cap(local.replace(/\d+$/, "")) || "Someone";
}

export const CATEGORIES = ["Maths", "Physics", "Chemistry", "Biology", "English",
  "History", "Geography", "Languages", "Business", "Other"];
const OWNER_EMAIL = String(process.env.OWNER_EMAIL || "").trim().toLowerCase();
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function cleanCards(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const c of raw) {
    const q = String((c && c.q) || "").slice(0, 500).trim();
    const a = String((c && c.a) || "").slice(0, 500).trim();
    if (q && a) out.push({ q, a });
    if (out.length >= 300) break;
  }
  return out.length ? out : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-School-Email, X-School-Password");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!db) return res.status(503).json({ error: "Sharing is not configured on the server." });
  const me = await whoami(req);
  if (!me) return res.status(401).json({ error: "Sign in to share decks." });

  if (req.method === "GET") {
    if (req.query.id) {
      const { data, error } = await db.from("shared_deck")
        .select("id, name, category, cards, email").eq("id", String(req.query.id)).maybeSingle();
      if (error) return res.status(502).json({ error: "Couldn't load that deck." });
      if (!data) return res.status(404).json({ error: "Deck not found." });
      return res.status(200).json({ id: data.id, name: data.name, category: data.category,
        author: nameFromEmail(data.email), cards: data.cards || [] });
    }
    let q = db.from("shared_deck").select("id, name, category, cards, email, created_at")
      .order("created_at", { ascending: false }).limit(120);
    if (req.query.category && CATEGORIES.includes(req.query.category)) q = q.eq("category", req.query.category);
    const { data, error } = await q;
    if (error) return res.status(502).json({ error: "Couldn't load the list." });
    return res.status(200).json({ categories: CATEGORIES, decks: (data || []).map(d => ({
      id: d.id, name: d.name, category: d.category, author: nameFromEmail(d.email),
      count: Array.isArray(d.cards) ? d.cards.length : 0, mine: d.email === me.email || me.email.toLowerCase() === OWNER_EMAIL
    })) });
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
    body = body || {};

    if (body.action === "delete") {
      const id = String(body.id || "");
      const { data: row } = await db.from("shared_deck").select("email").eq("id", id).maybeSingle();
      if (!row) return res.status(404).json({ error: "Deck not found." });
      const isOwner = !!OWNER_EMAIL && me.email.toLowerCase() === OWNER_EMAIL;
      if (row.email !== me.email && !isOwner) return res.status(403).json({ error: "You can only delete your own decks." });
      const { error } = await db.from("shared_deck").delete().eq("id", id);
      if (error) return res.status(502).json({ error: "Couldn't delete." });
      return res.status(200).json({ ok: true });
    }

    const name = String(body.name || "").slice(0, 80).trim();
    const category = CATEGORIES.includes(body.category) ? body.category : "Other";
    const cards = cleanCards(body.cards);
    if (!name) return res.status(400).json({ error: "Give the deck a name." });
    if (!cards) return res.status(400).json({ error: "The deck needs at least one card." });
    const id = newId();
    const { error } = await db.from("shared_deck").insert({ id, email: me.email, name, category, cards });
    if (error) { console.error("deck publish:", error.message); return res.status(502).json({ error: "Couldn't publish." }); }
    return res.status(200).json({ id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

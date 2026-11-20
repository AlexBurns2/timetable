/*
 * Messages from the moderators to one person: a reply to something they sent (a feature idea, a poll
 * idea, a name change). It shows on their screen the next time they open a page (theme.js), signed
 * "MSC Unofficial", never a moderator's name, with what it answers under it, until they close it.
 * Served by /api/forum (no function of its own). Private helper (underscore = not a route).
 *
 *   GET  /api/forum?notices=1                          → your unread ones { notices:[{id, body, about, at}] }
 *   POST /api/forum {action:'noticeread', ids:[…]}     → closed (only your own)
 *   POST /api/forum {action:'noticesend', request, body} → moderators: a reply to that request's sender
 *   POST /api/forum {action:'noticeto', to, body}       → moderators: a message to anyone (by email)
 *   GET  /api/forum?notices=sent                       → moderators: the last 40 sent, and whether each was seen
 *
 * Name changes ride here too, as requests the moderators can apply:
 *   POST /api/forum {action:'requestname', name}        → a request (kept with the poll suggestions, kind 'name')
 *   POST /api/forum {action:'nameapply', request}       → moderators: the name is set (name_override) and
 *                                                        the person told
 *
 * Table (SETUP.md, "Replies from the moderators"). RLS on with no policies: only the server.
 *   notice(id, email, body, about, created_at, read_at)
 */
import { db, isAdmin } from "./_supabase.js";
import { forgetNameOverrides, rosterList } from "./_names.js";

const MAX_BODY = 600, MAX_NAME = 40;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const missing = e => /does not exist|relation|schema cache|could not find/i.test(String(e && e.message || e));
const clean = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

export async function noticeGet(req, res, me) {
  const { data, error } = await db.from("notice").select("id, body, about, created_at").eq("email", me.email).is("read_at", null)
    .order("created_at", { ascending: true }).limit(5);
  if (error) return res.status(200).json({ notices: [], missing: missing(error) });
  return res.status(200).json({ notices: (data || []).map(n => ({ id: n.id, body: n.body, about: n.about || "", at: n.created_at })) });
}

/* moderators: what was sent lately, to whom (by the name they go by) and whether they've seen it */
export async function noticeSent(res, nameOf) {
  const { data, error } = await db.from("notice").select("id, email, body, about, created_at, read_at").order("created_at", { ascending: false }).limit(40);
  if (error) return res.status(200).json({ sent: [], missing: missing(error) });
  return res.status(200).json({ sent: (data || []).map(n => ({ id: n.id, to: nameOf(n.email), body: n.body, about: n.about || "", at: n.created_at, seen: n.read_at || null })) });
}

/* someone the site knows: in the school directory, or has used the site (saved settings) */
async function known(email) {
  try { if ((await rosterList()).some(p => String(p.email).toLowerCase() === email)) return true; } catch {}
  const { data } = await db.from("prefs").select("email").eq("email", email).limit(1);
  return !!(data && data.length);
}

/* a notice to one person; false if the table isn't there yet */
async function tell(email, body, about) {
  const { error } = await db.from("notice").insert({ id: newId(), email, body: clean(body, MAX_BODY), about: about ? clean(about, 300) : null });
  if (error) { if (!missing(error)) console.error("notice:", error.message); return false; }
  return true;
}

export async function noticePost(body, res, me) {
  const action = body.action;
  if (action === "noticeread") {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).slice(0, 20);
    if (!ids.length) return res.status(200).json({ ok: true });
    const { error } = await db.from("notice").update({ read_at: new Date().toISOString() }).eq("email", me.email).in("id", ids);
    if (error && !missing(error)) console.error("notice read:", error.message);
    return res.status(200).json({ ok: true });
  }
  if (action === "requestname") {
    const name = clean(body.name, MAX_NAME);
    if (name.length < 2) return res.status(400).json({ error: "Write the name you'd like." });
    const { data: mine } = await db.from("poll_suggestion").select("id").eq("email", me.email).eq("kind", "name")
      .gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString());
    if ((mine || []).length >= 2) return res.status(429).json({ error: "You've asked already this week. The moderators will get to it." });
    const { error } = await db.from("poll_suggestion").insert({ id: newId(), email: me.email, question: name, kind: "name" });
    if (error) { console.error("name request:", error.message); return res.status(502).json({ error: "Couldn't send that." }); }
    return res.status(200).json({ ok: true });
  }

  /* moderators only from here */
  if (!isAdmin(me.email)) return res.status(403).json({ error: "Moderators only." });
  /* a message to anyone, not an answer to something they sent */
  if (action === "noticeto") {
    const to = String(body.to || "").trim().toLowerCase(), text = clean(body.body, MAX_BODY);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ error: "Pick someone first." });
    if (text.length < 2) return res.status(400).json({ error: "Write a message first." });
    if (!(await known(to))) return res.status(404).json({ error: "Nobody with that email is in the school directory or has used the site." });
    if (!(await tell(to, text, null))) return res.status(502).json({ error: "Couldn't send that. Has the notice table been made (SETUP.md)?" });
    return res.status(200).json({ ok: true });
  }
  const { data: reqRow, error: rErr } = await db.from("poll_suggestion").select("id, email, question, kind").eq("id", String(body.request || "")).maybeSingle();
  if (rErr || !reqRow) return res.status(404).json({ error: "That request is gone." });
  if (action === "noticesend") {
    const text = clean(body.body, MAX_BODY);
    if (text.length < 2) return res.status(400).json({ error: "Write a reply first." });
    const what = reqRow.kind === "feature" ? "Your idea" : reqRow.kind === "name" ? "Your name change" : "Your poll idea";
    if (!(await tell(reqRow.email, text, what + ": “" + reqRow.question + "”")))
      return res.status(502).json({ error: "Couldn't send that. Has the notice table been made (SETUP.md)?" });
    return res.status(200).json({ ok: true });
  }
  if (action === "nameapply") {
    if (reqRow.kind !== "name") return res.status(400).json({ error: "That isn't a name change." });
    const name = clean(reqRow.question, MAX_NAME);
    const { error } = await db.from("name_override").upsert({ email: reqRow.email, name, updated_at: new Date().toISOString() });
    if (error) { console.error("name apply:", error.message); return res.status(502).json({ error: "Couldn't save that. Has the name_override table been created?" }); }
    forgetNameOverrides();
    await db.from("poll_suggestion").delete().eq("id", reqRow.id);
    const told = await tell(reqRow.email, "Done. Your name now shows as " + name + ".", "Your name change: “" + name + "”");
    return res.status(200).json({ ok: true, told });
  }
  return res.status(400).json({ error: "Unknown action." });
}

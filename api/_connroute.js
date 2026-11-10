/*
 * Quartets, the route (served by api/daily.js for ?conn=1 / {conn:1}).
 *
 * GET  /api/daily?conn=1[&date=YYYY-MM-DD]  → { date, today, epoch, year, groups:[{lv, label, kind, names, how}],
 *                                              result:{ found, log, mistakes, solved, done }, streak }
 *      (the answers come with the puzzle so the page can mark a guess instantly,
 *       as Daily Guess Who does; nothing in them is private)
 *      { none:true } when no puzzle could be made for the day
 * GET  /api/daily?conn=1&archive=1          → { epoch, today, days:[dates], mine:{ date:{ solved, done, mistakes } } }
 * POST /api/daily {conn:1, date, found:[levels], log:[[lv,lv,lv,lv]…], mistakes}  → { ok, streak }
 *
 * The puzzle is made by _conn.js the first time anyone in the year asks for a
 * day, then stored; a day that couldn't be made is stored as no groups, so it
 * isn't retried on every visit.
 */
import { db } from "./_supabase.js";
import { withName } from "./_names.js";
import { fetchAsOwner, studentDirectory } from "./timetable.js";
import { computeStreak, sydneyDate, resolveYear } from "./_daily.js";
import { makeQuartets, hashStr } from "./_conn.js";

export const CONN_EPOCH = "2026-11-10";        // the first day of Quartets
const MAX_MISTAKES = 4;

function cleanDate(d, today) {
  if (!d) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return null;
  return d > today || d < CONN_EPOCH ? null : d;
}

async function ensureConn(year, date, NAMES) {
  const sel = () => db.from("conn_puzzle").select("groups").eq("date", date).eq("year", year).maybeSingle();
  let { data: row, error } = await sel();
  if (error) throw new Error("quartets read: " + error.message);
  if (row) return row.groups;

  /* the year, by the names people know them by (two people with the same name are left out) */
  const seen = new Map();
  for (const p of await studentDirectory()) {
    if (String(p.year) !== String(year) || !p.first || !p.last || !p.email) continue;
    const name = withName(NAMES, p.email, p.first + " " + p.last).replace(/\s+/g, " ").trim();
    const parts = name.split(" ");
    const k = name.toLowerCase();
    seen.set(k, seen.has(k) ? null : { email: p.email, name, first: parts[0], last: parts.slice(1).join(" ") || p.last });
  }
  const people = [...seen.values()].filter(Boolean).sort((a, b) => a.email.localeCompare(b.email));
  const getTT = e => fetchAsOwner("/api/timetable/" + encodeURIComponent(e));
  const getRoster = async code => {
    const raw = await fetchAsOwner("/api/timetable/class/" + encodeURIComponent(code));
    const arr = Array.isArray(raw) ? raw : (raw && (raw.roster || raw.students)) || [];
    return arr.map(p => String(p.emailAddress || p.Email || p.email || "").toLowerCase()).filter(Boolean);
  };
  const seed = hashStr("conn:" + date + ":" + year);
  /* the last few days' categories, so the same ones don't keep turning up */
  const avoid = new Set();
  const { data: recent } = await db.from("conn_puzzle").select("groups").eq("year", year).lt("date", date)
    .order("date", { ascending: false }).limit(3);
  (recent || []).forEach(r => (Array.isArray(r.groups) ? r.groups : []).forEach(g => g && g.id && avoid.add(g.id)));
  let made = await makeQuartets({ people, getTT, getRoster, seed, avoid });
  if (!made) made = await makeQuartets({ people, getTT, getRoster, seed: seed ^ 0x5bd1e995, avoid });
  const groups = made ? made.groups : [];

  const { error: upErr } = await db.from("conn_puzzle")
    .upsert({ date, year, groups }, { onConflict: "date,year", ignoreDuplicates: true });
  if (upErr) throw new Error("quartets write: " + upErr.message);
  ({ data: row } = await sel());                 // whoever wrote first wins
  return row ? row.groups : groups;
}

async function streakFor(email, today) {
  const { data } = await db.from("conn_result").select("date").eq("email", email).eq("solved", true)
    .order("date", { ascending: false }).limit(120);
  return computeStreak((data || []).map(r => r.date), today);
}

export async function connRoute(req, res, me, body, NAMES) {
  const today = sydneyDate();
  let year;
  try { year = await resolveYear(me); } catch { year = null; }
  if (!year) return res.status(400).json({ error: "Couldn't work out which year you're in." });
  year = String(year);
  try {
    if (req.method === "GET" && req.query.archive) {
      const [{ data: days }, { data: mine }] = await Promise.all([
        db.from("conn_puzzle").select("date, groups").eq("year", year).gte("date", CONN_EPOCH).lte("date", today).order("date", { ascending: false }).limit(400),
        db.from("conn_result").select("date, solved, done, mistakes").eq("email", me.email).gte("date", CONN_EPOCH)
      ]);
      const m = {}; (mine || []).forEach(r => m[r.date] = { solved: !!r.solved, done: !!r.done, mistakes: r.mistakes || 0 });
      return res.status(200).json({ epoch: CONN_EPOCH, today,
        days: (days || []).filter(d => Array.isArray(d.groups) && d.groups.length === 4).map(d => d.date), mine: m });
    }
    const date = cleanDate(req.method === "POST" ? body && body.date : req.query.date, today);
    if (!date) return res.status(400).json({ error: "That day isn't available." });
    const stored = await ensureConn(year, date, NAMES);
    if (!Array.isArray(stored) || stored.length !== 4) return res.status(200).json({ date, today, epoch: CONN_EPOCH, year, none: true });
    /* by the names people go by today; emails stay on the server */
    const groups = stored.map(g => {
      const names = (g.names || []).map((n, i) => withName(NAMES, (g.emails || [])[i], n));
      /* someone renamed since: their "how" was worked out from the old name, so it goes */
      return { lv: g.lv, label: g.label, kind: g.kind, names, how: (g.how || []).map((h, i) => names[i] === g.names[i] ? h : '') };
    });

    const { data: had } = await db.from("conn_result").select("found, log, mistakes, solved, done").eq("email", me.email).eq("date", date).maybeSingle();
    const result = had ? { found: had.found || [], log: had.log || [], mistakes: had.mistakes || 0, solved: !!had.solved, done: !!had.done }
                       : { found: [], log: [], mistakes: 0, solved: false, done: false };

    if (req.method === "GET") {
      return res.status(200).json({ date, today, epoch: CONN_EPOCH, year, groups, result, streak: await streakFor(me.email, today) });
    }
    if (req.method === "POST") {
      if (result.done) return res.status(200).json({ ok: true, streak: await streakFor(me.email, today) });
      const lv = x => Number.isInteger(x) && x >= 1 && x <= 4;
      const found = [...new Set([...(result.found || []), ...((Array.isArray(body.found) ? body.found : []).filter(lv))])].slice(0, 4);
      const log = (Array.isArray(body.log) ? body.log : []).filter(g => Array.isArray(g) && g.length === 4 && g.every(lv)).slice(0, 8);
      const mistakes = Math.max(result.mistakes, Math.min(MAX_MISTAKES, Math.max(0, parseInt(body.mistakes, 10) || 0)));
      const solved = found.length === 4 && mistakes < MAX_MISTAKES;
      const done = solved || mistakes >= MAX_MISTAKES;
      const { error } = await db.from("conn_result").upsert({ email: me.email, date, year, found, log: log.length >= (result.log || []).length ? log : result.log,
        mistakes, solved, done, updated_at: new Date().toISOString() });
      if (error) { console.error("quartets result:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
      return res.status(200).json({ ok: true, streak: await streakFor(me.email, today) });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("quartets:", e.message);
    return res.status(502).json({ error: /does not exist|relation|schema cache|could not find/i.test(e.message)
      ? "Quartets isn't set up yet." : "Couldn't load today's Quartets." });
  }
}

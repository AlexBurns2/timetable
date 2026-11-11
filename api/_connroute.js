/*
 * Quartets, the route (served by api/daily.js for ?conn=1 / {conn:1}).
 *
 * GET  /api/daily?conn=1[&date=YYYY-MM-DD]  → that day's puzzle for your year:
 *      { date, today, epoch, year, groups:[{lv, label, kind, names, how}], result:{ found, log, mistakes, solved, done }, streak }
 *      (the answers come with the puzzle so the page can mark a guess instantly,
 *       as Daily Guess Who does; nothing in them is private. `how` is worked out
 *       now, from the names people go by today.)
 *      { none:true } when no fair puzzle could be made that day
 * GET  /api/daily?conn=1&archive=1          → every day with a puzzle: how many in the year played and solved it, and how you went
 * GET  /api/daily?conn=1&summary=1&date=…   → how the year went that day (see summaryFor)
 * POST /api/daily {conn:1, date, found:[levels], log:[[lv,lv,lv,lv]…], mistakes}  → { ok, streak }
 *
 * Each day's puzzle is made by _conn.js the first time anyone in the year opens
 * it, then kept, so past days can be played from the calendar; a day that
 * couldn't be made is kept as no groups, so it isn't retried every visit. A
 * puzzle is kept as it was made: there's no older-version handling to carry.
 */
import { db } from "./_supabase.js";
import { withName, stripEmails, rosterList, markClasses, hasClassesIn } from "./_names.js";
import { fetchAsOwner } from "./timetable.js";
import { computeStreak, sydneyDate, resolveYear } from "./_daily.js";
import { makeQuartets, hashStr, howFor, tidyTeacher, QUARTETS_VERSION } from "./_conn.js";

export const CONN_EPOCH = "2026-11-10";        // the first day of Quartets
const MAX_MISTAKES = 7;
/* Puzzles and results are kept under "<year>#v<version>". A new version of the
   generator starts afresh: the year's puzzles and results from any older one
   are deleted (once per warm instance) and each day is made again on demand. */
const keyFor = year => String(year) + "#v" + QUARTETS_VERSION;
const tidied = new Set();
async function dropOldVersions(year) {
  if (tidied.has(year)) return;
  const key = keyFor(year);
  for (const table of ["conn_result", "conn_puzzle"]) {
    const a = await db.from(table).delete().eq("year", String(year));                       // from before versions
    const b = await db.from(table).delete().like("year", String(year) + "#v%").neq("year", key);
    if (a.error || b.error) { console.error("quartets tidy:", (a.error || b.error).message); return; }
  }
  tidied.add(year);
}

/* teachers by the name students know (from the staff directory, "Ms Kubo"),
   with any override; a timetable sometimes gives only an email address */
let staffCache = { at: 0, map: null };
async function staffNames() {
  if (staffCache.map && Date.now() - staffCache.at < 6 * 3600e3) return staffCache.map;
  const map = new Map();
  try {
    const raw = await fetchAsOwner("/api/group/teacher");
    const arr = Array.isArray(raw) ? raw : (raw && (raw.people || raw.users || raw.data)) || [];
    for (const r of arr) {
      const email = String(r.emailAddress || r.email || r.Email || "").toLowerCase();
      const first = String(r.firstname || r.firstName || r.FirstName || "").trim();
      const last = String(r.lastname || r.lastName || r.LastName || "").trim();
      const title = String(r.title || r.Title || r.salutation || "").trim();
      const name = title && last ? title + " " + last : [first, last].filter(Boolean).join(" ");
      if (email && name) map.set(email, name);
    }
  } catch (e) { console.warn("quartets staff names:", e.message); }
  staffCache = { at: Date.now(), map };
  return map;
}

function cleanDate(d, today) {
  if (!d) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) return null;
  return d > today || d < CONN_EPOCH ? null : d;
}

async function ensureConn(year, date, NAMES) {
  const key = keyFor(year);
  const sel = () => db.from("conn_puzzle").select("groups").eq("date", date).eq("year", key).maybeSingle();
  let { data: row, error } = await sel();
  if (error) throw new Error("quartets read: " + error.message);
  if (row) return row.groups;

  /* the year, by the names people know them by (two people with the same name are left out) */
  const seen = new Map();
  for (const p of await rosterList()) {
    if (String(p.year) !== String(year) || !p.first || !p.last || !p.email || p.hasClasses === false) continue;   // no classes here: not in the game
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
  const staff = await staffNames();
  const teacherName = raw => { const e = String(raw || "").toLowerCase();
    return e.includes("@") ? withName(NAMES, e, staff.get(e) || tidyTeacher(raw)) : tidyTeacher(raw); };
  const seed = hashStr("conn:" + date + ":" + year);
  /* the last few days' categories, so the same ones don't keep turning up */
  const avoid = new Set();
  const { data: recent } = await db.from("conn_puzzle").select("groups").eq("year", key).lt("date", date)
    .order("date", { ascending: false }).limit(3);
  (recent || []).forEach(r => (Array.isArray(r.groups) ? r.groups : []).forEach(g => g && g.id && avoid.add(g.id)));
  const checked = new Map(), onTimetable = (e, raw) => checked.set(e, hasClassesIn(raw));   // everyone whose timetable was read
  let made = await makeQuartets({ people, getTT, getRoster, seed, year, avoid, teacherName, onTimetable });
  if (!made) made = await makeQuartets({ people, getTT, getRoster, seed: seed ^ 0x5bd1e995, year, avoid, teacherName, onTimetable });
  markClasses(checked).catch(() => {});
  /* kept: the categories and who's in them (emails stay on the server) */
  const groups = made ? made.groups.map(g => ({ lv: g.lv, id: g.id, label: g.label, kind: g.kind, names: g.names, emails: g.emails })) : [];

  const { error: upErr } = await db.from("conn_puzzle")
    .upsert({ date, year: key, groups }, { onConflict: "date,year", ignoreDuplicates: true });
  if (upErr) throw new Error("quartets write: " + upErr.message);
  ({ data: row } = await sel());                 // whoever wrote first wins
  return row ? row.groups : groups;
}

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
const nameFromEmail = email => {
  const p = String(email).split("@")[0].split(".").filter(Boolean);
  return p.length >= 2 ? cap(p[0]) + " " + cap(p[1].replace(/\d+$/, "")) : cap(String(p[0] || "").replace(/\d+$/, "")) || "Someone";
};

/* How the year went on one day: how many finished and solved it, a bar per
   number of mistakes (with who, for the hover), how many found each group,
   and one person to mention. Names only, by the names people go by. */
async function summaryFor(year, date, groups, NAMES) {
  const { data } = await db.from("conn_result").select("email, found, mistakes, solved, done, updated_at")
    .eq("year", keyFor(year)).eq("date", date).eq("done", true).limit(2000);
  const rows = data || [];
  const nm = e => withName(NAMES, e, nameFromEmail(e));
  const dist = { lost: 0 }, names = { lost: [] };
  for (let i = 0; i < MAX_MISTAKES; i++) { dist[i] = 0; names[i] = []; }
  for (const r of rows) {
    const k = r.solved ? String(Math.min(MAX_MISTAKES - 1, r.mistakes || 0)) : "lost";
    dist[k]++; if (names[k].length < 40) names[k].push(nm(r.email));
  }
  const found = (groups || []).map(g => ({ lv: g.lv, label: g.label,
    found: rows.filter(r => Array.isArray(r.found) && r.found.includes(g.lv)).length }));
  /* one person for the day: the first to solve it without a mistake, or else the first to solve it */
  const solvedRows = rows.filter(r => r.solved).sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)));
  const perfect = solvedRows.find(r => !r.mistakes);
  const spotlight = perfect ? { kind: "perfect", name: nm(perfect.email) }
    : solvedRows[0] ? { kind: "first", name: nm(solvedRows[0].email), n: solvedRows[0].mistakes || 0 } : null;
  return { played: rows.length, solved: solvedRows.length, chances: MAX_MISTAKES, dist, names, found, spotlight };
}

/* the nightly job (api/daily-generate.js) makes each year's puzzle ahead of time,
   so the first player of the day doesn't wait while it's made */
export async function prebuildQuartets(year, date, NAMES) {
  await dropOldVersions(String(year));
  const groups = await ensureConn(String(year), date, NAMES);
  return Array.isArray(groups) && groups.length === 4 ? "ok" : "none";
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
  const key = keyFor(year);
  try {
    await dropOldVersions(year);
    if (req.method === "GET" && req.query.archive) {
      const [{ data: days }, { data: plays }, { data: mine }] = await Promise.all([
        db.from("conn_puzzle").select("date, groups").eq("year", key).gte("date", CONN_EPOCH).lte("date", today).limit(1000),
        db.from("conn_result").select("date, solved").eq("year", key).eq("done", true).gte("date", CONN_EPOCH).limit(50000),
        db.from("conn_result").select("date, solved, done, mistakes").eq("email", me.email).eq("year", key).gte("date", CONN_EPOCH)
      ]);
      const by = {};
      (days || []).filter(d => Array.isArray(d.groups) && d.groups.length === 4).forEach(d => by[d.date] = { date: d.date, played: 0, wins: 0 });
      (plays || []).forEach(r => { const d = by[r.date]; if (d) { d.played++; if (r.solved) d.wins++; } });
      const m = {}; (mine || []).forEach(r => m[r.date] = { solved: !!r.solved, done: !!r.done, mistakes: r.mistakes || 0 });
      return res.status(200).json({ epoch: CONN_EPOCH, today, archive: Object.values(by).sort((a, b) => b.date.localeCompare(a.date)), mine: m });
    }
    const date = cleanDate(req.method === "POST" ? body && body.date : req.query.date, today);
    if (!date) return res.status(400).json({ error: "That day isn't available." });
    const stored = await ensureConn(year, date, NAMES);
    if (!Array.isArray(stored) || stored.length !== 4) return res.status(200).json({ date, today, epoch: CONN_EPOCH, year, none: true });
    /* by the names people go by today; emails stay on the server */
    const groups = stored.map(g => {
      const names = (g.names || []).map((n, i) => withName(NAMES, (g.emails || [])[i], n));
      return { lv: g.lv, label: stripEmails(g.label), kind: g.kind, names, how: names.map(n => g.kind === "name" ? howFor(g.id, n) : "") };
    });

    const { data: had } = await db.from("conn_result").select("found, log, mistakes, solved, done").eq("email", me.email).eq("date", date).eq("year", key).maybeSingle();
    const result = had ? { found: had.found || [], log: had.log || [], mistakes: had.mistakes || 0, solved: !!had.solved, done: !!had.done }
                       : { found: [], log: [], mistakes: 0, solved: false, done: false };

    if (req.method === "GET" && req.query.summary) {
      return res.status(200).json({ date, summary: await summaryFor(year, date, groups, NAMES), mine: result });
    }
    if (req.method === "GET") {
      return res.status(200).json({ date, today, epoch: CONN_EPOCH, year, chances: MAX_MISTAKES, groups, result, streak: await streakFor(me.email, today) });
    }
    if (req.method === "POST") {
      if (result.done) return res.status(200).json({ ok: true, streak: await streakFor(me.email, today) });
      const lv = x => Number.isInteger(x) && x >= 1 && x <= 4;
      const found = [...new Set([...(result.found || []), ...((Array.isArray(body.found) ? body.found : []).filter(lv))])].slice(0, 4);
      const log = (Array.isArray(body.log) ? body.log : []).filter(g => Array.isArray(g) && g.length === 4 && g.every(lv)).slice(0, 4 + MAX_MISTAKES);
      const mistakes = Math.max(result.mistakes, Math.min(MAX_MISTAKES, Math.max(0, parseInt(body.mistakes, 10) || 0)));
      const solved = found.length === 4 && mistakes < MAX_MISTAKES;
      const done = solved || mistakes >= MAX_MISTAKES;
      const { error } = await db.from("conn_result").upsert({ email: me.email, date, year: key, found, log: log.length >= (result.log || []).length ? log : result.log,
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

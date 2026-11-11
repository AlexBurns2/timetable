/*
 * Quartets, the route (served by api/daily.js for ?conn=1 / {conn:1}).
 *
 * GET  /api/daily?conn=1[&date=YYYY-MM-DD]  → that day's puzzle for your year:
 *      { date, today, epoch, year, groups:[{lv, label, kind, names, how}], result:{ found, log, mistakes, solved, done }, streak }
 *      (the answers come with the puzzle so the page can mark a guess instantly,
 *       as Daily Guess Who does; nothing in them is private. `how` is worked out
 *       now, from the names people go by today.)
 *      { none:true, retry:true } if it couldn't be made just now (nothing is kept;
 *      the page quietly asks again until it's there)
 * GET  /api/daily?conn=1&archive=1          → every day with a puzzle: how many in the year played and solved it, and how you went
 * GET  /api/daily?conn=1&summary=1&date=…   → how the year went that day (see summaryFor)
 * POST /api/daily {conn:1, date, found:[levels], log:[[lv,lv,lv,lv]…], mistakes}  → { ok, streak }
 *
 * Each day's puzzle is made by _conn.js the first time anyone in the year opens
 * it (or by the nightly job), then kept, so past days can be played from the
 * calendar. Nothing here ever deletes a puzzle or a result: a day that already
 * has a puzzle, made by this version of the generator or an older one, is
 * played as it was made, with its results. A day is only kept once it has a
 * puzzle. (An older version kept a day it couldn't make as no groups; such a
 * day is made when it's next opened, and only that empty marker is replaced.)
 */
import { db } from "./_supabase.js";
import { withName, stripEmails, rosterList, markClasses, hasClassesIn } from "./_names.js";
import { fetchAsOwner } from "./timetable.js";
import { computeStreak, sydneyDate, resolveYear } from "./_daily.js";
import { makeQuartets, hashStr, howFor, tidyTeacher, QUARTETS_VERSION } from "./_conn.js";

export const CONN_EPOCH = "2026-11-10";        // the first day of Quartets
const MAX_MISTAKES = 7;
/* Puzzles and results are kept under "<year>#v<version>" (the version of the
   generator that made the day). New days are made by the current version; a day
   made by an older one keeps its puzzle and its results under its own key. */
const keyFor = year => String(year) + "#v" + QUARTETS_VERSION;
const allKeys = year => [String(year), ...Array.from({ length: QUARTETS_VERSION }, (_, i) => String(year) + "#v" + (i + 1))];
const verOf = k => { const m = /#v(\d+)$/.exec(String(k)); return m ? +m[1] : 0; };
const isPuzzle = g => Array.isArray(g) && g.length === 4;
/* of a day's rows (one per version), the one that's played: a real puzzle, the
   newest version first */
const pickDay = rows => (rows || []).filter(r => isPuzzle(r.groups)).sort((a, b) => verOf(b.year) - verOf(a.year))[0] || null;

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

/* the day's puzzle as { groups, key }, made now if it hasn't been; null if it
   couldn't be made just now */
async function ensureConn(year, date, NAMES, deadline = Date.now() + 40000) {
  const key = keyFor(year);
  const selAll = () => db.from("conn_puzzle").select("year, groups").eq("date", date).in("year", allKeys(year));
  let { data: rows, error } = await selAll();
  if (error) throw new Error("quartets read: " + error.message);
  const had = pickDay(rows);
  if (had) return { groups: had.groups, key: had.year };
  const emptyBefore = (rows || []).some(r => r.year === key);   // kept as "couldn't be made" by an earlier version: make it now
  const sel = () => db.from("conn_puzzle").select("groups").eq("date", date).eq("year", key).maybeSingle();
  let row;

  /* the year, by the names people know them by (two people with the same name are left out) */
  const seen = new Map();
  for (const p of await rosterList()) {
    if (String(p.year) !== String(year) || !p.first || !p.last || !p.email || p.hasClasses === false) continue;   // no classes here: not in the game
    const name = withName(NAMES, p.email, p.first + " " + p.last).replace(/\s+/g, " ").trim();
    const parts = name.split(" ");
    const k = name.toLowerCase();
    seen.set(k, seen.has(k) ? null : { email: p.email, name, first: parts[0], last: parts.slice(1).join(" ") || p.last });
  }
  let people = [...seen.values()].filter(Boolean).sort((a, b) => a.email.localeCompare(b.email));
  /* never too few to play: if the saved roster comes up short, straight from the school directory */
  if (people.length < 40) {
    const { studentDirectory } = await import("./timetable.js");
    const again = new Map();
    for (const p of await studentDirectory()) {
      if (String(p.year) !== String(year) || !p.first || !p.last || !p.email) continue;
      const name = withName(NAMES, p.email, p.first + " " + p.last).replace(/\s+/g, " ").trim(), parts = name.split(" "), k = name.toLowerCase();
      again.set(k, again.has(k) ? null : { email: p.email, name, first: parts[0], last: parts.slice(1).join(" ") || p.last });
    }
    const more = [...again.values()].filter(Boolean).sort((a, b) => a.email.localeCompare(b.email));
    if (more.length > people.length) { console.warn("quartets: roster had " + people.length + " in year " + year + ", directory " + more.length); people = more; }
  }
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
  const { data: recent } = await db.from("conn_puzzle").select("groups").in("year", allKeys(year)).lt("date", date)
    .order("date", { ascending: false }).limit(3);
  (recent || []).forEach(r => (Array.isArray(r.groups) ? r.groups : []).forEach(g => g && g.id && avoid.add(g.id)));
  const checked = new Map(), onTimetable = (e, raw) => checked.set(e, hasClassesIn(raw));   // everyone whose timetable was read
  let made = await makeQuartets({ people, getTT, getRoster, seed, year, avoid, teacherName, onTimetable, deadline });
  if (!made) made = await makeQuartets({ people, getTT, getRoster, seed: seed ^ 0x5bd1e995, year, avoid, teacherName, onTimetable,
                                         deadline: Math.max(deadline, Date.now() + 3000) });
  markClasses(checked).catch(() => {});
  if (!made) { console.error("quartets: couldn't make", year, date, "from", people.length, "people"); return null; }   // not kept: tried again next visit
  if (made.tier > 0) console.warn("quartets:", year, date, "made with fallback tier", made.tier);
  /* kept: the categories and who's in them (emails stay on the server) */
  const groups = made.groups.map(g => ({ lv: g.lv, id: g.id, label: g.label, kind: g.kind, names: g.names, emails: g.emails }));

  if (emptyBefore) {
    /* replace only the empty marker, never a puzzle someone else has just made */
    const { error: e1 } = await db.from("conn_puzzle").update({ groups }).eq("date", date).eq("year", key).filter("groups", "eq", "[]");
    if (e1) console.warn("quartets: replacing an empty day:", e1.message);
    ({ data: row } = await sel());
    if (row && !isPuzzle(row.groups)) {           // still the marker (the filter didn't match it): replace it by its key
      const { error: e2 } = await db.from("conn_puzzle").update({ groups }).eq("date", date).eq("year", key);
      if (e2) throw new Error("quartets write: " + e2.message);
    }
  } else {
    const { error: upErr } = await db.from("conn_puzzle")
      .upsert({ date, year: key, groups }, { onConflict: "date,year", ignoreDuplicates: true });
    if (upErr) throw new Error("quartets write: " + upErr.message);
  }
  ({ data: row } = await sel());                 // whoever wrote first wins
  return { groups: row && isPuzzle(row.groups) ? row.groups : groups, key };
}

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
const nameFromEmail = email => {
  const p = String(email).split("@")[0].split(".").filter(Boolean);
  return p.length >= 2 ? cap(p[0]) + " " + cap(p[1].replace(/\d+$/, "")) : cap(String(p[0] || "").replace(/\d+$/, "")) || "Someone";
};

/* How the year went on one day: how many finished and solved it, a bar per
   number of mistakes (with who, for the hover), how many found each group,
   and one person to mention. Names only, by the names people go by. */
async function summaryFor(pk, date, groups, NAMES) {
  const { data } = await db.from("conn_result").select("email, found, mistakes, solved, done, updated_at")
    .eq("year", pk).eq("date", date).eq("done", true).limit(2000);
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
export async function prebuildQuartets(year, date, NAMES, deadline = Date.now() + 40000) {
  const day = await ensureConn(String(year), date, NAMES, deadline);
  /* and any earlier day kept empty (by an older version of this code), a few a night */
  const { data: days } = await db.from("conn_puzzle").select("date, year, groups").in("year", allKeys(year)).gte("date", CONN_EPOCH).lt("date", date).limit(5000);
  const byDate = new Map(); (days || []).forEach(d => (byDate.get(d.date) || byDate.set(d.date, []).get(d.date)).push(d));
  for (const [d] of [...byDate].filter(([, rs]) => !pickDay(rs)).slice(0, 3)) {
    if (Date.now() > deadline - 8000) break;
    try { await ensureConn(String(year), d, NAMES, Math.min(deadline, Date.now() + 15000)); } catch (e) { console.error("quartets repair:", e.message); }
  }
  return day ? "ok" : "none";
}

async function streakFor(email, today) {
  const { data } = await db.from("conn_result").select("date").eq("email", email).eq("solved", true)
    .order("date", { ascending: false }).limit(120);
  return computeStreak([...new Set((data || []).map(r => r.date))], today);
}

export async function connRoute(req, res, me, body, NAMES) {
  const today = sydneyDate();
  let year;
  try { year = await resolveYear(me); } catch { year = null; }
  if (!year) return res.status(400).json({ error: "Couldn't work out which year you're in." });
  year = String(year);
  const keys = allKeys(year);
  try {
    if (req.method === "GET" && req.query.archive) {
      const [{ data: days }, { data: plays }, { data: mine }] = await Promise.all([
        db.from("conn_puzzle").select("date, year, groups").in("year", keys).gte("date", CONN_EPOCH).lte("date", today).limit(5000),
        db.from("conn_result").select("date, year, solved").in("year", keys).eq("done", true).gte("date", CONN_EPOCH).limit(50000),
        db.from("conn_result").select("date, year, solved, done, mistakes").eq("email", me.email).in("year", keys).gte("date", CONN_EPOCH)
      ]);
      /* each day's played puzzle (its version); a day kept empty is listed too, and made when it's opened */
      const rowsOf = new Map(); (days || []).forEach(d => (rowsOf.get(d.date) || rowsOf.set(d.date, []).get(d.date)).push(d));
      const keyOf = {}; rowsOf.forEach((rs, date) => { const p = pickDay(rs); keyOf[date] = p ? p.year : keyFor(year); });
      const by = {};
      Object.keys(keyOf).forEach(date => by[date] = { date, played: 0, wins: 0 });
      (plays || []).forEach(r => { const d = by[r.date]; if (d && r.year === keyOf[r.date]) { d.played++; if (r.solved) d.wins++; } });
      const m = {}; (mine || []).forEach(r => { if (r.year === keyOf[r.date]) m[r.date] = { solved: !!r.solved, done: !!r.done, mistakes: r.mistakes || 0 }; });
      return res.status(200).json({ epoch: CONN_EPOCH, today, archive: Object.values(by).sort((a, b) => b.date.localeCompare(a.date)), mine: m });
    }
    const date = cleanDate(req.method === "POST" ? body && body.date : req.query.date, today);
    if (!date) return res.status(400).json({ error: "That day isn't available." });
    const day = await ensureConn(year, date, NAMES);
    if (!day || !isPuzzle(day.groups)) return res.status(200).json({ date, today, epoch: CONN_EPOCH, year, none: true, retry: true });
    const stored = day.groups, pk = day.key;     // results go with the version that made the day
    /* by the names people go by today; emails stay on the server */
    const groups = stored.map(g => {
      const names = (g.names || []).map((n, i) => withName(NAMES, (g.emails || [])[i], n));
      return { lv: g.lv, label: stripEmails(g.label), kind: g.kind, names, how: names.map(n => g.kind === "name" ? howFor(g.id, n) : "") };
    });

    const { data: had } = await db.from("conn_result").select("found, log, mistakes, solved, done").eq("email", me.email).eq("date", date).eq("year", pk).maybeSingle();
    const result = had ? { found: had.found || [], log: had.log || [], mistakes: had.mistakes || 0, solved: !!had.solved, done: !!had.done }
                       : { found: [], log: [], mistakes: 0, solved: false, done: false };

    if (req.method === "GET" && req.query.summary) {
      return res.status(200).json({ date, summary: await summaryFor(pk, date, groups, NAMES), mine: result });
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
      const { error } = await db.from("conn_result").upsert({ email: me.email, date, year: pk, found, log: log.length >= (result.log || []).length ? log : result.log,
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

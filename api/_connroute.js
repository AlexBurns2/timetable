/*
 * Quartets, the route (served by api/daily.js for ?conn=1 / {conn:1}).
 *
 * GET  /api/daily?conn=1[&date=YYYY-MM-DD]  → that day's puzzle for your year, as you have it (boardView):
 *      { date, today, epoch, year, size, chances, tiles:[names not yet placed], groups:[{lv, label, names, how}],
 *        result:{ found, log, mistakes, solved, done, hinted }, hint:{ gold, blue }, streak }
 *      groups are only the ones you've found (all of them once you're done), so the page never holds
 *      the answers; guesses are marked here. `how` is worked out now, from the names people go by today.
 *      { none:true, retry:true } if it couldn't be made just now (nothing is kept;
 *      the page quietly asks again until it's there)
 * GET  /api/daily?conn=1&archive=1          → every day with a puzzle: how many in the year played and solved it, and how you went
 * GET  /api/daily?conn=1&summary=1&date=…   → how the year went that day (see summaryFor; group names only once you're done)
 * POST /api/daily {conn:1, date, pick:[names]}  → marked: the board as above, plus { right, oneAway }
 * POST /api/daily {conn:1, date, hint:true}     → Triplets' one hint, used: the board as above
 *
 * Quartets again, from 2026-11-24 (the owner: "Add back quartets as every second day ... the old quartet games on triplets get
 * migrated over to the new quartets"): its own game on the games page, served by the same requests with q=1 (quartRoute,
 * below). A new puzzle every second day from QUARTETS_BACK, four groups of four and seven mistakes as before, kept under the
 * key "<year>#q1"; its days from CONN_EPOCH to the day before TRIPLETS_FROM are the old Quartets days, played and kept exactly
 * as they were (their puzzles and results stay where they are, under their own keys). Triplets' calendar now starts at
 * TRIPLETS_FROM. Results for the new days go in a table of their own, quart_result (SETUP.md): conn_result allows one row a
 * person a day, and Triplets has every day.
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
import { makeQuartets, hashStr, howFor, tidyTeacher, hardness, QUARTETS_VERSION, TRIPLETS_FROM, PEOPLE_DAYS } from "./_conn.js";

export const CONN_EPOCH = "2026-11-10";        // the first day of Quartets
export const QUARTETS_BACK = "2026-11-25";     // Quartets back, every second day from here
const QKEY = year => String(year) + "#q1";
const shiftD = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const oldQ = d => d >= CONN_EPOCH && d < TRIPLETS_FROM;                          // a Quartets day from before Triplets
const newQ = d => d >= QUARTETS_BACK && dayDiff(QUARTETS_BACK, d) % 2 === 0;     // a Quartets day from QUARTETS_BACK on
export const isQuartetsDay = d => oldQ(d) || newQ(d);
const latestQ = today => { let d = today; for (let i = 0; i < 40; i++, d = shiftD(d, -1)) if (isQuartetsDay(d)) return d; return null; };
const nextQ = today => { let d = shiftD(today, 1); for (let i = 0; i < 3; i++, d = shiftD(d, 1)) if (newQ(d)) return d; return null; };
const qDaysUpTo = today => { const out = []; for (let d = CONN_EPOCH; d <= today; d = shiftD(d, 1)) if (isQuartetsDay(d)) out.push(d); return out; };
const MAX_MISTAKES = 7;
/* Triplets (from TRIPLETS_FROM): three groups of three, four mistakes. Quartets days: four of four, seven. */
const chancesFor = groups => Array.isArray(groups) && groups.length === 3 ? 4 : MAX_MISTAKES;
/* Puzzles and results are kept under "<year>#v<version>" (the version of the
   generator that made the day). New days are made by the current version; a day
   made by an older one keeps its puzzle and its results under its own key. */
const keyFor = (year, date) => String(year) + "#v" + (date && date >= TRIPLETS_FROM ? QUARTETS_VERSION : 8);
const allKeys = year => [String(year), ...Array.from({ length: QUARTETS_VERSION }, (_, i) => String(year) + "#v" + (i + 1))];
const verOf = k => { const m = /#v(\d+)$/.exec(String(k)); return m ? +m[1] : 0; };
const isPuzzle = g => Array.isArray(g) && (g.length === 4 || g.length === 3);
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
  return d > today || d < TRIPLETS_FROM ? null : d;      // (Triplets: its earlier days are Quartets', in quartRoute)
}

/* the day's puzzle as { groups, key }, made now if it hasn't been; null if it
   couldn't be made just now */
async function ensureConn(year, date, NAMES, deadline = Date.now() + 40000, opt = {}) {
  const Q = !!opt.q;                              // Quartets' own day (from QUARTETS_BACK): its own key, four of four
  const key = Q ? QKEY(year) : keyFor(year, date);
  const selAll = () => db.from("conn_puzzle").select("year, groups").eq("date", date).in("year", Q ? [QKEY(year)] : allKeys(year));
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
  const seed = hashStr((Q ? "quart:" : "conn:") + date + ":" + year);
  /* the last two months' puzzles: which categories came up when (so the same ones don't keep turning up),
     and who each category used (so it picks other people next time). Read only; nothing is changed. */
  const avoid = new Map(), usedBy = new Map(), dayMs = 864e5, today = Date.parse(date + "T00:00:00Z");
  const { data: recent } = await db.from("conn_puzzle").select("date, year, groups").in("year", allKeys(year).concat(QKEY(year))).lt("date", date)      // both games' days
    .gte("date", new Date(today - PEOPLE_DAYS * dayMs).toISOString().slice(0, 10)).order("date", { ascending: false }).limit(PEOPLE_DAYS + 5);
  /* Triplets' last few days: how many of their groups came from timetables (so tomorrow's mix differs) */
  const recentMix = (recent || []).filter(r => r.year !== QKEY(year) && Array.isArray(r.groups) && r.groups.length === 3)
    .map(r => ({ ago: Math.round((today - Date.parse(String(r.date).slice(0, 10) + "T00:00:00Z")) / dayMs), tt: r.groups.filter(g => g && g.kind !== "name").length }))
    .filter(d => d.ago <= 3);
  (recent || []).forEach(r => { const ago = Math.round((today - Date.parse(String(r.date).slice(0, 10) + "T00:00:00Z")) / dayMs);
    (Array.isArray(r.groups) ? r.groups : []).forEach(g => { if (!g || !g.id) return;
      if (!avoid.has(g.id) || ago < avoid.get(g.id)) avoid.set(g.id, ago);
      const m = usedBy.get(g.id) || usedBy.set(g.id, new Map()).get(g.id);
      (Array.isArray(g.emails) ? g.emails : []).forEach(e => { const k = String(e).toLowerCase(); if (!m.has(k) || ago < m.get(k)) m.set(k, ago); }); }); });
  const checked = new Map(), onTimetable = (e, raw) => checked.set(e, hasClassesIn(raw));   // everyone whose timetable was read
  const size = Q ? 4 : date >= TRIPLETS_FROM ? 3 : 4;
  let made = await makeQuartets({ size, people, getTT, getRoster, seed, year, avoid, usedBy, teacherName, onTimetable, deadline, recentMix });
  if (!made) made = await makeQuartets({ size, people, getTT, getRoster, seed: seed ^ 0x5bd1e995, year, avoid, usedBy, teacherName, onTimetable,
                                         deadline: Math.max(deadline, Date.now() + 3000), recentMix });
  markClasses(checked).catch(() => {});
  if (!made) { console.error("quartets: couldn't make", year, date, "from", people.length, "people"); return null; }   // not kept: tried again next visit
  if (made.tier > 0) console.warn("quartets:", year, date, "made with fallback tier", made.tier);
  if (!made.mixKept) console.warn("triplets:", year, date, "couldn't make the day's mix of", made.mix, "timetable groups");
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
/* How hard each group was meant to be, in words only (1 easy, 2 medium, 3 hard,
   4 very hard), and the day as a whole against the usual (-1 easier, 0 about
   usual, 1 harder). No scores or category kinds go out. */
const rateGroup = h => h <= 1.5 ? 1 : h <= 2.25 ? 2 : h <= 3.25 ? 3 : 4;
function designOf(stored) {
  const hs = new Map((stored || []).map(g => [g.lv, hardness({ kind: g.kind, id: g.id })]));
  const total = [...hs.values()].reduce((a, b) => a + b, 0);
  return { rated: lv => hs.has(lv) ? rateGroup(hs.get(lv)) : null, day: hs.size === 4 ? (total < 9 ? -1 : total > 10.5 ? 1 : 0) : hs.size === 3 ? (total < 6 ? -1 : total > 7.2 ? 1 : 0) : null };
}
async function summaryFor(pk, date, groups, NAMES, stored, told, table = "conn_result") {
  const MAX_MISTAKES = chancesFor(stored);
  const { data } = await db.from(table).select("email, found, mistakes, solved, done, updated_at")
    .eq("year", pk).eq("date", date).eq("done", true).limit(2000);
  const rows = data || [];
  const nm = e => withName(NAMES, e, nameFromEmail(e));
  const dist = { lost: 0 }, names = { lost: [] };
  for (let i = 0; i < MAX_MISTAKES; i++) { dist[i] = 0; names[i] = []; }
  for (const r of rows) {
    const k = r.solved ? String(Math.min(MAX_MISTAKES - 1, r.mistakes || 0)) : "lost";
    dist[k]++; if (names[k].length < 40) names[k].push(nm(r.email));
  }
  const design = designOf(stored);
  const found = (groups || []).map(g => ({ lv: g.lv, label: told ? g.label : undefined, rated: design.rated(g.lv),
    found: rows.filter(r => Array.isArray(r.found) && r.found.includes(g.lv)).length }));
  /* one person for the day: the first to solve it without a mistake, or else the first to solve it */
  const solvedRows = rows.filter(r => r.solved).sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)));
  const perfect = solvedRows.find(r => !r.mistakes);
  const spotlight = perfect ? { kind: "perfect", name: nm(perfect.email) }
    : solvedRows[0] ? { kind: "first", name: nm(solvedRows[0].email), n: solvedRows[0].mistakes || 0 } : null;
  return { played: rows.length, solved: solvedRows.length, chances: MAX_MISTAKES, dist, names, found, spotlight, design: design.day };
}

/* the nightly job (api/daily-generate.js) makes each year's puzzle ahead of time,
   so the first player of the day doesn't wait while it's made */
export async function prebuildQuartets(year, date, NAMES, deadline = Date.now() + 40000) {
  const day = await ensureConn(String(year), date, NAMES, deadline);
  if (newQ(date) && Date.now() < deadline - 10000) try { await ensureConn(String(year), date, NAMES, deadline, { q: true }); } catch (e) { console.error("quartets (every second day):", e.message); }
  /* and any earlier day kept empty (by an older version of this code), a few a night */
  const { data: days } = await db.from("conn_puzzle").select("date, year, groups").in("year", allKeys(year)).gte("date", CONN_EPOCH).lt("date", date).limit(5000);
  const byDate = new Map(); (days || []).forEach(d => (byDate.get(d.date) || byDate.set(d.date, []).get(d.date)).push(d));
  for (const [d] of [...byDate].filter(([, rs]) => !pickDay(rs)).slice(0, 3)) {
    if (Date.now() > deadline - 8000) break;
    try { await ensureConn(String(year), d, NAMES, Math.min(deadline, Date.now() + 15000)); } catch (e) { console.error("quartets repair:", e.message); }
  }
  return day ? "ok" : "none";
}

/* the same shuffle the page used to do, from a seed (so a reload keeps the order) */
const seeded = (list, seed) => { let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const HINT_MARK = 0;                    // a log entry of all zeros: Triplets' hint was asked for (kept with the result)
/* Triplets from 25 November 2026: no Hint button. With one mistake left the hint comes by itself: two people from the
   easiest group still unsolved (the owner, 24 November: people were stuck once only two groups were left, where every wrong
   pick reads "one away"). Not the group's name: the owner took that out. Earlier days keep the button and the hint as they were. */
export const AUTO_HINT_FROM = "2026-11-25";
const autoHint = (K, date) => K === 3 && String(date) >= AUTO_HINT_FROM;
/* The hints, from the guesses so far. Triplets: the one asked for, two people from the easiest
   group still unsolved. Quartets (earlier days): two in a row wrong lights up two from the easiest
   unsolved group, a third wrong in a row a third; with one mistake left, two from another group. */
function hintsFor(groups, result, date, CH) {
  const K = groups.length, found = result.found || [], log = (result.log || []).filter(g => !g.every(l => l === HINT_MARK));
  if (K === 3 && autoHint(K, date)) {
    const left = groups.filter(x => !found.includes(x.lv)), hg = left[0];
    if (result.done || left.length < 2 || (result.mistakes || 0) < CH - 1) return { gold: [], blue: [] };
    return { gold: seeded(hg.names, date + ":hint").slice(0, 2), blue: [] }; }
  if (K === 3) { const hg = groups.find(x => !found.includes(x.lv));
    return { gold: result.hinted && hg && !result.done ? seeded(hg.names, date + ":hint").slice(0, 2) : [], blue: [] }; }
  let run = 0, step = 0, hg = null, lg = null, wrong = 0; const got = [];
  for (const g of log) {
    if (g.every(l => l === g[0])) { got.push(g[0]); run = 0; continue; }
    run++; wrong++;
    if (run === 2 && step === 0) { hg = groups.find(x => !got.includes(x.lv)); step = 1; }
    else if (run === 3 && step === 1) { step = hg && !got.includes(hg.lv) ? 2 : 3; }
    if (wrong === CH - 1 && !lg) lg = groups.find(x => !got.includes(x.lv) && x !== hg) || null;
  }
  if (result.done) return { gold: [], blue: [] };
  const gold = !hg || found.includes(hg.lv) || step === 3 ? [] : seeded(hg.names, date + ":hint").slice(0, step === 2 ? 3 : 2);
  const blue = !lg || found.includes(lg.lv) ? [] : seeded(lg.names, date + ":last").slice(0, 2);
  return { gold, blue };
}
/* the board as this person has it: the people not yet placed, the groups found (all once done) */
function boardView(groups, result, date, CH) {
  const sorted = groups.slice().sort((a, b) => a.lv - b.lv), found = result.found || [];
  const shown = result.done ? sorted : found.map(lv => sorted.find(g => g.lv === lv)).filter(Boolean);
  return { size: sorted.length, chances: CH, autoHint: autoHint(sorted.length, date),
    tiles: seeded(sorted.flatMap(g => g.names), date).filter(n => !shown.some(g => g.names.includes(n))),
    groups: shown.map(g => ({ lv: g.lv, label: g.label, names: g.names, how: g.how, found: found.includes(g.lv) })),
    result: { found, log: result.log || [], mistakes: result.mistakes || 0, solved: !!result.solved, done: !!result.done, hinted: !!result.hinted },
    hint: hintsFor(sorted, result, date, CH) };
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
        db.from("conn_puzzle").select("date, year, groups").in("year", keys).gte("date", TRIPLETS_FROM).lte("date", today).limit(5000),
        db.from("conn_result").select("date, year, solved").in("year", keys).eq("done", true).gte("date", TRIPLETS_FROM).limit(50000),
        db.from("conn_result").select("date, year, solved, done, mistakes").eq("email", me.email).in("year", keys).gte("date", TRIPLETS_FROM)
      ]);
      /* each day's played puzzle (its version); a day kept empty is listed too, and made when it's opened */
      const rowsOf = new Map(); (days || []).forEach(d => (rowsOf.get(d.date) || rowsOf.set(d.date, []).get(d.date)).push(d));
      const keyOf = {}; rowsOf.forEach((rs, date) => { const p = pickDay(rs); keyOf[date] = p ? p.year : keyFor(year, date); });
      const by = {};
      Object.keys(keyOf).forEach(date => by[date] = { date, played: 0, wins: 0 });
      (plays || []).forEach(r => { const d = by[r.date]; if (d && r.year === keyOf[r.date]) { d.played++; if (r.solved) d.wins++; } });
      const m = {}; (mine || []).forEach(r => { if (r.year === keyOf[r.date]) m[r.date] = { solved: !!r.solved, done: !!r.done, mistakes: r.mistakes || 0 }; });
      return res.status(200).json({ epoch: TRIPLETS_FROM, today, archive: Object.values(by).sort((a, b) => b.date.localeCompare(a.date)), mine: m });
    }
    const date = cleanDate(req.method === "POST" ? body && body.date : req.query.date, today);
    if (!date) return res.status(400).json({ error: "That day isn't available." });
    /* the day, your result for it (under each version's key, as the day decides which counts) and your
       streak, read side by side: each read is a trip to the database */
    const [day, mine, streakDates] = await Promise.all([ensureConn(year, date, NAMES),
      db.from("conn_result").select("year, found, log, mistakes, solved, done, updated_at").eq("email", me.email).eq("date", date).in("year", keys),
      db.from("conn_result").select("date").eq("email", me.email).eq("solved", true).order("date", { ascending: false }).limit(120)]);
    if (!day || !isPuzzle(day.groups)) return res.status(200).json({ date, today, epoch: TRIPLETS_FROM, year, none: true, retry: true });
    const stored = day.groups, pk = day.key;     // results go with the version that made the day
    /* by the names people go by today; emails stay on the server */
    const groups = stored.map(g => {
      const names = (g.names || []).map((n, i) => withName(NAMES, (g.emails || [])[i], n));
      return { lv: g.lv, label: stripEmails(g.label), kind: g.kind, names, how: names.map(n => g.kind === "name" ? howFor(g.id, n) : "") };
    });

    const had = ((mine && mine.data) || []).find(r => r.year === pk) || null;
    const dates = [...new Set(((streakDates && streakDates.data) || []).map(r => r.date))];
    const result = had ? { found: had.found || [], log: had.log || [], mistakes: had.mistakes || 0, solved: !!had.solved, done: !!had.done }
                       : { found: [], log: [], mistakes: 0, solved: false, done: false };
    result.hinted = result.log.some(g => Array.isArray(g) && g.length && g.every(l => l === HINT_MARK));
    const CH = chancesFor(stored);

    if (req.method === "GET" && req.query.summary) {
      return res.status(200).json({ date, summary: await summaryFor(pk, date, groups, NAMES, stored, result.done), mine: result });
    }
    const board = async extra => res.status(200).json(Object.assign({ date, today, epoch: TRIPLETS_FROM, year }, boardView(groups, result, date, CH),
      { streak: computeStreak(result.solved && !dates.includes(date) ? [date].concat(dates) : dates, today) }, extra || {}));
    if (req.method === "GET") return board();
    if (req.method === "POST") {
      if (result.done) return board();
      const G = stored.length;                                    // groups, and people in each (the same)
      let extra = {};
      if (body.hint) {
        if (G !== 3 || result.hinted || autoHint(G, date)) return board();
        result.log = result.log.concat([Array(G).fill(HINT_MARK)]); result.hinted = true;
      } else {
        /* a guess: K names, all still on the board */
        const pick = Array.isArray(body.pick) ? [...new Set(body.pick.map(String))] : [];
        const lvOf = new Map(); groups.forEach(g => g.names.forEach(n => lvOf.set(n, g.lv)));
        if (pick.length !== G || pick.some(n => !lvOf.has(n) || result.found.includes(lvOf.get(n))))
          return res.status(400).json({ error: "Reload the page to carry on." });
        const lvs = pick.map(n => lvOf.get(n)), right = lvs.every(l => l === lvs[0]);
        result.log = result.log.concat([lvs]).slice(0, G + CH + 1);
        if (right) result.found = [...new Set(result.found.concat(lvs[0]))];
        else result.mistakes = Math.min(CH, result.mistakes + 1);
        const most = Math.max(...groups.map(g => lvs.filter(x => x === g.lv).length));
        extra = { right, oneAway: !right && most === G - 1 };
      }
      result.solved = result.found.length === G && result.mistakes < CH;
      result.done = result.solved || result.mistakes >= CH;
      /* saved only on top of the result just read, so guesses sent at once can't both count */
      const row = { email: me.email, date, year: pk, found: result.found, log: result.log, mistakes: result.mistakes,
        solved: result.solved, done: result.done, updated_at: new Date().toISOString() };
      const { data: saved, error } = had
        ? await db.from("conn_result").update(row).eq("email", me.email).eq("date", date).eq("year", pk).eq("updated_at", had.updated_at).select("done")
        : await db.from("conn_result").insert(row).select("done");
      if (error && /duplicate|unique|23505/i.test(error.message + " " + error.code)) return res.status(409).json({ error: "Too quick: try that again." });
      if (error) { console.error("quartets result:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
      if (!saved || !saved.length) return res.status(409).json({ error: "Too quick: try that again." });
      return board(extra);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("quartets:", e.message);
    return res.status(502).json({ error: /does not exist|relation|schema cache|could not find/i.test(e.message)
      ? "Quartets isn't set up yet." : "Couldn't load today's Quartets." });
  }
}

/* ── Quartets (q=1): its own game again, from 2026-11-24 ──────────────────────
   The days: the old Quartets days (CONN_EPOCH to the day before TRIPLETS_FROM, played and kept as they were: puzzles under
   their version keys, results in conn_result), then every second day from QUARTETS_BACK (puzzles under "<year>#q1", results
   in quart_result). No date asked for: the latest Quartets day, so the day between two shows the last one, and says when
   the next comes. The streak counts Quartets days in a row (every second day counts as in a row). The rest (the board, the
   guesses, the old hints, the summary) is as Quartets always was. */
const missingTable = e => e && /does not exist|relation|schema cache|could not find/i.test(e.message || "");
export async function quartRoute(req, res, me, body, NAMES) {
  const today = sydneyDate();
  let year;
  try { year = await resolveYear(me); } catch { year = null; }
  if (!year) return res.status(400).json({ error: "Couldn't work out which year you're in." });
  year = String(year);
  const keys = allKeys(year), QK = QKEY(year);
  /* the days you solved, from both kinds, for the streak */
  const solvedDays = async () => {
    const [{ data: a }, { data: b2 }] = await Promise.all([
      db.from("conn_result").select("date").eq("email", me.email).eq("solved", true).in("year", keys).lt("date", TRIPLETS_FROM).gte("date", CONN_EPOCH),
      db.from("quart_result").select("date").eq("email", me.email).eq("solved", true).eq("year", QK)]);
    return new Set([...(a || []), ...(b2 || [])].map(r => String(r.date).slice(0, 10)));
  };
  const streakOf = (won, upto) => { const days = qDaysUpTo(upto).reverse(); let i = 0, n = 0;
    if (days.length && !won.has(days[0])) i = 1;                                // the latest still open: count from the one before
    for (; i < days.length && won.has(days[i]); i++) n++; return n; };
  try {
    if (req.method === "GET" && req.query.archive) {
      const [{ data: oldDays }, { data: newDays }, { data: oldPlays }, { data: newPlays }, { data: oldMine }, { data: newMine }] = await Promise.all([
        db.from("conn_puzzle").select("date, year, groups").in("year", keys).gte("date", CONN_EPOCH).lt("date", TRIPLETS_FROM).limit(5000),
        db.from("conn_puzzle").select("date, year, groups").eq("year", QK).gte("date", QUARTETS_BACK).lte("date", today).limit(5000),
        db.from("conn_result").select("date, year, solved").in("year", keys).eq("done", true).gte("date", CONN_EPOCH).lt("date", TRIPLETS_FROM).limit(50000),
        db.from("quart_result").select("date, year, solved").eq("year", QK).eq("done", true).limit(50000),
        db.from("conn_result").select("date, year, solved, done, mistakes").eq("email", me.email).in("year", keys).gte("date", CONN_EPOCH).lt("date", TRIPLETS_FROM),
        db.from("quart_result").select("date, year, solved, done, mistakes").eq("email", me.email).eq("year", QK)]);
      const rowsOf = new Map(); [...(oldDays || []), ...(newDays || [])].forEach(d => (rowsOf.get(d.date) || rowsOf.set(d.date, []).get(d.date)).push(d));
      const keyOf = {}; rowsOf.forEach((rs, date) => { const p = pickDay(rs); keyOf[date] = p ? p.year : oldQ(date) ? keyFor(year, date) : QK; });
      const qdays = qDaysUpTo(today);
      qdays.filter(newQ).forEach(d => { if (!keyOf[d]) keyOf[d] = QK; });        // a day not made yet is made when it's opened
      const by = {}; Object.keys(keyOf).forEach(date => by[date] = { date, played: 0, wins: 0 });
      [...(oldPlays || []), ...(newPlays || [])].forEach(r => { const d = by[r.date]; if (d && r.year === keyOf[r.date]) { d.played++; if (r.solved) d.wins++; } });
      const m = {}; [...(oldMine || []), ...(newMine || [])].forEach(r => { if (r.year === keyOf[r.date]) m[r.date] = { solved: !!r.solved, done: !!r.done, mistakes: r.mistakes || 0 }; });
      return res.status(200).json({ epoch: CONN_EPOCH, today, qdays, archive: Object.values(by).sort((a, b) => b.date.localeCompare(a.date)), mine: m });
    }
    const raw = req.method === "POST" ? body && body.date : req.query.date;
    const date = raw ? (/^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today && isQuartetsDay(raw) ? raw : null) : latestQ(today);
    if (!date) return res.status(400).json({ error: "That day isn't available." });
    const old = oldQ(date), T = old ? "conn_result" : "quart_result", rkeys = old ? keys : [QK];
    const [day, mine, won] = await Promise.all([old ? ensureConn(year, date, NAMES) : ensureConn(year, date, NAMES, undefined, { q: true }),
      db.from(T).select("year, found, log, mistakes, solved, done, updated_at").eq("email", me.email).eq("date", date).in("year", rkeys),
      solvedDays()]);
    if (missingTable(mine.error)) throw mine.error;
    const next = nextQ(today);
    if (!day || !isPuzzle(day.groups)) return res.status(200).json({ date, today, epoch: CONN_EPOCH, year, next, none: true, retry: true });
    const stored = day.groups, pk = day.key;
    const groups = stored.map(g => {
      const names = (g.names || []).map((n, i) => withName(NAMES, (g.emails || [])[i], n));
      return { lv: g.lv, label: stripEmails(g.label), kind: g.kind, names, how: names.map(n => g.kind === "name" ? howFor(g.id, n) : "") };
    });
    const had = ((mine && mine.data) || []).find(r => r.year === pk) || null;
    const result = had ? { found: had.found || [], log: had.log || [], mistakes: had.mistakes || 0, solved: !!had.solved, done: !!had.done }
                       : { found: [], log: [], mistakes: 0, solved: false, done: false };
    result.hinted = false;
    const CH = chancesFor(stored);
    if (req.method === "GET" && req.query.summary) return res.status(200).json({ date, summary: await summaryFor(pk, date, groups, NAMES, stored, result.done, T), mine: result });
    const board = extra => res.status(200).json(Object.assign({ date, today, epoch: CONN_EPOCH, year, next }, boardView(groups, result, date, CH),
      { streak: streakOf(result.solved ? new Set([...won, date]) : won, today) }, extra || {}));
    if (req.method === "GET") return board();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (result.done) return board();
    const G = stored.length;
    const pick = Array.isArray(body.pick) ? [...new Set(body.pick.map(String))] : [];
    const lvOf = new Map(); groups.forEach(g => g.names.forEach(n => lvOf.set(n, g.lv)));
    if (pick.length !== G || pick.some(n => !lvOf.has(n) || result.found.includes(lvOf.get(n))))
      return res.status(400).json({ error: "Reload the page to carry on." });
    const lvs = pick.map(n => lvOf.get(n)), right = lvs.every(l => l === lvs[0]);
    result.log = result.log.concat([lvs]).slice(0, G + CH + 1);
    if (right) result.found = [...new Set(result.found.concat(lvs[0]))];
    else result.mistakes = Math.min(CH, result.mistakes + 1);
    const most = Math.max(...groups.map(g => lvs.filter(x => x === g.lv).length));
    result.solved = result.found.length === G && result.mistakes < CH;
    result.done = result.solved || result.mistakes >= CH;
    const row = { email: me.email, date, year: pk, found: result.found, log: result.log, mistakes: result.mistakes,
      solved: result.solved, done: result.done, updated_at: new Date().toISOString() };
    const { data: saved, error } = had
      ? await db.from(T).update(row).eq("email", me.email).eq("date", date).eq("year", pk).eq("updated_at", had.updated_at).select("done")
      : await db.from(T).insert(row).select("done");
    if (error && /duplicate|unique|23505/i.test(error.message + " " + error.code)) return res.status(409).json({ error: "Too quick: try that again." });
    if (error) { if (missingTable(error)) throw error; console.error("quartets result:", error.message); return res.status(502).json({ error: "Couldn't save that." }); }
    if (!saved || !saved.length) return res.status(409).json({ error: "Too quick: try that again." });
    return board({ right, oneAway: !right && most === G - 1 });
  } catch (e) {
    console.error("quartets (q):", e.message);
    return res.status(502).json({ error: missingTable(e) ? "Quartets isn't set up yet." : "Couldn't load Quartets." });
  }
}

/*
 * "Whose timetable?" — a daily game on the games page, served by /api/daily?whose=1 (whoseRoute below),
 * so it needs no Vercel function of its own. Private helper (underscore = not a route).
 *
 * One day of one student's timetable, the same for everyone in their year that day. It starts as blank
 * tiles, one per period: the shape of the day (which periods are free, which are doubles). Each wrong
 * guess (or a skip) fills in one more thing: a period's subject, its teacher or its room, the weekday, or
 * the week. Eight hints, so nine guesses.
 *
 * The answer is certain. Building a day reads every timetable in the year, then checks the hints
 * against every student and every day of their fortnight (anyone could have been shown any of their
 * days): once all eight hints are out exactly one person fits, and the hints are ordered so that one
 * person fits from the sixth or seventh hint, the eighth at the latest (the fifth only if nothing
 * better exists). A day that someone else has exactly the same is never used. If no day in the year
 * can be made unique (whole classes sharing one timetable), the year has no puzzle that day.
 *
 * Like Daily Guess Who, the browser gets the whole day and the answer up front and marks guesses itself,
 * so it's instant; each guess is saved here in the background.
 *
 * Tables (SETUP.md, "Whose timetable?"). RLS on with no policies: only the server reads or writes them.
 *   whose_puzzle(date, year, puzzle jsonb, created_at, pk(date, year))
 *   whose_result(email, date, year, guesses, won, done, updated_at, pk(email, date))
 */

import { db } from "./_supabase.js";
import { fetchAsOwner } from "./timetable.js";
import { rosterList, withName } from "./_names.js";
import { resolveYear, sydneyDate, computeStreak } from "./_daily.js";

export const WHOSE_EPOCH = "2026-11-20";            // the first day of the game
export const HINTS = 8;
const CYCLE = ["mona", "tuea", "weda", "thua", "fria", "monb", "tueb", "wedb", "thub", "frib"];
const WEEKDAY = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };

/* ── seeded helpers ─────────────────────────────────────────────────── */
export function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
async function eachLimited(list, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) await fn(list[i++]); })); }

/* subjects and teachers as the timetable shows them (the same tidying as _daily.js and index.html) */
const cleanSubject = name => String(name || "")
  .replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i, "")
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/, "")
  .replace(/^[\s:\-–—]+/, "").trim();
const titleCase = s => String(s).split(/[-\s]+/).filter(Boolean).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
function tidyTeacher(t) {
  const s = String(t || "").trim();
  if (!s) return "";
  if (s.includes("@")) {
    const parts = s.split("@")[0].split(".");
    if (parts.length >= 2) return titleCase(parts[0]) + " " + titleCase(parts[1].replace(/\d+$/, ""));
    return titleCase(s.split("@")[0].replace(/[._]+/g, " ").replace(/\d+$/, ""));
  }
  const m = s.match(/^([^,]+),\s*(.+)$/);
  return m ? (m[2] + " " + m[1]).replace(/\s{2,}/g, " ").trim() : s;
}
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/* ── a timetable as days: { mona: Map(period → { code, subject, teacher, room }) } ── */
export function readDays(raw) {
  const rows = Array.isArray(raw) ? raw : (raw && (raw.timetable || raw.Timetable)) || [];
  const days = {};
  for (const r of rows) {
    const day = String(r.DayName || r.dayName || "").toLowerCase();
    if (!CYCLE.includes(day)) continue;
    const m = String(r.Period || r.period || "").trim().match(/^(?:period\s*|p)?(\d)$/i);
    if (!m) continue;
    const course = String(r.CourseName || r.courseName || r.Course || "").trim(), code = String(r.ClassCode || r.classCode || "").trim();
    if (!course && !code) continue;
    const d = days[day] || (days[day] = new Map()), p = +m[1];
    if (d.has(p)) continue;
    d.set(p, { code: code || course, subject: cleanSubject(course) || code,
               teacher: tidyTeacher(r.TeacherName || r.TeacherFullName || r.Teacher || r.StaffName || ""),
               room: String(r.RoomCode || r.roomCode || r.Room || r.room || "").trim() });
  }
  return days;
}
/* the shape of a day, periods 0 to 9: "." free, "x" a class, "=" the same class as the period before (a double) */
const shapeOf = day => { let s = ""; for (let p = 0; p <= 9; p++) { const c = day.get(p), b = day.get(p - 1); s += !c ? "." : b && b.code === c.code ? "=" : "x"; } return s; };
/* the classes of a day as tiles, keyed by their first period; a double is one tile, its room or
   teacher left out if they differ between its periods */
function tilesOf(day) {
  const tiles = new Map(); let open = null;
  for (let p = 0; p <= 9; p++) {
    const c = day.get(p);
    if (!c) { open = null; continue; }
    if (open && open.code === c.code && open.to === p - 1) {
      open.to = p;
      if (!same(open.room, c.room)) open.room = "";
      if (!same(open.teacher, c.teacher)) open.teacher = "";
      continue;
    }
    open = { from: p, to: p, code: c.code, subject: c.subject, teacher: c.teacher, room: c.room };
    tiles.set(p, open);
  }
  return tiles;
}

/* ── hints ─────────────────────────────────────────────────────────── */
const per = t => t.from === t.to ? "Period " + t.from : "Periods " + t.from + " and " + t.to;
const IS = t => t.from === t.to ? " is " : " are ";
function hintText(f, tile, dayKey) {
  if (f.k === "D") return "It’s a <b>" + WEEKDAY[dayKey.slice(0, 3)] + "</b>.";
  if (f.k === "W") return "It’s <b>Week " + dayKey.slice(3).toUpperCase() + "</b>.";
  if (f.k === "S") return per(tile) + IS(tile) + "<b>" + tile.subject + "</b>.";
  if (f.k === "T") return per(tile) + IS(tile) + "with <b>" + tile.teacher + "</b>.";
  return per(tile) + IS(tile) + "in <b>" + tile.room + "</b>.";
}
/* does one of someone's days fit a fact about the answer's day? */
function fits(pair, f, ans) {
  if (f.k === "D") return pair.day.slice(0, 3) === ans.day.slice(0, 3);
  if (f.k === "W") return pair.day.slice(3) === ans.day.slice(3);
  const a = ans.tiles.get(f.from), b = pair.tiles.get(f.from);
  if (!a || !b) return false;
  return f.k === "S" ? same(a.subject, b.subject) : f.k === "T" ? same(a.teacher, b.teacher) : same(a.room, b.room);
}
const peopleIn = pairs => new Set(pairs.map(p => p.email)).size;

/* The order of a day's hints. Random orders are tried (seeded, so the same for everyone) and scored:
   exactly one person must fit after the eighth; one person should first fit at the sixth or seventh
   (eighth fine, fifth only at a push, never sooner); each hint should cut the field down steadily
   rather than all at once; the weekday and week make good openers and poor closers. */
function planHints(ans, pool, facts, r, tries) {
  let best = null;
  for (let t = 0; t < tries; t++) {
    /* the weekday and subjects drift towards the front, rooms towards the back, the rest are mixed */
    const order = facts.map(f => ({ f, w: r() + (f.k === "D" ? -0.3 : f.k === "W" ? -0.15 : f.k === "S" ? -0.12 : f.k === "R" ? 0.1 : 0) }))
      .sort((a, b) => a.w - b.w).slice(0, HINTS).map(x => x.f);
    let alive = pool;
    const counts = [peopleIn(alive)];
    for (const f of order) { alive = alive.filter(p => fits(p, f, ans)); counts.push(peopleIn(alive)); }
    if (counts[HINTS] !== 1) continue;
    const first = counts.indexOf(1);
    if (first < 5) continue;
    let score = { 6: 4, 7: 4, 8: 2, 5: 0 }[first] || 0;
    /* steady: each step's share of the way (in log terms) close to an even share */
    const span = Math.log(Math.max(2, counts[0]));
    for (let i = 1; i <= first; i++) {
      const step = (Math.log(Math.max(1, counts[i - 1])) - Math.log(Math.max(1, counts[i]))) / span;
      score -= Math.pow(step - 1 / first, 2) * 6;
      if (counts[i] === counts[i - 1] && i < first) score -= 0.4;          // a hint that ruled nobody out
    }
    const dw = f => f.k === "D" || f.k === "W";
    if (dw(order[HINTS - 1])) score -= 1;
    if (dw(order[0]) && dw(order[1])) score -= 1.5;                       // "Week B", then "a Monday": a slow start
    if (order[0].k === "S" || order[0].k === "D") score += 0.5;
    if (!best || score > best.score) best = { order, counts, score };
  }
  return best;
}

/* Make a day's puzzle from a year's timetables.
     people  [{ email }] with readable timetables: days (from readDays)
     seed    a number (from the date and year); avoid: emails used lately
   Returns { email, day, lo, hi, tiles, hints:[{k, from?}], counts } or null (no day could be made certain). */
export function makeWhose({ people, seed, avoid = new Set(), maxTries = 300 }) {
  const r = rng(seed);
  /* every day of everyone's fortnight that has a class in it */
  const pairs = [];
  for (const p of people) for (const day of CYCLE) {
    const d = p.days[day];
    if (d && d.size) pairs.push({ email: p.email, day, shape: shapeOf(d), tiles: tilesOf(d), max: Math.max(...d.keys()), min: Math.min(...d.keys()) });
  }
  if (!pairs.length) return null;
  const byShape = new Map();
  for (const p of pairs) (byShape.get(p.shape) || byShape.set(p.shape, []).get(p.shape)).push(p);
  /* the year's usual last period, so a day that ends early shows its free periods at the end */
  const lastCount = {};
  pairs.forEach(p => lastCount[p.max] = (lastCount[p.max] || 0) + 1);
  const usualLast = +Object.keys(lastCount).sort((a, b) => lastCount[b] - lastCount[a])[0];

  /* everything a day can tell (the day, its shape, each class's subject, teacher and room): a day
     with the same as someone else's can never be certain, so only days nobody else has are tried */
  const sigOf = p => p.day + "|" + p.shape + "|" + [...p.tiles.values()].map(t => [t.subject, t.teacher, t.room].map(x => String(x).toLowerCase()).join("~")).join("|");
  const holders = new Map();
  for (const p of pairs) { const k = sigOf(p); (holders.get(k) || holders.set(k, new Set()).get(k)).add(p.email); }
  const open = shuffle(pairs.filter(p => p.tiles.size >= 2 && !avoid.has(p.email) && holders.get(sigOf(p)).size === 1), r);
  let tries = 0;
  for (const ans of open) {
    if (tries++ >= maxTries) break;
    const pool = byShape.get(ans.shape);
    const facts = [{ k: "D" }, { k: "W" }];
    for (const t of ans.tiles.values()) {
      if (t.subject) facts.push({ k: "S", from: t.from });
      if (t.teacher) facts.push({ k: "T", from: t.from });
      if (t.room) facts.push({ k: "R", from: t.from });
    }
    if (facts.length < HINTS) continue;
    /* certain with everything out? (empty facts are left out, so check it as the game will) */
    if (peopleIn(pool.filter(p => facts.every(f => fits(p, f, ans)))) !== 1) continue;
    const plan = planHints(ans, pool, facts, r, 500);
    if (!plan) continue;
    const lo = Math.min(1, ans.min), hi = Math.max(usualLast, ans.max);
    const tiles = [];
    for (let p = lo; p <= hi; p++) {
      const t = ans.tiles.get(p);
      if (t) { tiles.push({ from: t.from, to: t.to, subject: t.subject, teacher: t.teacher, room: t.room, code: t.code }); p = t.to; }
      else tiles.push({ from: p, to: p, free: true });
    }
    return { email: ans.email, day: ans.day, lo, hi, tiles,
             hints: plan.order.map(f => f.from == null ? { k: f.k } : { k: f.k, from: f.from }), counts: plan.counts };
  }
  return null;
}

/* the hints as the browser shows them: text, and what each fills in on the board */
export function hintsFor(p) {
  const tiles = new Map(p.tiles.filter(t => !t.free).map(t => [t.from, t]));
  return p.hints.map(h => { const t = tiles.get(h.from);
    return { k: h.k, from: h.from, text: hintText(h, t, p.day),
             value: h.k === "D" ? WEEKDAY[p.day.slice(0, 3)] : h.k === "W" ? "Week " + p.day.slice(3).toUpperCase()
                  : h.k === "S" ? t.subject : h.k === "T" ? t.teacher : t.room }; });
}

/* ── building a year's day (the school API, as the server account) ─────── */
const ttCache = new Map();                           // email → { at, days }, per warm instance, so a retry carries on
async function daysOf(email) {
  const hit = ttCache.get(email);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.days;
  const days = readDays(await fetchAsOwner("/api/timetable/" + encodeURIComponent(email)));
  if (ttCache.size > 3000) ttCache.clear();
  ttCache.set(email, { at: Date.now(), days });
  return days;
}
/* a fingerprint of a whole timetable, to spot the school API handing back one timetable for everyone */
const printOf = days => CYCLE.map(d => d + ":" + (days[d] ? [...days[d]].map(([p, c]) => p + c.code).join(",") : "")).join("|");

async function buildYear(year, date, deadline) {
  const roster = (await rosterList()).filter(p => String(p.year) === String(year) && p.first && p.last && p.hasClasses !== false);
  if (roster.length < 8) return { none: "Not enough people in your year." };
  const got = [];
  let failed = 0;
  await eachLimited(roster, 12, async p => {
    if (Date.now() > deadline) { failed++; return; }
    try { const days = await daysOf(p.email); if (Object.keys(days).length) got.push({ email: p.email, days }); } catch { failed++; }
  });
  /* too many unread: try again later (nothing is stored, so the next visit carries on from the cache) */
  if (got.length < roster.length * 0.85 - 2) return { retry: true };
  const prints = new Map();
  got.forEach(p => { const k = printOf(p.days); prints.set(k, (prints.get(k) || 0) + 1); });
  if ([...prints.values()].some(n => n > 5 && n > got.length * 0.25)) return { none: "The timetables couldn't be read properly today." };

  const { data: recent } = await db.from("whose_puzzle").select("puzzle").eq("year", String(year)).lt("date", date)
    .order("date", { ascending: false }).limit(40);
  const avoid = new Set((recent || []).map(r => r.puzzle && r.puzzle.email).filter(Boolean));
  const puzzle = makeWhose({ people: got.sort((a, b) => a.email.localeCompare(b.email)), seed: hashStr("whose|" + date + "|" + year), avoid });
  if (!puzzle) return { none: "No one’s day is certain enough in your year today." };
  /* prove the timetable read is theirs: they're on the roster of one of that day's classes */
  for (const t of puzzle.tiles.filter(t => !t.free && t.code).slice(0, 3)) {
    try {
      const raw = await fetchAsOwner("/api/timetable/class/" + encodeURIComponent(t.code));
      const arr = Array.isArray(raw) ? raw : (raw && (raw.roster || raw.students)) || [];
      if (arr.some(x => String(x.emailAddress || x.Email || x.email || "").toLowerCase() === puzzle.email)) return { puzzle };
    } catch {}
  }
  return { none: "Today’s day couldn’t be checked." };
}

/* today's (or a past day's) puzzle for a year; made by the first to ask, or by the nightly job */
const building = new Map();
export async function ensureWhose(year, date, deadline = Date.now() + 45000) {
  year = String(year);
  const sel = () => db.from("whose_puzzle").select("puzzle").eq("date", date).eq("year", year).maybeSingle();
  const { data: row, error } = await sel();
  if (error) throw new Error(/does not exist|relation|schema cache/i.test(error.message) ? "Whose timetable? isn't set up yet." : "puzzle read: " + error.message);
  if (row) return row.puzzle;
  if (date !== sydneyDate()) return null;            // a past day that was never made stays unmade
  const key = date + "|" + year;
  if (!building.has(key)) building.set(key, (async () => {
    try {
      const b = await buildYear(year, date, deadline);
      if (b.retry) return { retry: true };
      const puzzle = b.puzzle || { none: b.none };
      const { error: upErr } = await db.from("whose_puzzle").upsert({ date, year, puzzle }, { onConflict: "date,year", ignoreDuplicates: true });
      if (upErr) throw new Error("puzzle write: " + upErr.message);
      const { data: again } = await sel();
      return again ? again.puzzle : puzzle;
    } finally { setTimeout(() => building.delete(key), 1000); }
  })());
  return building.get(key);
}

/* the nightly job's part: every year, while there's time */
export async function prebuildWhose(deadline) {
  const date = sydneyDate(), out = {};
  for (const y of ["12", "11", "10", "9", "8", "7"]) {
    if (Date.now() > deadline - 8000) { out[y] = "later"; continue; }
    try { const p = await ensureWhose(y, date, deadline - 3000); out[y] = !p ? "none" : p.retry ? "later" : p.none ? "none" : "ok"; }
    catch (e) { out[y] = "skip"; console.error("whose " + y + ":", e.message); }
  }
  return out;
}

/* ── the route: /api/daily?whose=1 (GET: the day; summary=1: how the year went) and {whose:1, guess} ── */
const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const shift = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export async function whoseRoute(req, res, me, body, NAMES) {
  const today = sydneyDate();
  const raw = req.method === "POST" ? body.date : req.query.date;
  const date = !raw ? today : /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today && raw >= WHOSE_EPOCH && raw >= shift(today, -30) ? raw : null;
  if (!date) return res.status(400).json({ error: "That day isn't available to play." });
  let year, p;
  try {
    year = await resolveYear(me);
    if (!year) return res.status(400).json({ error: "Couldn't work out which year you're in." });
    p = await ensureWhose(year, date);
  } catch (e) { console.error("whose setup:", e.message); return res.status(502).json({ error: e.message || "Couldn't load the puzzle." }); }
  if (!p || p.retry) return res.status(503).json({ error: "Still reading everyone’s timetables. Try again in a minute." });
  if (p.none) return res.status(200).json({ date, today, year, none: p.none });

  const answer = withName(NAMES, p.email, null) || (await rosterList().then(l => l.find(x => x.email === p.email)).then(x => x ? x.first + " " + x.last : null).catch(() => null));
  if (!answer) return res.status(502).json({ error: "Couldn't load the puzzle." });
  const total = HINTS + 1;
  const { data: had } = await db.from("whose_result").select("guesses, won, done").eq("email", me.email).eq("date", date).maybeSingle();
  let guesses = (had && had.guesses) || 0, done = !!(had && had.done), won = !!(had && had.won);
  const streak = async () => computeStreak(((await db.from("whose_result").select("date").eq("email", me.email).eq("won", true)
    .order("date", { ascending: false }).limit(120)).data || []).map(r => r.date), today);

  if (req.method === "GET" && req.query.summary) {
    const { data } = await db.from("whose_result").select("email, guesses, won, done").eq("year", String(year)).eq("date", date).limit(5000);
    /* who is in each bar, for hovering over it (by the names people go by, as in Daily Guess Who; capped so it stays small) */
    const roster = new Map((await rosterList().catch(() => [])).map(x => [x.email, x.first + " " + x.last]));
    const nameOf = e => withName(NAMES, e, roster.get(e) || titleCase(String(e).split("@")[0].replace(/[._]+/g, " ").replace(/\d+$/, "")));
    const dist = {}, names = { lost: [] }; for (let i = 1; i <= total; i++) { dist[i] = 0; names[i] = []; }
    const add = (k, e) => { if (names[k].length < 40) names[k].push(nameOf(e)); };
    let played = 0, wins = 0;
    for (const r of data || []) {
      if (r.done) played++;
      if (r.won) { wins++; if (r.guesses >= 1 && r.guesses <= total) { dist[r.guesses]++; add(r.guesses, r.email); } }
      else if (r.done) add("lost", r.email);
    }
    return res.status(200).json({ date, summary: { played, wins, losses: played - wins, total, dist, names } });
  }
  if (req.method === "GET") {
    const candidates = (await rosterList()).filter(x => String(x.year) === String(year) && x.first && x.last && x.hasClasses !== false)
      .map(x => withName(NAMES, x.email, x.first + " " + x.last));
    if (!candidates.some(n => norm(n) === norm(answer))) candidates.push(answer);
    return res.status(200).json({ date, today, year, candidates: [...new Set(candidates)].sort((a, b) => a.localeCompare(b)),
      tiles: p.tiles.map(t => t.free ? { from: t.from, to: t.to, free: true } : { from: t.from, to: t.to }),
      day: { weekday: WEEKDAY[p.day.slice(0, 3)], week: p.day.slice(3).toUpperCase() },
      full: p.tiles.filter(t => !t.free).map(t => ({ from: t.from, subject: t.subject, teacher: t.teacher, room: t.room })),
      hints: hintsFor(p), total, guesses, done, won, streak: await streak(), answer });
  }
  if (req.method === "POST") {
    if (done) return res.status(200).json({ done, won, guesses, total, streak: await streak(), answer });
    const guess = String(body.guess || "");
    if (!guess && !body.skip) return res.status(400).json({ error: "A guess is required." });
    guesses += 1;
    won = !body.skip && norm(guess) === norm(answer);
    done = won || guesses >= total;
    const { error } = await db.from("whose_result").upsert({ email: me.email, date, year: String(year), guesses, won, done, updated_at: new Date().toISOString() });
    if (error) { console.error("whose result:", error.message); return res.status(502).json({ error: "Couldn't save your guess." }); }
    return res.status(200).json({ correct: won, done, won, guesses, total, streak: await streak(), answer: done ? answer : undefined });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

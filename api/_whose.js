/*
 * "Whose Timetable?" — a daily game on the games page, served by /api/daily?whose=1 (whoseRoute below),
 * so it needs no Vercel function of its own. Private helper (underscore = not a route). (Briefly
 * called "Whose Week"; the owner went back to this name, easier to say.)
 *
 * Someone's whole fortnight from your year, the same for everyone in it that day. It starts as the
 * school's grid: a blank rectangle for every period at its bell time, gaps for recess, lunch and
 * assembly, and nothing else (free periods look like the rest, so the first guess is blind). Each
 * wrong guess, or a skip, gives one more hint, in the same order of kinds every day:
 *   1 every lesson of a common subject (two of them in the junior years)
 *   2 one period on every day
 *   3 a whole day (frees and all)
 *   4 every lesson of a rarer subject
 *   5 a teacher ("teaches two of their classes"), or a double on a day
 *   6 all their free periods
 * Each fills in tiles (subjects in their colours) except the teacher or double; a hint never fills a
 * tile already shown. Nothing personal or abstract (how many subjects, which classes you share): the
 * owner found those unfair. Under the board, a plain count of the students who still fit.
 *
 * The answer is certain. Building a day reads every timetable in the year; the details of each hint
 * are chosen so that, checked against everyone's whole fortnight (a single week can be shared, so both
 * are always checked), exactly one person fits by the fourth hint (the third from last), and more than
 * one still fits after the first. If no one in the year can be made certain (whole classes sharing a
 * timetable), the year has no puzzle that day.
 *
 * The browser only gets what has been shown so far: the hints unlocked, the tiles they filled in,
 * and how many still fit after each. Guesses are marked here, and the answer (and the rest of the
 * board) only goes out once the day is over for you, so nothing in the page gives the person away.
 * Names only ever go to the browser, never email addresses. The last 30 days can
 * be played again from the archive (?whose=1&archive=1 lists them).
 *
 * Tables (SETUP.md, "Whose Timetable?"). RLS on with no policies: only the server reads or writes them.
 *   whose_puzzle(date, year, puzzle jsonb, created_at, pk(date, year))
 *   whose_result(email, date, year, guesses, won, done, updated_at, pk(email, date))
 * A day made by an earlier version of the game is made again if it's today (the owner chose not to
 * keep those), and a result saved before its day was remade counts as not started. An earlier
 * version's past day can't be played.
 */

import { db } from "./_supabase.js";
import { fetchAsOwner } from "./timetable.js";
import { rosterList, withName } from "./_names.js";
import { resolveYear, sydneyDate, computeStreak } from "./_daily.js";

export const WHOSE_EPOCH = "2026-11-20";            // the first day of the game
const VERSION = 3;
const CYCLE = ["mona", "tuea", "weda", "thua", "fria", "monb", "tueb", "wedb", "thub", "frib"];
const WEEKDAY = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };
const dayName = d => WEEKDAY[d.slice(0, 3)] + ", Week " + d.slice(3).toUpperCase();
const NOT_A_SUBJECT = /\b(sport|study|wellbeing|mentor|roll ?call|homeroom|pastoral|assembly|tutorial|recess|lunch|break)\b/i;
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];
const word = n => WORDS[n] || String(n);

/* ── seeded helpers ─────────────────────────────────────────────────── */
export function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
async function eachLimited(list, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) await fn(list[i++]); })); }
const toMin = v => { const m = String(v == null ? "" : v).match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const lc = s => String(s || "").trim().toLowerCase();
const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const shift = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

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

/* ── reading ───────────────────────────────────────────────────────── */
/* a timetable as days: { mona: Map(period → { code, subject, teacher, s, e }) } */
export function readTT(raw) {
  const rows = Array.isArray(raw) ? raw : (raw && (raw.timetable || raw.Timetable)) || [];
  const days = {};
  for (const r of rows) {
    const day = lc(r.DayName || r.dayName);
    if (!CYCLE.includes(day)) continue;
    const m = String(r.Period || r.period || "").trim().match(/^(?:period\s*|p)?(\d)$/i);
    if (!m) continue;
    const course = String(r.CourseName || r.courseName || r.Course || "").trim(), code = String(r.ClassCode || r.classCode || "").trim();
    if (!course && !code) continue;
    const d = days[day] || (days[day] = new Map()), p = +m[1];
    if (d.has(p)) continue;
    d.set(p, { code: code || course, subject: cleanSubject(course) || code,
               teacher: tidyTeacher(r.TeacherName || r.TeacherFullName || r.Teacher || r.StaffName || ""),
               s: toMin(r.StartTime || r.startTime), e: toMin(r.EndTime || r.endTime) });
  }
  return days;
}
/* the school's bell times: { mona: Map(period → { s, e, teach }) } (Type O or R: not a teaching period) */
export function readBells(raw) {
  const rows = Array.isArray(raw) ? raw : (raw && (raw.bellTimes || raw.BellTimes || raw.bells || raw.data)) || [];
  const out = {};
  for (const r of rows) {
    const day = lc(r.DayName || r.dayName);
    const days = CYCLE.includes(day) ? [day] : /^(mon|tue|wed|thu|fri)/.test(day) ? [day.slice(0, 3) + "a", day.slice(0, 3) + "b"] : [];
    const m = String(r.Period || r.period || "").trim().match(/^(?:period\s*|p)?(\d)$/i);
    const s = toMin(r.StartTime || r.startTime), e = toMin(r.EndTime || r.endTime);
    if (!m || !days.length || s == null || e == null || e <= s) continue;
    const teach = !/^[OR]$/i.test(String(r.Type || r.type || "T").trim());
    for (const d of days) (out[d] || (out[d] = new Map())).set(+m[1], { s, e, teach });
  }
  return out;
}
/* the grid everyone starts with: each day's periods at their bell times. A period is on it if the bells
   call it a teaching period, or a sixth of the year has a class in it (sport, say). */
function templateOf(people, bells) {
  const t = {};
  for (const d of CYCLE) {
    const count = new Map(), times = new Map();
    for (const p of people) {
      const day = p.days[d]; if (!day) continue;
      for (const [per, c] of day) {
        count.set(per, (count.get(per) || 0) + 1);
        if (c.s != null && c.e != null && c.e > c.s) { const m = times.get(per) || times.set(per, new Map()).get(per), k = c.s + "-" + c.e; m.set(k, (m.get(k) || 0) + 1); }
      }
    }
    const b = bells[d] || new Map(), list = [];
    for (let per = 0; per <= 9; per++) {
      const bt = b.get(per);
      if (!((bt && bt.teach) || (count.get(per) || 0) >= Math.max(2, people.length / 6))) continue;
      let s = bt ? bt.s : null, e = bt ? bt.e : null;
      if (s == null && times.has(per)) [s, e] = [...times.get(per)].sort((x, y) => y[1] - x[1])[0][0].split("-").map(Number);
      list.push({ p: per, s, e });
    }
    /* no times for a period: after the one before it */
    list.forEach((x, i) => { if (x.s == null) { x.s = i ? list[i - 1].e + 5 : 540; x.e = x.s + 55; } });
    t[d] = list;
  }
  return t;
}

/* ── one person, as the hints see them ─────────────────────────────── */
function profileOf(person, slots) {
  const cells = {}, subjSlots = new Map(), frees = [];
  for (const k of slots) {
    const [d, per] = k.split("|"), c = person.days[d] && person.days[d].get(+per);
    cells[k] = c ? c.subject : "";
    if (!c) frees.push(k); else { const s = lc(c.subject); (subjSlots.get(s) || subjSlots.set(s, []).get(s)).push(k); }
  }
  const classes = new Map();
  for (const d of CYCLE) for (const c of (person.days[d] || new Map()).values()) if (!classes.has(c.code)) classes.set(c.code, c);
  const subjects = [...new Set([...classes.values()].map(c => c.subject).filter(s => s && !NOT_A_SUBJECT.test(s)))];
  const teach = new Map();
  for (const c of classes.values()) if (c.teacher && !NOT_A_SUBJECT.test(c.subject)) teach.set(lc(c.teacher), (teach.get(lc(c.teacher)) || 0) + 1);
  const doubles = new Set();
  for (const d of CYCLE) { const day = person.days[d]; if (day) for (const [per, c] of day) { const n = day.get(per + 1); if (n && n.code === c.code) doubles.add(d); } }
  return { email: person.email, cells, subj: new Map([...subjSlots].map(([s, l]) => [s, l.join(",")])), frees: frees.join(","),
           subjects, nSubj: subjects.length, teach, teachers: [...classes.values()], doubles,
           sig: slots.map(k => lc(cells[k])).join("|") };
}
/* does someone fit a hint about the answer? */
function fits(c, h, a, slots) {
  if (h.k === "subj") return h.subjects.every(s => (c.subj.get(lc(s)) || "") === (a.subj.get(lc(s)) || ""));
  if (h.k === "slot") return slots.every(k => !k.endsWith("|" + h.p) || lc(c.cells[k]) === lc(a.cells[k]));
  if (h.k === "day") return slots.every(k => !k.startsWith(h.d + "|") || lc(c.cells[k]) === lc(a.cells[k]));
  if (h.k === "teacher") return (c.teach.get(lc(h.t)) || 0) === h.n;
  if (h.k === "double") return c.doubles.has(h.d);
  if (h.k === "frees") return c.frees === a.frees;
  return true;
}
/* the tiles a board hint shows */
function tilesFor(h, a, slots) {
  if (h.k === "subj") return slots.filter(k => h.subjects.some(s => lc(a.cells[k]) === lc(s)));
  if (h.k === "slot") return slots.filter(k => k.endsWith("|" + h.p));
  if (h.k === "day") return slots.filter(k => k.startsWith(h.d + "|"));
  if (h.k === "frees") return slots.filter(k => !a.cells[k]);
  return [];
}

/* The details of the day's hints for one answer, or null. The kinds come in a fixed order; the details
   (which subjects, period, day, teacher) are tried and scored: exactly one person must fit after hint 4
   (the third from last); more than one after hint 1; best if one person first fits at hint 3 or 4 (2 at
   a push); each hint should cut the field down; each board hint must show new tiles. */
function planFor(a, people, slots, freq, junior, r) {
  const n = list => list.length;
  const onBoard = a.subjects.filter(s => a.subj.has(lc(s)));
  if (onBoard.length < 3) return null;
  const common = onBoard.slice().sort((x, y) => (freq.get(lc(y)) || 0) - (freq.get(lc(x)) || 0) || x.localeCompare(y));
  const firstOpts = junior
    ? [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3]].filter(([i, j]) => common[j]).map(([i, j]) => [common[i], common[j]])
    : common.slice(0, 3).map(s => [s]);
  const periods = [...new Set(slots.map(k => +k.split("|")[1]))];
  let best = null;
  for (const sa of firstOpts) {
    const hA = { k: "subj", subjects: sa }, shownA = new Set(tilesFor(hA, a, slots));
    const S1 = people.filter(c => fits(c, hA, a, slots));
    if (n(S1) < 2) continue;
    for (const p of shuffle(periods, r)) {
      const hS = { k: "slot", p }, tS = tilesFor(hS, a, slots);
      if (tS.filter(k => !shownA.has(k)).length < 3) continue;
      const S2 = S1.filter(c => fits(c, hS, a, slots)), shown2 = new Set([...shownA, ...tS]);
      for (const d of shuffle(CYCLE, r)) {
        const hD = { k: "day", d }, tD = tilesFor(hD, a, slots);
        if (tD.filter(k => !shown2.has(k)).length < 3) continue;
        const S3 = S2.filter(c => fits(c, hD, a, slots)), shown3 = new Set([...shown2, ...tD]);
        /* the payoff: a rarer subject, rarest first, with tiles still to show */
        const rare = common.filter(s => !sa.includes(s)).reverse();
        for (const sb of rare.slice(0, 3)) {
          const hB = { k: "subj", subjects: [sb] };
          if (!tilesFor(hB, a, slots).some(k => !shown3.has(k))) continue;
          const S4 = S3.filter(c => fits(c, hB, a, slots));
          if (n(S4) !== 1) continue;
          const counts = [n(people), n(S1), n(S2), n(S3), n(S4)];
          const first = counts.indexOf(1);
          let score = { 4: 3, 3: 3, 2: 1 }[first] || 0;
          for (const i of [2, 3]) if (i <= first && counts[i] === counts[i - 1]) score -= 0.8;     // a hint that ruled nobody out
          const span = Math.log(counts[0]);
          for (const i of [1, 2, 3, 4]) if (i <= first) score -= Math.pow((Math.log(counts[i - 1]) - Math.log(Math.max(1, counts[i]))) / span - 1 / first, 2) * 2;
          score += r() * 0.3;
          if (!best || score > best.score) best = { score, sa, p, d, sb, counts };
        }
      }
    }
  }
  if (!best) return null;
  /* the fifth: a teacher who has them more than once, else a double, else any teacher */
  const many = [...new Map(a.teachers.filter(c => c.teacher && !NOT_A_SUBJECT.test(c.subject)).map(c => [lc(c.teacher), c.teacher])).values()]
    .map(t => ({ t, n: a.teach.get(lc(t)) || 0 }));
  const twice = many.filter(x => x.n >= 2);
  const fifth = twice.length ? Object.assign({ k: "teacher" }, twice[Math.floor(r() * twice.length)])
    : a.doubles.size ? { k: "double", d: shuffle([...a.doubles], r)[0] }
    : many.length ? Object.assign({ k: "teacher" }, many[Math.floor(r() * many.length)]) : null;
  const hints = [{ k: "subj", subjects: best.sa }, { k: "slot", p: best.p }, { k: "day", d: best.d }, { k: "subj", subjects: [best.sb] }]
    .concat(fifth ? [fifth] : [], [{ k: "frees" }]);
  return { hints, counts: best.counts };
}

/* Make a day's puzzle from a year's timetables.
     people  [{ email, days }] (days from readTT); bells from readBells; seed a number; avoid: emails used lately
   Returns the stored puzzle or null (no one could be made certain). */
export function makeWhose({ people: raw, bells, seed, avoid = new Set(), maxTries = 80 }) {
  const r = rng(seed);
  const template = templateOf(raw, bells || {});
  const slots = CYCLE.flatMap(d => template[d].map(x => d + "|" + x.p));
  if (slots.length < 10) return null;
  const people = raw.map(p => profileOf(p, slots));
  const sigs = new Map(); people.forEach(p => sigs.set(p.sig, (sigs.get(p.sig) || 0) + 1));
  const freq = new Map(); people.forEach(p => p.subjects.forEach(s => freq.set(lc(s), (freq.get(lc(s)) || 0) + 1)));
  const loads = people.map(p => p.nSubj).sort((x, y) => x - y), junior = loads[loads.length >> 1] >= 9;
  let tries = 0;
  for (const a of shuffle(people.filter(p => !avoid.has(p.email) && sigs.get(p.sig) === 1 && p.nSubj >= 3), r)) {
    if (tries++ >= maxTries) break;
    const plan = planFor(a, people, slots, freq, junior, r);
    if (!plan) continue;
    /* who still fits after each hint */
    const fit = [people.map((_, i) => i)];
    let alive = fit[0];
    for (const h of plan.hints) { alive = alive.filter(i => fits(people[i], h, a, slots)); fit.push(alive); }
    return { v: VERSION, email: a.email, template, cells: a.cells, hints: plan.hints, counts: plan.counts, fit,
             people: people.map(p => p.email), classes: Object.fromEntries(a.teachers.map(c => [c.code, c.subject])) };
  }
  return null;
}

/* the hints as the browser shows them */
function hintText(h, p) {
  const list = xs => xs.length === 1 ? "<b>" + xs[0] + "</b>" : xs.slice(0, -1).map(x => "<b>" + x + "</b>").join(", ") + " and <b>" + xs[xs.length - 1] + "</b>";
  if (h.k === "subj") return "Here’s every " + list(h.subjects) + " lesson.";
  if (h.k === "slot") return "Here’s <b>Period " + h.p + "</b> on every day.";
  if (h.k === "day") return "Here’s their whole <b>" + dayName(h.d) + "</b>.";
  if (h.k === "teacher") return "<b>" + h.t + "</b> teaches " + (h.n === 1 ? "one" : word(h.n)) + " of their classes.";
  if (h.k === "double") return "They have a double on <b>" + dayName(h.d) + "</b>.";
  return Object.values(p.cells).some(v => !v) ? "Here are all their free periods." : "They have <b>no free periods</b>.";
}

/* What the browser gets, after n hints: names (never emails), the empty board, the n hints with the
   tiles each filled in (and only those tiles' subjects), and how many still fit after 0…n hints.
   With done, everything: the whole board and every hint. */
export function whoseView(p, nameOf, n, done, light) {
  const slots = CYCLE.flatMap(d => (p.template[d] || []).map(x => d + "|" + x.p));
  const k = done ? p.hints.length : Math.max(0, Math.min(n, p.hints.length));
  const hints = p.hints.slice(0, k), tiles = hints.map(h => tilesFor(h, p, slots));
  const cells = {};
  (done ? slots : tiles.flat()).forEach(key => { cells[key] = p.cells[key] || ""; });
  /* peek: the next hint (its words, tiles and how many still fit after it), sent ahead so a
     wrong guess or a skip shows it straight away instead of waiting for the server */
  let peek;
  if (!done && k < p.hints.length) {
    const h = p.hints[k], t = tilesFor(h, p, slots), c = {};
    t.forEach(key => { c[key] = p.cells[key] || ""; });
    peek = { hint: { k: h.k, text: hintText(h, p) }, tiles: t, cells: c, count: (p.fit[k + 1] || []).length };
  }
  const out = { cells, tiles, counts: p.fit.slice(0, k + 1).map(l => l.length), hints: hints.map(h => ({ k: h.k, text: hintText(h, p) })), peek };
  return light ? out : Object.assign({ names: p.people.map(nameOf), template: p.template }, out);
}

/* ── building a year's day (the school API, as the server account) ─────── */
const ttCache = new Map();                           // email → { at, days }, per warm instance, so a retry carries on
async function daysOf(email) {
  const hit = ttCache.get(email);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.days;
  const days = readTT(await fetchAsOwner("/api/timetable/" + encodeURIComponent(email)));
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
  const [bellsRaw] = await Promise.all([
    fetchAsOwner("/api/timetable/bell-times").catch(() => null),
    eachLimited(roster, 12, async p => {
      if (Date.now() > deadline) return;
      try { const days = await daysOf(p.email); if (Object.keys(days).length) got.push({ email: p.email, days }); } catch {}
    })
  ]);
  /* too many unread: try again later (nothing is stored, so the next visit carries on from the cache) */
  if (got.length < roster.length * 0.85 - 2) return { retry: true };
  const prints = new Map();
  got.forEach(p => { const k = printOf(p.days); prints.set(k, (prints.get(k) || 0) + 1); });
  if ([...prints.values()].some(n => n > 5 && n > got.length * 0.25)) return { none: "The timetables couldn't be read properly today." };

  const { data: recent } = await db.from("whose_puzzle").select("puzzle").eq("year", String(year)).lt("date", date)
    .order("date", { ascending: false }).limit(40);
  const avoid = new Set((recent || []).map(r => r.puzzle && r.puzzle.email).filter(Boolean));
  const puzzle = makeWhose({ people: got.sort((a, b) => a.email.localeCompare(b.email)), bells: readBells(bellsRaw),
                             seed: hashStr("whose2|" + date + "|" + year), avoid });
  if (!puzzle) return { none: "No one’s timetable is certain enough in your year today." };
  /* prove the timetable read is theirs: they're on the roster of one of their classes */
  for (const code of Object.keys(puzzle.classes).filter(c => !NOT_A_SUBJECT.test(puzzle.classes[c])).slice(0, 3)) {
    try {
      const raw = await fetchAsOwner("/api/timetable/class/" + encodeURIComponent(code));
      const arr = Array.isArray(raw) ? raw : (raw && (raw.roster || raw.students)) || [];
      if (arr.some(x => String(x.emailAddress || x.Email || x.email || "").toLowerCase() === puzzle.email)) return { puzzle };
    } catch {}
  }
  return { none: "Today’s timetable couldn’t be checked." };
}

/* today's (or a past day's) puzzle for a year, with when it was made; made by the first to ask, or
   by the nightly job. Today's, if it was made by the first version of the game, is made again. */
const building = new Map();
export async function ensureWhose(year, date, deadline = Date.now() + 45000) {
  year = String(year);
  const sel = () => db.from("whose_puzzle").select("puzzle, created_at").eq("date", date).eq("year", year).maybeSingle();
  const { data: row, error } = await sel();
  if (error) throw new Error(/does not exist|relation|schema cache/i.test(error.message) ? "Whose Timetable? isn't set up yet." : "puzzle read: " + error.message);
  const today = date === sydneyDate();
  if (row && (row.puzzle && row.puzzle.v === VERSION || !today)) return row;
  if (!today) return null;                           // a past day that was never made stays unmade
  const key = date + "|" + year;
  if (!building.has(key)) building.set(key, (async () => {
    try {
      const b = await buildYear(year, date, deadline);
      if (b.retry) return { puzzle: { retry: true } };
      const puzzle = Object.assign({ v: VERSION }, b.puzzle || { none: b.none });
      const fresh = { date, year, puzzle, created_at: new Date().toISOString() };
      /* a first-version day is replaced; otherwise the first to finish wins */
      const { error: upErr } = row ? await db.from("whose_puzzle").update({ puzzle, created_at: fresh.created_at }).eq("date", date).eq("year", year)
        : await db.from("whose_puzzle").upsert(fresh, { onConflict: "date,year", ignoreDuplicates: true });
      if (upErr) throw new Error("puzzle write: " + upErr.message);
      const { data: again } = await sel();
      return again || fresh;
    } finally { setTimeout(() => building.delete(key), 1000); }
  })());
  return building.get(key);
}

/* the nightly job's part: every year, while there's time */
export async function prebuildWhose(deadline) {
  const date = sydneyDate(), out = {};
  for (const y of ["12", "11", "10", "9", "8", "7"]) {
    if (Date.now() > deadline - 8000) { out[y] = "later"; continue; }
    try { const r = await ensureWhose(y, date, deadline - 3000), p = r && r.puzzle; out[y] = !p ? "none" : p.retry ? "later" : p.none ? "none" : "ok"; }
    catch (e) { out[y] = "skip"; console.error("whose " + y + ":", e.message); }
  }
  return out;
}

/* the archive: the year's days in the last 30 (this version's, with a puzzle), how many played and
   solved each, and how you went (results saved before a day was remade don't count) */
async function archiveFor(year, today, email) {
  const from = WHOSE_EPOCH > shift(today, -30) ? WHOSE_EPOCH : shift(today, -30);
  const [{ data: days }, { data: all }, { data: mine }] = await Promise.all([
    db.from("whose_puzzle").select("date, created_at, v:puzzle->v, none:puzzle->none").eq("year", String(year)).gte("date", from).lte("date", today),
    db.from("whose_result").select("date, won, done, updated_at").eq("year", String(year)).gte("date", from).lte("date", today).limit(20000),
    db.from("whose_result").select("date, won, done, guesses, updated_at").eq("email", email).gte("date", from).lte("date", today)
  ]);
  const made = new Map((days || []).filter(d => Number(d.v) === VERSION && !d.none).map(d => [d.date, d.created_at]));
  const counts = r => made.has(r.date) && Date.parse(r.updated_at) >= Date.parse(made.get(r.date));
  const by = {};
  for (const d of made.keys()) by[d] = { date: d, played: 0, wins: 0 };
  for (const r of all || []) if (counts(r)) { if (r.done) by[r.date].played++; if (r.won) by[r.date].wins++; }
  const you = {};
  for (const r of mine || []) if (counts(r)) you[r.date] = { won: !!r.won, done: !!r.done, guesses: r.guesses || 0 };
  return { epoch: from, today, days: Object.values(by).sort((x, y) => y.date.localeCompare(x.date)), mine: you };
}

/* ── the route: /api/daily?whose=1 (GET: the day; summary=1: how the year went) and {whose:1, guess | skip} ── */
export async function whoseRoute(req, res, me, body, NAMES) {
  const today = sydneyDate();
  const raw = req.method === "POST" ? body.date : req.query.date;
  const date = !raw ? today : /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today && raw >= WHOSE_EPOCH && raw >= shift(today, -30) ? raw : null;
  if (!date) return res.status(400).json({ error: "That day isn't available to play." });
  let year, row, hadRead;
  try {
    year = await resolveYear(me);
    if (!year) return res.status(400).json({ error: "Couldn't work out which year you're in." });
    if (req.method === "GET" && req.query.archive) return res.status(200).json(await archiveFor(year, today, me.email));
    [row, hadRead] = await Promise.all([ensureWhose(year, date),
      db.from("whose_result").select("guesses, won, done, updated_at").eq("email", me.email).eq("date", date).maybeSingle()]);
  } catch (e) { console.error("whose setup:", e.message); return res.status(502).json({ error: e.message || "Couldn't load the puzzle." }); }
  const p = row && row.puzzle;
  if (!p || p.retry) return res.status(503).json({ error: "Still reading everyone’s timetables. Try again in a minute." });
  if (p.none || p.v !== VERSION) return res.status(200).json({ date, today, year, none: p.none || "This day was made by an earlier version of the game." });

  const roster = new Map((await rosterList().catch(() => [])).map(x => [x.email, x.first + " " + x.last]));
  const nameOf = e => withName(NAMES, e, roster.get(e) || titleCase(String(e).split("@")[0].replace(/[._]+/g, " ").replace(/\d+$/, "")));
  const answer = nameOf(p.email);
  const total = p.hints.length + 1;
  const made = row.created_at || "";
  /* a result saved before the day was made again doesn't count */
  const had = hadRead && hadRead.data;
  const after = t => !made || Date.parse(t) >= Date.parse(made);
  const cur = had && after(had.updated_at) ? had : null;
  let guesses = (cur && cur.guesses) || 0, done = !!(cur && cur.done), won = !!(cur && cur.won);
  const wonDates = async () => ((await db.from("whose_result").select("date").eq("email", me.email).eq("won", true)
    .order("date", { ascending: false }).limit(120)).data || []).map(r => r.date);
  const streak = async () => computeStreak(await wonDates(), today);

  if (req.method === "GET" && req.query.summary) {
    const { data } = await db.from("whose_result").select("email, guesses, won, done, updated_at").eq("year", String(year)).eq("date", date).limit(5000);
    /* who is in each bar, for hovering over it (by the names people go by; capped so it stays small) */
    const dist = {}, names = { lost: [] }; for (let i = 1; i <= total; i++) { dist[i] = 0; names[i] = []; }
    const add = (k, e) => { if (names[k].length < 40) names[k].push(nameOf(e)); };
    let played = 0, wins = 0;
    for (const r of data || []) {
      if (!after(r.updated_at)) continue;
      if (r.done) played++;
      if (r.won) { wins++; if (r.guesses >= 1 && r.guesses <= total) { dist[r.guesses]++; add(r.guesses, r.email); } }
      else if (r.done) add("lost", r.email);
    }
    return res.status(200).json({ date, summary: { played, wins, losses: played - wins, total, dist, names } });
  }
  /* the day as you have it: the hints so far, and the answer only once you're done */
  const view = async (light, streakNow) => Object.assign({ date, today, year, total, guesses, done, won,
    streak: streakNow != null ? streakNow : await streak(), answer: done ? answer : undefined }, whoseView(p, nameOf, guesses, done, light));
  if (req.method === "GET") return res.status(200).json(await view());
  if (req.method === "POST") {
    if (done) return res.status(200).json(Object.assign(await view(), { correct: won }));
    const guess = String(body.guess || "");
    if (!guess && !body.skip) return res.status(400).json({ error: "A guess is required." });
    const before = guesses;
    guesses += 1;
    won = !body.skip && norm(guess) === norm(answer);
    done = won || guesses >= total;
    /* saved only on top of the result just read, so guesses sent all at once can't each count as the same one */
    const row = { email: me.email, date, year: String(year), guesses, won, done, updated_at: new Date().toISOString() };
    /* the streak is read at the same time (today counted in if this guess won it) */
    const [{ data: saved, error }, dates] = await Promise.all([
      cur ? db.from("whose_result").update(row).eq("email", me.email).eq("date", date).eq("guesses", before).select("guesses")
      : had ? db.from("whose_result").update(row).eq("email", me.email).eq("date", date).eq("updated_at", had.updated_at).select("guesses")
      : db.from("whose_result").insert(row).select("guesses"),
      wonDates()]);
    if (error && /duplicate|unique|23505/i.test(error.message + " " + error.code)) return res.status(409).json({ error: "Too quick: try that again." });
    if (error) { console.error("whose result:", error.message); return res.status(502).json({ error: "Couldn't save your guess." }); }
    if (!saved || !saved.length) return res.status(409).json({ error: "Too quick: try that again." });
    const st = computeStreak(won && !dates.includes(date) ? [date].concat(dates) : dates, today);
    return res.status(200).json(Object.assign(await view(true, st), { correct: won }));
  }
  return res.status(405).json({ error: "Method not allowed" });
}

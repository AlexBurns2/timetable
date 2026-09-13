/*
 * Daily Guess Who engine (Phase 2). Private helper (underscore = not a route).
 *
 * One mystery person per (date, year), chosen ON THE SERVER so everyone in a
 * year sees the same person that day — Wordle-style. The answer never leaves
 * the server: guesses are graded here. The pick is DETERMINISTIC from the date
 * and year, so a lazy first-request and the midnight cron both produce the same
 * person, and an `ignoreDuplicates` upsert means whoever writes first wins.
 *
 * Scope is the player's own year only — the same footing as the practice game's
 * "My grade" mode. A whole-school daily would name strangers.
 *
 * Tables:
 *   daily_puzzle(date, year, target jsonb, candidates jsonb, created_at, pk(date,year))
 *   daily_result(email, date, year, guesses, won, done, updated_at, pk(email,date))
 */

import { fetchAsOwner } from "./timetable.js";

/* current date in Sydney as YYYY-MM-DD (the puzzle rolls over at local midnight) */
export function sydneyDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);
}

/* stable 32-bit hash (FNV-1a) — the deterministic seed for the daily pick */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;

/* mirror the client's name/year extraction so pools line up */
function personName(r) {
  const full  = r.FullName || r.fullName || r.Name || r.name || "";
  const first = r.FirstName || r.firstName || r.firstname || r.GivenName || r.preferredName || "";
  const last  = r.LastName || r.lastName || r.lastname || r.Surname || r.surname || "";
  const mail  = r.Email || r.email || r.emailAddress || "";
  const nm = full || [first, last].filter(Boolean).join(" ");
  if (nm) return String(nm).trim();
  if (mail) { const p = String(mail).split("@")[0].split("."); if (p.length >= 2) return cap(p[0]) + " " + cap(p[1].replace(/\d+$/, "")); }
  return "";
}
/* year lives in the `groups` array as "yr11" on the real directory, not in a
   Year/Form field — check the named fields first, then fall back to groups */
function yearOf(r) {
  const direct = String(
    r.year || r.Year || r.grade || r.Grade || r.yearGroup || r.YearGroup ||
    r.form || r.Form || r.rollClass || r.RollClass || r.RollGroup || r.rollGroup ||
    r.cohort || r.Cohort || r.stage || r.Stage || ""
  ).replace(/\D/g, "");
  if (direct) return direct;
  const groups = r.groups || r.Groups || [];
  for (const g of (Array.isArray(groups) ? groups : [])) {
    const m = String(g).match(/(?:yr|year)\.?\s*(\d{1,2})/i);
    if (m) return m[1];
  }
  return "";
}
function toPerson(r) {
  const name = personName(r);
  const email = String(r.emailAddress || r.Email || r.email || "").toLowerCase();
  return name ? { name, email, year: yearOf(r) } : null;
}

/* normalise the raw /api/group/* payload (bare array, or wrapped) to people */
export function parseDirectory(raw) {
  const arr = Array.isArray(raw) ? raw : (raw && (raw.people || raw.students || raw.roster)) || [];
  return arr.map(toPerson).filter(Boolean);
}

/* deterministic partial reveal: first letter always, others by a stable hash */
function mask(word, frac) {
  return [...word].map((ch, i) =>
    (i === 0 || (hashStr(word + ":" + i) % 100) < Math.round(frac * 100)) ? ch : "_"
  ).join(" ");
}

/* small seeded PRNG so a day's hint order is the same for everyone in the year
   and stable across reloads, but different from day to day */
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffleWith(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const VOWELS = "AEIOU";
const countVowels = w => [...w.toUpperCase()].filter(c => VOWELS.includes(c)).length;
const hasDouble = w => /(.)\1/i.test(w);

/* Puzzles up to this date keep the ORIGINAL hint set, exactly as they were
   played. The varied hints below only apply from the day after. */
export const LEGACY_UNTIL = "2026-09-12";

/* The hint set as it shipped originally — do not change it. Past days were
   played against these, so they have to keep reading the same way. */
export function legacyHints(first, last) {
  const H = [];
  H.push("Their first name has <b>" + first.length + "</b> letters.");
  H.push("Their first name starts with <b>" + first[0].toUpperCase() + "</b>.");
  if (last) H.push("Their surname has <b>" + last.length + "</b> letters.");
  if (last) H.push("Their surname starts with <b>" + last[0].toUpperCase() + "</b>.");
  H.push("Their first name looks like <b>" + mask(first, 0.5) + "</b>.");
  if (last) H.push("Their surname looks like <b>" + mask(last, 0.4) + "</b>.");
  H.push("Their name reads <b>" + mask(first, 0.7) + (last ? " " + mask(last, 0.65) : "") + "</b>.");
  return H;
}

/* Hints in tiers by how much they give away — vague first, near-answer last.
   Each tier is shuffled with the day's seed, so the ORDER varies day to day
   while the puzzle stays identical for everyone in the year.

   Two safety rules, learned the hard way:
   - `extra.date` on or before LEGACY_UNTIL ⇒ the original hints, untouched.
   - subject / teacher hints are used ONLY when the generator could PROVE the
     timetable it read belongs to the target (`extra.verified`). An unverified
     read could be somebody else's timetable, which would describe the wrong
     person entirely — better to fall back to name shapes than to lie. */
export function buildHints(first, last, extra) {
  extra = extra || {};
  if (extra.date && String(extra.date) <= LEGACY_UNTIL) return legacyHints(first, last);
  const rnd = rngFrom(hashStr(String(extra.seed || first + "|" + last)));
  const ok = extra.verified === true;
  const subjects = ok && Array.isArray(extra.subjects) ? extra.subjects.filter(Boolean) : [];
  const teachers = ok && Array.isArray(extra.teachers) ? extra.teachers.filter(Boolean) : [];
  const subj = shuffleWith(subjects, rnd), tchs = shuffleWith(teachers, rnd);
  const full = (first + last).replace(/\s/g, "");

  /* T0 vague → T3 nearly the answer */
  const T = [[], [], [], []];

  /* --- what they study (viewer-independent, so the daily stays shared) --- */
  if (subj.length) {
    T[0].push("They take <b>" + subj[0] + "</b>.");
    if (subj[1]) T[1].push("They also take <b>" + subj[1] + "</b>.");
    if (subj.length > 2) T[0].push("They study <b>" + subjects.length + "</b> subjects this timetable.");
  }
  if (tchs.length) T[1].push("One of their teachers is <b>" + tchs[0] + "</b>.");
  if (tchs[1]) T[2].push("They also have a class with <b>" + tchs[1] + "</b>.");

  /* --- vague name shape --- */
  T[0].push("Their first name has <b>" + first.length + "</b> letters.");
  T[0].push("Their first name has <b>" + countVowels(first) + "</b> vowel" + (countVowels(first) === 1 ? "" : "s") + ".");
  T[0].push("Their first name starts with a <b>" + (VOWELS.includes(first[0].toUpperCase()) ? "vowel" : "consonant") + "</b>.");
  T[0].push("Their whole name has <b>" + full.length + "</b> letters.");
  /* check each name separately — first+last would invent a double at the join */
  T[0].push("Their name " + (hasDouble(first) || (last && hasDouble(last)) ? "has a" : "has no") + " <b>double letter</b> in it.");
  if (last) {
    T[0].push("Their surname has <b>" + last.length + "</b> letters.");
    T[0].push("Their surname starts with a letter in the <b>"
      + (last[0].toUpperCase() <= "M" ? "first" : "second") + " half</b> of the alphabet.");
  }

  /* --- medium --- */
  T[1].push("Their first name ends with <b>" + first[first.length - 1].toUpperCase() + "</b>.");
  if (last) T[1].push("Their surname ends with <b>" + last[last.length - 1].toUpperCase() + "</b>.");

  /* --- strong --- */
  T[2].push("Their first name starts with <b>" + first[0].toUpperCase() + "</b>.");
  if (last) T[2].push("Their surname starts with <b>" + last[0].toUpperCase() + "</b>.");
  if (last) T[2].push("Their initials are <b>" + first[0].toUpperCase() + "." + last[0].toUpperCase() + ".</b>");

  /* --- nearly the answer --- */
  T[3].push("Their first name looks like <b>" + mask(first, 0.5) + "</b>.");
  if (last) T[3].push("Their surname looks like <b>" + mask(last, 0.45) + "</b>.");

  /* Shuffle inside each tier, keep the tiers in order, and trim so a round is
     ~9 hints rather than a long crawl. The full-name reveal is kept out of the
     shuffle entirely so the biggest giveaway is always the very last hint. */
  return [].concat(
    shuffleWith(T[0], rnd).slice(0, 3),
    shuffleWith(T[1], rnd).slice(0, 2),
    shuffleWith(T[2], rnd).slice(0, 2),
    shuffleWith(T[3], rnd).slice(0, 1),
    ["Their name reads <b>" + mask(first, 0.7) + (last ? " " + mask(last, 0.65) : "") + "</b>."]
  );
}

/* mirror the client's subject / teacher tidying so hints read naturally */
const cleanSubject = name => String(name || "")
  .replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i, "")
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/, "")
  .replace(/^[\s:\-–—]+/, "").trim();
const tidyTeacher = t => {
  t = String(t || "").trim();
  if (!t) return "";
  if (t.includes("@")) t = t.split("@")[0];
  if (/[.,]/.test(t)) return t.split(/[.,]\s*/).filter(Boolean).map(cap).join(" ").replace(/\s+\d+/g, "").trim();
  return t;
};

/* Subjects + teachers for one person, read as the server's own account so the
   hints are the same for everyone in the year. Best-effort: any failure just
   leaves the puzzle with name-shape hints only. */
async function studiesOf(email) {
  if (!email) return {};
  const want = String(email).toLowerCase();
  try {
    const raw = await fetchAsOwner("/api/timetable/" + encodeURIComponent(email));
    const rows = Array.isArray(raw) ? raw : (raw && (raw.timetable || raw.Timetable)) || [];
    if (!rows.length) return {};
    const subjects = new Set(), teachers = new Set(), codes = [];
    for (const r of rows) {
      const course = String(r.CourseName || r.courseName || r.Course || "");
      const per = String(r.Period || r.period || "");
      if (!course || /assembly|recess|lunch|roll ?call|break|wellbeing/i.test(course + " " + per)) continue;
      const s = cleanSubject(course);
      if (s) subjects.add(s);
      const t = tidyTeacher(r.TeacherName || r.TeacherFullName || r.Teacher || r.StaffName || "");
      if (t) teachers.add(t);
      const code = r.ClassCode || r.classCode;
      if (code && !codes.includes(code)) codes.push(code);
    }
    if (!subjects.size || !codes.length) return {};

    /* PROVE it is their timetable. Asking the school API for someone else's
       timetable as the server account could plausibly hand back the server
       account's own — which would describe the wrong person. So take a class
       off the timetable we just read and check the target is actually on its
       roster. No proof ⇒ no subject hints. */
    let verified = false;
    for (const code of codes.slice(0, 3)) {
      try {
        const roster = await fetchAsOwner("/api/timetable/class/" + encodeURIComponent(code));
        const arr = Array.isArray(roster) ? roster : (roster && (roster.roster || roster.students)) || [];
        if (arr.some(p => String(p.emailAddress || p.Email || p.email || "").toLowerCase() === want)) {
          verified = true; break;
        }
      } catch { /* try the next class */ }
    }
    if (!verified) return {};
    return { subjects: [...subjects].slice(0, 12), teachers: [...teachers].slice(0, 12), verified: true };
  } catch { return {}; }
}

/* the deduped, deterministically ordered roster for one year */
async function loadYear(year) {
  const seen = new Set(); const list = [];
  parseDirectory(await fetchAsOwner("/api/group/student"))
     .filter(p => p.year === String(year) && p.name.includes(" "))   // need a surname for hints
     .sort((a, b) => (a.email || a.name).localeCompare(b.email || b.name))  // stable order across runs
     .forEach(p => { const k = p.email || p.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); list.push(p); } });
  return list;
}

/* find the caller's year — from the JWT first, else from the directory */
export async function resolveYear(me) {
  if (me.year) return String(me.year);
  const mine = parseDirectory(await fetchAsOwner("/api/group/student")).find(p => p.email && p.email === me.email);
  return mine && mine.year ? String(mine.year) : null;
}

/* return today's puzzle for a year, generating it if it doesn't exist yet */
export async function ensurePuzzle(db, year, date) {
  year = String(year);
  const sel = () => db.from("daily_puzzle")
    .select("date, year, target, candidates").eq("date", date).eq("year", year).maybeSingle();

  let { data: row, error } = await sel();
  if (error) throw new Error("puzzle read: " + error.message);
  if (row) return row;

  const roster = await loadYear(year);
  if (roster.length < 5) throw new Error("Not enough students in year " + year + " to build a puzzle.");

  const t = roster[hashStr(date + ":" + year) % roster.length];
  const parts = t.name.split(/\s+/);
  const first = parts[0], last = parts.slice(1).join(" ");
  const studies = await studiesOf(t.email);          // best-effort subject / teacher hints
  const target = { name: t.name, first, last,
    subjects: studies.subjects || [], teachers: studies.teachers || [],
    verified: studies.verified === true,     // only then are subject hints trusted
    hints: buildHints(first, last, { seed: date + ":" + year, date, ...studies }) };
  const candidates = roster.map(p => p.name);

  const { error: upErr } = await db.from("daily_puzzle")
    .upsert({ date, year, target, candidates }, { onConflict: "date,year", ignoreDuplicates: true });
  if (upErr) throw new Error("puzzle write: " + upErr.message);

  ({ data: row } = await sel());                 // re-read: race-safe if two writers collided
  return row || { date, year, target, candidates };
}

/* consecutive won days ending today (or yesterday, if today isn't won yet) */
export function computeStreak(wonDates, today) {
  const set = new Set(wonDates);
  const d = new Date(today + "T00:00:00Z");
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let streak = 0;
  while (set.has(d.toISOString().slice(0, 10))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
  return streak;
}

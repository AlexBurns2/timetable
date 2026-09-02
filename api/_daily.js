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

/* ordered easy→hard, all name-shape (year is the same for everyone in the pool) */
function buildHints(first, last) {
  const H = [];
  // first-name and surname length are separate hints — together they give too much away
  H.push("Their first name has <b>" + first.length + "</b> letters.");
  H.push("Their first name starts with <b>" + first[0].toUpperCase() + "</b>.");
  if (last) H.push("Their surname has <b>" + last.length + "</b> letters.");
  if (last) H.push("Their surname starts with <b>" + last[0].toUpperCase() + "</b>.");
  H.push("Their first name looks like <b>" + mask(first, 0.5) + "</b>.");
  if (last) H.push("Their surname looks like <b>" + mask(last, 0.4) + "</b>.");
  H.push("Their name reads <b>" + mask(first, 0.7) + (last ? " " + mask(last, 0.65) : "") + "</b>.");
  return H;
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
  const target = { name: t.name, first, last, hints: buildHints(first, last) };
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

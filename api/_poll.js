/*
 * The weekly anonymous poll on Home (served through /api/forum, so it costs no
 * extra Vercel function; the underscore keeps this file from being a route).
 *
 * The week (Sydney time):
 *   Monday 09:30     a new question opens (set by a moderator ahead of time;
 *                    not before school, so it doesn't pop up mid-something);
 *                    once you've voted you see the live results
 *   Friday 12:00     voting closes and the winner is announced (the big show);
 *                    the final results are there for everyone until Sunday
 *   next Monday      it moves to "past polls"
 *
 * Anonymity is in the data model, not just the page:
 *   poll_voter  says WHO has voted in a week, and nothing about the answer;
 *   poll_tally  says HOW MANY votes each answer has, with no names and no
 *               times: it is a running count, bumped by poll_bump().
 * Nothing stored links a voter to an answer, and the server never logs one.
 * Results show from the first vote (MIN_SHOW is 1, the owner's choice): with
 * very few votes, someone who knows who voted could work out a pick.
 *
 * Four kinds of question, and what an answer can be (always checked on the
 * server against a list, never free text):
 *   period   Period 0 to Period 7
 *   student  a student in the voter's own year (results are per year)
 *   teacher  any teacher in the school directory
 *   class    one of the voter's own subjects, from their timetable
 *   custom   one of the moderator's own answers (2 to 8 of them)
 * `pick` lets people choose up to 3 (e.g. "pick your top three teachers"). Each
 * pick counts once, and the hidden "__n" count says how many people voted, so
 * a result reads as the share of voters who picked it.
 *
 * Tables (Supabase → SQL editor). RLS on with no policies: only the
 * service-role key (this server) can read or write them.
 *
 *   -- Safe to run more than once: it only creates what's missing and adds missing
 *   -- columns. Nothing is dropped or rewritten (except the old one-answer version
 *   -- of the poll_bump function, which is replaced).
 *   create table if not exists poll (
 *     week       date primary key,          -- the Monday it opens
 *     question   text not null,
 *     kind       text not null,
 *     created_by text not null,
 *     created_at timestamptz not null default now()
 *   );
 *   alter table poll add column if not exists choices   jsonb;                                -- the answers, for a custom question
 *   alter table poll add column if not exists pick      int not null default 1;               -- how many people pick (1 to 3)
 *   alter table poll add column if not exists pickexact boolean not null default false;       -- exactly `pick`, not up to it
 *   alter table poll add column if not exists anim      text not null default 'surprise';     -- Monday: how the question takes over the card
 *   alter table poll add column if not exists celebrate text not null default 'surprise';     -- Friday: the winner's celebration
 *   alter table poll add column if not exists reveal    text;                                 -- Friday's line, e.g. "The person most likely to … is…"
 *   alter table poll drop constraint if exists poll_kind_check;
 *   alter table poll add constraint poll_kind_check check (kind in ('period','student','teacher','class','custom'));
 *   alter table poll drop constraint if exists poll_pick_check;
 *   alter table poll add constraint poll_pick_check check (pick between 1 and 3);
 *
 *   create table if not exists poll_voter (
 *     week  date not null,
 *     email text not null,
 *     primary key (week, email)
 *   );
 *   create table if not exists poll_tally (
 *     week   date not null,
 *     scope  text not null,                 -- 'all', or the year ('11') for student polls
 *     choice text not null,
 *     votes  int  not null default 0,
 *     primary key (week, scope, choice)
 *   );
 *   create table if not exists poll_suggestion (
 *     id         text primary key,
 *     email      text not null,
 *     question   text not null,
 *     kind       text,
 *     created_at timestamptz not null default now()
 *   );
 *   alter table poll enable row level security;
 *   alter table poll_voter enable row level security;
 *   alter table poll_tally enable row level security;
 *   alter table poll_suggestion enable row level security;
 *
 *   -- one vote: every pick, and the voter count, in a single statement
 *   drop function if exists poll_bump(date, text, text);
 *   create or replace function poll_bump(p_week date, p_scope text, p_choices text[])
 *   returns void language sql security definer set search_path = public as $$
 *     insert into poll_tally (week, scope, choice, votes)
 *     select p_week, p_scope, c, 1 from unnest(p_choices) as c
 *     on conflict (week, scope, choice) do update set votes = poll_tally.votes + 1;
 *   $$;
 *   revoke execute on function poll_bump(date, text, text[]) from public, anon, authenticated;
 *   grant execute on function poll_bump(date, text, text[]) to service_role;
 *
 *   -- Separate questions for juniors, seniors and Year 12 (run once, after the code that knows about
 *   -- them is live: the old code saves one question a week). Adds a column (every existing question
 *   -- becomes "for everyone") and makes a week's key the week and who it's for. Nothing is deleted.
 *   alter table poll add column if not exists audience text not null default 'all';
 *   alter table poll drop constraint if exists poll_audience_check;
 *   alter table poll add constraint poll_audience_check check (audience in ('all','junior','senior','y12'));
 *   alter table poll drop constraint if exists poll_pkey;
 *   alter table poll add primary key (week, audience);
 *
 *   -- Optional: a second lock in the database itself (the server already refuses all of
 *   -- this). A question anyone has voted on can't be changed or deleted, and a count can
 *   -- only go up. Adds rules only; no data is changed. Safe to run more than once.
 *   create or replace function poll_locked() returns trigger language plpgsql as $$
 *   begin
 *     if exists (select 1 from poll_voter where week = old.week) then
 *       raise exception 'poll % has votes, so it is locked', old.week;
 *     end if;
 *     return case when tg_op = 'DELETE' then old else new end;
 *   end $$;
 *   drop trigger if exists poll_locked on poll;
 *   create trigger poll_locked before update or delete on poll for each row execute function poll_locked();
 *   create or replace function poll_tally_up() returns trigger language plpgsql as $$
 *   begin
 *     if tg_op = 'DELETE' or new.votes < old.votes or new.week <> old.week or new.scope <> old.scope or new.choice <> old.choice then
 *       raise exception 'poll counts only go up';
 *     end if;
 *     return new;
 *   end $$;
 *   drop trigger if exists poll_tally_up on poll_tally;
 *   create trigger poll_tally_up before update or delete on poll_tally for each row execute function poll_tally_up();
 */

import { db, isAdmin } from "./_supabase.js";
import { withName, rosterList } from "./_names.js";
import { fetchAsOwner, studentDirectory } from "./timetable.js";
import { limited, slowDown } from "./_limit.js";

export const KINDS = ["period", "student", "teacher", "class", "custom"];
const VOTERS = "__n";                   // the tally row that counts people, not answers
/* the week's show (poll.js plays it): how the question arrives on Monday and
   how the winner is revealed on Friday. "surprise" picks one from the week. */
export const ANIMS = ["surprise", "drop", "wreck", "topple", "explode", "flip", "slot"];
export const CELEBS = ["surprise", "spotlight", "countdown", "curtain", "envelope", "slot"];
const MIN_SHOW = 1;                 // results show from the first vote (was 5; the owner chose to always show them)
const OPENS_AT = 9 * 3600 + 30 * 60;           // Monday 09:30, in seconds after Monday 00:00: the question opens
const RESULTS_AT = 4 * 86400 + 12 * 3600;      // Friday 12:00: voting closes, the winner is out
const WEEK_ENDS = 7 * 86400 + OPENS_AT;        // next Monday 09:30
const MAX_Q = 120;
/* Suggestions (poll questions, ideas for the site) have no weekly cap since 26 November 2026 (the owner); there was 3 a
   week each. Only a flood brake is left: SUGGEST_PER_MIN a minute each, counted in memory, so it costs no database read. */
const SUGGEST_PER_MIN = 10;
const MAX_IDEA = 300;

/* ── the week, in Sydney ─────────────────────────────────────────────── */
function sydney(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(p.weekday).slice(0, 3));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, sec: +p.second || 0, dow };
}
const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const addDays = (s, n) => { const t = new Date(s + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const isMonday = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T00:00:00Z").getUTCDay() === 1;

/* NSW public school terms (Eastern division) from now: the students' first and last days, and the Monday the
   school calls Week 1 where that comes first (the same dates as the timetable's TERMS in index.html, from the
   Department's published calendar). The moderator's planner offers every school week from this week to the end
   of PLAN_END's term: Year 12's last term before the HSC, since they sit the exams in Term 4 and aren't at
   school. To plan further, add the next terms here and move PLAN_END. */
const TERMS = [
  { term: 4, first: "2026-10-13", last: "2026-12-17" },
  { term: 1, first: "2027-02-03", last: "2027-04-09", week1: "2027-01-25" },
  { term: 2, first: "2027-04-29", last: "2027-07-02" },
  { term: 3, first: "2027-07-20", last: "2027-09-24" },
  { term: 4, first: "2027-10-11", last: "2027-12-17" }
];
export const PLAN_END = "2027-09-24";
const mondayOf = s => addDays(s, -((new Date(s + "T00:00:00Z").getUTCDay() + 6) % 7));
/* every week with a school day in it, from `from` (a Monday) to PLAN_END: [{ week, term, n, year }] */
export function schoolWeeks(from) {
  const out = [];
  for (const t of TERMS) {
    const w1 = mondayOf(t.week1 || t.first), end = t.last < PLAN_END ? t.last : PLAN_END;
    for (let m = mondayOf(t.first); m <= end; m = addDays(m, 7))
      if (m >= from) out.push({ week: m, term: t.term, n: Math.round((Date.parse(m) - Date.parse(w1)) / (7 * 864e5)) + 1, year: +t.first.slice(0, 4) });
  }
  return out;
}
/* the school holidays a week (its Monday) falls in, named after the term just ended, with the day
   school is back; null for a week with a school day in it, or one past the table */
const BREAK_NAMES = { 1: "Autumn holidays", 2: "Winter holidays", 3: "Spring holidays", 4: "Summer holidays" };
export function breakOf(week) {
  const fri = addDays(week, 4);
  for (let i = 0; i < TERMS.length; i++) {
    const t = TERMS[i], n = TERMS[i + 1];
    if (t.first <= fri && week <= t.last) return null;
    if (n && week > t.last && fri < n.first) return { name: BREAK_NAMES[t.term], after: t, back: n.first, summer: t.term === 4 };
  }
  return null;
}

/* this week's Monday, where we are in the week, and when each change happens.
   resultsAt / nextAt are exact instants (epoch ms) and `now` is the server's
   clock, so every open page can play the same moment together. */
/* seconds of Sydney wall-clock time between `monday` 00:00 and instant `t` */
function wallSince(monday, t) {
  const s = sydney(new Date(t));
  const days = Math.round((Date.UTC(s.y, s.m - 1, s.d) - Date.parse(monday + "T00:00:00Z")) / 86400e3);
  return days * 86400 + s.h * 3600 + s.min * 60 + s.sec;
}
export function pollClock(d = new Date()) {
  const s = sydney(d);
  const back = (s.dow + 6) % 7;                              // days since Monday
  let week = addDays(iso(s.y, s.m, s.d), -back);
  let atSec = back * 86400 + s.h * 3600 + s.min * 60 + s.sec;
  /* before 9:30 on Monday it is still last week's poll */
  if (atSec < OPENS_AT) { week = addDays(week, -7); atSec += 7 * 86400; }
  const nowMs = d.getTime(), base = nowMs - (nowMs % 1000);
  /* the instant a wall-clock moment happens (one correction step covers a daylight-saving change in between) */
  const instant = target => { let t = base + (target - atSec) * 1000; t += (target - wallSince(week, t)) * 1000; return t; };
  const resultsAt = instant(RESULTS_AT), nextAt = instant(WEEK_ENDS);
  return {
    week,
    phase: atSec >= RESULTS_AT ? "results" : "open",        // "results": voting closed, final
    resultsIn: Math.max(0, Math.round((resultsAt - nowMs) / 1000)),   // seconds until the winner is announced
    nextIn: Math.max(0, Math.round((nextAt - nowMs) / 1000)),         // seconds until next week's question
    now: nowMs,
    openedAt: instant(OPENS_AT),                             // this week's 9:30 Monday
    resultsAt, nextAt
  };
}

/* ── the answers a voter may give ────────────────────────────────────── */
const PERIODS = ["0", "1", "2", "3", "4", "5", "6", "7"].map(n => ({ id: "P" + n, label: "Period " + n }));
const NOT_A_SUBJECT = /\b(sport|study|wellbeing|mentor|roll ?call|homeroom|pastoral|assembly|tutorial|recess|lunch|break)\b/i;
const cleanSubject = name => String(name || "")
  .replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i, "")
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/, "")
  .replace(/^[\s:\-–—]+/, "").trim();
const userOf = e => String(e || "").toLowerCase().split("@")[0];
const titleCase = s => String(s).split(/\s+/).filter(Boolean)
  .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");

/* the teachers, from the school directory, kept six hours per warm instance */
let teacherCache = { at: 0, list: null };
async function teachers() {
  if (teacherCache.list && Date.now() - teacherCache.at < 6 * 3600e3) return teacherCache.list;
  const raw = await fetchAsOwner("/api/group/teacher");
  const arr = Array.isArray(raw) ? raw : ((raw && (raw.people || raw.users || raw.data)) || []);
  const seen = new Set(), list = [];
  for (const r of arr) {
    const email = String(r.emailAddress || r.email || r.Email || "").toLowerCase();
    const first = String(r.firstname || r.firstName || r.FirstName || "").trim();
    const last = String(r.lastname || r.lastName || r.LastName || "").trim();
    const title = String(r.title || r.Title || r.salutation || "").trim();
    const full = String(r.FullName || r.fullName || r.name || r.Name || "").trim();
    let name = title && last ? title + " " + last : [first, last].filter(Boolean).join(" ") || full;
    if (!name && email) name = titleCase(userOf(email).replace(/[._]+/g, " ").replace(/\d+$/, ""));
    const id = userOf(email);
    if (!name || !id || seen.has(id)) continue;
    seen.add(id); list.push({ id, label: name, sort: (last || name).toLowerCase() });
  }
  list.sort((a, b) => a.sort.localeCompare(b.sort) || a.label.localeCompare(b.label));
  teacherCache = { at: Date.now(), list: list.map(({ id, label }) => ({ id, label })) };
  return teacherCache.list;
}

/* a student's own subjects, from their timetable, kept six hours */
const classCache = new Map();
async function classesOf(email) {
  const hit = classCache.get(email);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.list;
  const raw = await fetchAsOwner("/api/timetable/" + encodeURIComponent(email));
  const rows = Array.isArray(raw) ? raw : (raw && (raw.timetable || raw.Timetable)) || [];
  const set = new Set();
  for (const r of rows) {
    const s = cleanSubject(r.CourseName || r.courseName || r.Course || "");
    if (s && !NOT_A_SUBJECT.test(s) && /[A-Za-z]{3,}/.test(s)) set.add(s);
  }
  const list = [...set].sort().map(s => ({ id: s, label: s }));
  classCache.set(email, { at: Date.now(), list });
  return list;
}

/* A class question offers every subject taken in the voter's year. No list of
   those exists, so when a moderator saves a class question their page asks for
   it a slice of the year at a time (pollsubjects), and the subjects are kept on
   the question itself, in choices: { years: { "9": [...] }, done: ["9"] }. They
   stay fixed for that week. Until a year is collected, its students pick from
   their own subjects. */
const SUBJECT_SLICE = 24;
const yearSubjects = (poll, year) => {
  const y = poll && poll.choices && !Array.isArray(poll.choices) && poll.choices.years;
  return y && Array.isArray(y[String(year)]) ? y[String(year)] : [];
};
async function eachLimited(list, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) await fn(list[i++]); }));
}

/* students in one year, by the name people know them by */
async function yearMates(year, NAMES) {
  const all = await rosterList();
  return all.filter(p => String(p.year) === String(year) && p.hasClasses !== false)
    .map(p => ({ id: userOf(p.email), label: withName(NAMES, p.email, [p.first, p.last].filter(Boolean).join(" ") || userOf(p.email)),
                 email: p.email }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/* a custom question's answers, as options (ids by position: they can't change once voted on) */
const customOptions = poll => (Array.isArray(poll.choices) ? poll.choices : [])
  .map((c, i) => ({ id: "C" + i, label: String(c) })).filter(o => o.label);
/* what this person may answer to this question (empty: they can't vote on it) */
async function optionsFor(poll, me, NAMES) {
  const kind = poll.kind;
  if (kind === "custom") return customOptions(poll);
  if (kind === "period") return PERIODS;
  if (kind === "teacher") return (await teachers()).filter(t => t.id !== userOf(me.email));
  if (kind === "student") {
    if (!me.year) return [];
    return (await yearMates(me.year, NAMES)).filter(p => p.email !== me.email).map(({ id, label }) => ({ id, label }));
  }
  if (kind === "class") {
    if (!me.year) return [];
    const all = new Set(yearSubjects(poll, me.year));
    for (const o of await classesOf(me.email).catch(() => [])) all.add(o.id);   // always your own, too
    return [...all].sort((a, b) => a.localeCompare(b)).map(s => ({ id: s, label: s }));
  }
  return [];
}
/* ── who a question is for ─────────────────────────────────────────────
   A week can have one question for everyone, or separate ones: juniors (Years 7 to 10), seniors (11
   and 12) and Year 12 alone (the sentimental ones, the more grown-up ones kept from juniors). Each
   student gets the most particular one there is for them: Year 12 their own, else the seniors', else
   everyone's; Year 11 the seniors', else everyone's; 7 to 10 the juniors', else everyone's. Anyone
   without a year gets everyone's. It needs the audience column (SQL above); until it's there every
   question is for everyone, as before. A vote still counts once a week (poll_voter), whichever one. */
export const AUDIENCES = ["all", "junior", "senior", "y12"];
const prefsFor = me => { const y = Number(me && me.year);
  return y === 12 ? ["y12", "senior", "all"] : y === 11 ? ["senior", "all"] : y >= 7 && y <= 10 ? ["junior", "all"] : ["all"]; };
const audOf = p => (p && p.audience) || "all";
/* this person's question out of a week's */
export function pickFor(rows, me) {
  for (const a of prefsFor(me)) { const r = (rows || []).find(x => audOf(x) === a); if (r) return r; }
  return null;
}
let audCol = { at: 0, ok: null };
export async function hasAudience() {
  if (audCol.ok !== null && Date.now() - audCol.at < 10 * 60e3) return audCol.ok;
  const { error } = await db.from("poll").select("audience").limit(1);
  audCol = { at: Date.now(), ok: !error };
  return audCol.ok;
}
const cols = async list => (await hasAudience()) ? list + ", audience" : list;
/* the newest week's question for this person, out of rows newest first (several to a week) */
const byWeek = rows => { const m = new Map(); for (const r of rows || []) (m.get(r.week) || m.set(r.week, []).get(r.week)).push(r); return m; };

/* student and class questions are per year: your year's people, your year's subjects. A group's own
   question counts on its own ("senior:12"); everyone's keeps the old scopes ("12", "all"). */
const scopeOf = (kind, me, aud) => {
  const base = kind === "student" || kind === "class" ? String(me.year || "") : "all";
  return base && aud && aud !== "all" ? aud + ":" + base : base;
};

/* an answer's name for the results, whoever is reading them */
async function labeller(poll, scope, NAMES) {
  const kind = poll.kind;
  if (kind === "custom") { const m = new Map(customOptions(poll).map(o => [o.id, o.label])); return id => m.get(id) || "?"; }
  if (kind === "period") { const m = new Map(PERIODS.map(p => [p.id, p.label])); return id => m.get(id) || id; }
  if (kind === "teacher") { const m = new Map((await teachers().catch(() => [])).map(t => [t.id, t.label])); return id => m.get(id) || titleCase(id.replace(/[._]+/g, " ").replace(/\d+$/, "")); }
  if (kind === "student") {
    const m = new Map((await yearMates(String(scope).split(":").pop(), NAMES).catch(() => [])).map(p => [p.id, p.label]));
    return id => m.get(id) || titleCase(id.replace(/[._]+/g, " ").replace(/\d+$/, ""));
  }
  return id => id;
}

/* people who voted in a scope: the "__n" row (or, without one, the sum) */
const votersIn = rows => { const n = rows.find(r => r.choice === VOTERS);
  return n ? n.votes : rows.reduce((a, r) => a + (r.votes || 0), 0); };
/* the counts for one week and scope, as [{label, votes, pct}] (most first);
   pct is the share of voters who picked it */
async function resultsOf(poll, scope, NAMES, limit) {
  const { data, error } = await db.from("poll_tally").select("choice, votes").eq("week", poll.week).eq("scope", scope);
  if (error) throw new Error("poll results: " + error.message);
  const total = votersIn(data || []);
  const rows = (data || []).filter(r => r.votes > 0 && r.choice !== VOTERS);
  if (total < MIN_SHOW) return { total, results: null };
  const name = await labeller(poll, scope, NAMES);
  rows.sort((a, b) => b.votes - a.votes || String(a.choice).localeCompare(String(b.choice)));
  const results = rows.slice(0, limit || 10).map(r => ({ label: name(r.choice), votes: r.votes,
    pct: Math.round(r.votes / total * 100) }));
  return { total, results, others: Math.max(0, rows.length - results.length) };
}
async function totalOf(week, scope) {
  const { data } = await db.from("poll_tally").select("choice, votes").eq("week", week).eq("scope", scope);
  return votersIn(data || []);
}
async function hasVoted(week, email) {
  const { data, error } = await db.from("poll_voter").select("email").eq("week", week).eq("email", email).maybeSingle();
  if (error) throw new Error("poll voters: " + error.message);
  return !!data;
}

/* ── GET ────────────────────────────────────────────────────────────── */
export async function pollGet(req, res, me, NAMES) {
  const what = String(req.query.poll || "1");
  const clock = pollClock();
  try {
    if (what === "history") {
      const { data, error } = await db.from("poll").select(await cols("week, question, kind, choices, pick, pickexact"))
        .lt("week", clock.week).order("week", { ascending: false }).limit(120);
      if (error) throw new Error(error.message);
      const polls = [];
      for (const rows of [...byWeek(data).values()].slice(0, 30)) {
        const p = pickFor(rows, me); if (!p) continue;
        const scope = scopeOf(p.kind, me, audOf(p));
        const r = scope ? await resultsOf(p, scope, NAMES, 8) : { total: 0, results: null };
        polls.push({ week: p.week, question: p.question, kind: p.kind, pick: p.pick || 1, total: r.total, results: r.results, others: r.others || 0 });
      }
      return res.status(200).json({ polls });
    }
    if (what === "admin") {
      if (!isAdmin(me.email)) return res.status(403).json({ error: "Moderators only." });
      const audiences = await hasAudience();
      const [{ data: polls }, { data: sugg }, { data: voters }] = await Promise.all([
        db.from("poll").select(await cols("week, question, kind, choices, pick, pickexact, anim, celebrate, reveal, created_by")).order("week", { ascending: false }).limit(200),
        db.from("poll_suggestion").select("id, email, question, kind, created_at").order("created_at", { ascending: false }).limit(300),
        db.from("poll_tally").select("week, scope, votes").eq("choice", VOTERS).gte("week", addDays(clock.week, -7 * 60)).limit(3000)
      ]);
      /* voters per week and group: a group's scopes start "junior:", "senior:" or "y12:" */
      const count = new Map();
      for (const v of voters || []) { const k = v.week + "|" + (String(v.scope).includes(":") ? String(v.scope).split(":")[0] : "all");
        count.set(k, (count.get(k) || 0) + (v.votes || 0)); }
      /* every school week from this one to Year 12's last term (the planner's list) */
      const plan = schoolWeeks(clock.week), weeks = plan.map(w => w.week);
      return res.status(200).json({
        clock, weeks, schoolWeeks: plan, planEnd: PLAN_END, audiences,
        polls: (polls || []).map(p => ({ week: p.week, audience: audOf(p), question: p.question, kind: p.kind, anim: p.anim || "surprise",
          celebrate: p.celebrate || "surprise", reveal: p.reveal || "",
          choices: Array.isArray(p.choices) ? p.choices : [], pick: p.pick || 1, exact: !!p.pickexact, voters: count.get(p.week + "|" + audOf(p)) || 0,
          subjectsDone: p.kind === "class" && p.choices && Array.isArray(p.choices.done) ? p.choices.done : undefined,
          by: withName(NAMES, p.created_by, userOf(p.created_by)) })),
        suggestions: (sugg || []).filter(s => s.kind !== "feature" && s.kind !== "name").map(s => ({ id: s.id, question: s.question, kind: s.kind || "", at: s.created_at,
          by: withName(NAMES, s.email, titleCase(userOf(s.email).replace(/[._]+/g, " ").replace(/\d+$/, ""))) })),
        /* ideas for the site, from Home's footer */
        features: (sugg || []).filter(s => s.kind === "feature").map(s => ({ id: s.id, idea: s.question, at: s.created_at,
          by: withName(NAMES, s.email, titleCase(userOf(s.email).replace(/[._]+/g, " ").replace(/\d+$/, ""))) })),
        /* name changes asked for (also from Home's footer): the name now, and the one wanted */
        names: (sugg || []).filter(s => s.kind === "name").map(s => ({ id: s.id, want: s.question, at: s.created_at,
          by: withName(NAMES, s.email, titleCase(userOf(s.email).replace(/[._]+/g, " ").replace(/\d+$/, ""))) }))
      });
    }

    /* this week's poll, as this person sees it */
    const { data: rowsNow, error } = await db.from("poll").select(await cols("week, question, kind, choices, pick, pickexact, anim, celebrate, reveal")).eq("week", clock.week);
    if (error) throw new Error(error.message);
    const poll = pickFor(rowsNow, me);
    if (!poll) {
      /* the holidays (and no question set for them): a look back at the term, or at the year over summer */
      const brk = breakOf(clock.week);
      let lookback = null;
      if (brk) try { lookback = await lookbackFor(brk, clock, me, NAMES); } catch (e) { console.error("poll look back:", e.message); }
      if (lookback) return res.status(200).json({ clock, poll: null, last: null, lookback });
      /* nothing this week: the most recent finished one instead, if any */
      const { data: before } = await db.from("poll").select(await cols("week, question, kind, choices, pick"))
        .lt("week", clock.week).order("week", { ascending: false }).limit(16);
      const last = [...byWeek(before).values()].map(rows => pickFor(rows, me)).find(Boolean);
      let lastOut = null;
      if (last) {
        const scope = scopeOf(last.kind, me, audOf(last));
        const r = scope ? await resultsOf(last, scope, NAMES, 8) : { total: 0, results: null };
        lastOut = { week: last.week, question: last.question, kind: last.kind, pick: last.pick || 1, total: r.total, results: r.results, others: r.others || 0 };
      }
      return res.status(200).json({ clock, poll: null, last: lastOut });
    }
    const scope = scopeOf(poll.kind, me, audOf(poll)), open = clock.phase === "open";
    /* everything the card might need, asked for at once rather than one after
       another (the answers or the results are dropped if it turns out they
       aren't needed) */
    const settle = pr => pr.then(v => ({ v }), e => ({ e }));
    const t0 = Date.now();
    const [votedR, totalR, optsR, resR] = await Promise.all([
      settle(hasVoted(poll.week, me.email)),
      scope ? settle(totalOf(poll.week, scope)) : { v: 0 },
      scope && open ? settle(optionsFor(poll, me, NAMES)) : null,
      scope && !open ? settle(resultsOf(poll, scope, NAMES, 12)) : null
    ]);
    if (votedR.e) throw votedR.e;
    const voted = votedR.v;
    const out = { week: poll.week, audience: audOf(poll), question: poll.question, kind: poll.kind, anim: poll.anim || "surprise",
                  celebrate: poll.celebrate || "surprise", reveal: poll.reveal || "", pick: poll.pick || 1, exact: !!poll.pickexact, voted, phase: clock.phase,
                  canVote: !!scope, total: scope ? totalR.v || 0 : 0, minShow: MIN_SHOW };
    if (!voted && scope && open) {
      if (optsR.e) { console.error("poll options:", optsR.e.message); out.options = []; out.optionsError = true; }
      else out.options = optsR.v || [];
      if (!out.options.length) out.canVote = false;
    }
    if (!open) out.canVote = false;
    /* results: live once you've voted; final, for everyone, from Friday noon */
    if (scope && (voted || !open)) {
      if (resR && resR.e) throw resR.e;
      const r = resR ? resR.v : await resultsOf(poll, scope, NAMES, 12);
      out.results = r.results; out.others = r.others || 0; out.total = r.total;
    }
    /* Friday's slot machine spins through people from the year (or the other
       possible answers): a shuffled handful of names, nothing about votes */
    if (scope && clock.phase === "results" && out.results) {
      try {
        const all = (await optionsFor(poll, me, NAMES)).map(o => o.label);
        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
        out.reel = all.slice(0, 30);
      } catch { /* the reel just uses the results */ }
    }
    const ms = Date.now() - t0;
    if (ms > 1500) console.warn("poll slow: " + ms + "ms (" + poll.kind + ")");
    return res.status(200).json({ clock, poll: out });
  } catch (e) {
    console.error("poll read:", e.message);
    return res.status(502).json({ error: /does not exist|relation|schema cache|could not find/i.test(e.message) ? "The poll isn't set up yet." : "Couldn't load the poll." });
  }
}

/* ── POST ───────────────────────────────────────────────────────────── */
export async function pollPost(body, res, me, NAMES) {
  const clock = pollClock();
  const action = body.action;

  if (action === "pollvote") {
    const { data: rowsNow, error: pErr } = await db.from("poll").select(await cols("week, question, kind, choices, pick, pickexact")).eq("week", clock.week);
    if (pErr) { console.error("poll vote read:", pErr.message); return res.status(502).json({ error: "Couldn't save your vote. Try again." }); }
    const poll = pickFor(rowsNow, me);
    if (!poll || String(body.week) !== poll.week) return res.status(409).json({ error: "That poll has closed. Reload for this week's." });
    if (clock.phase !== "open") return res.status(409).json({ error: "Voting has closed. The results are out." });
    const scope = scopeOf(poll.kind, me, audOf(poll));
    if (!scope) return res.status(403).json({ error: "This one is for students." });
    let options;
    try { options = await optionsFor(poll, me, NAMES); }
    catch (e) { console.error("poll options:", e.message); return res.status(502).json({ error: "Couldn't check that answer. Try again." }); }
    const most = poll.pick || 1;
    const picks = [...new Set((Array.isArray(body.choice) ? body.choice : [body.choice]).map(String))];
    if (!picks.length || picks.length > most || (poll.pickexact && picks.length !== most))
      return res.status(400).json({ error: most === 1 ? "Pick one." : poll.pickexact ? "Pick exactly " + most + "." : "Pick up to " + most + "." });
    if (!picks.every(c => options.some(o => o.id === c))) return res.status(400).json({ error: "Pick from the list." });
    /* first, that you have voted (the primary key stops a second vote)... */
    const { error: vErr } = await db.from("poll_voter").insert({ week: poll.week, email: me.email });
    if (vErr) {
      if (/duplicate|unique/i.test(vErr.message)) return res.status(409).json({ error: "You've already voted this week." });
      console.error("poll voter:", vErr.message);
      return res.status(502).json({ error: "Couldn't save your vote." });
    }
    /* ...then, separately and with no name on it, one more for that answer */
    const { error: bErr } = await db.rpc("poll_bump", { p_week: poll.week, p_scope: scope, p_choices: picks.concat(VOTERS) });
    if (bErr) {
      console.error("poll count failed");                       // never log the answer
      await db.from("poll_voter").delete().eq("week", poll.week).eq("email", me.email);   // so you can try again
      return res.status(502).json({ error: "Couldn't save your vote. Try again." });
    }
    const live = await resultsOf(poll, scope, NAMES, 12).catch(() => ({ total: 0, results: null }));
    return res.status(200).json({ ok: true, total: live.total, results: live.results, others: live.others || 0 });
  }

  if (action === "pollsuggest") {
    const question = String(body.question || "").replace(/\s+/g, " ").trim().slice(0, MAX_Q);
    const kind = KINDS.includes(body.kind) ? body.kind : "";
    if (question.length < 5) return res.status(400).json({ error: "Write a question first." });
    if (limited("pollsuggest:" + me.email, SUGGEST_PER_MIN, 60e3)) return slowDown(res);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const { error } = await db.from("poll_suggestion").insert({ id, email: me.email, question, kind: kind || null });
    if (error) { console.error("poll suggest:", error.message); return res.status(502).json({ error: "Couldn't send that." }); }
    return res.status(200).json({ ok: true });
  }

  /* an idea for the site (Home's footer, "Suggest a feature"). Kept with the poll
     suggestions as kind 'feature', so no table of its own; the moderator page
     lists them under Feature ideas. As many as anyone likes (only the flood brake). */
  if (action === "featuresuggest") {
    const idea = String(body.idea || "").replace(/\s+/g, " ").trim().slice(0, MAX_IDEA);
    if (idea.length < 5) return res.status(400).json({ error: "Write your idea first." });
    if (limited("featuresuggest:" + me.email, SUGGEST_PER_MIN, 60e3)) return slowDown(res);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const { error } = await db.from("poll_suggestion").insert({ id, email: me.email, question: idea, kind: "feature" });
    if (error) { console.error("feature idea:", error.message); return res.status(502).json({ error: "Couldn't send that." }); }
    return res.status(200).json({ ok: true });
  }

  /* moderators: set, change or take down a week's question, clear a suggestion. Only questions
     that haven't opened yet can change (lockedWeek); a live or past one, and its votes, can't. */
  if (!isAdmin(me.email)) return res.status(403).json({ error: "Moderators only." });
  if (action === "pollset") {
    const r = await pollSetOne(body, me, clock);
    return r.ok ? res.status(200).json({ ok: true }) : res.status(r.status).json({ error: r.error });
  }
  /* many weeks at once (the planner's Save): { set: [questions as pollset takes them], remove: [weeks] }.
     Each is checked and saved on its own, and the answer says how each went. */
  if (action === "pollbatch") {
    /* one change a week and group (a later one wins), and one that's being set isn't also removed.
       A removal is { week, audience }, or just a week (everyone's) from an older page. */
    const keyOf = x => String(x.week || "") + "|" + (AUDIENCES.includes(x.audience) ? x.audience : "all");
    const sets = new Map((Array.isArray(body.set) ? body.set : []).filter(x => x && typeof x === "object").map(x => [keyOf(x), x]));
    const set = [...sets.values()].slice(0, 80);
    const remove = [...new Map((Array.isArray(body.remove) ? body.remove : []).map(x => typeof x === "object" && x ? x : { week: String(x) })
      .map(x => [keyOf(x), x])).entries()].filter(([k]) => !sets.has(k)).map(([, x]) => x).slice(0, 80);
    if (!set.length && !remove.length) return res.status(400).json({ error: "Nothing to save." });
    const jobs = set.map(x => ({ week: String(x.week || ""), audience: keyOf(x).split("|")[1], run: () => pollSetOne(x, me, clock) }))
      .concat(remove.map(x => ({ week: String(x.week || ""), audience: keyOf(x).split("|")[1], removed: true, run: () => pollDelOne(String(x.week || ""), clock, x.audience) })));
    const results = new Array(jobs.length);
    await eachLimited(jobs.map((_, k) => k), 4, async k => {
      const j = jobs[k];
      let r;
      try { r = await j.run(); } catch (e) { console.error("poll batch:", e.message); r = { error: "Couldn't save that." }; }
      results[k] = { week: j.week, audience: j.audience, removed: !!j.removed, ok: !!r.ok, error: r.ok ? undefined : r.error };
    });
    return res.status(200).json({ results });
  }
  /* one slice of a year's timetables, for a class question's subject list */
  if (action === "pollsubjects") {
    const week = String(body.week || ""), year = String(parseInt(body.year, 10) || "");
    const from = Math.max(0, parseInt(body.from, 10) || 0);
    const aud = AUDIENCES.includes(body.audience) ? body.audience : "all", A = await hasAudience();
    const one = q => A ? q.eq("audience", aud) : q;
    const { data: poll, error: pErr } = await one(db.from("poll").select("kind, choices").eq("week", week)).maybeSingle();
    if (pErr || !poll) return res.status(404).json({ error: "Save the question first." });
    if (poll.kind !== "class") return res.status(400).json({ error: "That isn't a class question." });
    const why = lockedWeek(week, clock);
    if (why) return res.status(409).json({ error: why });
    if (await votedOn(week)) return res.status(409).json({ error: "People have voted on this one, so it can't be changed." });
    const c = poll.choices && !Array.isArray(poll.choices) ? poll.choices : {};
    const years = { ...(c.years || {}) }, done = Array.isArray(c.done) ? c.done.slice() : [];
    if (done.includes(year)) return res.status(200).json({ next: null, total: 0, count: (years[year] || []).length });
    let mates;
    try { mates = (await studentDirectory()).filter(p => String(p.year) === year).map(p => p.email).sort(); }
    catch (e) { console.error("poll subjects:", e.message); return res.status(502).json({ error: "Couldn't reach the school directory." }); }
    const set = new Set(from ? years[year] || [] : []);
    await eachLimited(mates.slice(from, from + SUBJECT_SLICE), 6, async email => {
      try { for (const o of await classesOf(email)) set.add(o.id); } catch { /* one timetable missing: skip it */ }
    });
    const next = from + SUBJECT_SLICE < mates.length ? from + SUBJECT_SLICE : null;
    years[year] = [...set].sort((a, b) => a.localeCompare(b));
    if (next === null && mates.length) done.push(year);
    const { error } = await one(db.from("poll").update({ choices: { years, done } }).eq("week", week).eq("kind", "class"));
    if (error) { console.error("poll subjects save:", error.message); return res.status(502).json({ error: "Couldn't save the subjects." }); }
    return res.status(200).json({ next, total: mates.length, count: years[year].length });
  }
  if (action === "polldel") {
    const r = await pollDelOne(String(body.week || ""), clock, body.audience);
    return r.ok ? res.status(200).json({ ok: true }) : res.status(r.status).json({ error: r.error });
  }
  if (action === "suggestdel") {
    const { error } = await db.from("poll_suggestion").delete().eq("id", String(body.id || ""));
    if (error) return res.status(502).json({ error: "Couldn't remove that." });
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: "Unknown poll action." });
}

/* ── the holidays: looking back ──────────────────────────────────────
   Every question from the term just ended (over summer, the whole year), newest first, each with its
   top two answers for this person's scope, plus how many of them this person voted in (their own
   poll_voter rows: never anyone else's, and never what they picked). A closed week's results can't
   change, so they're kept for six hours per warm instance. */
const pastResults = new Map();
async function closedResults(p, scope, NAMES) {
  const k = p.week + "|" + scope, hit = pastResults.get(k);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.r;
  const r = await resultsOf(p, scope, NAMES, 2);
  if (pastResults.size > 500) pastResults.clear();
  pastResults.set(k, { at: Date.now(), r });
  return r;
}
async function lookbackFor(brk, clock, me, NAMES) {
  const from = brk.summer ? brk.after.first.slice(0, 4) + "-01-01" : mondayOf(brk.after.week1 || brk.after.first);
  const { data, error } = await db.from("poll").select(await cols("week, question, kind, choices, pick"))
    .gte("week", from).lt("week", clock.week).order("week", { ascending: false }).limit(180);
  if (error) throw new Error(error.message);
  const list = [...byWeek(data).values()].map(rows => pickFor(rows, me)).filter(Boolean).slice(0, 45), polls = new Array(list.length);
  await eachLimited(list.map((_, i) => i), 6, async i => {
    const p = list[i], scope = scopeOf(p.kind, me, audOf(p));
    const r = scope ? await closedResults(p, scope, NAMES).catch(() => ({ total: 0, results: null })) : { total: 0, results: null };
    polls[i] = { week: p.week, question: p.question, kind: p.kind, total: r.total || 0,
                 top: (r.results || []).slice(0, 2).map(x => ({ label: x.label, votes: x.votes, pct: x.pct })) };
  });
  let voted = null;
  if (me.email) {
    const { count, error: cErr } = await db.from("poll_voter").select("week", { count: "exact", head: true })
      .eq("email", me.email).gte("week", from).lt("week", clock.week);
    if (!cErr && typeof count === "number") voted = count;
  }
  return { name: brk.name, back: brk.back, summer: brk.summer,
           title: brk.summer ? from.slice(0, 4) + " in polls" : "Term " + brk.after.term + " in polls", polls, voted };
}

/* A question is fixed once it has opened: this week's (live) and every past one can't be changed,
   removed or have its subjects collected, whether or not anyone has voted yet, so nothing can ever
   touch a question while votes are coming in. Next week's locks two minutes before it opens (no
   request runs that long), so a save can't land as the first votes do. A question can still be
   set for this week if it has none (a new row; nothing to change). Returns why, or "". */
const LOCK_AHEAD = 2 * 60e3;
function lockedWeek(week, clock) {
  if (week <= clock.week) return week === clock.week ? "This week's question is live, so it can't be changed." : "That week has been and gone.";
  if (week === addDays(clock.week, 7) && clock.nextAt - Date.now() < LOCK_AHEAD) return "That question opens in a moment, so it's locked now.";
  return "";
}
/* has anyone voted on that week's question? */
async function votedOn(week) {
  const { data, error } = await db.from("poll_voter").select("email").eq("week", week).limit(1);
  if (error) throw new Error("poll voters: " + error.message);
  return (data || []).length > 0;
}
/* one week's question, checked and saved: { ok } or { status, error } */
async function pollSetOne(body, me, clock) {
  const week = String(body.week || ""), kind = String(body.kind || "");
  const anim = ANIMS.includes(body.anim) ? body.anim : "surprise";
  const celebrate = CELEBS.includes(body.celebrate) ? body.celebrate : "surprise";
  const reveal = String(body.reveal || "").replace(/\s+/g, " ").trim().slice(0, 140) || null;
  const pick = Math.min(3, Math.max(1, parseInt(body.pick, 10) || 1));
  const pickexact = pick > 1 && body.exact === true;
  let choices = null;
  if (kind === "custom") {
    choices = [...new Set((Array.isArray(body.choices) ? body.choices : [])
      .map(c => String(c).replace(/\s+/g, " ").trim().slice(0, 60)).filter(Boolean))];
    if (choices.length < 2 || choices.length > 8) return { status: 400, error: "A custom question needs 2 to 8 answers." };
    if (pick >= choices.length) return { status: 400, error: "Let people pick fewer than all the answers." };
  }
  const question = String(body.question || "").replace(/\s+/g, " ").trim().slice(0, MAX_Q);
  if (!isMonday(week) || week < clock.week) return { status: 400, error: "Pick this week or a later Monday." };
  if (!KINDS.includes(kind)) return { status: 400, error: "Pick a kind of answer." };
  if (question.length < 5) return { status: 400, error: "Write the question." };
  const aud = AUDIENCES.includes(body.audience) ? body.audience : "all", A = await hasAudience();
  if (!A && aud !== "all") return { status: 409, error: "Separate questions need the database's new column first (SETUP.md)." };
  const row = { week, question, kind, choices, pick, pickexact, anim, celebrate, reveal, created_by: me.email };
  if (A) row.audience = aud;
  /* this week, only if it has no question yet: added as a new row, which fails if one exists */
  if (week === clock.week) {
    if (await votedOn(week)) return { status: 409, error: "This week's question is live, so it can't be changed." };
    const { error } = await db.from("poll").insert(row);
    if (error) return /duplicate|unique/i.test(error.message) ? { status: 409, error: "This week's question is live, so it can't be changed." }
      : (console.error("poll set:", error.message), { status: 502, error: "Couldn't save that." });
    return { ok: true };
  }
  const why = lockedWeek(week, clock);
  if (why) return { status: 409, error: why };
  if (await votedOn(week)) return { status: 409, error: "People have voted on this one, so it can't be changed." };
  const sel = db.from("poll").select("kind, choices").eq("week", week);
  const { data: had } = await (A ? sel.eq("audience", aud) : sel).maybeSingle();
  /* a class question keeps the subjects already collected for it */
  if (kind === "class") row.choices = had && had.kind === "class" && had.choices && !Array.isArray(had.choices) ? had.choices : null;
  const { error } = await db.from("poll").upsert(row, { onConflict: A ? "week,audience" : "week" });
  if (error) { console.error("poll set:", error.message); return { status: 502, error: "Couldn't save that." }; }
  return { ok: true };
}
/* take a week's question down (one group's, or everyone's), if nobody has voted on it */
async function pollDelOne(week, clock, audience) {
  if (!isMonday(week)) return { status: 400, error: "That isn't a week." };
  const why = lockedWeek(week, clock);
  if (why) return { status: 409, error: why };
  if (await votedOn(week)) return { status: 409, error: "People have voted on this one, so it stays." };
  const aud = AUDIENCES.includes(audience) ? audience : "all", del = db.from("poll").delete().eq("week", week);
  const { error } = await ((await hasAudience()) ? del.eq("audience", aud) : del);
  if (error) return { status: 502, error: "Couldn't remove that." };
  return { ok: true };
}

/* ── the share link's preview (/poll): the question, never the results ── */
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export async function pollPreview(req, res) {
  let q = "";
  try {
    if (db) {
      const { data } = await db.from("poll").select(await cols("question")).eq("week", pollClock().week);
      const p = (data || []).find(x => audOf(x) === "all") || (data || [])[0];
      q = p ? p.question : "";
    }
  } catch {}
  const title = q ? q : "This week's poll";
  const desc = "An anonymous poll for MSC students. Vote to see what everyone said.";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${escHtml(title)} · MSC Unofficial</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MSC Unofficial">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:image" content="https://www.mscunofficial.com/images/poll-og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="This week's anonymous poll on MSC Unofficial">
<meta name="twitter:card" content="summary_large_image">
<meta name="description" content="${escHtml(desc)}">
<meta http-equiv="refresh" content="0;url=/home.html?poll=1">
</head><body><script>location.replace('/home.html?poll=1')</script>
<p><a href="/home.html?poll=1">Open the poll</a></p></body></html>`);
}

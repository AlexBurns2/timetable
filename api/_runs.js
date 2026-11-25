/*
 * Games the server runs itself, so the answers never reach the browser, and
 * tickets for the games it can't run, so a score can't simply be posted.
 * Private module (the underscore keeps Vercel from making it a route); served
 * by /api/leaderboard (POST {action:"run", …} and {action:"ticket", …}), so it
 * doesn't count as a function of its own.
 *
 * Six Degrees, Odd One Out and Classroom used to be played entirely in the
 * page: the page held the class lists, picked the questions and knew the
 * answers (Odd One Out even marked the outsider in the page itself), and then
 * posted whatever score it liked. Now:
 *   - the server reads the player's own timetable and class lists (with their
 *     own login), picks each question, keeps the answer, marks each pick, runs
 *     the clock and records the score when the run ends. The page only ever
 *     sees the question in front of it, and the answer once it has been marked.
 *   - each answer is checked against the question the server last handed out
 *     (state.seq): the same question can't be answered twice, and two answers
 *     sent at once can't both count.
 *   - Six Degrees' map is everyone's real classes, not just the classes they
 *     share with you, so someone who shares a class with the target always has
 *     the target among their options. And the target is never on the tile you
 *     just pressed, so pressing one spot over and over (an autoclicker) never
 *     reaches anyone.
 *
 * Runs are kept in the game_state table, one row per person and game under the
 * mode "run:<game>" (new rows only: nothing else in the table is touched).
 *
 *   POST {action:"run", game:"chain", op:"ready"}    → { people }  the map is made (can take a while the first time)
 *   POST {action:"run", game, op:"go", week}         → the first board / question
 *   POST {action:"run", game, op:"pick", rid, pick}  → marked, and the next one
 *   POST {action:"run", game:"chain", op:"end", rid} → the run's result (when the clock runs out)
 *
 * Tickets (snake, 2048, typing, reaction, Tetris): POST {action:"ticket", game}
 * hands out an id when a game starts; a score sent later must carry it, and is
 * held to what's possible in the time since (scoreFits). Not proof against a
 * determined cheat, but no more posting a score from the console.
 */
import { randomBytes } from "node:crypto";
import { db } from "./_supabase.js";
import { fetchAsCaller } from "./timetable.js";
import { displayNames, withName, rosterList } from "./_names.js";

const GRACE = 1500;                          // a little for the network, on every clock
const RUN_MS = 90000;                        // Six Degrees' clock
const POOL_TTL = 6 * 3600e3, MAP_TTL = 12 * 3600e3;
const now = () => Date.now();
const rid = () => randomBytes(6).toString("hex");
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* the week the boards are on: Monday-anchored, Sydney's date (as tetrisWeek() in games.js) */
export function boardWeek() {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
  const [y, m, dd] = d.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, dd) - Date.UTC(2024, 0, 1)) / 864e5 / 7);
}
/* the page's own week, if it's this one or next to it (a clock either side of midnight Sunday) */
export const weekFrom = v => { const w = parseInt(v, 10), s = boardWeek(); return Number.isInteger(w) && Math.abs(w - s) <= 1 ? w : s; };

/* ── one row per person and game ─────────────────────────────────────── */
const MODE = g => "run:" + g;
async function readRow(email, game) {
  const { data, error } = await db.from("game_state").select("state").eq("email", email).eq("mode", MODE(game)).maybeSingle();
  if (error) throw new Error(error.message);
  return (data && data.state) || null;
}
/* Write it back only if nobody else has since (its seq is still the one read).
   false: someone else got there first. */
async function writeRow(email, game, state, prevSeq) {
  const row = { state, updated_at: new Date().toISOString() };
  if (prevSeq == null) {
    const { error } = await db.from("game_state").upsert({ email, mode: MODE(game), ...row });
    if (error) throw new Error(error.message);
    return true;
  }
  const { data, error } = await db.from("game_state").update(row).eq("email", email).eq("mode", MODE(game))
    .eq("state->>seq", String(prevSeq)).select("mode");
  if (error) throw new Error(error.message);
  return (data || []).length > 0;
}

/* ── the player's classes, read from the school with their own login ─── */
const cleanSubject = name => String(name || "")
  .replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i, "")
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/, "")
  .replace(/^[\s:\-–—]+/, "").trim();
const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
const mailOf = r => String((r && (r.Email || r.email || r.emailAddress)) || "").toLowerCase();
function personName(r) {
  const full = r.FullName || r.fullName || r.Name || r.name || "";
  const first = r.FirstName || r.firstName || r.firstname || r.GivenName || r.preferredName || "";
  const last = r.LastName || r.lastName || r.lastname || r.Surname || r.surname || "";
  const nm = full || [first, last].filter(Boolean).join(" ");
  if (nm) return String(nm);
  const p = mailOf(r).split("@")[0].split(".");
  return p.length >= 2 ? cap(p[0]) + " " + cap(p[1].replace(/\d+$/, "")) : "";
}
const tidyName = t => {
  t = String(t || "").trim(); if (!t) return "";
  if (t.includes("@")) t = t.split("@")[0];
  if (/[.,]/.test(t)) return t.split(/[.,]\s*/).filter(Boolean).map(cap).join(" ").replace(/\s+\d+/g, "").trim();
  return t;
};
const isStaff = r => {
  const groups = Array.isArray(r.groups) ? r.groups.map(g => String(g).toLowerCase()) : [];
  return groups.some(g => /^(teacher|staff|executive|admin)/.test(g)) ||
    /teacher|staff/i.test(r.Role || r.role || r.Type || r.type || "") || /@det\.nsw\.edu\.au$/.test(mailOf(r));
};
const rowsOf = tt => { const a = Array.isArray(tt) ? tt : (tt && (tt.timetable || tt.Timetable || tt.entries || tt.data)) || [];
  return (Array.isArray(a) ? a : []).filter(r => r && r.ClassCode && !/assembly|recess|lunch|roll/i.test((r.Period || "") + " " + (r.CourseName || ""))); };
async function eachLimited(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

/* { at, codes:[code], label:{code:subject}, pool:[{n, e, y, s:[subject], c:[code]}], rooms:[…] } */
async function buildPool(req, me) {
  const tt = await fetchAsCaller(req, "/api/timetable/" + encodeURIComponent(me.email));
  const rows = rowsOf(tt);
  const label = {};
  rows.forEach(r => { label[r.ClassCode] = cleanSubject(r.CourseName) || r.ClassCode; });
  const codes = [...new Set(rows.map(r => r.ClassCode))].slice(0, 12);
  const [NAMES, roster] = await Promise.all([displayNames(), rosterList().catch(() => [])]);
  const yearOfMail = new Map(roster.map(p => [p.email, p.year]));
  const people = new Map();
  await eachLimited(codes, 5, async code => {
    let raw; try { raw = await fetchAsCaller(req, "/api/timetable/class/" + encodeURIComponent(code)); } catch { return; }
    const arr = Array.isArray(raw) ? raw : (raw && (raw.students || raw.roster)) || [];
    for (const r of Array.isArray(arr) ? arr : []) {
      if (!r || isStaff(r)) continue;
      const e = mailOf(r); if (!e || e === me.email) continue;
      const n = withName(NAMES, e, personName(r)); if (!n) continue;
      if (!people.has(e)) people.set(e, { n, e, y: String(r.Year || r.year || r.Form || r.form || yearOfMail.get(e) || "").replace(/\D/g, ""), s: new Set(), c: new Set() });
      people.get(e).s.add(label[code]); people.get(e).c.add(code);
    }
  });
  const pool = [...people.values()].map(p => ({ n: p.n, e: p.e, y: p.y, s: [...p.s], c: [...p.c] }));
  /* one room / teacher / period per class (for Classroom), from its first row that names a room */
  const rmOf = r => String(r.RoomCode || r.RoomNumber || r.RoomName || r.Room || r.Location || "").trim();
  const tchOf = r => String(r.TeacherName || r.TeacherFullName || r.Teacher || r.StaffName || "").trim();
  const rooms = [], seen = new Set();
  rows.forEach(r => { const room = rmOf(r); if (!room || seen.has(r.ClassCode)) return; seen.add(r.ClassCode);
    rooms.push({ subject: label[r.ClassCode], room, teacher: tidyName(tchOf(r)), period: String(r.Period || "").trim() }); });
  return { at: now(), codes, label, pool, rooms };
}
async function poolFor(req, me, fresh) {
  const st = await readRow(me.email, "pool").catch(() => null);
  if (!fresh && st && st.data && now() - st.data.at < POOL_TTL) return st.data;
  const data = await buildPool(req, me);
  await writeRow(me.email, "pool", { seq: 1, data }, null).catch(() => {});
  return data;
}

/* ── Six Degrees' map: everyone in your classes, linked by every class they share ── */
const codesCache = new Map();          // email -> { at, codes:[[code, subject]] }
async function buildMap(req, me) {
  const P = await poolFor(req, me);
  const nodes = P.pool.filter(p => p.e);
  const deadline = now() + 35000;
  await eachLimited(nodes, 8, async p => {
    const hit = codesCache.get(p.e);
    if (hit && now() - hit.at < MAP_TTL) return;
    if (now() > deadline) return;                                  // out of time: what's known from your own classes
    try {
      const rows = rowsOf(await fetchAsCaller(req, "/api/timetable/" + encodeURIComponent(p.e)));
      const m = new Map(); rows.forEach(r => { if (!m.has(r.ClassCode)) m.set(r.ClassCode, cleanSubject(r.CourseName) || r.ClassCode); });
      if (codesCache.size > 5000) codesCache.clear();
      codesCache.set(p.e, { at: now(), codes: [...m] });
    } catch { /* unreadable: what's known from your own classes */ }
  });
  const labels = [], idx = new Map();
  const ci = (code, subj) => { if (!idx.has(code)) { idx.set(code, labels.length); labels.push(subj || code); } return idx.get(code); };
  const out = nodes.map(p => {
    const known = codesCache.get(p.e);
    const list = known && known.codes.length ? known.codes : p.c.map(c => [c, P.label[c]]);
    const own = p.c.map(c => [c, P.label[c]]);                      // always keep the classes they share with you
    const all = new Map([...list, ...own]);
    return { n: p.n, y: p.y, c: [...all].map(([c, s]) => ci(c, s)) };
  });
  return { at: now(), nodes: out, labels, full: nodes.filter(p => codesCache.has(p.e)).length };
}
function mapTools(map) {
  const byCode = new Map();
  map.nodes.forEach((p, i) => p.c.forEach(c => { if (!byCode.has(c)) byCode.set(c, []); byCode.get(c).push(i); }));
  const nbr = i => { const s = new Set(); map.nodes[i].c.forEach(c => (byCode.get(c) || []).forEach(j => { if (j !== i) s.add(j); })); return [...s]; };
  const via = (a, b) => { const c = map.nodes[a].c.find(x => map.nodes[b].c.includes(x)); return c == null ? "" : map.labels[c]; };
  const dist = src => { const d = map.nodes.map(() => Infinity); d[src] = 0; const q = [src];
    for (let h = 0; h < q.length; h++) for (const n of nbr(q[h])) if (d[n] === Infinity) { d[n] = d[q[h]] + 1; q.push(n); } return d; };
  return { nbr, via, dist };
}

/* ── the games ───────────────────────────────────────────────────────── */
const GAMES = { chain: { metric: "targets" }, oddone: { metric: "high" }, classroom: { metric: "high" } };
export const RUN_GAMES = new Set(Object.keys(GAMES));

/* Six Degrees */
function chainPickTarget(run, T) {
  const d = T.dist(run.cur), minD = 2 + Math.min(4, Math.floor(run.score / 4));
  let cands = [];
  for (let k = minD; k >= 1 && !cands.length; k--) cands = d.map((x, i) => i !== run.cur && x !== Infinity && x >= k ? i : -1).filter(i => i >= 0);
  run.target = cands.length ? cands[rnd(cands.length)] : null;
}
/* the tiles: up to 14 of where you can go, the target among them when it's next to you,
   and never on the tile just pressed (avoid) */
function chainBoard(run, T, avoid) {
  const nb = T.nbr(run.cur);
  let show = shuffle(nb.slice()).slice(0, 14);
  if (run.target != null && nb.includes(run.target) && !show.includes(run.target)) show[rnd(show.length)] = run.target;
  const at = show.indexOf(run.target);
  if (at >= 0 && at === avoid && show.length > 1) {
    let j = rnd(show.length - 1); if (j >= at) j++;
    [show[at], show[j]] = [show[j], show[at]];
  }
  run.show = show;
}
function chainView(run, map, T) {
  const p = i => ({ n: map.nodes[i].n, y: map.nodes[i].y || "" });
  return { rid: run.rid, score: run.score, left: Math.max(0, run.t0 + RUN_MS - now()), over: !!run.over,
    cur: p(run.cur), target: run.target == null ? null : p(run.target),
    opts: run.show.map(i => ({ n: map.nodes[i].n, via: T.via(run.cur, i) })) };
}

/* Odd One Out */
function oddQuestion(run, pool, delay) {
  const bySubj = new Map();
  pool.forEach((p, i) => p.s.forEach(s => { if (!bySubj.has(s)) bySubj.set(s, []); bySubj.get(s).push(i); }));
  const subjects = [...bySubj.keys()].filter(s => bySubj.get(s).length >= 3 && bySubj.get(s).length < pool.length);
  if (!subjects.length) return null;
  let subj, tries = 0;
  do { subj = subjects[rnd(subjects.length)]; } while (subj === run.last && subjects.length > 1 && tries++ < 6);
  run.last = subj;
  const three = shuffle(bySubj.get(subj).slice()).slice(0, 3);
  const outs = pool.map((p, i) => i).filter(i => !pool[i].s.includes(subj));
  if (!outs.length) return null;
  const odd = outs[rnd(outs.length)];
  const cards = shuffle([...three, odd]);
  const time = Math.max(3000, 8000 - run.streak * 300 - Math.floor((now() - run.t0) / 8000) * 300);
  run.q = { subj, cards, ans: cards.indexOf(odd), at: now() + (delay || 0), time };
  return true;
}
const oddView = (run, pool) => ({ rid: run.rid, score: run.score, streak: run.streak, lives: run.lives, over: !!run.over,
  q: run.q && !run.over ? { subj: run.q.subj, time: run.q.time, cards: run.q.cards.map(i => ({ n: pool[i].n, y: pool[i].y || "" })) } : null });

/* Classroom */
const norm = s => String(s).toLowerCase().replace(/\s+/g, "");
function nearMiss(code) {
  const pos = []; for (let i = 0; i < code.length; i++) if (/\d/.test(code[i])) pos.push(i);
  if (!pos.length) return code + "2";
  const i = pos[rnd(pos.length)], d = +code[i];
  let nd = Math.random() < 0.5 ? d + 1 : d - 1; if (nd < 0) nd = 1; if (nd > 9) nd = 8; if (nd === d) nd = (d + 1) % 10;
  return code.slice(0, i) + nd + code.slice(i + 1);
}
function classQuestion(run, rooms, delay) {
  const uniq = a => [...new Set(a)];
  const allRooms = uniq(rooms.map(r => r.room)), allSubjects = uniq(rooms.map(r => r.subject));
  const withTeacher = rooms.filter(r => r.teacher), allTeachers = uniq(withTeacher.map(r => r.teacher));
  const types = ["room"];
  if (allTeachers.length >= 3 && withTeacher.length >= 2) types.push("teacher");
  if (allSubjects.length >= 3) types.push("subject");
  let type, cls, tries = 0;
  do { type = types[rnd(types.length)]; const from = type === "teacher" ? withTeacher : rooms; cls = from[rnd(from.length)]; }
  while (type + ":" + cls.subject === run.last && tries++ < 10);
  run.last = type + ":" + cls.subject;
  const opts4 = (pool, answer) => { const out = [answer];
    for (const v of shuffle(pool.slice())) { if (out.length >= 4) break; if (!out.some(o => norm(o) === norm(v))) out.push(v); }
    return shuffle(out); };
  const roomOpts = answer => { const out = [answer];
    const more = shuffle([nearMiss(answer), nearMiss(answer), nearMiss(answer), ...shuffle(allRooms.filter(r => norm(r) !== norm(answer))).slice(0, 2)]);
    for (const v of more) { if (out.length >= 4) break; if (v && !out.some(o => norm(o) === norm(v))) out.push(v); }
    let guard = 0; while (out.length < 4 && guard++ < 30) { const v = nearMiss(answer); if (v && !out.some(o => norm(o) === norm(v))) out.push(v); }
    return shuffle(out); };
  const roomTxt = r => r ? "Room " + r : "", periodTxt = p => p ? (/^\d+$/.test(p) ? "Period " + p : p) : "";
  let prompt, clue, answer, options;
  if (type === "room") { prompt = "Where is your " + cls.subject + "?"; clue = [cls.teacher ? "with " + cls.teacher : "", periodTxt(cls.period)]; answer = cls.room; options = roomOpts(cls.room); }
  else if (type === "teacher") { prompt = "Who takes your " + cls.subject + "?"; clue = [roomTxt(cls.room), periodTxt(cls.period)]; answer = cls.teacher; options = opts4(allTeachers, cls.teacher); }
  else { prompt = "Which class runs in " + cls.room + "?"; clue = [cls.teacher ? "with " + cls.teacher : "", periodTxt(cls.period)]; answer = cls.subject; options = opts4(allSubjects, cls.subject); }
  const time = Math.max(4000, 12000 - run.score * 450 - run.streak * 150);
  run.q = { prompt, clue: clue.filter(Boolean).join(" · "), options, ans: options.indexOf(answer), at: now() + (delay || 0), time };
}
const classView = run => ({ rid: run.rid, score: run.score, streak: run.streak, lives: run.lives, over: !!run.over,
  q: run.q && !run.over ? { prompt: run.q.prompt, clue: run.q.clue, options: run.q.options, time: run.q.time } : null });

/* ── the route ───────────────────────────────────────────────────────── */
/* record: (game, metric, score, week) => Promise, from leaderboard.js (keeps the best) */
export async function runHandler(req, res, me, body, record) {
  const game = String(body.game || ""), op = String(body.op || "");
  if (!GAMES[game]) return res.status(400).json({ error: "Unknown game." });
  const fail = (code, error) => res.status(code).json({ error });
  const finish = async (run, week) => {
    if (run.recorded) return;
    run.over = true; run.recorded = true;
    if (run.score > 0) await record(game, GAMES[game].metric, run.score, week).catch(e => console.error("run record:", e.message));
  };
  try {
    let st = await readRow(me.email, game);
    const seq = st ? st.seq || 0 : null;
    st = st || { seq: 0 };
    const save = async () => { st.seq = (seq || 0) + 1; return writeRow(me.email, game, st, seq); };
    /* a run left unfinished (the page closed, or a new one started): its score still counts */
    const settle = async () => { const r = st.run; if (r && !r.recorded) await finish(r, r.week); };

    if (game === "chain") {
      if (op === "ready") {
        if (!st.map || now() - st.map.at > MAP_TTL || body.fresh) st.map = await buildMap(req, me);
        await settle(); await save();
        return res.status(200).json({ people: st.map.nodes.length });
      }
      if (!st.map) return fail(409, "Load the game again.");
      const T = mapTools(st.map);
      if (op === "go") {
        await settle();
        const N = st.map.nodes.length; if (N < 6) return fail(400, "Not enough classmates with shared classes to play.");
        let cur = rnd(N), tries = 0; while (!T.nbr(cur).length && tries++ < 60) cur = rnd(N);
        const run = { rid: rid(), t0: now(), week: weekFrom(body.week), cur, score: 0, target: null, show: [] };
        chainPickTarget(run, T); chainBoard(run, T, -1);
        st.run = run;
        if (!(await save())) return fail(409, "Start again.");
        return res.status(200).json(chainView(run, st.map, T));
      }
      const run = st.run;
      if (!run || run.rid !== body.rid) return fail(409, "That run has finished.");
      if (op === "pick" && !run.over && now() <= run.t0 + RUN_MS + GRACE) {
        const k = Number(body.pick);
        if (!Number.isInteger(k) || k < 0 || k >= run.show.length) return fail(400, "Pick someone.");
        const n = run.show[k], hit = n === run.target;
        run.cur = n;
        if (hit) { run.score++; chainPickTarget(run, T); }
        if (run.target == null) await finish(run, run.week);
        else chainBoard(run, T, k);
        if (!(await save())) return fail(409, "Too quick: try that again.");
        return res.status(200).json(Object.assign(chainView(run, st.map, T), { hit }));
      }
      /* the clock ran out (op "end", or a pick that came too late) */
      if (!run.over && now() < run.t0 + RUN_MS - 3000) return fail(400, "There's still time left.");
      await finish(run, run.week); await save();
      return res.status(200).json(Object.assign(chainView(run, st.map, T), { over: true }));
    }

    /* Odd One Out and Classroom: questions, three lives */
    const P = op === "go" ? await poolFor(req, me) : null;
    if (op === "go") {
      await settle();
      const run = { rid: rid(), t0: now(), week: weekFrom(body.week), score: 0, streak: 0, lives: 3, last: "" };
      if (game === "oddone") {
        st.pool = P.pool;
        if (!oddQuestion(run, st.pool)) return fail(400, "Not enough classmates across your classes to play yet.");
      } else {
        st.rooms = P.rooms.filter(r => r.room && r.subject);
        if (st.rooms.length < 3) return fail(400, "Your timetable doesn’t list enough rooms to play.");
        classQuestion(run, st.rooms);
      }
      st.run = run;
      if (!(await save())) return fail(409, "Start again.");
      return res.status(200).json(game === "oddone" ? oddView(run, st.pool) : classView(run));
    }
    const run = st.run;
    if (op !== "pick" || !run || run.rid !== body.rid || run.over || !run.q) return fail(409, "That run has finished.");
    const k = Number(body.pick), late = now() > run.q.at + run.q.time + GRACE;
    const right = !late && k === run.q.ans, ans = run.q.ans;
    if (right) { run.score++; run.streak++; } else { run.streak = 0; run.lives--; }
    const delay = right ? 520 : 1000;                  // the page shows the answer for this long first
    if (run.lives <= 0) { run.q = null; await finish(run, run.week); }
    else if (game === "oddone") { if (!oddQuestion(run, st.pool, delay)) { run.q = null; await finish(run, run.week); } }
    else classQuestion(run, st.rooms, delay);
    if (!(await save())) return fail(409, "Too quick: try that again.");
    return res.status(200).json(Object.assign(game === "oddone" ? oddView(run, st.pool) : classView(run), { right, ans, late }));
  } catch (e) {
    console.error("run " + game + ":", e.message);
    return fail(e.status === 401 ? 401 : 502, e.status === 401 ? e.message : "Couldn’t reach the game. Try again.");
  }
}

/* ── tickets for the games played in the page ───────────────────────────
   One live ticket per game (and the one before it, for a score sent just as a
   new game starts). A score must name one, and fit the time since it was given. */
export const TICKET_GAMES = new Set(["snake", "g2048", "typing", "react", "tetris"]);
export async function issueTicket(me, game) {
  if (!TICKET_GAMES.has(game)) return null;
  const st = (await readRow(me.email, "tickets").catch(() => null)) || {};
  const t = st.t || {}, seed = randomBytes(4).readUInt32BE(0);
  t[game] = { id: rid(), at: now(), seed, prev: t[game] ? { id: t[game].id, at: t[game].at, seed: t[game].seed } : null };
  await writeRow(me.email, "tickets", { seq: 1, t }, null);
  return { id: t[game].id, seed };
}
/* the ticket a score was sent with: how long ago it was given (ms) and its seed, or null when it isn't one of yours */
export async function ticketOf(me, game, id) {
  if (!id) return null;
  const st = await readRow(me.email, "tickets").catch(() => null);
  const t = st && st.t && st.t[game]; if (!t) return null;
  const hit = t.id === id ? t : t.prev && t.prev.id === id ? t.prev : null;
  if (!hit || now() - hit.at > 12 * 3600e3) return null;
  return { age: now() - hit.at, seed: hit.seed == null ? null : hit.seed };
}
/* is this score possible in that time? (generous: a fast player is fine, a pasted number isn't) */
export function scoreFits(game, metric, score, ms) {
  const s = ms / 1000;
  if (game === "snake") return score <= 253 && score <= 4 * s + 5;              // the 16 × 16 board, a fruit at a time
  if (game === "g2048") return score <= 300 * s + 500;
  if (game === "typing") return score <= 250 && s >= 1.5;
  /* three tries, each after a wait of at least 0.9 s, 0.7 s apart: at least about 4 s */
  if (game === "react") return metric === "avg3" ? s >= 4 : s >= 1;
  if (game === "tetris:sprint" || game === "tetris:sprintall") return score <= ms + 3000;   // a clear can't take less time than has passed
  /* Survival and Zen can be saved and carried on another day, so only the ticket is checked */
  return true;
}

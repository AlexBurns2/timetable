// TAS boards. league "fixed": everyone plays the same seed, you send a movie.
// league "bot": you send code. Ask for a seed (POST {action:"tas", op:"seed", cat, league:"bot"}), run your bot on it,
// then send {action:"tas", cat, league:"bot", ticket, movie, code} within SEED_MS. Ranked by score, steps, then lines.
//   GET ?tas=<cat>[&league=bot][&rank=N]
import { randomBytes } from "node:crypto";
import { db, isAdmin } from "./_supabase.js";
import { TAS, SEEDS, SEED_MS, runTas, cleanMovie, codeLines, MAX_MOVIE, STARTER, snakeNew, snakeStep, tetrisNew, tetrisFrame, tetrisGhost } from "../tasengine.js";
import { displayNames, withName } from "./_names.js";
import { limited, slowDown } from "./_limit.js";

const MODE = (cat, lg) => (lg === "bot" ? "run:tasb:" : "run:tas:") + cat;
const MAX_CODE = 20000;
// anyone can watch a run, but only its owner gets the moves (or the code); a watcher gets them scrambled
const scramble = m => Buffer.from(m).map((c, i) => c ^ ((i * 131 + 7) & 255)).toString("base64");
const better = (a, b) => !b || a.score > b.score || (a.score === b.score && (a.frames < b.frames || (a.frames === b.frames && (a.lines || 0) < (b.lines || 0))));

/* ── Someone else's run sent as your own (the owner, 27 November 2026: anyone could download a run off the board with
   ?rank=N and send it back). Runs are compared by what they do in the game, not by their letters, so padding a copy
   with inputs that change nothing doesn't hide it: Snake the way it heads each step, 2048 its moves, Tetris where each
   piece lands (and each hold), each up to the last point that scored. A run whose start is at least half of someone
   else's run is theirs. Your own earlier run explains it, though: if you had that much of it first, it's yours (so
   improving your own run still works when someone has copied it). Bots: code that's mostly someone else's code (names
   changed or not), unless it's mostly a starter bot. ── */
function trace(cat, movie, seed) {
  const m = cleanMovie(movie), out = [];
  let at = 0;
  if (cat === "snake") {
    const g = snakeNew(seed);
    for (let i = 0; i < m.length && !g.dead && !g.full; i++) {
      const had = g.eaten; snakeStep(g, m[i]); out.push(g.dir); if (g.eaten > had) at = out.length;
    }
  } else if (cat === "g2048") {
    const r = runTas(cat, m, seed);                       // every move must move, so the letters are the moves
    return r.ok ? m.slice(0, r.frames).split("") : [];
  } else {
    const g = tetrisNew(seed, 40);
    for (let i = 0; i < m.length && !g.won && !g.over; i++) {
      const c = m[i], p = g.piece;
      const tok = c === "X" ? p.type + p.rot + ":" + p.x + ":" + tetrisGhost(g) : c === "H" && !g.held ? "h" : null;
      const had = g.score;
      if (!tetrisFrame(g, c)) break;
      if (tok) out.push(tok);
      if (g.score > had) at = out.length;
    }
  }
  return out.slice(0, at);
}
const shared = (a, b) => { let i = 0; const n = Math.min(a.length, b.length); while (i < n && a[i] === b[i]) i++; return i; };
const MIN_SHARED = { snake: 40, g2048: 30, tetris: 10 };       // a start this short can be anyone's (the first fruit, an opener)
const copies = (cat, mine, theirs) => { const p = shared(mine, theirs); return p >= MIN_SHARED[cat] && p >= theirs.length * 0.5 ? p : 0; };

/* code, reduced to its shape: comments and spacing gone, every name the same (properties and keywords kept) */
const KEYWORDS = new Set("break case catch class const continue default delete do else false for function if in instanceof let new null of return switch this throw true try typeof undefined var void while".split(" "));
function shape(code) {
  const s = String(code || "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const toks = s.match(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\S/g) || [];
  return toks.map((t, i) => /^[A-Za-z_$]/.test(t) && !KEYWORDS.has(t) && toks[i - 1] !== "." ? "~" : t);
}
function grams(toks, k = 5) { const s = new Set(); for (let i = 0; i + k <= toks.length; i++) s.add(toks.slice(i, i + k).join(" ")); return s; }
function alike(a, b) {                                         // how much of the two shapes is the same (0 to 1)
  if (!a.size || !b.size) return 0;
  let n = 0; for (const g of a) if (b.has(g)) n++;
  return n / (a.size + b.size - n);
}

/* who a run (or a bot) was taken from, or null. old: the sender's own run on this board, if any */
async function takenFrom(cat, lg, me, r, src, seed, old) {
  const { data, error } = await db.from("game_state").select("email, state").eq("mode", MODE(cat, lg)).limit(2000);
  if (error) throw new Error(error.message);
  const since = st => String(st.since || st.at || "");
  if (lg === "bot") {
    const g = grams(shape(src.code)), start = alike(g, grams(shape(STARTER[cat])));
    const own = old && old.code ? alike(g, grams(shape(old.code))) : 0;
    for (const row of data || []) {
      if (row.email === me.email || !row.state || !row.state.code) continue;
      const a = alike(g, grams(shape(row.state.code)));
      if (a < 0.85 || a <= start) continue;                       // not theirs, or the starter
      if (old && own >= a && since(old) <= since(row.state)) continue;
      return row.state;
    }
    return null;
  }
  const tr = trace(cat, src.movie, seed), mineOld = old && old.movie ? trace(cat, old.movie, seed) : null;
  for (const row of data || []) {
    if (row.email === me.email || !row.state || !row.state.movie) continue;
    const p = copies(cat, tr, trace(cat, row.state.movie, seed));
    if (!p) continue;
    /* your own run already had this much of it: your own line of work. A run from before 27 November 2026 has no
       "since", so who had it first can't be told from dates (the one copied may have improved since): your own run
       explains it then, and the moderators sort out the old copies (copiesOn) */
    if (mineOld && shared(tr, mineOld) >= p && (!row.state.since || since(old) <= since(row.state))) continue;
    return row.state;
  }
  return null;
}
/* for moderators: pairs of runs on a board that share most of their start (or bots most of their code), with which was
   sent first. Not a verdict: someone copied may have improved their run since, which makes theirs the later one. */
async function copiesOn(cat, lg) {
  const { data, error } = await db.from("game_state").select("email, state").eq("mode", MODE(cat, lg)).limit(2000);
  if (error) throw new Error(error.message);
  const list = await rows(cat, lg), rank = email => list.findIndex(r => r.email === email) + 1;
  const runs = (data || []).filter(r => r.state && (lg === "bot" ? r.state.code : r.state.movie))
    .map(r => ({ email: r.email, st: r.state, key: lg === "bot" ? grams(shape(r.state.code)) : trace(cat, r.state.movie, SEEDS[cat]) }));
  const start = lg === "bot" ? grams(shape(STARTER[cat])) : null, out = [];
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    const a = runs[i], b = runs[j];
    let same = 0;
    if (lg === "bot") { const s = alike(a.key, b.key); if (s >= 0.85 && s > alike(a.key, start) && s > alike(b.key, start)) same = s; }
    else { const p = shared(a.key, b.key); if (p >= MIN_SHARED[cat] && (p >= a.key.length * 0.5 || p >= b.key.length * 0.5)) same = p / Math.max(1, Math.min(a.key.length, b.key.length)); }
    if (!same) continue;
    const first = String(a.st.at) <= String(b.st.at) ? a : b, then = first === a ? b : a;
    out.push({ first: rank(first.email), then: rank(then.email), same: Math.round(Math.min(1, same) * 100) });
  }
  return out.sort((x, y) => x.first - y.first || x.then - y.then);
}

async function rows(cat, lg) {
  const { data, error } = await db.from("game_state")
    .select("email, score:state->score, frames:state->frames, lines:state->lines, name:state->>name, at:state->>at").eq("mode", MODE(cat, lg)).limit(2000);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ ...r, score: +r.score, frames: +r.frames, lines: r.lines == null ? null : +r.lines }))
    .sort((a, b) => b.score - a.score || a.frames - b.frames || (a.lines || 0) - (b.lines || 0) || String(a.at).localeCompare(String(b.at)));
}

export async function tasBoard(cat, me, lg = "fixed") {
  const [list, names] = await Promise.all([rows(cat, lg), displayNames()]);
  const mine = list.find(r => r.email === me.email);
  return {
    cat, league: lg, ...TAS[cat], seed: lg === "bot" ? null : SEEDS[cat], seedMs: SEED_MS,
    top: list.slice(0, 100).map((r, i) => ({ rank: i + 1, name: withName(names, r.email, r.name), score: r.score, frames: r.frames, lines: r.lines, you: r.email === me.email })),
    mine: mine ? { rank: list.indexOf(mine) + 1, score: mine.score, frames: mine.frames } : null,
    canEdit: isAdmin(me.email)
  };
}

export async function tasHandler(req, res, me, src, name) {
  const cat = String(src.cat || src.tas || ""), lg = src.league === "bot" ? "bot" : "fixed";
  if (!TAS[cat]) return res.status(400).json({ error: "Unknown TAS board." });
  const at = rank => rows(cat, lg).then(list => list[parseInt(rank, 10) - 1]);

  if (req.method === "GET" && src.copies) {
    if (!isAdmin(me.email)) return res.status(403).json({ error: "Only moderators can look for copies." });
    return res.status(200).json({ cat, league: lg, copies: await copiesOn(cat, lg) });
  }
  if (req.method === "GET") {
    if (src.rank == null) return res.status(200).json(await tasBoard(cat, me, lg));
    const row = await at(src.rank);
    if (!row) return res.status(404).json({ error: "No run there." });
    const { data } = await db.from("game_state").select("state").eq("email", row.email).eq("mode", MODE(cat, lg)).maybeSingle();
    if (!data || !data.state || !data.state.movie) return res.status(404).json({ error: "No run there." });
    const own = row.email === me.email || isAdmin(me.email), m = cleanMovie(data.state.movie);
    return res.status(200).json({ cat, league: lg, rank: +src.rank, score: row.score, frames: row.frames, lines: row.lines,
      seed: data.state.seed == null ? SEEDS[cat] : data.state.seed, own,
      ...(own ? { movie: m, code: data.state.code || null } : { watch: scramble(m) }) });
  }

  if (src.op === "delete") {
    if (!isAdmin(me.email)) return res.status(403).json({ error: "Only moderators can take a run down." });
    const row = await at(src.rank);
    if (!row) return res.status(404).json({ error: "No run there." });
    await db.from("game_state").delete().eq("email", row.email).eq("mode", MODE(cat, lg));
    return res.status(200).json(await tasBoard(cat, me, lg));
  }

  const seeds = async () => { const { data } = await db.from("game_state").select("state").eq("email", me.email).eq("mode", "run:tasseed").maybeSingle(); return (data && data.state) || {}; };
  const keep = st => db.from("game_state").upsert({ email: me.email, mode: "run:tasseed", state: st, updated_at: new Date().toISOString() });

  if (src.op === "seed") {
    if (limited("tasseed:" + me.email, 10, 60000)) return slowDown(res);
    const st = await seeds(), seed = randomBytes(4).readUInt32BE(0), ticket = randomBytes(6).toString("hex");
    st[cat] = { ticket, seed, at: Date.now() };
    const { error } = await keep(st);
    if (error) { console.error("tas seed:", error.message); return res.status(502).json({ error: "Couldn't hand out a seed." }); }
    return res.status(200).json({ cat, seed, ticket, ms: SEED_MS });
  }

  if (limited("tas:" + me.email, 30, 60000)) return slowDown(res);
  if (typeof src.movie !== "string" || src.movie.length > MAX_MOVIE * 4) return res.status(400).json({ error: "Send the movie as text." });
  let seed = SEEDS[cat], ms = null, lines = null;
  if (lg === "bot") {
    if (typeof src.code !== "string" || !src.code.trim() || src.code.length > MAX_CODE) return res.status(400).json({ error: "Send your bot's code with the run (up to " + MAX_CODE + " characters)." });
    lines = codeLines(src.code);
    const st = await seeds(), t = st[cat];
    if (!t || t.ticket !== src.ticket) return res.status(400).json({ error: "That seed isn't yours any more. Get a new one." });
    ms = Date.now() - t.at;
    delete st[cat]; await keep(st);
    if (ms > SEED_MS + 5000) return res.status(400).json({ error: "Too slow: runs on a random seed have to come back within " + SEED_MS / 60000 + " minutes." });
    seed = t.seed;
  }
  const r = runTas(cat, src.movie, seed);
  if (!r.ok) return res.status(400).json({ error: "That run doesn't work: " + r.why + ".", why: r.why });
  r.ms = ms; r.lines = lines;

  const { data } = await db.from("game_state").select("state").eq("email", me.email).eq("mode", MODE(cat, lg)).maybeSingle();
  const old = data && data.state, improved = better(r, old);
  if (improved) {
    /* someone else's run (or bot) sent as yours: refused, and nothing of yours changes */
    const from = await takenFrom(cat, lg, me, r, src, seed, old);
    if (from) return res.status(409).json({ error: lg === "bot"
      ? "That bot is mostly " + (from.name || "someone else") + "'s code. Send one you wrote."
      : "That run is mostly " + (from.name || "someone else") + "'s run. Send one of your own.", copy: true });
    const now = new Date().toISOString();
    /* since: when this line of your own work began (a better run built on your last keeps its date), so a copy of an
       older run of yours never counts as earlier than you */
    const ownLine = !old ? false : lg === "bot"
      ? !!old.code && alike(grams(shape(src.code)), grams(shape(old.code))) >= 0.85
      : !!old.movie && (() => { const a = trace(cat, src.movie, seed), b = trace(cat, old.movie, seed); return shared(a, b) >= Math.max(MIN_SHARED[cat], b.length * 0.5); })();
    const since = ownLine ? old.since || old.at : now;
    const { error } = await db.from("game_state").upsert({ email: me.email, mode: MODE(cat, lg),
      state: { movie: cleanMovie(src.movie), score: r.score, frames: r.frames, ms, lines, code: lg === "bot" ? src.code : undefined, seed: lg === "bot" ? seed : null, name, at: now, since }, updated_at: now });
    if (error) { console.error("tas:", error.message); return res.status(502).json({ error: "Couldn't save your run." }); }
  }
  return res.status(200).json({ ok: true, score: r.score, frames: r.frames, lines, ms, improved,
    best: improved ? { score: r.score, frames: r.frames, lines } : { score: old.score, frames: old.frames, lines: old.lines }, board: await tasBoard(cat, me, lg) });
}

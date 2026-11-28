// TAS boards. league "fixed": everyone plays the same seed, you send a movie.
// league "bot": you send code. Ask for a seed (POST {action:"tas", op:"seed", cat, league:"bot"}), run your bot on it,
// then send {action:"tas", cat, league:"bot", ticket, movie, code} within SEED_MS. Ranked by score, steps, then lines.
//   GET ?tas=<cat>[&league=bot][&rank=N]
import { randomBytes } from "node:crypto";
import { db, isAdmin } from "./_supabase.js";
import { TAS, SEEDS, SEED_MS, runTas, cleanMovie, codeLines, MAX_MOVIE } from "../tasengine.js";
import { displayNames, withName } from "./_names.js";
import { limited, slowDown } from "./_limit.js";

const MODE = (cat, lg) => (lg === "bot" ? "run:tasb:" : "run:tas:") + cat;
const MAX_CODE = 20000;
// anyone can watch a run, but only its owner gets the moves (or the code); a watcher gets them scrambled
const scramble = m => Buffer.from(m).map((c, i) => c ^ ((i * 131 + 7) & 255)).toString("base64");
const plainCode = c => String(c || "").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
const sharedStart = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const better = (a, b) => !b || a.score > b.score || (a.score === b.score && (a.frames < b.frames || (a.frames === b.frames && (a.lines || 0) < (b.lines || 0))));

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
  /* no passing off someone else's run (or a run built on it), or someone else's bot */
  const { data: rivals } = await db.from("game_state").select("email, movie:state->>movie, code:state->>code").eq("mode", MODE(cat, lg)).neq("email", me.email).limit(2000);
  const mine = cleanMovie(src.movie), myCode = plainCode(src.code);
  for (const o of rivals || []) {
    if (lg === "bot" && o.code && plainCode(o.code) === myCode) return res.status(400).json({ error: "That's someone else's bot." });
    if (lg === "fixed" && o.movie) {
      const same = sharedStart(mine, cleanMovie(o.movie));
      if (same >= Math.min(mine.length, 200) && same >= mine.length / 4) return res.status(400).json({ error: "That run starts the same as someone else's. Make your own." });
    }
  }
  r.ms = ms; r.lines = lines;

  const { data } = await db.from("game_state").select("state").eq("email", me.email).eq("mode", MODE(cat, lg)).maybeSingle();
  const old = data && data.state, improved = better(r, old);
  if (improved) {
    const now = new Date().toISOString();
    const { error } = await db.from("game_state").upsert({ email: me.email, mode: MODE(cat, lg),
      state: { movie: cleanMovie(src.movie), score: r.score, frames: r.frames, ms, lines, code: lg === "bot" ? src.code : undefined, seed: lg === "bot" ? seed : null, name, at: now }, updated_at: now });
    if (error) { console.error("tas:", error.message); return res.status(502).json({ error: "Couldn't save your run." }); }
  }
  return res.status(200).json({ ok: true, score: r.score, frames: r.frames, lines, ms, improved,
    best: improved ? { score: r.score, frames: r.frames, lines } : { score: old.score, frames: old.frames, lines: old.lines }, board: await tasBoard(cat, me, lg) });
}

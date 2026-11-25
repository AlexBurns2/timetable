// Tool-assisted runs: send a movie (one input per frame), the server plays it back with the
// fixed seed and ranks it by frames. Bots welcome. Served by /api/leaderboard.
//   GET  ?tas=<cat>                   the board
//   GET  ?tas=<cat>&rank=N            that run's movie
//   POST {action:"tas", cat, movie}   send a run
import { db, isAdmin } from "./_supabase.js";
import { TAS, SEEDS, runTas, cleanMovie, MAX_MOVIE } from "../tasengine.js";
import { displayNames, withName } from "./_names.js";
import { limited, slowDown } from "./_limit.js";

const MODE = cat => "run:tas:" + cat;

async function rows(cat) {
  const c = TAS[cat];
  const { data, error } = await db.from("game_score").select("name, email, score, updated_at")
    .eq("game", c.game).eq("metric", c.metric).eq("period", "all")
    .order("score", { ascending: true }).order("updated_at", { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function tasBoard(cat, me) {
  const [list, names] = await Promise.all([rows(cat), displayNames()]);
  const mine = list.find(r => r.email === me.email);
  return {
    cat, ...TAS[cat], seed: SEEDS[TAS[cat].game],
    top: list.map((r, i) => ({ rank: i + 1, name: withName(names, r.email, r.name), frames: r.score, at: r.updated_at, you: r.email === me.email })),
    meBest: mine ? mine.score : null, canEdit: isAdmin(me.email)
  };
}

export async function tasHandler(req, res, me, src, name) {
  const cat = String(src.cat || src.tas || "");
  if (!TAS[cat]) return res.status(400).json({ error: "Unknown TAS category." });

  if (req.method === "GET") {
    if (src.rank == null) return res.status(200).json(await tasBoard(cat, me));
    const list = await rows(cat), row = list[parseInt(src.rank, 10) - 1];
    if (!row) return res.status(404).json({ error: "No run at that place." });
    const { data } = await db.from("game_state").select("state").eq("email", row.email).eq("mode", MODE(cat)).maybeSingle();
    if (!data || !data.state || !data.state.movie) return res.status(404).json({ error: "That run's movie wasn't kept." });
    return res.status(200).json({ cat, rank: +src.rank, frames: row.score, movie: data.state.movie });
  }

  if (src.op === "delete") {
    if (!isAdmin(me.email)) return res.status(403).json({ error: "Only moderators can take a run down." });
    const list = await rows(cat), row = list[parseInt(src.rank, 10) - 1];
    if (!row) return res.status(404).json({ error: "No run at that place." });
    const c = TAS[cat];
    await db.from("game_score").delete().eq("game", c.game).eq("metric", c.metric).eq("period", "all").eq("email", row.email);
    await db.from("game_state").delete().eq("email", row.email).eq("mode", MODE(cat));
    return res.status(200).json(await tasBoard(cat, me));
  }

  if (limited("tas:" + me.email, 30, 60000)) return slowDown(res);
  if (typeof src.movie !== "string" || src.movie.length > MAX_MOVIE * 4) return res.status(400).json({ error: "Send the movie as text." });
  const r = runTas(cat, src.movie);
  if (!r.ok) return res.status(400).json({ error: "That run doesn't finish: " + r.why + ".", why: r.why });

  const c = TAS[cat], at = new Date().toISOString();
  const { data: ex } = await db.from("game_score").select("score")
    .eq("game", c.game).eq("metric", c.metric).eq("period", "all").eq("email", me.email).maybeSingle();
  const improved = !ex || r.frames < ex.score;
  if (improved) {
    const { error } = await db.from("game_state").upsert({ email: me.email, mode: MODE(cat), state: { movie: cleanMovie(src.movie), frames: r.frames, at }, updated_at: at });
    if (error) { console.error("tas movie:", error.message); return res.status(502).json({ error: "Couldn't save your run." }); }
    const { error: e2 } = await db.from("game_score").upsert({ game: c.game, metric: c.metric, period: "all", email: me.email, name, score: r.frames, updated_at: at });
    if (e2) { console.error("tas score:", e2.message); return res.status(502).json({ error: "Couldn't save your run." }); }
  }
  return res.status(200).json({ ok: true, frames: r.frames, improved, best: improved ? r.frames : ex.score, board: await tasBoard(cat, me) });
}

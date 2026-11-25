// TAS boards: GET ?tas=<cat>, GET ?tas=<cat>&rank=N for a movie, POST {action:"tas", cat, movie}
import { db, isAdmin } from "./_supabase.js";
import { TAS, SEEDS, runTas, cleanMovie, MAX_MOVIE } from "../tasengine.js";
import { displayNames, withName } from "./_names.js";
import { limited, slowDown } from "./_limit.js";

const MODE = cat => "run:tas:" + cat;
const better = (a, b) => !b || a.score > b.score || (a.score === b.score && a.frames < b.frames);

async function rows(cat) {
  const { data, error } = await db.from("game_state")
    .select("email, score:state->score, frames:state->frames, name:state->>name, at:state->>at").eq("mode", MODE(cat)).limit(2000);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ ...r, score: +r.score, frames: +r.frames }))
    .sort((a, b) => b.score - a.score || a.frames - b.frames || String(a.at).localeCompare(String(b.at)));
}

export async function tasBoard(cat, me) {
  const [list, names] = await Promise.all([rows(cat), displayNames()]);
  const mine = list.find(r => r.email === me.email);
  return {
    cat, ...TAS[cat], seed: SEEDS[cat],
    top: list.slice(0, 100).map((r, i) => ({ rank: i + 1, name: withName(names, r.email, r.name), score: r.score, frames: r.frames, you: r.email === me.email })),
    mine: mine ? { rank: list.indexOf(mine) + 1, score: mine.score, frames: mine.frames } : null,
    canEdit: isAdmin(me.email)
  };
}

export async function tasHandler(req, res, me, src, name) {
  const cat = String(src.cat || src.tas || "");
  if (!TAS[cat]) return res.status(400).json({ error: "Unknown TAS board." });
  const at = rank => rows(cat).then(list => list[parseInt(rank, 10) - 1]);

  if (req.method === "GET") {
    if (src.rank == null) return res.status(200).json(await tasBoard(cat, me));
    const row = await at(src.rank);
    if (!row) return res.status(404).json({ error: "No run there." });
    const { data } = await db.from("game_state").select("state").eq("email", row.email).eq("mode", MODE(cat)).maybeSingle();
    if (!data || !data.state || !data.state.movie) return res.status(404).json({ error: "No run there." });
    return res.status(200).json({ cat, rank: +src.rank, score: row.score, frames: row.frames, movie: data.state.movie });
  }

  if (src.op === "delete") {
    if (!isAdmin(me.email)) return res.status(403).json({ error: "Only moderators can take a run down." });
    const row = await at(src.rank);
    if (!row) return res.status(404).json({ error: "No run there." });
    await db.from("game_state").delete().eq("email", row.email).eq("mode", MODE(cat));
    return res.status(200).json(await tasBoard(cat, me));
  }

  if (limited("tas:" + me.email, 30, 60000)) return slowDown(res);
  if (typeof src.movie !== "string" || src.movie.length > MAX_MOVIE * 4) return res.status(400).json({ error: "Send the movie as text." });
  const r = runTas(cat, src.movie);
  if (!r.ok) return res.status(400).json({ error: "That run doesn't work: " + r.why + ".", why: r.why });

  const { data } = await db.from("game_state").select("state").eq("email", me.email).eq("mode", MODE(cat)).maybeSingle();
  const old = data && data.state, improved = better(r, old);
  if (improved) {
    const now = new Date().toISOString();
    const { error } = await db.from("game_state").upsert({ email: me.email, mode: MODE(cat),
      state: { movie: cleanMovie(src.movie), score: r.score, frames: r.frames, name, at: now }, updated_at: now });
    if (error) { console.error("tas:", error.message); return res.status(502).json({ error: "Couldn't save your run." }); }
  }
  return res.status(200).json({ ok: true, score: r.score, frames: r.frames, improved,
    best: improved ? { score: r.score, frames: r.frames } : { score: old.score, frames: old.frames }, board: await tasBoard(cat, me) });
}

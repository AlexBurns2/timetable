// Held scores, one game_state row per person and board ("run:flag:<board>"). Alex clears them.
import { db } from "./_supabase.js";

const MODE = key => "run:flag:" + key;
const better = (dir, a, b) => b == null || (dir === "min" ? a < b : a > b);

export async function holdScore(email, name, e) {
  const mode = MODE(e.key);
  const { data } = await db.from("game_state").select("state").eq("email", email).eq("mode", mode).maybeSingle();
  const old = data && data.state;
  const fresh = !old || better(e.dir, e.score, old.score), sameWeek = !!old && old.week === e.week;
  const keep = fresh ? { ...e } : { ...old };
  keep.name = name;
  const seen = [...(old && old.why || []), ...(old && old.also || []), ...e.why];
  keep.also = [...new Set(seen)].filter(w => !keep.why.includes(w)).slice(0, 12);
  if (sameWeek) keep.boards = [...new Set([...(old.boards || []), ...(e.boards || [])])];
  keep.tries = (old ? old.tries || 1 : 0) + 1;
  keep.at = new Date().toISOString();
  const { error } = await db.from("game_state").upsert({ email, mode, state: keep, updated_at: keep.at });
  if (error) throw new Error(error.message);
}

export async function heldList() {
  const { data, error } = await db.from("game_state").select("email, state, updated_at").like("mode", "run:flag:%")
    .order("updated_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ email: r.email, ...r.state }));
}

export async function takeHeld(email, key) {
  const mode = MODE(key);
  const { data } = await db.from("game_state").select("state").eq("email", email).eq("mode", mode).maybeSingle();
  if (!data) return null;
  await db.from("game_state").delete().eq("email", email).eq("mode", mode);
  return data.state;
}

const TT = {
  sprint:    { t: "tetris_score", col: "time_ms", dir: "min", week: true },
  sprintall: { t: "sprint_best",  col: "time_ms", dir: "min" },
  zen:       { t: "zen_score",    col: "ms",      dir: "max" }
};

export async function writeTetris(email, name, board, value, week) {
  if (board === "zenscore") {
    const { data: ex } = await db.from("zen_board").select("best").eq("email", email).maybeSingle();
    const { error } = await db.from("zen_board").upsert({ email, name, current: value, best: Math.max(value, ex ? ex.best : 0), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return;
  }
  const b = TT[board];
  if (!b) return;
  let q = db.from(b.t).select(b.col).eq("email", email);
  if (b.week) q = q.eq("week", week);
  const { data: ex } = await q.maybeSingle();
  if (!better(b.dir, value, ex ? ex[b.col] : null)) return;
  const row = { email, name, [b.col]: value };
  if (b.week) row.week = week;
  const { error } = await db.from(b.t).upsert(row);
  if (error) throw new Error(error.message);
}

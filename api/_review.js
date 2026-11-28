// Scores that didn't check out. They still go on the boards; each one is flagged here (one game_state row per
// person and board, "run:flag:<board>", keeping the best) and Alex gets a notice to look. He keeps it or takes it off.
import { db, REVIEWER } from "./_supabase.js";
import { tell } from "./_notice.js";

const MODE = key => "run:flag:" + key;
const better = (dir, a, b) => b == null || (dir === "min" ? a < b : a > b);

export async function flagScore(email, name, e, label) {
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
  if (fresh) await tell(REVIEWER, name + "'s " + (label || e.key) + " score of " + e.score + " is on the board but didn't check out: " + e.why.join("; ") +
    ". Keep it or take it off on the moderator page, under Flagged scores.", "Flagged score").catch(() => {});
}

export async function flaggedList() {
  const { data, error } = await db.from("game_state").select("email, state, updated_at").like("mode", "run:flag:%")
    .order("updated_at", { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ email: r.email, ...r.state }));
}

export async function takeFlag(email, key) {
  const mode = MODE(key);
  const { data } = await db.from("game_state").select("state").eq("email", email).eq("mode", mode).maybeSingle();
  if (!data) return null;
  await db.from("game_state").delete().eq("email", email).eq("mode", mode);
  return data.state;
}

const TT = {
  sprint:    { t: "tetris_score", col: "time_ms", dir: "min", week: true },
  sprintall: { t: "sprint_best",  col: "time_ms", dir: "min" },
  zen:       { t: "zen_score",    col: "ms",      dir: "max" },
  zenscore:  { t: "zen_board",    col: "best",    dir: "max" }
};

// takes a flagged score off the boards it went on, as long as it's still the one there
export async function removeFlagged(email, f) {
  for (const b of f.boards || []) {
    if (f.kind === "t") {
      const t = TT[b]; if (!t) continue;
      let q = db.from(t.t).delete().eq("email", email).eq(t.col, f.score);
      if (t.week) q = q.eq("week", f.week);
      await q;
    } else await db.from("game_score").delete().eq("game", f.game).eq("metric", f.metric).eq("period", b).eq("email", email).eq("score", f.score);
  }
}

export async function writeTetris(email, name, board, value, week) {
  if (board === "zenscore") {
    const { data: ex } = await db.from("zen_board").select("best").eq("email", email).maybeSingle();
    const { error } = await db.from("zen_board").upsert({ email, name, current: value, best: Math.max(value, ex ? ex.best : 0), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return !ex || value > ex.best;
  }
  const b = TT[board];
  if (!b) return false;
  let q = db.from(b.t).select(b.col).eq("email", email);
  if (b.week) q = q.eq("week", week);
  const { data: ex } = await q.maybeSingle();
  if (!better(b.dir, value, ex ? ex[b.col] : null)) return false;
  const row = { email, name, [b.col]: value };
  if (b.week) row.week = week;
  const { error } = await db.from(b.t).upsert(row);
  if (error) throw new Error(error.message);
  return true;
}

// Flagged scores, one game_state row per person and board.
// Since 27 November 2026 (the owner: "let runs through by default and still send a ping, and the moderators decide
// whether to keep it or remove it afterwards") a flagged score goes on the boards at once and leaves a note here
// ("run:seen:<board>") with what each board showed before it. A moderator keeps it (the note goes) or removes it (each
// board goes back to what it showed before, but only where the flagged score is still the one there: a better score
// sent since is never touched). The older held scores ("run:flag:<board>", kept off the boards until let on) still
// list and clear as before; nothing new is held that way.
import { db } from "./_supabase.js";

const MODE = key => "run:flag:" + key;
const SEEN = key => "run:seen:" + key;
const better = (dir, a, b) => b == null || (dir === "min" ? a < b : a > b);
const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);

/* a flagged score that has gone on the boards. changed: { board: what it showed before } for the boards it changed;
   on: { board: what it shows now }. Several flagged runs in a row keep the board's value from before the first, unless
   something else changed the board in between (then that's what a removal goes back to). */
export async function noteFlag(email, name, e, changed, on) {
  if (!Object.keys(changed).length) return;               // it beat nothing: nothing on a board to keep or remove
  const mode = SEEN(e.key);
  const { data } = await db.from("game_state").select("state").eq("email", email).eq("mode", mode).maybeSingle();
  const old = data && data.state;
  const prev = { ...(old && old.prev || {}) }, now = { ...(old && old.on || {}) };
  for (const [b, before] of Object.entries(changed)) {
    if (!(old && b in prev && same(before, now[b]))) prev[b] = before;
    now[b] = on[b];
  }
  const fresh = !old || better(e.dir, e.score, old.score);
  const keep = fresh ? { ...e } : { ...old };
  keep.live = true; keep.name = name; keep.prev = prev; keep.on = now;
  keep.boards = Object.keys(now);
  const seen = [...(old && old.why || []), ...(old && old.also || []), ...e.why];
  keep.also = [...new Set(seen)].filter(w => !keep.why.includes(w)).slice(0, 12);
  keep.tries = (old ? old.tries || 1 : 0) + 1;
  keep.at = new Date().toISOString();
  const { error } = await db.from("game_state").upsert({ email, mode, state: keep, updated_at: keep.at });
  if (error) throw new Error(error.message);
}

/* how many are waiting for a moderator (the ping on the Moderator button) */
export async function flagCount() {
  const n = async p => { const { count } = await db.from("game_state").select("email", { count: "exact", head: true }).like("mode", p); return count || 0; };
  const [a, b] = await Promise.all([n("run:seen:%"), n("run:flag:%")]);
  return a + b;
}

/* a moderator's answer to a flagged score that's on the boards: "keep" drops the note; "remove" puts each board back.
   board(b) reads what a board shows now; put(b, v) sets it (v null: no entry). */
export async function settleFlag(email, key, op, board, put) {
  const mode = SEEN(key);
  const { data } = await db.from("game_state").select("state").eq("email", email).eq("mode", mode).maybeSingle();
  if (!data) return null;
  const st = data.state || {};
  if (op === "remove") {
    for (const b of Object.keys(st.on || {})) {
      if (!same(await board(st, b), st.on[b])) continue;    // changed since: leave it
      await put(st, b, st.prev ? st.prev[b] : null);
    }
  }
  await db.from("game_state").delete().eq("email", email).eq("mode", mode);
  return st;
}

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
  const q = p => db.from("game_state").select("email, state, updated_at").like("mode", p).order("updated_at", { ascending: false }).limit(300);
  const [a, b] = await Promise.all([q("run:seen:%"), q("run:flag:%")]);
  if (a.error || b.error) throw new Error((a.error || b.error).message);
  return [...(a.data || []), ...(b.data || [])].sort((x, y) => String(y.updated_at).localeCompare(String(x.updated_at)))
    .map(r => ({ email: r.email, ...r.state }));
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

/* writes a Tetris score where it beats what's there; says what the board showed before and after
   (Zen: { current, best }, the others: the time), for a flagged score's note */
export async function writeTetris(email, name, board, value, week) {
  if (board === "zenscore") {
    const { data: ex } = await db.from("zen_board").select("current, best").eq("email", email).maybeSingle();
    const after = { current: value, best: Math.max(value, ex ? ex.best : 0) };
    const { error } = await db.from("zen_board").upsert({ email, name, ...after, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { wrote: true, before: ex ? { current: ex.current, best: ex.best } : null, after };
  }
  const b = TT[board];
  if (!b) return { wrote: false };
  let q = db.from(b.t).select(b.col).eq("email", email);
  if (b.week) q = q.eq("week", week);
  const { data: ex } = await q.maybeSingle();
  const before = ex ? ex[b.col] : null;
  if (!better(b.dir, value, before)) return { wrote: false, before };
  const row = { email, name, [b.col]: value };
  if (b.week) row.week = week;
  const { error } = await db.from(b.t).upsert(row);
  if (error) throw new Error(error.message);
  return { wrote: true, before, after: value };
}
/* what a Tetris board shows for one person now, and putting it back (v null: no entry), for removing a flagged score */
export async function tetrisNow(email, st, board) {
  if (board === "zenscore") {
    const { data } = await db.from("zen_board").select("current, best").eq("email", email).maybeSingle();
    return data ? { current: data.current, best: data.best } : null;
  }
  const b = TT[board]; if (!b) return undefined;
  let q = db.from(b.t).select(b.col).eq("email", email);
  if (b.week) q = q.eq("week", st.week);
  const { data } = await q.maybeSingle();
  return data ? data[b.col] : null;
}
export async function tetrisPut(email, st, board, v) {
  if (board === "zenscore") {
    const { error } = v == null ? await db.from("zen_board").delete().eq("email", email)
      : await db.from("zen_board").upsert({ email, name: st.name, current: v.current, best: v.best, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return;
  }
  const b = TT[board]; if (!b) return;
  if (v == null) {
    let q = db.from(b.t).delete().eq("email", email);
    if (b.week) q = q.eq("week", st.week);
    const { error } = await q; if (error) throw new Error(error.message);
    return;
  }
  const row = { email, name: st.name, [b.col]: v };
  if (b.week) row.week = st.week;
  const { error } = await db.from(b.t).upsert(row);
  if (error) throw new Error(error.message);
}

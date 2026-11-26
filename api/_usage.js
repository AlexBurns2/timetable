// A daily time limit for one person who asked for it. Kept as a hash, not an email, since the repo is public.
import { createHash } from "node:crypto";
import { db } from "./_supabase.js";

const LIMITS = new Map([
  ["0000000000000000000000000000000000000000000000000000000000000000", 10]       // minutes a day
]);
const hash = email => createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());

export const limitFor = email => LIMITS.get(hash(email)) || 0;

// how much of today's time is used; a tick adds the time since the last one (pages tick every 30 s while on screen)
export async function usage(email, tick) {
  const minutes = limitFor(email);
  if (!minutes) return null;
  const { data } = await db.from("game_state").select("state").eq("email", email).eq("mode", "run:usage").maybeSingle();
  let st = data && data.state;
  if (!st || st.day !== today()) st = { day: today(), ms: 0, last: 0 };
  if (tick) {
    const now = Date.now(), gap = now - (st.last || 0);
    st.ms += gap >= 0 && gap <= 45000 ? gap : 30000;
    st.last = now;
    await db.from("game_state").upsert({ email, mode: "run:usage", state: st, updated_at: new Date().toISOString() });
  }
  return { minutes, used: Math.round(st.ms / 1000), locked: st.ms >= minutes * 60000 };
}

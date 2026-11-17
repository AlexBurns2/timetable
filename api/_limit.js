/*
 * Small guards shared by the routes. Private module (the underscore keeps
 * Vercel from making it a route).
 *
 *   limited(key, max, windowMs)   true when `key` has already done this `max`
 *                                 times in the last `windowMs`. Counted in
 *                                 memory, per server instance: a brake on
 *                                 floods and scripts, not an exact quota (two
 *                                 instances each keep their own count, and a
 *                                 fresh one starts at zero). Limits are set
 *                                 well above what a person does by hand.
 *   crossSite(req)                true when a browser says the request came
 *                                 from a page on another site. The routes that
 *                                 need no sign-in refuse those, so no other
 *                                 website can drive them from a visitor's
 *                                 browser. (Signed-in routes need the school
 *                                 login in headers, which another site cannot
 *                                 send, so they are safe from this already.)
 *   safeEqual(a, b)               compares two secrets without leaking how
 *                                 much of them matched through timing.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { clientIp } from "./timetable.js";

const hits = new Map();                  // key -> [times]
export function limited(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now);
  if (hits.size >= 20000) hits.clear();  // never grow without bound
  hits.set(key, list);
  return false;
}
/* the usual answer when someone is over a limit */
export const slowDown = res => res.status(429).json({ error: "That's a lot at once. Wait a minute and try again." });
export const ipOf = req => clientIp(req) || "unknown";

export function crossSite(req) {
  const h = (req && req.headers) || {};
  const site = String(h["sec-fetch-site"] || "").toLowerCase();
  if (site) return site === "cross-site";
  const origin = String(h.origin || "");
  if (!origin || origin === "null") return origin === "null";
  try { return new URL(origin).host.toLowerCase() !== String(h["x-forwarded-host"] || h.host || "").toLowerCase(); }
  catch { return true; }
}

export function safeEqual(a, b) {
  const x = createHash("sha256").update(String(a)).digest(), y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y);
}

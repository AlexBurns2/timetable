/*
 * Shared server-side Supabase helper. Files in /api whose name starts with an
 * underscore are NOT turned into routes by Vercel, so this is a private module.
 *
 * Two things live here:
 *   db         a Supabase client built with the SERVICE ROLE key. It bypasses
 *              row-level security, so it must never be imported into anything
 *              that ships to the browser. Only /api/* code may touch it.
 *   whoami()   proves who the caller is. There is no separate app login: the
 *              browser sends the same school credentials it uses for the
 *              timetable, we authenticate them against the school API, and the
 *              email in the resulting JWT becomes the verified identity. A
 *              valid token is proof the caller owns that address.
 *
 * Environment variables (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL                 https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    the service_role secret (NOT the anon key)
 * Both come from Supabase → Project Settings → API.
 */

import { createClient } from "@supabase/supabase-js";
import { getToken, decodeJwtPayload, normaliseEmail } from "./timetable.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/* Null when the env vars aren't set yet, so routes can return a clean
   "not configured" instead of throwing at import time. */
export const db = (SUPABASE_URL && SERVICE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

/*
 * Returns { email, year, groups } for a verified caller, or null when the
 * credentials are missing or the school rejects them.
 *   email   the address from the JWT (lowercased) — the primary key everywhere
 *   year    e.g. "11", parsed from a group like "yr11"; null for staff/unknown
 *   groups  the raw group list from the token
 */
export async function whoami(req) {
  const rawEmail = req.headers["x-school-email"];
  const password = req.headers["x-school-password"];
  if (!rawEmail || !password) return null;

  const apiBase = (process.env.SCHOOL_API_BASE || "").replace(/\/+$/, "");
  if (!apiBase) return null;

  const domain = (process.env.EMAIL_DOMAIN ||
                  (process.env.SCHOOL_EMAIL || "").split("@")[1] || "").toLowerCase();
  const emailAddress = normaliseEmail(rawEmail, domain);
  if (!emailAddress) return null;

  try {
    const auth = await getToken(apiBase, emailAddress, String(password));
    const claims = decodeJwtPayload(auth.token) || {};
    const verified = String(claims.emailAddress || emailAddress).toLowerCase();
    const groups = Array.isArray(claims.groups) ? claims.groups : [];
    let year = null;
    for (const g of groups) {
      const m = String(g).match(/^yr\.?\s*(\d{1,2})$/i);
      if (m) { year = m[1]; break; }
    }
    return { email: verified, year, groups };
  } catch {
    return null;   // bad credentials / unreachable → not authenticated
  }
}

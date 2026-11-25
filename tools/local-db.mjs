// Stands in for api/_supabase.js when running tools/local.mjs: an in-memory database and no real login.
const KEYS = { game_score: ["game", "metric", "period", "email"], game_state: ["email", "mode"], tetris_score: ["email", "week"],
  sprint_best: ["email"], zen_score: ["email"], zen_board: ["email"], name_override: ["email"], site_setting: ["key"] };
const tables = {};
const rowsOf = t => tables[t] || (tables[t] = []);
const like = (v, p) => new RegExp("^" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i").test(String(v));

class Query {
  constructor(t) { this.t = t; this.f = []; this.op = "select"; this.ord = []; this.lim = null; this.rg = null; this.one = false; this.head = false; this.cols = "*"; }
  select(cols, o) { if (this.op === "select") this.cols = cols || "*"; if (o && o.head) this.head = true; return this; }
  eq(k, v) { this.f.push(r => String(r[k]) === String(v)); return this; }
  neq(k, v) { this.f.push(r => String(r[k]) !== String(v)); return this; }
  like(k, p) { this.f.push(r => like(r[k], p)); return this; }
  ilike(k, p) { return this.like(k, p); }
  gt(k, v) { this.f.push(r => r[k] > v); return this; }
  gte(k, v) { this.f.push(r => r[k] >= v); return this; }
  lt(k, v) { this.f.push(r => r[k] < v); return this; }
  lte(k, v) { this.f.push(r => r[k] <= v); return this; }
  in(k, vs) { this.f.push(r => vs.map(String).includes(String(r[k]))); return this; }
  is() { return this; }
  not() { return this; }
  or() { return this; }
  order(k, o) { this.ord.push([k, !o || o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rg = [a, b]; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  insert(row) { return this.upsert(row); }
  upsert(row) { this.op = "upsert"; this.data = [].concat(row); return this; }
  update(row) { this.op = "update"; this.data = row; return this; }
  delete() { this.op = "delete"; return this; }
  pick(r) {
    if (!this.cols.includes("->")) return { ...r };
    return Object.fromEntries(this.cols.split(",").map(c => c.trim()).map(c => {
      const [alias, path] = c.includes(":") ? c.split(":") : [c, c], m = /^(\w+)->>?"?([^"]+)"?$/.exec(path);
      return [alias, m ? (r[m[1]] || {})[m[2]] : r[path]];
    }));
  }
  run() {
    const all = rowsOf(this.t), hit = r => this.f.every(f => f(r)), key = KEYS[this.t] || ["id"];
    if (this.op === "upsert") {
      for (const row of this.data) {
        const i = all.findIndex(r => key.every(k => String(r[k]) === String(row[k])));
        const next = { updated_at: new Date().toISOString(), ...(i >= 0 ? all[i] : {}), ...row };
        if (i >= 0) all[i] = next; else all.push(next);
      }
      return { data: null, error: null };
    }
    if (this.op === "delete") { tables[this.t] = all.filter(r => !hit(r)); return { data: null, error: null }; }
    if (this.op === "update") { const h = all.filter(hit); h.forEach(r => Object.assign(r, this.data)); return { data: h, error: null }; }
    let out = all.filter(hit);
    for (const [k, asc] of this.ord.slice().reverse()) out.sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1));
    const count = out.length;
    if (this.rg) out = out.slice(this.rg[0], this.rg[1] + 1);
    if (this.lim != null) out = out.slice(0, this.lim);
    out = out.map(r => this.pick(r));
    if (this.head) return { data: null, count, error: null };
    return this.one ? { data: out[0] || null, error: null } : { data: out, count, error: null };
  }
  then(ok, bad) { try { ok(this.run()); } catch (e) { bad(e); } }
}

export const db = { from: t => new Query(t) };
const ADMINS = new Set(["andre.kwok2@education.nsw.gov.au", "alex.burns6@education.nsw.gov.au"]);
export const isAdmin = email => ADMINS.has(String(email).toLowerCase());
export const REVIEWER = "alex.burns6@education.nsw.gov.au";
export const isReviewer = email => String(email).toLowerCase() === REVIEWER;
export async function whoami(req) {
  let e = String(req.headers["x-school-email"] || "").trim().toLowerCase();
  if (!e) return null;
  if (!e.includes("@")) e += "@education.nsw.gov.au";
  return { email: e, year: null, groups: [] };
}

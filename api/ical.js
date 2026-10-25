import { parseICS } from "./calendar.js";

const ALLOWED_HOSTS = new Set(["calendar.google.com", "www.google.com"]);
const DEV_ORIGINS = new Set(["http://127.0.0.1:3000", "http://localhost:3000"]);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function readUrl(raw) {
  let url;
  try { url = new URL(String(raw || "").trim()); }
  catch { throw Object.assign(new Error("That doesn't look like a web address."), { status:400 }); }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname))
    throw Object.assign(new Error("Only an https address from calendar.google.com is accepted."), { status:400 });
  return url;
}

async function readLimited(response) {
  const size = Number(response.headers.get("content-length"));
  if (Number.isFinite(size) && size > MAX_BYTES)
    throw Object.assign(new Error("That calendar feed is too large to import."), { status:413 });
  const reader = response.body && response.body.getReader();
  if (!reader) throw Object.assign(new Error("Google returned an empty calendar feed."), { status:502 });
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw Object.assign(new Error("That calendar feed is too large to import."), { status:413 });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");
  const origin = String(req.headers.origin || "").toLowerCase();
  if (DEV_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error:"The request body isn't valid JSON." }); }
  }
  let target;
  try { target = readUrl(body && body.url); }
  catch (error) { return res.status(error.status || 400).json({ error:error.message }); }

  try {
    const signal = AbortSignal.timeout(15000);
    let response;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      response = await fetch(target, {
        headers:{ "User-Agent":"msc-unofficial-calendar" },
        redirect:"manual",
        signal
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS)
        return res.status(502).json({ error:"Google redirected the calendar too many times." });
      try { target = readUrl(new URL(location, target).toString()); }
      catch (error) { return res.status(502).json({ error:"Google redirected to an unsupported address." }); }
    }
    if (!response.ok)
      return res.status(502).json({ error:"Google refused that address (" + response.status + "). Check it is the secret iCal address." });
    const text = await readLimited(response);
    if (!/BEGIN:VCALENDAR/i.test(text))
      return res.status(400).json({ error:"That address didn't return a calendar." });
    return res.status(200).json({ events:parseICS(text) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error:error.message });
    console.error("iCal import:", error.message);
    return res.status(502).json({ error:"Couldn't reach Google to read that calendar." });
  }
}

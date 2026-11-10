/*
 * Daily Guess Who engine (Phase 2). Private helper (underscore = not a route).
 *
 * One mystery person per (date, year), chosen ON THE SERVER so everyone in a
 * year sees the same person that day — Wordle-style. The answer never leaves
 * the server: guesses are graded here. The pick is DETERMINISTIC from the date
 * and year, so a lazy first-request and the midnight cron both produce the same
 * person, and an `ignoreDuplicates` upsert means whoever writes first wins.
 *
 * Scope is the player's own year only — the same footing as the practice game's
 * "My grade" mode. A whole-school daily would name strangers.
 *
 * Tables:
 *   daily_puzzle(date, year, target jsonb, candidates jsonb, created_at, pk(date,year))
 *   daily_result(email, date, year, guesses, won, done, updated_at, pk(email,date))
 */

import { fetchAsOwner } from "./timetable.js";

/* current date in Sydney as YYYY-MM-DD (the puzzle rolls over at local midnight) */
export function sydneyDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);
}

/* stable 32-bit hash (FNV-1a) — the deterministic seed for the daily pick */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const cap = s => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;

/* mirror the client's name/year extraction so pools line up */
function personName(r) {
  const full  = r.FullName || r.fullName || r.Name || r.name || "";
  const first = r.FirstName || r.firstName || r.firstname || r.GivenName || r.preferredName || "";
  const last  = r.LastName || r.lastName || r.lastname || r.Surname || r.surname || "";
  const mail  = r.Email || r.email || r.emailAddress || "";
  const nm = full || [first, last].filter(Boolean).join(" ");
  if (nm) return String(nm).trim();
  if (mail) { const p = String(mail).split("@")[0].split("."); if (p.length >= 2) return cap(p[0]) + " " + cap(p[1].replace(/\d+$/, "")); }
  return "";
}
/* year lives in the `groups` array as "yr11" on the real directory, not in a
   Year/Form field — check the named fields first, then fall back to groups */
function yearOf(r) {
  const direct = String(
    r.year || r.Year || r.grade || r.Grade || r.yearGroup || r.YearGroup ||
    r.form || r.Form || r.rollClass || r.RollClass || r.RollGroup || r.rollGroup ||
    r.cohort || r.Cohort || r.stage || r.Stage || ""
  ).replace(/\D/g, "");
  if (direct) return direct;
  const groups = r.groups || r.Groups || [];
  for (const g of (Array.isArray(groups) ? groups : [])) {
    const m = String(g).match(/(?:yr|year)\.?\s*(\d{1,2})/i);
    if (m) return m[1];
  }
  return "";
}
function toPerson(r) {
  const name = personName(r);
  const email = String(r.emailAddress || r.Email || r.email || "").toLowerCase();
  if (!name) return null;
  const p = { name, email, year: yearOf(r) };
  const first = String(r.FirstName || r.firstName || r.firstname || r.GivenName || r.preferredName || "").trim();
  const last = String(r.LastName || r.lastName || r.lastname || r.Surname || r.surname || "").trim();
  if (first && last && name === first + " " + last) { p.first = first; p.last = last; }   // only when they make up the name exactly
  return p;
}

/* normalise the raw /api/group/* payload (bare array, or wrapped) to people */
export function parseDirectory(raw) {
  const arr = Array.isArray(raw) ? raw : (raw && (raw.people || raw.students || raw.roster)) || [];
  return arr.map(toPerson).filter(Boolean);
}

/* deterministic partial reveal: first letter always, others by a stable hash */
function mask(word, frac) {
  return [...word].map((ch, i) =>
    (i === 0 || (hashStr(word + ":" + i) % 100) < Math.round(frac * 100)) ? ch : "_"
  ).join(" ");
}

/* small seeded PRNG so a day's hint order is the same for everyone in the year
   and stable across reloads, but different from day to day */
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffleWith(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const VOWELS = "AEIOU";
const countVowels = w => [...w.toUpperCase()].filter(c => VOWELS.includes(c)).length;
const hasDouble = w => /(.)\1/i.test(w);

/* Puzzles up to this date keep the ORIGINAL hint set, exactly as they were
   played. The varied hints below only apply from the day after. */
export const LEGACY_UNTIL = "2026-09-12";

/* The hint set as it shipped originally — do not change it. Past days were
   played against these, so they have to keep reading the same way. */
export function legacyHints(first, last) {
  const H = [];
  H.push("Their first name has <b>" + first.length + "</b> letters.");
  H.push("Their first name starts with <b>" + first[0].toUpperCase() + "</b>.");
  if (last) H.push("Their surname has <b>" + last.length + "</b> letters.");
  if (last) H.push("Their surname starts with <b>" + last[0].toUpperCase() + "</b>.");
  H.push("Their first name looks like <b>" + mask(first, 0.5) + "</b>.");
  if (last) H.push("Their surname looks like <b>" + mask(last, 0.4) + "</b>.");
  H.push("Their name reads <b>" + mask(first, 0.7) + (last ? " " + mask(last, 0.65) : "") + "</b>.");
  return H;
}

/* Days up to and including this one keep the second hint set (v2Hints, below),
   exactly as they were played; the third (v3Hints) starts the day after. */
export const V2_UNTIL = "2026-11-09";

/* Which hint set a day uses. Archived days always read the way they were
   played: hints are recomputed from the stored puzzle on every read, so each
   set is frozen once its last day has passed.

   Two safety rules, learned the hard way:
   - `extra.date` decides the set; anything undated gets the newest.
   - subject / teacher / classmate hints are used ONLY when the generator could
     PROVE the timetable it read belongs to the target (`extra.verified`). An
     unverified read could be somebody else's timetable, which would describe
     the wrong person entirely — better to fall back to name shapes than lie. */
export function buildHints(first, last, extra) {
  extra = extra || {};
  if (extra.date && String(extra.date) <= LEGACY_UNTIL) return legacyHints(first, last);
  if (extra.date && String(extra.date) <= V2_UNTIL) return v2Hints(first, last, extra);
  return v3Hints(first, last, extra);
}

/* ── the third hint set (from the day after V2_UNTIL) ───────────────────────
   Lean on things people actually know about each other (who they sit with,
   who teaches them, what they take) and keep name trivia as filler. Every
   hint has a tier (how much it gives away: 1 gentle … 4 nearly the answer), a
   fun weight, and the facts it reveals. A round is 8 hints plus the final
   reveal:
   - slots run gentle → strong, with a little shuffling across neighbouring
     tiers so no two days feel the same, but a strong hint never lands in the
     first three and a near-giveaway never before the seventh;
   - inside a slot the pick is random, weighted towards the fun ones;
   - a hint is skipped if what it says is already known (initials after "their
     surname starts with C", a letter count after the name's been masked), and
     no person or teacher is the subject of two hints. */
/* letters only, accents included (Zoë has three), and a letter's plain form
   for "starts with" / "ends in" (Élise starts with E) */
const lettersOf = s => String(s || "").normalize("NFC").replace(/[^\p{L}]/gu, "");
const plainLetter = ch => String(ch || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const SCIENCE = /\b(physics|chemistry|biology|earth (?:and|&) environmental|investigating science|science extension)\b/i;
const MATHS = /\bmath/i;
const EXTENSION = /\bextension\b|\bext\.?\s?[12]\b/i;
const NOT_A_SUBJECT = /\b(sport|study|wellbeing|mentor|roll ?call|homeroom|pastoral|assembly|tutorial|recess|lunch)\b/i;
/* the subjects everyone in Years 7–10 takes: saying someone takes one says nothing */
const JUNIOR_CORE = /^(english|mathematics|maths?|science|history|geography|pdhpe|pd\s*\/?\s*h\s*\/?\s*pe|health|religion)\b/i;
/* ...and in Years 7–8, also music, visual arts, technology and a language */
const STAGE4_CORE = /^(music|visual arts?|art|technology|tech(?:nology)? mandatory|french|japanese|chinese|mandarin|italian|german|spanish|indonesian|korean|latin|greek|arabic|vietnamese|languages?)\b/i;
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = n => WORDS[n] || String(n);
/* what knowing one fact also tells you */
const IMPLIES = { F1: ["Fvs"], Fmask: ["F1", "Flen", "Fvs"], Lmask: ["L1", "Llen"], F2: ["F1"], L2: ["L1"] };
/* how much of a name a hint may show: its first two letters, or just the first
   for a short name; never more, and never how long it is */
const startOf = w => { const ch = [...lettersOf(w)]; if (!ch.length) return "";
  return ch.length >= 3 ? plainLetter(ch[0]) + ch[1].toLowerCase() : plainLetter(ch[0]); };

/* v3's partial reveal. Same letters as mask() at the same fraction (so a later,
   bigger reveal always contains an earlier one), but hyphens, apostrophes and
   spaces stay visible, so Mia-Rose reads "M i _ _ - R _ s e". mask() itself is
   left alone: the frozen hint sets use it. */
function maskV3(w, frac, more) {
  const chars = [...String(w || "")];
  const hidden = [];
  const out = chars.map((ch, i) => {
    if (!/\p{L}/u.test(ch) || i === 0 || (hashStr(w + ":" + i) % 100) < Math.round(frac * 100)) return ch;
    hidden.push(i); return "_";
  });
  /* never the whole name: a short one ("Ng") keeps its last-ranked letter hidden */
  if (!hidden.length) {
    const letters = chars.map((ch, i) => i).filter(i => i > 0 && /\p{L}/u.test(chars[i]));
    if (letters.length) {
      const i = letters.sort((x, y) => hashStr(w + ":" + y) % 100 - hashStr(w + ":" + x) % 100)[0];
      out[i] = "_"; hidden.push(i);
    }
  }
  /* `more`: show this many extra letters (lowest hash first), but always leave one hidden */
  if (more && hidden.length > 1)
    hidden.sort((x, y) => hashStr(w + ":" + x) % 100 - hashStr(w + ":" + y) % 100)
      .slice(0, Math.min(more, hidden.length - 1)).forEach(i => { out[i] = chars[i]; });
  return out.join(" ");
}
/* the final hint shows more of each name than its earlier "looks like" hint did */
const finalMask = (w, earlier, frac) => {
  const m = maskV3(w, frac);
  return m === maskV3(w, earlier) ? maskV3(w, frac, 1) : m;
};

export function v3Hints(first, last, extra) {
  extra = extra || {};
  const rnd = rngFrom(hashStr("v3|" + String(extra.seed || first + "|" + last)));
  const ok = extra.verified === true;
  const year = Number(extra.year);
  const senior = year >= 11;
  /* a subject everyone in their year takes tells you nothing */
  const common = s => !senior && (JUNIOR_CORE.test(s) || (year <= 8 && STAGE4_CORE.test(s)));
  const nameOf = typeof extra.nameOf === "function" ? extra.nameOf : (email, name) => name;
  const F = lettersOf(first), L = lettersOf(last);
  const FL = [...F], LL = [...L];
  const pool = [];
  /* `fresh`: facts that must all still be unknown for the hint to be worth giving
     (no "initials R.C." after "starts with R"; no "both A and B" after "takes A") */
  const add = (tier, fun, tags, text, kind, fresh) => pool.push({ tier, fun, tags, text, kind: kind || "", fresh: fresh || null });
  /* at most this many of a kind in one round, so it never reads as a list */
  const CAP = { teacher: 1, subject: 3, trivia: 2, ending: 1, start2: 1 };   // one "starts with Em" before the last hint, which gives both

  /* ── what they take (verified timetables only) ── */
  const classes = ok && Array.isArray(extra.classes)
    ? extra.classes.filter(c => c && c.subject && !NOT_A_SUBJECT.test(c.subject)) : [];
  const subjects = [...new Set(classes.map(c => c.subject))];
  if (subjects.length) {
    const ext = subjects.filter(s => EXTENSION.test(s)).length;
    if (senior) {
      const sci = subjects.filter(s => SCIENCE.test(s)).length;
      if (sci >= 2) add(1, 3, ["sci"], "They study <b>" + word(sci) + " sciences</b>.", "subject");
      else if (sci === 0) add(1, 3, ["sci"], "They don't study <b>any science</b>.", "subject");
      if (!subjects.some(s => MATHS.test(s))) add(1, 3, ["maths"], "They don't study <b>any maths</b>.", "subject");
      if (ext === 1) add(1, 3, ["ext"], "They take an <b>extension</b> subject.", "subject");
      if (ext >= 2) add(2, 3, ["ext"], "They take <b>" + word(ext) + " extension</b> subjects.", "subject");
    }
    const telling = shuffleWith(subjects.filter(s => !common(s)), rnd);
    /* an extension course narrows it to a handful, so it isn't an opener; naming
       their one extension subject also says they take an extension subject */
    for (const s of telling.slice(0, 4))
      add(EXTENSION.test(s) ? 2 : 1, 2, ["subj:" + s].concat(ext === 1 && EXTENSION.test(s) ? ["ext"] : []),
        "They take <b>" + s + "</b>.", "subject");
    if (telling.length >= 2)
      add(2, 2, ["subj:" + telling[0], "subj:" + telling[1]],
        "They take both <b>" + telling[0] + "</b> and <b>" + telling[1] + "</b>.", "subject",
        ["subj:" + telling[0], "subj:" + telling[1]]);
  }

  /* ── who teaches them ── */
  const byTeacher = new Map();
  for (const c of classes) if (c.teacher) byTeacher.set(c.teacher, (byTeacher.get(c.teacher) || 0) + 1);
  for (const [t, n] of shuffleWith([...byTeacher], rnd).slice(0, 4)) {
    if (n >= 2) add(2, 4, ["who:" + t], "They have <b>" + word(n) + " classes</b> with <b>" + t + "</b>.");
    else add(1, 2, ["who:" + t], "One of their teachers is <b>" + t + "</b>.", "teacher");
  }

  /* ── who they sit with ── */
  const mates = ok && Array.isArray(extra.classmates) ? extra.classmates.filter(m => m && m.name && m.email) : [];
  const most = mates.filter(m => m.shared >= 2).sort((a, b) => b.shared - a.shared);
  let sharer = "";
  if (most.length) {
    const tied = most.filter(m => m.shared === most[0].shared);
    const m = tied[Math.floor(rnd() * tied.length)];
    sharer = m.email;
    add(3, 5, ["who:" + m.email], "They share <b>" + word(m.shared) + " classes</b> with <b>" + nameOf(m.email, m.name) + "</b>.");
  }
  const telling2 = s => !NOT_A_SUBJECT.test(s) && !common(s);
  const inOne = mates.filter(m => m.email !== sharer && Array.isArray(m.subjects) && m.subjects.some(telling2));
  if (inOne.length) {
    const m = inOne[Math.floor(rnd() * inOne.length)];
    const ss = m.subjects.filter(telling2);
    const s = ss[Math.floor(rnd() * ss.length)];
    add(2, 4, ["who:" + m.email, "subj:" + s], "They're in <b>" + s + "</b> with <b>" + nameOf(m.email, m.name) + "</b>.");
  }

  /* little or nothing from a timetable (no verified timetable, or a junior who
     takes only what everyone takes): the round is mostly name shapes, so it is
     paced differently below and keeps two extra gentle ones */
  const sparse = pool.length < 4;

  /* ── name shapes: filler early, giveaways late. No vowel counts, no "starts
     with a consonant", no surname length when there is anything better: those
     are guesswork, not fun. ── */
  /* one fact at a time: a letter count is fine; "looks like E m _ _ y" (the length
     and three letters at once) isn't, so the most a hint shows is two letters */
  if (FL.length) {
    add(1, 1, ["Flen"], "Their first name has <b>" + FL.length + "</b> letters.", "trivia");
    add(2, 2, ["Fend"], "Their first name ends in <b>" + plainLetter(FL[FL.length - 1]) + "</b>.", "ending");
    add(3, 2, ["F1"], "Their first name starts with <b>" + plainLetter(FL[0]) + "</b>.");
    if (FL.length >= 3) add(4, 1, ["F2", "F1"], "Their first name starts with <b>" + startOf(first) + "</b>.", "start2", ["L2"]);
  }
  if (LL.length) {
    if (sparse) {
      add(1, 1, ["Llen"], "Their surname has <b>" + LL.length + "</b> letters.", "trivia");
      /* easy to check against the list of names; pointless once both lengths are out */
      if (FL.length) add(1, 1, ["Lcmp"], FL.length === LL.length ? "Their first name and surname are the <b>same length</b>."
        : "Their first name is <b>" + (FL.length < LL.length ? "shorter" : "longer") + "</b> than their surname.", "trivia", ["Llen"]);
    }
    add(2, 1, ["Lend"], "Their surname ends in <b>" + plainLetter(LL[LL.length - 1]) + "</b>.", "ending");
    add(3, 2, ["L1"], "Their surname starts with <b>" + plainLetter(LL[0]) + "</b>.");
    /* initials: a late hint, and only while neither letter has been given */
    if (FL.length) add(4, 2, ["F1", "L1"], "Their initials are <b>" + plainLetter(FL[0]) + "." + plainLetter(LL[0]) + ".</b>", "", ["F1", "L1"]);
    if (LL.length >= 3) add(4, 1, ["L2", "L1"], "Their surname starts with <b>" + startOf(last) + "</b>.", "start2", ["F2"]);
  }

  /* ── the order: 8 slots, gentle → strong. The gentle ones swap now and then
     (one place at most, no cascades) so no two days run alike; the strong ones
     stay at the end, so a letter or a mask is never followed by a weaker hint. */
  const slots = [1, 1, 1, 2, 2, 3, 3, 4];
  /* a sparse round has only so many gentle hints, so its first letter may come at the 5th */
  const fits = (tier, i) => !(tier >= 3 && i < (sparse ? 4 : 5)) && !(tier >= 4 && i < (sparse ? 6 : 7));
  for (let i = 0; i < 4; i++)
    if (rnd() < 0.3 && slots[i] !== slots[i + 1]) {
      [slots[i], slots[i + 1]] = [slots[i + 1], slots[i]];
      i++;
    }

  const known = new Set(), used = new Set(), out = [], kinds = {};
  const learn = tags => tags.forEach(t => { known.add(t); (IMPLIES[t] || []).forEach(x => known.add(x)); });
  const usable = (h, capped) => !used.has(h) && !h.tags.every(t => known.has(t)) &&
    !h.tags.some(t => t.startsWith("who:") && known.has(t)) &&
    !(h.fresh && h.fresh.some(t => known.has(t))) &&
    !(capped && h.kind && (kinds[h.kind] || 0) >= (CAP[h.kind] || 99));
  const pick = list => {
    const w = list.map(h => h.fun * h.fun);                      // fun hints win most of the time, not always
    let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  };
  /* The caps give way only when nothing else fills the slot. With a timetable,
     a stronger social hint is better than a third subject, so the tier moves
     first; a sparse round relaxes the cap first, so its letters stay late. */
  slots.forEach((tier, i) => {
    const tiers = [tier, tier - 1, tier + 1, tier - 2, tier + 2];
    const tries = sparse ? tiers.flatMap(t => [[t, true], [t, false]])
                           : [true, false].flatMap(c => tiers.map(t => [t, c]));
    for (const [t, capped] of tries) {
      if (t < 1 || t > 4 || !fits(t, i)) continue;
      const list = pool.filter(h => h.tier === t && usable(h, capped));
      if (!list.length) continue;
      const h = pick(list);
      used.add(h); learn(h.tags); out.push(h.text);
      if (h.kind) kinds[h.kind] = (kinds[h.kind] || 0) + 1;
      return;
    }
  });
  /* the last hint: how each name starts (two letters at most, no length) */
  out.push("Their name starts <b>" + startOf(first) + "…" + (last ? "&emsp;" + startOf(last) + "…" : "") + "</b>");
  return out;
}

/* ── the second hint set (2026-09-13 to V2_UNTIL) — frozen, do not change ── */
export function v2Hints(first, last, extra) {
  extra = extra || {};
  const rnd = rngFrom(hashStr(String(extra.seed || first + "|" + last)));
  const ok = extra.verified === true;
  const subjects = ok && Array.isArray(extra.subjects) ? extra.subjects.filter(Boolean) : [];
  const teachers = ok && Array.isArray(extra.teachers) ? extra.teachers.filter(Boolean) : [];
  const subj = shuffleWith(subjects, rnd), tchs = shuffleWith(teachers, rnd);
  const full = (first + last).replace(/\s/g, "");

  /* T0 vague → T3 nearly the answer */
  const T = [[], [], [], []];

  /* --- what they study (viewer-independent, so the daily stays shared) --- */
  if (subj.length) {
    T[0].push("They take <b>" + subj[0] + "</b>.");
    if (subj[1]) T[1].push("They also take <b>" + subj[1] + "</b>.");
    if (subj.length > 2) T[0].push("They study <b>" + subjects.length + "</b> subjects this timetable.");
  }
  if (tchs.length) T[1].push("One of their teachers is <b>" + tchs[0] + "</b>.");
  if (tchs[1]) T[2].push("They also have a class with <b>" + tchs[1] + "</b>.");

  /* --- vague name shape --- */
  T[0].push("Their first name has <b>" + first.length + "</b> letters.");
  T[0].push("Their first name has <b>" + countVowels(first) + "</b> vowel" + (countVowels(first) === 1 ? "" : "s") + ".");
  T[0].push("Their first name starts with a <b>" + (VOWELS.includes(first[0].toUpperCase()) ? "vowel" : "consonant") + "</b>.");
  T[0].push("Their whole name has <b>" + full.length + "</b> letters.");
  /* check each name separately — first+last would invent a double at the join */
  T[0].push("Their name " + (hasDouble(first) || (last && hasDouble(last)) ? "has a" : "has no") + " <b>double letter</b> in it.");
  if (last) {
    T[0].push("Their surname has <b>" + last.length + "</b> letters.");
    T[0].push("Their surname starts with a letter in the <b>"
      + (last[0].toUpperCase() <= "M" ? "first" : "second") + " half</b> of the alphabet.");
  }

  /* --- medium --- */
  T[1].push("Their first name ends with <b>" + first[first.length - 1].toUpperCase() + "</b>.");
  if (last) T[1].push("Their surname ends with <b>" + last[last.length - 1].toUpperCase() + "</b>.");

  /* --- strong --- */
  T[2].push("Their first name starts with <b>" + first[0].toUpperCase() + "</b>.");
  if (last) T[2].push("Their surname starts with <b>" + last[0].toUpperCase() + "</b>.");
  if (last) T[2].push("Their initials are <b>" + first[0].toUpperCase() + "." + last[0].toUpperCase() + ".</b>");

  /* --- nearly the answer --- */
  T[3].push("Their first name looks like <b>" + mask(first, 0.5) + "</b>.");
  if (last) T[3].push("Their surname looks like <b>" + mask(last, 0.45) + "</b>.");

  /* Shuffle inside each tier, keep the tiers in order, and trim so a round is
     ~9 hints rather than a long crawl. The full-name reveal is kept out of the
     shuffle entirely so the biggest giveaway is always the very last hint. */
  return [].concat(
    shuffleWith(T[0], rnd).slice(0, 3),
    shuffleWith(T[1], rnd).slice(0, 2),
    shuffleWith(T[2], rnd).slice(0, 2),
    shuffleWith(T[3], rnd).slice(0, 1),
    ["Their name reads <b>" + mask(first, 0.7) + (last ? " " + mask(last, 0.65) : "") + "</b>."]
  );
}

/* mirror the client's subject / teacher tidying so hints read naturally */
const cleanSubject = name => String(name || "")
  .replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i, "")
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/, "")
  .replace(/^[\s:\-–—]+/, "").trim();
/* the same as index.html's tidyTeacher, so a hint names a teacher the way the
   timetable shows them: "stephen.henne@det…" -> "Stephen Henne", "Doyle, Mr R"
   -> "Mr R Doyle", anything else as it came */
const titleCase = s => String(s).split(/[-\s]+/).filter(Boolean)
  .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
const tidyTeacher = t => {
  const s = String(t || "").trim();
  if (!s) return "";
  if (s.includes("@")) {
    const parts = s.split("@")[0].split(".");
    if (parts.length >= 2) return titleCase(parts[0]) + " " + titleCase(parts[1].replace(/\d+$/, ""));
    return titleCase(s.split("@")[0].replace(/[._]+/g, " ").replace(/\d+$/, ""));
  }
  const m = s.match(/^([^,]+),\s*(.+)$/);
  return m ? (m[2] + " " + m[1]).replace(/\s{2,}/g, " ").trim() : s;
};

/* Subjects + teachers for one person, read as the server's own account so the
   hints are the same for everyone in the year. Best-effort: any failure just
   leaves the puzzle with name-shape hints only. */
async function studiesOf(email, sameYear) {
  if (!email) return {};
  const want = String(email).toLowerCase();
  try {
    const raw = await fetchAsOwner("/api/timetable/" + encodeURIComponent(email));
    const rows = Array.isArray(raw) ? raw : (raw && (raw.timetable || raw.Timetable)) || [];
    if (!rows.length) return {};
    const subjects = new Set(), teachers = new Set(), codes = [], classes = [];
    for (const r of rows) {
      const course = String(r.CourseName || r.courseName || r.Course || "");
      const per = String(r.Period || r.period || "");
      if (!course || /assembly|recess|lunch|roll ?call|break|wellbeing/i.test(course + " " + per)) continue;
      const s = cleanSubject(course);
      if (s) subjects.add(s);
      const t = tidyTeacher(r.TeacherName || r.TeacherFullName || r.Teacher || r.StaffName || "");
      if (t) teachers.add(t);
      const code = r.ClassCode || r.classCode;
      if (code && !codes.includes(code)) { codes.push(code); if (s) classes.push({ code, subject: s, teacher: t || "" }); }
    }
    if (!subjects.size || !codes.length) return {};

    /* PROVE it is their timetable. Asking the school API for someone else's
       timetable as the server account could plausibly hand back the server
       account's own — which would describe the wrong person. So check the
       target is actually on the roster of a class off the timetable we just
       read. No proof ⇒ no subject hints. The same rosters say who they sit
       with: how many of their classes each classmate shares, and which. */
    /* Classmates count real subjects only (not sport, study or mentor groups),
       and only people in the same year: a combined class can hold others.
       Real subjects are read first; at most 10 rosters per puzzle. */
    let verified = false;
    const mates = new Map();
    const real = c => !NOT_A_SUBJECT.test(c.subject);
    for (const c of classes.filter(real).concat(classes.filter(c => !real(c))).slice(0, 10)) {
      try {
        const roster = await fetchAsOwner("/api/timetable/class/" + encodeURIComponent(c.code));
        const arr = Array.isArray(roster) ? roster : (roster && (roster.roster || roster.students)) || [];
        if (arr.some(p => String(p.emailAddress || p.Email || p.email || "").toLowerCase() === want)) verified = true;
        for (const p of arr) {
          const email = String(p.emailAddress || p.Email || p.email || "").toLowerCase();
          const groups = (Array.isArray(p.groups) ? p.groups : []).map(g => String(g).toLowerCase());
          if (!email || email === want || /@det\.nsw\.edu\.au$/.test(email) ||
              groups.some(g => /^(teacher|staff|executive|admin)/.test(g))) continue;      // students only
          if (!real(c) || (sameYear && sameYear.size && !sameYear.has(email))) continue;
          const name = personName(p);
          if (!name) continue;
          const m = mates.get(email) || mates.set(email, { email, name, shared: 0, subjects: [] }).get(email);
          m.shared++; if (!m.subjects.includes(c.subject)) m.subjects.push(c.subject);
        }
      } catch { /* try the next class */ }
    }
    if (!verified) return {};
    const classmates = [...mates.values()].sort((a, b) => b.shared - a.shared || a.email.localeCompare(b.email)).slice(0, 60);
    return { subjects: [...subjects].slice(0, 12), teachers: [...teachers].slice(0, 12), verified: true,
             classes: classes.slice(0, 12), classmates };
  } catch { return {}; }
}

/* the deduped, deterministically ordered roster for one year */
async function loadYear(year) {
  const seen = new Set(); const list = [];
  parseDirectory(await fetchAsOwner("/api/group/student"))
     .filter(p => p.year === String(year) && p.name.includes(" "))   // need a surname for hints
     .sort((a, b) => (a.email || a.name).localeCompare(b.email || b.name))  // stable order across runs
     .forEach(p => { const k = p.email || p.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); list.push(p); } });
  return list;
}

/* find the caller's year — from the JWT first, else from the directory */
export async function resolveYear(me) {
  if (me.year) return String(me.year);
  const mine = parseDirectory(await fetchAsOwner("/api/group/student")).find(p => p.email && p.email === me.email);
  return mine && mine.year ? String(mine.year) : null;
}

/* return today's puzzle for a year, generating it if it doesn't exist yet */
export async function ensurePuzzle(db, year, date) {
  year = String(year);
  const sel = () => db.from("daily_puzzle")
    .select("date, year, target, candidates").eq("date", date).eq("year", year).maybeSingle();

  let { data: row, error } = await sel();
  if (error) throw new Error("puzzle read: " + error.message);
  if (row) return date > V2_UNTIL ? withV3Details(db, row, year) : row;

  const roster = await loadYear(year);
  if (roster.length < 5) throw new Error("Not enough students in year " + year + " to build a puzzle.");

  const t = roster[hashStr(date + ":" + year) % roster.length];
  const parts = t.name.split(/\s+/);
  const first = t.first || parts[0], last = t.first ? t.last : parts.slice(1).join(" ");
  const sameYear = new Set(roster.map(p => p.email).filter(Boolean));
  const studies = await studiesOf(t.email, sameYear);   // best-effort subject / teacher / classmate hints
  const target = { name: t.name, first, last, email: t.email || "",
    subjects: studies.subjects || [], teachers: studies.teachers || [],
    classes: studies.classes || [], classmates: studies.classmates || [], v3: true,
    verified: studies.verified === true,     // only then are subject hints trusted
    hints: buildHints(first, last, { seed: date + ":" + year, date, year, ...studies }) };
  const candidates = roster.map(p => p.name);

  const { error: upErr } = await db.from("daily_puzzle")
    .upsert({ date, year, target, candidates }, { onConflict: "date,year", ignoreDuplicates: true });
  if (upErr) throw new Error("puzzle write: " + upErr.message);

  ({ data: row } = await sel());                 // re-read: race-safe if two writers collided
  return row || { date, year, target, candidates };
}

/* A day after V2_UNTIL whose puzzle was made before the third hint set
   existed has no classes or classmates stored. Add them once: the same person,
   the same candidates, only extra fields on `target`. Marked v3 either way, so
   a failed lookup is not retried on every read. */
async function withV3Details(db, row, year) {
  const t = row.target || {};
  if (t.v3) return row;
  let email = t.email || "";
  try {
    const roster = await loadYear(year);
    if (!email) {
      const same = roster.filter(p => p.name === t.name);
      if (same.length === 1) email = same[0].email || "";            // only when the name is unambiguous
    }
    const studies = email ? await studiesOf(email, new Set(roster.map(p => p.email).filter(Boolean))) : {};
    const target = { ...t, email, v3: true };
    if (studies.verified) Object.assign(target, { subjects: studies.subjects, teachers: studies.teachers,
      classes: studies.classes || [], classmates: studies.classmates || [], verified: true });
    const { error } = await db.from("daily_puzzle").update({ target }).eq("date", row.date).eq("year", String(year));
    if (error) { console.error("puzzle details:", error.message); return row; }
    return { ...row, target };
  } catch (e) { console.error("puzzle details:", e.message); return row; }
}

/* consecutive won days ending today (or yesterday, if today isn't won yet) */
export function computeStreak(wonDates, today) {
  const set = new Set(wonDates);
  const d = new Date(today + "T00:00:00Z");
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let streak = 0;
  while (set.has(d.toISOString().slice(0, 10))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
  return streak;
}

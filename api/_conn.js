/*
 * Quartets: the daily "find the four groups of four" puzzle for your year.
 * Private helper (underscore = not a route); served by api/daily.js under ?conn=1,
 * so it doesn't need a Vercel function of its own.
 *
 * Sixteen people from your year, four hidden groups of four. A group can be a
 * plain name theme (surnames that are everyday words), a subject, a class or
 * a teacher, or wordplay (a name hidden in a name, an anagram, initials that
 * spell a chemical symbol). The four are a random mix each day, so there's no
 * pattern to learn, but every day's total difficulty sits in the same band
 * (see pickFour); they're shown as levels 1 to 4, easiest first.
 * Fixed answers, like a crossword: each of the sixteen fits only their own
 * group's category among the four, and no other name theme takes in four of
 * them. Shared subjects across groups are fine (and make good red herrings).
 *
 * One puzzle per (date, year), made on first request and stored; everyone in
 * the year gets the same one. Only display names are stored, never emails,
 * birthdays or scores. Subjects, classes and teachers are what Daily Guess Who
 * already tells a year about its own people.
 *
 * Tables (SETUP.md has the SQL):
 *   conn_puzzle(date, year, groups jsonb, created_at)          pk (date, year)
 *   conn_result(email, date, year, found jsonb, mistakes, solved, done, updated_at)  pk (email, date)
 */

/* ── small word lists (lower case) ─────────────────────────────────── */
const L = s => s.split(' ');
const FLOWERS = new Set(L('lily rose ivy violet daisy poppy iris jasmine willow hazel holly heather fern rosie primrose marigold lavender magnolia azalea camellia dahlia flora flower blossom lotus olive laurel saffron sage juniper rowan aspen briar clover posy myrtle petal acacia cassia linnea zinnia tansy bryony ash oak cedar birch alder'));
const GEMS = new Set(L('ruby jade pearl amber jasper opal crystal garnet beryl coral jet onyx sapphire emerald diamond topaz agate esme jewel gemma'));
const MONTHS = new Set(L('january february march april may june july august september october november december'));
const JOBS = new Set(L('baker cooper smith carter turner taylor tailor butcher fisher fletcher mason miller porter potter thatcher weaver hunter shepherd sheppard archer chandler clark clarke cook draper farmer fowler gardener glover knight marshall page parker sawyer skinner slater spencer stewart steward tanner thatcher walker ward webb webster wright bishop chapman collier dyer falconer forester gardner harper judge keeper painter piper plumber ranger sailor shoemaker singer squire tucker barber bowman brewer butler carpenter deacon fowler gunner hooper lister mercer proctor sargent scrivener tyler waller'));
const COLOURS = new Set(L('black white green brown grey gray gold silver red blue pink scarlett scarlet violet amber rose ruby olive hazel ivory jet sable coral indigo lilac lavender azure tan teal crimson cherry plum'));
const ANIMALS = new Set(L('fox wolf bear lamb bull hart buck hogg hogg lyon lion seal fish salmon pike bass herring trout crabb crab mole hare rabbit badger otter deer stagg stag colt mare steed horse oxley moose roe buck nightingale drake swan crane hawk eagle falcon finch sparrow wren robin heron jay crow raven rook dove bird swift martin peacock gosling partridge parrott parrot mallard teal starling bunting lark'));
const BIRDS = new Set(L('swan crane hawk eagle falcon finch sparrow wren robin heron jay crow raven rook dove bird swift martin peacock gosling partridge parrott parrot mallard teal starling bunting lark nightingale drake'));
const PLACES = new Set(L('london paris york sydney perth darwin hobart brisbane adelaide melbourne canberra kent devon cornwall essex surrey chester lincoln preston bristol bath derby england ireland scott wales holland france china india jordan georgia sierra cuba chad israel kenya peru austin dallas houston denver phoenix boston orlando florence sienna verona victoria sofia vienna lima dakota savannah brooklyn camden carolina virginia paris hamilton wellington washington lancaster hudson aden'));
/* everyday words that are also surnames (Smart, Field, Ball) or first names (Grace, Sunny) */
const WORDY = new Set(L('smart full field fields ball buck lamb host cannon sparks spark ward park song rich hung burns young long short small stone wood woods hill hills green white brown black gray grey king bird fox hall bell lane day love hope price hunt best wise read page rice cash gold silver bush banks booth bond rock rocks brook brooks bridge bridges castle chamber church cross dean dove drake east west north south ford fort frost gale glass good grant hart heath holland house hope hunter jewel joy knight lake law lord mark marsh may meadow mill mills moon morning new noble oak park pearl pierce pike pool pope power rain rains ray reed ridge rivers rose rush salt sharp short sparrow spring steel sterling stone storm street summer summers swift thorn tower vine waters wells west wild winter wolf wood worth wren sands stamp sage cook coy bright bush chance cole crane dale dash dew fair free friend gay gentle gill glad hale hardy hay heart hood hook horn jolly kind lamb lock love lucky major marsh mason mayor meek merry mild moss nice page pardon parsons peck penny plum prince pride proud read reed rich rose sale sea shore silk sly snow spear star sweet tall tidy toy trim true vale wade warren wing wise yeo'));
const WORD_FIRST = new Set(L('grace sunny tiger ruby bill will rose hope joy faith sky river storm summer autumn honey jack mark pat rob sue star dawn eve ivy lily daisy holly hazel amber jade pearl april may june august art bob chance chase clay cole crystal dale dean drew faith frank gene gil glen grant guy harmony hunter iris jay jewel king lane lark lee mason max melody miles neil nick noble page penny pierce piper ray reed rich river robin rock rocky rusty sage scout skye sterling sterling summer tucker victor wade will willow win wren'));
/* names hidden inside longer first names: Hannah has Anna, William has Liam, Isabella has Bella
   (four letters or more, with at least two letters left over, so it's a find, not a nickname) */
const NICK = L('anna bella ella elle chris liam alex theo tina nina rita lena mina leah leon noel dean anne andy rick nick mark ivan eric rose lily ruby emma emily sara sarah dana dina gina jane joan june kate mary maya nora rosa rosie tess tom thom matt dave dan beth anna ella gabe jack jake joel john josh luke mike paul pete ross ryan sean will zach adam alan amos axel bert carl cole drew eden evan finn gail hope iris jade jean jess judy kyle lara lars leo levi lisa lois lola luca lucy luna mae mara max mila milo neil nell nico noah ollie omar otto owen remy rene rory ruth ryan saul seth stan tara tess toby tony vera wade yael zane zara zoe kian liv nate sian amie');
/* everyday words some first names are anagrams of: Liam is mail, Mary is army */
const WORDS = L('aim air and arm army art ate bury bale bean bear beat bird blue boat bone care cart cast cat clam coal cola dale dare date deal dean dear den dial dine dirt done door dote earl earn east ease edit end evil fare fear fire flea fold gale game gear glee hale heal hear heat hint hire horn idle inch item jar keen kale lace lair lake lame lane last late lead lean leap liar lied lies lime line lion lips list live loan lone lore lose lost lure mail male mane mare mate meal mean meat mile mine mint mire mist mite moat mode more name near neat nest nice nile nose note oath oils omen once oral ores pale pane pear pine plea poem pose race rail rain rang rate read real rein rest rice ride rile rind rise road roam robe role rose rude rule safe sail sale same sane save scar seal sear seat sent shoe silo sine sire site slab slay slot snag sole some sore spar spin star stem stop tale tame tea teak team tear tide tile time tins tire toes tone tore tram tray tree trim urn vale veil vile vine wane ware wear wine wire wore yarn year ales alert angel angle arise baker bread cider cried crate eager early earth hated heart hoser ideal inert lemon liner liver loser male malt manor meant miser moral needs noted onset opera other petal plate pleas ranged reins resin rinse risen serene siren slate snare stale steal tales tears teams tenor toner trace vowel wider');
const ANIMALS_HIDDEN = L('cat rat ant bee owl emu ape hen eel cod ram pig dog bat elk yak gnu cow doe ewe fox kid koi asp boar crow dove duck frog goat hare lamb lion mole moth mule newt seal slug swan toad wasp wolf worm bear deer mink orca puma');
/* only the symbols people remember from school */
const SYMBOLS = new Set(L('He Li Be Ne Na Mg Al Si Cl Ar Ca Fe Co Ni Cu Zn Ag Sn Au Hg Pb Pt Ra Rn Kr Xe Br Mn Cr Ti'));

const sortKey = w => w.split('').sort().join('');
const WORD_KEYS = new Map(); for (const w of WORDS) if (!WORD_KEYS.has(sortKey(w))) WORD_KEYS.set(sortKey(w), w);
const lc = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const rev = s => s.split('').reverse().join('');

/* ── what a name could be "about" ─────────────────────────────────── */
/* level 1 (plain themes) and level 4 (wordplay). `id` is the category; `how`
   is the short reason shown per person once a group is solved. */
export function nameFeatures(first, last){
  const f = lc(first), l = lc(last), out = [];
  const add = (lv, id, label, how) => out.push({ lv, id, label, how });
  if (!f || !l) return out;
  if (FLOWERS.has(f)) add(1, 'flower', 'First names that are flowers or plants');
  if (GEMS.has(f)) add(1, 'gem', 'First names that are gems');
  if (MONTHS.has(f)) add(1, 'month', 'First names that are months');
  if (JOBS.has(l)) add(1, 'job', 'Surnames that are jobs');
  if (COLOURS.has(l)) add(1, 'colour', 'Surnames that are colours');
  if (BIRDS.has(l)) add(1, 'bird', 'Surnames that are birds');
  else if (ANIMALS.has(l)) add(1, 'animal', 'Surnames that are animals');
  if (PLACES.has(l)) add(1, 'place', 'Surnames that are places');
  if (WORDY.has(l) && !JOBS.has(l) && !COLOURS.has(l) && !ANIMALS.has(l)) add(1, 'wordsur', 'Surnames that are everyday words');
  if (WORD_FIRST.has(f) && !FLOWERS.has(f) && !GEMS.has(f) && !MONTHS.has(f)) add(1, 'wordfirst', 'First names that are also everyday words');
  /* wordplay */
  /* inside the name (Gil-bert, Wil-liam), or at the start with a good part left over (Chris-topher) */
  const nick = NICK.find(n => n.length >= 4 && f.includes(n) && f.length - n.length >= (f.startsWith(n) ? 4 : 2));
  if (nick) add(4, 'hiddenname', 'Another name hidden in their first name', nick[0].toUpperCase() + nick.slice(1));
  const whole = f + l;
  const ani = ANIMALS_HIDDEN.find(a => { const i = whole.indexOf(a); return i >= 0 && a !== f && a !== l && !(ANIMALS.has(l) && l.includes(a)); });
  if (ani) add(4, 'hiddenanimal', 'An animal hidden in their name', ani);
  const word = f.length >= 3 && WORD_KEYS.get(sortKey(f));
  if (word && word !== f) add(4, 'anagram', 'First name is an anagram of a word', word);
  if (f.length >= 3 && f === rev(f)) add(4, 'palindrome', 'First name reads the same backwards');
  if (f[0] === l[0]) add(4, 'alliter', 'Matching initials', f[0].toUpperCase() + '.' + l[0].toUpperCase() + '.');
  if (l.charCodeAt(0) - f.charCodeAt(0) === 1) add(4, 'abc', 'Initials are next to each other in the alphabet', f[0].toUpperCase() + l[0].toUpperCase());
  const sym = f[0].toUpperCase() + l[0];
  if (SYMBOLS.has(sym)) add(4, 'element', 'Initials spell a chemical symbol', sym);
  return out;
}

/* the short reason one person is in a name group ("emu", "G.G."), worked out
   when the puzzle is shown, from the name they go by then; nothing is stored.
   Empty if the group isn't a wordplay one, or the name no longer fits. */
export function howFor(groupId, name){
  const id = String(groupId || '').replace(/^n:/, '');
  const parts = String(name || '').trim().split(/\s+/);
  const f = nameFeatures(parts[0], parts.slice(1).join(' ')).find(x => x.id === id);
  return f && f.how ? f.how : '';
}

/* ── the timetable side ─────────────────────────────────────────── */
const NOT_A_SUBJECT = /\b(sport|study|wellbeing|mentor|roll ?call|homeroom|pastoral|assembly|tutorial|recess|lunch|break|private)\b/i;
const TOO_COMMON = /^english\b|^mathematics$|^maths?$|^religion|^studies of religion/i;
export const cleanSubject = name => String(name || '')
  .replace(/\s*\b(yr|year)\s*\.?\s*\d{1,2}\b\s*$/i, '')
  .replace(/^\d{1,2}\s*[A-Za-z]{2,}[A-Za-z0-9]*(?:\s+[A-Za-z]?\d{1,2})?\s+(?=\S)/, '')
  .replace(/^[\s:\-–—]+/, '').trim();
/* what a whole timetable says about someone, like Daily Guess Who's hints (Years 11 and 12) */
const SCIENCE = /\b(physics|chemistry|biology|earth (?:and|&) environmental|investigating science|science extension)\b/i;
const MATHS = /\bmath/i;
const EXTENSION = /\bextension\b|\bext\.?\s?[12]\b/i;
const LANGUAGE = /\b(french|japanese|chinese|mandarin|italian|german|spanish|indonesian|korean|latin|greek|arabic|vietnamese|hindi|modern greek)\b/i;
const PROFILES = {
  'p:nomaths': { label: "Don't take any maths",              about: MATHS,     test: s => !s.some(x => MATHS.test(x)) },
  'p:nosci':   { label: "Don't take any science",            about: SCIENCE,   test: s => !s.some(x => SCIENCE.test(x)) },
  'p:sci3':    { label: 'Take three sciences',               about: SCIENCE,   test: s => s.filter(x => SCIENCE.test(x)).length >= 3 },
  'p:ext2':    { label: 'Take two or more extension subjects', about: EXTENSION, test: s => s.filter(x => EXTENSION.test(x)).length >= 2 },
  'p:lang':    { label: 'Take a language',                   about: LANGUAGE,  test: s => s.some(x => LANGUAGE.test(x)) }
};
const profileHas = (t, id) => PROFILES[id].test([...t.subjects]);
/* one timetable → { subjects:Set, codes:Set, teachers:Set, classes:[{code, subject, teacher}] } */
export function readTimetable(raw){
  const rows = Array.isArray(raw) ? raw : (raw && (raw.timetable || raw.Timetable)) || [];
  const t = { subjects: new Set(), codes: new Set(), teachers: new Set(), classes: [] };
  for (const r of rows){
    const s = cleanSubject(r.CourseName || r.courseName || r.Course || '');
    if (!s || NOT_A_SUBJECT.test(s) || !/[A-Za-z]{3,}/.test(s)) continue;
    const code = String(r.ClassCode || r.classCode || '').trim();
    const teacher = String(r.TeacherName || r.TeacherFullName || r.Teacher || r.StaffName || '').replace(/\s+/g, ' ').trim();
    t.subjects.add(s);
    if (teacher) t.teachers.add(teacher);
    if (code && !t.codes.has(code)){ t.codes.add(code); t.classes.push({ code, subject: s, teacher }); }
  }
  return t;
}

/* ── seeded helpers ─────────────────────────────────────────────── */
export function hashStr(s){ let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
async function eachLimited(list, n, fn){ let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) await fn(list[i++]); })); }

/*
 * Make a puzzle.
 *   people   [{ email, first, last, name }]  the year, by the names people know them by
 *   getTT    async email → raw timetable    (the school API, as the server account)
 *   getRoster async code → [emails]         (a class's students)
 *   seed     a number (from the date and year)
 * Returns { groups:[{ lv, label, kind, names:[...], how:[...] }] } or null.
 */
export async function makeQuartets({ people, getTT, getRoster, seed, year, avoid = new Set(), sampleSize = 36, rosterMax = 8, fetchMax = 150 }){
  const senior = Number(year) >= 11;
  const r = rng(seed), byEmail = new Map(people.map(p => [p.email, p])), inYear = new Set(byEmail.keys());
  const n = people.length;
  if (n < 24) return null;
  let fetches = 0;
  const tts = new Map();
  const loadTT = async emails => {
    const want = emails.filter(e => !tts.has(e)).slice(0, Math.max(0, fetchMax - fetches));
    fetches += want.length;
    await eachLimited(want, 8, async e => { try { tts.set(e, readTimetable(await getTT(e))); } catch { tts.set(e, null); } });
  };

  /* 1. a sample of timetables: which subjects are common, which classes to read */
  const sample = shuffle(people.map(p => p.email), r).slice(0, sampleSize);
  await loadTT(sample);
  const got = sample.map(e => tts.get(e)).filter(t => t && t.subjects.size);
  if (got.length < 8) return null;
  /* if the school API ever handed back one account's timetable for everyone, stop */
  const sigs = new Map(); got.forEach(t => { const k = [...t.codes].sort().join(); sigs.set(k, (sigs.get(k) || 0) + 1); });
  if (Math.max(...sigs.values()) > got.length / 2) return null;
  const share = new Map();
  got.forEach(t => t.subjects.forEach(s => share.set(s, (share.get(s) || 0) + 1)));
  const okSubject = s => !TOO_COMMON.test(s) && (share.get(s) || 0) / got.length <= 0.35;
  const classes = new Map();
  got.forEach(t => t.classes.forEach(c => { if (okSubject(c.subject) && !classes.has(c.code)) classes.set(c.code, c); }));
  /* rosters for a spread of subjects */
  const bySubj = new Map(); for (const c of classes.values()) (bySubj.get(c.subject) || bySubj.set(c.subject, []).get(c.subject)).push(c);
  const pickCls = []; for (const list of shuffle([...bySubj.values()], r)){ pickCls.push(shuffle(list, r)[0]); if (pickCls.length >= rosterMax) break; }
  /* seniors: the science, extension and language classes too (common or not), so
     "three sciences" and "two extensions" can be read straight off the class lists */
  if (senior){
    const extra = new Map();
    got.forEach(t => t.classes.forEach(c => { if ((SCIENCE.test(c.subject) || EXTENSION.test(c.subject) || LANGUAGE.test(c.subject)) &&
      !pickCls.some(x => x.code === c.code) && !extra.has(c.code)) extra.set(c.code, { ...c }); }));
    pickCls.push(...shuffle([...extra.values()], r).slice(0, 8));
  }
  await eachLimited(pickCls, 6, async c => { fetches++;
    try { c.members = new Set((await getRoster(c.code)).map(e => String(e).toLowerCase()).filter(e => inYear.has(e))); } catch { c.members = new Set(); } });

  /* 2. every category, with who's known to be in it */
  const cats = new Map();
  const cat = (id, lv, label, kind, extra) => cats.get(id) || cats.set(id, Object.assign({ id, lv, label, kind, members: new Set(), how: new Map() }, extra)).get(id);
  for (const p of people) for (const f of nameFeatures(p.first, p.last)){
    const c = cat('n:' + f.id, f.lv, f.label, 'name'); c.members.add(p.email); if (f.how) c.how.set(p.email, f.how);
  }
  for (const c of pickCls){
    if (!c.members || c.members.size < 5 || !okSubject(c.subject) && !EXTENSION.test(c.subject)) continue;
    const sc = cat('s:' + c.subject, 2, 'Take ' + c.subject, 'subject', { subject: c.subject }); c.members.forEach(e => sc.members.add(e));
    cat('c:' + c.code, 3, 'In the same ' + c.subject + ' class', 'class', { code: c.code, subject: c.subject, members: c.members });
    if (c.teacher){ const tc = cat('t:' + c.teacher, 3, 'Taught by ' + c.teacher, 'teacher', { teacher: c.teacher, subjects: new Set() });
      tc.subjects.add(c.subject); c.members.forEach(e => tc.members.add(e)); }
  }
  /* seniors: what whole timetables say. Everyone whose timetable has been read
     counts, and the class lists add more: someone on three science lists takes
     three sciences. How common each is comes from the timetables read. */
  if (senior){
    const read = [...tts.entries()].filter(([, t]) => t && t.subjects.size);
    const onLists = (re, k) => { const m = new Map();
      pickCls.forEach(c => { if (c.members && re.test(c.subject)) c.members.forEach(e => { const s = m.get(e) || new Set(); s.add(c.subject); m.set(e, s); }); });
      return [...m].filter(([, s]) => s.size >= k).map(([e]) => e); };
    for (const [id, pf] of Object.entries(PROFILES)){
      const c = cat(id, 3, pf.label, 'profile', { about: pf.about });
      read.forEach(([e, t]) => { if (profileHas(t, id)) c.members.add(e); });
      if (id === 'p:sci3') onLists(SCIENCE, 3).forEach(e => c.members.add(e));
      if (id === 'p:ext2') onLists(EXTENSION, 2).forEach(e => c.members.add(e));
      if (id === 'p:lang') onLists(LANGUAGE, 1).forEach(e => c.members.add(e));
      c.share = read.length ? read.filter(([, t]) => profileHas(t, id)).length / read.length : 1;
    }
  }
  const usable = [...cats.values()].filter(c => c.kind === 'profile' ? c.members.size >= 5 && c.share <= 0.45 && c.share > 0
    : c.members.size >= (c.kind === 'name' ? 5 : 6) && c.members.size <= n * 0.45);
  if (usable.length < 4) return null;

  /* does this person fit this category? names exactly; timetables from their own timetable */
  const fits = (e, c) => {
    if (c.kind === 'name') return c.members.has(e);
    if (c.members.has(e)) return true;
    const t = tts.get(e); if (!t) return null;                       // unknown
    if (c.kind === 'subject') return t.subjects.has(c.subject);
    if (c.kind === 'class') return t.codes.has(c.code);
    if (c.kind === 'teacher') return t.teachers.has(c.teacher);
    if (c.kind === 'profile') return profileHas(t, c.id);
    return false;
  };
  const first = e => lc(byEmail.get(e).first), last = e => lc(byEmail.get(e).last);

  let best = null;
  for (let attempt = 0; attempt < 160 && fetches < fetchMax; attempt++){
    const chosen = pickFour(usable, r, avoid);
    if (!chosen) continue;
    /* four people each, who fit their own group and none of the other three */
    const taken = new Set(), groups = [];
    let ok = true;
    for (const c of chosen){
      /* rule people out on what's free to check first (names), then read timetables */
      const clash = e => groups.some(g => g.m.some(x => first(x) === first(e) || last(x) === last(e)));
      const pool = shuffle([...c.members].filter(e => !taken.has(e) && !clash(e) &&
          chosen.every(o => o === c || o.kind !== 'name' || !o.members.has(e))), r)
        .sort((a, b) => (tts.has(b) ? 1 : 0) - (tts.has(a) ? 1 : 0));        // already-read timetables first
      if (pool.length < 4){ ok = false; break; }
      const picked = [];
      for (let i = 0; i < pool.length && picked.length < 4; i += 8){
        const batch = pool.slice(i, i + 8);
        if (chosen.some(o => o.kind !== 'name')) await loadTT(batch);
        for (const e of batch){
          if (picked.length >= 4) break;
          if (!tts.get(e)) continue;                                         // need their timetable to be sure
          if (chosen.some(o => o !== c && fits(e, o) !== false)) continue;
          if (picked.some(x => first(x) === first(e) || last(x) === last(e))) continue;
          picked.push(e);
        }
        if (fetches >= fetchMax) break;
      }
      if (picked.length < 4){ ok = false; break; }
      picked.forEach(e => taken.add(e)); groups.push({ c, m: picked });
    }
    if (!ok) continue;
    const all = groups.flatMap(g => g.m);
    /* no rival: no other name theme takes in four of the sixteen, and no first initial four times over */
    const rival = usable.some(c => c.kind === 'name' && !chosen.includes(c) && all.filter(e => c.members.has(e)).length >= 4);
    const initials = new Map(); all.forEach(e => initials.set(first(e)[0], (initials.get(first(e)[0]) || 0) + 1));
    if (rival || [...initials.values()].some(k => k >= 4)) continue;
    /* red herrings: other categories three of them share, across groups */
    const herrings = usable.filter(c => !chosen.includes(c) && all.filter(e => fits(e, c) === true).length === 3).length;
    const score = Math.min(herrings, 3);
    if (!best || score > best.score) best = { groups, score };
    if (best.score >= 2) break;
  }
  if (!best) return null;
  /* level 1 to 4 by how hard each group is */
  const ordered = best.groups.slice().sort((a, b) => hardness(a.c) - hardness(b.c));
  return { herrings: best.score, hardness: ordered.reduce((a, g) => a + hardness(g.c), 0), groups: ordered.map((g, i) => ({
    lv: i + 1, id: g.c.id, label: g.c.label, kind: g.c.kind,
    emails: g.m,                                                    // kept on the server only, so a later name change shows
    names: g.m.map(e => byEmail.get(e).name),
    how: g.m.map(e => g.c.how.get(e) || '')
  })) };
}

/* ── choosing four categories ─────────────────────────────────────
   Any mix, so there's no pattern to learn (one day two name themes and a
   teacher, another a subject, a class and two kinds of wordplay), but every
   day lands in the same difficulty band, with at least one way in. */
const HARD = { 'n:flower': 1, 'n:gem': 1, 'n:month': 1, 'n:colour': 1.25, 'n:job': 1.5, 'n:animal': 1.5, 'n:bird': 1.5, 'n:place': 2,
  'n:wordsur': 1.5, 'n:wordfirst': 1.5,
  'n:alliter': 2.5, 'n:palindrome': 3, 'n:abc': 3.5, 'n:element': 3.5, 'n:hiddenname': 3.5, 'n:anagram': 4, 'n:hiddenanimal': 4 };
const PROFILE_HARD = { 'p:nomaths': 2.5, 'p:nosci': 2.5, 'p:lang': 2.25, 'p:sci3': 3, 'p:ext2': 3 };
export const hardness = c => c.kind === 'subject' ? 2.25 : c.kind === 'class' ? 3 : c.kind === 'teacher' ? 2.75
  : c.kind === 'profile' ? PROFILE_HARD[c.id] || 3 : HARD[c.id] || 3;
const family = c => c.kind === 'profile' ? 'profile' : c.kind !== 'name' ? 'timetable' : hardness(c) <= 2 ? 'theme' : 'wordplay';
export const BAND = [9.25, 11.5];                     // the four together (1 + 2.25 + 3 + 4 is 10.25)
function pickFour(usable, r, avoid){
  const chosen = [], fam = {};
  for (const c of shuffle(usable, r)){
    if (avoid && avoid.has(c.id) && r() < 0.85) continue;                   // used in the last few days: mostly skipped
    const f = family(c);
    if ((fam[f] || 0) >= 2) continue;                                       // no more than two of a kind
    if (c.kind === 'teacher' && chosen.some(o => o.kind === 'teacher')) continue;
    /* two timetable groups mustn't overlap: "Physics" and "a Physics class", or a Physics teacher */
    const subj = x => x.kind === 'teacher' ? [...x.subjects] : x.subject ? [x.subject] : [];
    if (c.kind !== 'name' && chosen.some(o => o.kind !== 'name' && subj(o).some(s => subj(c).includes(s)))) continue;
    /* nor a whole-timetable group with one about the same thing ("three sciences" and "Take Physics") */
    const clashes = (a, b) => a.kind === 'profile' && (b.kind === 'profile' ? a.about === b.about : subj(b).some(s => a.about.test(s)));
    if (chosen.some(o => clashes(c, o) || clashes(o, c))) continue;
    if (c.kind !== 'name' && chosen.filter(o => o.kind !== 'name').length >= 3) continue;   // at least one name group
    chosen.push(c); fam[f] = (fam[f] || 0) + 1;
    if (chosen.length === 4) break;
  }
  if (chosen.length < 4) return null;
  const total = chosen.reduce((a, c) => a + hardness(c), 0), easiest = Math.min(...chosen.map(hardness));
  if (total < BAND[0] || total > BAND[1] || easiest > 2.25) return null;    // too easy, too hard, or nowhere to start
  return chosen;
}

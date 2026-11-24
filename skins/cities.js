/* Cities Collection: its own script (theme.js skinJs), loaded the first time a city is on. It adds the few
   small things a stylesheet can't, and nothing moves:
   - the date the way the city writes it, for the stamp in the header's caption (--ct-date: 令和8年11月21日,
     2026年11月21日, 21 NOV 2026), kept right past midnight;
   - Home: a postage stamp in the header with the city's time, its weather now in its own words, today's
     range and the sun's times (/api/leaderboard?weather=<city>; no stamp if that fails);
   - one printed mark on the postcard itself, different for each city: Sydney's series line, Tokyo's crop
     marks (tombo), Hong Kong's postmark, Chongqing's barcode label, Los Angeles's airmail label, Edinburgh's
     printer's colour bar.
   It watches html[data-city] (tt:look) and takes all of it away again when another theme is picked. */
(() => {
  'use strict';
  const root = document.documentElement;
  const CITY = {
    sydney:    { tz:'Australia/Sydney', loc:'en-AU', name:'Sydney',    local:'Sydney', lang:'en' },
    tokyo:     { tz:'Asia/Tokyo',       loc:'ja-JP', name:'Tokyo',     local:'東京',   lang:'ja' },
    hongkong:  { tz:'Asia/Hong_Kong',   loc:'zh-HK', name:'Hong Kong', local:'香港',   lang:'zh-HK' },
    chongqing: { tz:'Asia/Shanghai',    loc:'zh-CN', name:'Chongqing', local:'重庆',   lang:'zh-CN' },
    losangeles:{ tz:'America/Los_Angeles', loc:'en-US', name:'Los Angeles', local:'Los Angeles', lang:'en-US' },
    edinburgh: { tz:'Europe/London',    loc:'en-GB', name:'Edinburgh', local:'Edinburgh', lang:'en-GB' }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  /* ── the date, as the city writes it ── */
  function dateText(id, d){
    const c = CITY[id];
    try {
      if (id === 'tokyo') return new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { timeZone:c.tz, era:'long', year:'numeric', month:'long', day:'numeric' }).format(d);
      if (id === 'sydney') return new Intl.DateTimeFormat('en-AU', { timeZone:c.tz, day:'numeric', month:'short', year:'numeric' }).format(d).replace(/\./g, '').toUpperCase();
      /* the month first, like a US postmark (NOV 24 2026); Edinburgh's day with its ordinal (24th November 2026) */
      if (id === 'losangeles') return new Intl.DateTimeFormat('en-US', { timeZone:c.tz, month:'short', day:'numeric', year:'numeric' }).format(d).replace(',', '').toUpperCase();
      if (id === 'edinburgh'){
        const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone:c.tz, day:'numeric', month:'long', year:'numeric' }).formatToParts(d).forEach(x => p[x.type] = x.value);
        const n = +p.day, th = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th','st','nd','rd'][n % 10] || 'th';
        return n + th + ' ' + p.month + ' ' + p.year;
      }
      return new Intl.DateTimeFormat(c.loc, { timeZone:c.tz, year:'numeric', month:'long', day:'numeric' }).format(d);
    } catch { return ''; }
  }
  /* the postmark's date: 21 XI 26 */
  function postDate(id, d){
    try {
      const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone:CITY[id].tz, day:'numeric', month:'numeric', year:'2-digit' }).formatToParts(d).forEach(x => p[x.type] = x.value);
      return p.day + ' ' + ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][+p.month - 1] + ' ' + p.year;
    } catch { return ''; }
  }

  /* ── the weather, in the city's own words ── */
  const kind = (c, day) => c === 0 ? 'clear' : c === 1 ? 'mostly' : c === 2 ? 'partly' : c === 3 ? 'cloud' : c === 45 || c === 48 ? 'fog' :
    c >= 51 && c <= 57 ? 'drizzle' : c >= 61 && c <= 67 ? 'rain' : c >= 71 && c <= 77 ? 'snow' : c >= 80 && c <= 82 ? 'showers' :
    c === 85 || c === 86 ? 'snowshowers' : c >= 95 ? 'storm' : 'cloud';
  const WORDS = {
    /* the Bureau of Meteorology's words: sunny by day, clear by night */
    sydney:   (k, day) => ({ clear:day ? 'Sunny' : 'Clear', mostly:day ? 'Mostly sunny' : 'Mostly clear', partly:'Partly cloudy', cloud:'Cloudy', fog:'Fog', drizzle:'Drizzle',
                             rain:'Rain', showers:'Showers', snow:'Snow', snowshowers:'Snow showers', storm:'Storm' })[k],
    /* the Japan Meteorological Agency's */
    tokyo:    k => ({ clear:'晴れ', mostly:'晴れ', partly:'晴れ時々曇り', cloud:'曇り', fog:'霧', drizzle:'霧雨', rain:'雨', showers:'にわか雨', snow:'雪', snowshowers:'にわか雪', storm:'雷雨' })[k],
    /* the Hong Kong Observatory's */
    hongkong: (k, day) => ({ clear:'天晴', mostly:'大致天晴', partly:day ? '部分時間有陽光' : '多雲', cloud:'天陰', fog:'霧', drizzle:'微雨', rain:'有雨', showers:'驟雨', snow:'下雪', snowshowers:'陣雪', storm:'雷暴' })[k],
    /* the China Meteorological Administration's (Chongqing is the fog city: 雾 comes up often) */
    chongqing:k => ({ clear:'晴', mostly:'晴', partly:'多云', cloud:'阴', fog:'雾', drizzle:'毛毛雨', rain:'雨', showers:'阵雨', snow:'雪', snowshowers:'阵雪', storm:'雷阵雨' })[k],
    /* the US National Weather Service's */
    losangeles:(k, day) => ({ clear:day ? 'Sunny' : 'Clear', mostly:day ? 'Mostly Sunny' : 'Mostly Clear', partly:day ? 'Partly Sunny' : 'Partly Cloudy', cloud:'Cloudy', fog:'Fog',
                              drizzle:'Drizzle', rain:'Rain', showers:'Showers', snow:'Snow', snowshowers:'Snow Showers', storm:'T-storms' })[k],
    /* the Met Office's: sunny day, clear night, sunny intervals, overcast, mist */
    edinburgh:(k, day) => ({ clear:day ? 'Sunny day' : 'Clear night', mostly:day ? 'Sunny intervals' : 'Partly cloudy', partly:day ? 'Sunny intervals' : 'Partly cloudy', cloud:'Overcast',
                             fog:'Mist', drizzle:'Drizzle', rain:'Light rain', showers:'Light shower', snow:'Light snow', snowshowers:'Sleet', storm:'Thunder' })[k]
  };
  /* Los Angeles reads Fahrenheit; the server sends Celsius */
  const F = c => Math.round(c * 9 / 5 + 32);
  const degrees = (id, v) => id === 'losangeles' && isFinite(v) ? F(v) : v;
  /* today's range and the sun, each city's way: Min/Max like the BoM, 最高/最低 like the JMA, the HKO's
     range in 度, a mainland weather app's 9~17℃ */
  const RANGE = {
    sydney:   w => '<i>Min</i> ' + w.lo + '° <i>Max</i> ' + w.hi + '°',
    tokyo:    w => '<i>最高</i>' + w.hi + '℃ <i>最低</i>' + w.lo + '℃',
    hongkong: w => '<i>氣溫</i>' + w.lo + '–' + w.hi + '度',
    chongqing:w => '<i>气温</i>' + w.lo + '~' + w.hi + '℃',
    losangeles:w => '<i>Hi</i> ' + F(w.hi) + '° <i>Lo</i> ' + F(w.lo) + '°',
    edinburgh:w => '<i>High</i> ' + w.hi + '° <i>Low</i> ' + w.lo + '°'
  };
  const SUN = { sydney:['Sunrise', 'Sunset'], tokyo:['日の出', '日の入り'], hongkong:['日出', '日落'], chongqing:['日出', '日落'], losangeles:['Sunrise', 'Sunset'], edinburgh:['Sunrise', 'Sunset'] };
  const UNIT = { sydney:'°', tokyo:'℃', hongkong:'°', chongqing:'℃', losangeles:'°F', edinburgh:'°C' };
  /* "2026-11-21T06:12" is already the city's own clock: 6:12 (5:42 am in Sydney) */
  function hm(iso, id){
    const m = /T(\d\d):(\d\d)/.exec(String(iso || ''));
    if (!m) return '';
    const h = +m[1];
    if (id === 'sydney') return ((h % 12) || 12) + ':' + m[2] + (h < 12 ? ' am' : ' pm');
    if (id === 'losangeles') return ((h % 12) || 12) + ':' + m[2] + (h < 12 ? ' AM' : ' PM');
    return (id === 'tokyo' ? String(h) : m[1]) + ':' + m[2];
  }
  /* small line drawings for the sky (24 × 24, drawn in the stamp's ink) */
  const CLOUD = 'M7 19h10.5a4 4 0 0 0 .4-7.98A6 6 0 0 0 6.3 11.6 3.75 3.75 0 0 0 7 19z';
  const CLOUDUP = 'M7 15.5h10.5a4 4 0 0 0 .4-7.98A6 6 0 0 0 6.3 8.1 3.75 3.75 0 0 0 7 15.5z';
  const SKY = {
    sun:   '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.35 5.35l1.5 1.5M17.15 17.15l1.5 1.5M5.35 18.65l1.5-1.5M17.15 6.85l1.5-1.5"/>',
    moon:  '<path d="M19.6 14.6A8 8 0 0 1 9.4 4.4a8 8 0 1 0 10.2 10.2z"/>',
    psun:  '<path d="M8 2.8v1.6M2.8 8h1.6M4.3 4.3l1.1 1.1M11.7 4.3l-1.1 1.1M4.5 11.4A3.8 3.8 0 0 1 11 6.4"/><path d="M9.5 20.5h8a3.3 3.3 0 0 0 .3-6.6A4.9 4.9 0 0 0 8.4 14.6 3 3 0 0 0 9.5 20.5z"/>',
    pmoon: '<path d="M12.3 9.8A4 4 0 0 1 7.2 4.7a4 4 0 1 0 5.1 5.1z"/><path class="c" d="M9.5 20.5h8a3.3 3.3 0 0 0 .3-6.6A4.9 4.9 0 0 0 8.4 14.6 3 3 0 0 0 9.5 20.5z"/>',
    cloud: '<path d="' + CLOUD + '"/>',
    fog:   '<path d="M4 8.5h16M6.5 12.5h11M4 16.5h16"/>',
    rain:  '<path d="' + CLOUDUP + '"/><path d="M8.6 18.3l-.9 2.4M12.6 18.3l-.9 2.4M16.6 18.3l-.9 2.4"/>',
    snow:  '<path d="' + CLOUDUP + '"/><path d="M8.5 19h.01M12.5 19h.01M16.5 19h.01M10.5 21.6h.01M14.5 21.6h.01"/>',
    storm: '<path d="' + CLOUDUP + '"/><path d="M12.8 16.6l-2 3.2h3l-2 3.1"/>'
  };
  const skyOf = (k, day) => k === 'clear' || k === 'mostly' ? (day ? 'sun' : 'moon') : k === 'partly' ? (day ? 'psun' : 'pmoon') :
    k === 'fog' ? 'fog' : k === 'snow' || k === 'snowshowers' ? 'snow' : k === 'storm' ? 'storm' : k === 'cloud' ? 'cloud' : 'rain';
  const sky = n => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + SKY[n] + '</svg>';

  /* ── each city's printed mark on the postcard ── */
  /* an EAN-13, as printed: China's numbers start 69 */
  function ean(digits){
    const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
    const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
    const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
    const P = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
    const d = digits.split('').map(Number);
    let sum = 0; for (let i = 0; i < 12; i++) sum += d[i] * (i % 2 ? 3 : 1);
    d[12] = (10 - sum % 10) % 10;
    let bits = '101';
    for (let i = 1; i <= 6; i++) bits += (P[d[0]][i - 1] === 'L' ? L : G)[d[i]];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += R[d[i]];
    bits += '101';
    let bars = '';
    for (let i = 0; i < bits.length; i++){
      if (bits[i] !== '1') continue;
      let w = 1; while (bits[i + w] === '1') w++;
      const guard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      bars += '<rect x="' + (i + 7) + '" y="0" width="' + w + '" height="' + (guard ? 34 : 30) + '"/>';
      i += w - 1;
    }
    return { bars, text: d.join('') };
  }
  function printMark(id){
    const now = new Date();
    if (id === 'sydney') return '<div class="ctp-series"><b>City Series / 001</b><span>Sydney NSW 2000</span><span>A$2.50</span></div>';
    if (id === 'tokyo'){
      /* トンボ: a double mark at each corner (the trim and the bleed, 3 mm apart) */
      const c = '<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M0 18.5h12.5M0 26.5h12.5M18.5 0v12.5M26.5 0v12.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
      return ['tl', 'tr', 'br', 'bl'].map(k => '<i class="ctp-tombo ' + k + '">' + c + '</i>').join('') +
        '<i class="ctp-tombo mid l"><svg viewBox="0 0 30 30" aria-hidden="true"><path d="M8 15h22M19 6v18" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="19" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="1"/></svg></i>';
    }
    if (id === 'hongkong'){
      const wave = y => 'M0 ' + y + 'q6.5 -4.5 13 0t13 0t13 0t13 0t13 0t13 0t13 0t13 0t13 0t13 0';
      return '<svg class="ctp-post" viewBox="0 0 230 92" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7">' +
        [22, 34, 46, 58, 70].map(y => '<path d="' + wave(y) + '"/>').join('') +
        '<circle cx="186" cy="46" r="40"/><circle cx="186" cy="46" r="27.5"/><path d="M161 39.5h50M161 53.5h50" stroke-width="1"/></g>' +
        '<defs><path id="ctpt" d="M155.5 46a30.5 30.5 0 0 1 61 0"/><path id="ctpb" d="M150 46a36 36 0 0 0 72 0"/></defs>' +
        '<g fill="currentColor"><text class="en"><textPath href="#ctpt" startOffset="50%" text-anchor="middle">HONG KONG</textPath></text>' +
        '<text class="zh"><textPath href="#ctpb" startOffset="50%" text-anchor="middle">香 港</textPath></text>' +
        '<text class="dt" x="186" y="50" text-anchor="middle">' + esc(postDate(id, now)) + '</text>' +
        '<circle cx="149" cy="46" r="1.6"/><circle cx="223" cy="46" r="1.6"/></g></svg>';
    }
    if (id === 'chongqing'){
      const e = ean('692026000400');
      return '<div class="ctp-label"><span class="t">重庆 · 城市系列 004</span>' +
        '<svg viewBox="0 0 109 41" aria-hidden="true"><g fill="currentColor">' + e.bars + '</g>' +
        '<text x="1.5" y="40">' + e.text[0] + '</text><text x="14" y="40" textLength="38">' + e.text.slice(1, 7) + '</text><text x="60" y="40" textLength="38">' + e.text.slice(7) + '</text></svg>' +
        '<span class="p">明信片 · 定价 ¥3.00</span></div>';
    }
    if (id === 'losangeles') return '<div class="ctp-air">Via Air Mail<span>Por Avión</span></div>';
    if (id === 'edinburgh'){
      /* the bar: process colours, then a grey ramp, as printed in a sheet's margin */
      const sw = ['#00a3d9', '#e2007a', '#ffe500', '#1a1a1a', '#5a5a5a', '#9a9a9a', '#d0d0d0'];
      return '<div class="ctp-bar">' + sw.map(c => '<i style="background:' + c + '"></i>').join('') + '<b>Printed in Edinburgh</b></div>';
    }
    return '';
  }

  /* ── on and off ── */
  let on = '', undo = [];
  const later = fn => undo.push(fn);
  function off(){ undo.splice(0).reverse().forEach(f => { try { f(); } catch {} }); on = ''; }

  function start(id){
    on = id;
    /* the date stamp in the caption (cities.css .cityclock::after) */
    const stampDate = () => root.style.setProperty('--ct-date', JSON.stringify(dateText(id, new Date())));
    stampDate();
    const dt = setInterval(stampDate, 60000);
    later(() => { clearInterval(dt); root.style.removeProperty('--ct-date'); });

    /* the printed mark */
    const pm = document.createElement('div');
    pm.className = 'ctprint'; pm.dataset.c = id; pm.setAttribute('aria-hidden', 'true');
    pm.innerHTML = printMark(id);
    document.body.appendChild(pm);
    later(() => pm.remove());

    if (root.getAttribute('data-pg') === 'home') homeStamp(id);
  }

  /* ── Home: the stamp ── */
  function homeStamp(id){
    const host = document.querySelector('.hubbar .hubin');
    if (!host) return;
    const c = CITY[id];
    let box = null, wx = null, alive = true;
    /* Home fits its greeting to the space (home.html fitHello), but the city's face arrives after that and the
       stamp narrows the space later still: fit it again then, so the name isn't cut to "Welcome back, …" */
    const refit = () => { if (alive && typeof window.fitHello === 'function') window.fitHello(); };
    if (document.fonts && document.fonts.addEventListener){ document.fonts.addEventListener('loadingdone', refit); later(() => document.fonts.removeEventListener('loadingdone', refit)); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    later(() => { alive = false; if (box) box.remove(); host.classList.remove('hasctwx'); if (typeof window.fitHello === 'function') window.fitHello(); });
    const timeFmt = new Intl.DateTimeFormat(c.loc, { timeZone:c.tz, hour:'numeric', minute:'2-digit' });
    function timeHtml(){
      /* 下午 and pm small beside the numbers */
      try {
        return timeFmt.formatToParts(new Date()).map(p => p.type === 'dayPeriod' ? '<small>' + esc(p.value.trim()) + '</small>' : p.type === 'literal' && !p.value.trim() ? '' : esc(p.value)).join('');
      } catch { return ''; }
    }
    function draw(){
      if (!alive || !wx) return;
      const k = kind(wx.code), day = wx.day !== false;
      const word = WORDS[id](k, day) || wx.text || '';
      const sun = SUN[id];
      if (!box){
        box = document.createElement('div');
        box.className = 'ctwx'; box.dataset.c = id; box.setAttribute('role', 'group'); box.setAttribute('lang', c.lang);
        const btns = host.querySelector(':scope > .headbtns');
        host.insertBefore(box, btns || null);
        host.classList.add('hasctwx');
        requestAnimationFrame(refit);
      }
      box.setAttribute('aria-label', 'In ' + c.name + ': ' + (wx.text || '') + ', ' + degrees(id, wx.temp) + ' degrees');
      box.innerHTML = '<div class="ctwx-in">' +
        '<div class="ctwx-top"><span class="ctwx-time">' + timeHtml() + '</span>' +
          '<span class="ctwx-temp">' + esc(degrees(id, wx.temp)) + '<small>' + UNIT[id] + '</small></span></div>' +
        '<div class="ctwx-now">' + sky(skyOf(k, day)) + '<b>' + esc(word) + '</b>' + (!['sydney', 'losangeles', 'edinburgh'].includes(id) && wx.text ? '<span lang="en">' + esc(wx.text) + '</span>' : '') + '</div>' +
        '<div class="ctwx-row">' + (isFinite(wx.hi) && isFinite(wx.lo) ? '<span>' + RANGE[id](wx) + '</span>' : '') +
          (wx.sunrise && wx.sunset ? '<span><i>' + sun[0] + '</i> ' + hm(wx.sunrise, id) + ' <i>' + sun[1] + '</i> ' + hm(wx.sunset, id) + '</span>' : '') + '</div>' +
        '<div class="ctwx-foot"><b>' + esc(c.local) + '</b><span>' + esc(dateText(id, new Date())) + '</span></div></div>';
    }
    const KEY = 'ct.wx.' + id;
    function load(){
      try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (s && Date.now() - s.t < 10 * 60e3 && s.d){ wx = s.d; draw(); return; } } catch {}
      if (!window.TT || !TT.api) return;
      TT.api('/api/leaderboard', { params:{ weather:id }, timeout:15000 }).then(d => {
        if (!alive || !d || d.temp == null || !isFinite(d.temp)) return;
        wx = d; draw();
        try { sessionStorage.setItem(KEY, JSON.stringify({ t:Date.now(), d })); } catch {}
      }).catch(() => {});
    }
    load();
    const t1 = setInterval(() => { if (box) box.querySelector('.ctwx-time').innerHTML = timeHtml(); }, 20000);
    const t2 = setInterval(load, 15 * 60e3);
    later(() => { clearInterval(t1); clearInterval(t2); });
  }

  function look(){
    const id = root.getAttribute('data-city') || '';
    const want = CITY[id] ? id : '';
    if (want === on) return;
    off();
    if (want) start(want);
  }
  function go(){ addEventListener('tt:look', look); look(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once:true }); else go();
})();

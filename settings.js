/* ═══════════════════════════════════════════════════════════════════
   Portable Settings dialog for the home page — a copy of the timetable's
   settings, minus the two panels that need live timetable data (subject
   colours + .ics export, which stay on the timetable). Everything here is
   driven through theme.js's shared TT.apply, so it themes every page the
   same way the timetable's settings do.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
"use strict";
if (!window.TT) return;
const TTx = window.TT;
const SKINS = TTx.SKINS, CUSTOM_FONTS = TTx.CUSTOM_FONTS, CUSTOM_DEFAULTS = TTx.CUSTOM_DEFAULTS;
const EMAIL_DOMAIN = TTx.EMAIL_DOMAIN || 'education.nsw.gov.au';
const get = TTx.get, set = TTx.set;
const LS = { skin:'tt.skin', mode:'tt.mode', custom:'tt.custom', creds:'tt.creds', email:'tt.email', cache:'tt.cache',
  textScale:'tt.textscale', zoom:'tt.zoom', contrast:'tt.contrast', motion:'tt.motion',
  view:'tt.view', outline:'tt.outline', header:'tt.header', zen:'tt.zen',
  room:'tt.room', weekletter:'tt.weekletter', progress:'tt.progress' };
const apply = () => TTx.apply(TTx.readState());
const $ = id => document.getElementById(id);

let skin   = get(LS.skin, 'plain');
let custom = Object.assign({}, CUSTOM_DEFAULTS, get(LS.custom, {}));
let creds  = get(LS.creds, null);

/* ── inject the dialogs ── */
const host = document.createElement('div');
host.innerHTML =
  '<dialog id="setDlg" class="setdlg">' +
    '<form method="dialog" class="dlg-h"><h2>Settings</h2><button class="btn icon" value="close">&#10005;</button></form>' +
    '<div class="dlg-b">' +
      '<div class="field"><label>Appearance</label><div class="skins" id="s_skins"></div></div>' +
      '<div class="field" id="s_customwrap" hidden>' +
        '<label>Custom theme</label>' +
        '<div class="custrow"><span>Background</span><input type="color" id="c_bg"></div>' +
        '<div class="custrow"><span>Card</span><input type="color" id="c_panel"></div>' +
        '<div class="custrow"><span>Text</span><input type="color" id="c_text"></div>' +
        '<div class="custrow"><span>Accent</span><input type="color" id="c_accent"></div>' +
        '<div class="custrow"><span>Corner radius</span><input type="range" id="c_radius" min="0" max="26" step="1"><b id="c_radius_v"></b></div>' +
        '<div class="custrow"><span>Typeface</span><select id="c_font"></select></div>' +
        '<details class="adv"><summary>Advanced</summary>' +
          '<div class="custrow"><span>Border colour</span><input type="color" id="c_line"></div>' +
          '<div class="custrow"><span>Second colour</span><input type="color" id="c_accent2"></div>' +
          '<div class="custrow"><span>Backdrop</span><select id="c_backdrop">' +
            '<option value="solid">Solid</option><option value="gradient">Soft gradient</option><option value="mesh">Colour mesh</option></select></div>' +
          '<div class="custrow"><span>Frosted glass</span><input type="checkbox" id="c_glass" class="sw"></div>' +
          '<div class="custrow"><span>Shadow</span><select id="c_shadow">' +
            '<option value="none">None</option><option value="soft">Soft</option><option value="hard">Hard offset</option></select></div>' +
          '<div class="custrow"><span>Border width</span><input type="range" id="c_border" min="0" max="4" step="1"><b id="c_border_v"></b></div>' +
          '<div class="custrow"><span>Subject tint</span><input type="range" id="c_tint" min="0" max="70" step="1"><b id="c_tint_v"></b></div>' +
        '</details>' +
        '<div class="custrow"><button class="btn" type="button" id="c_reset">Reset custom theme</button></div>' +
      '</div>' +
      '<div class="field"><label>Login</label>' +
        '<div class="hint" style="margin-top:0;margin-bottom:9px">Your school login, stored <b>only on this device</b> and used to fetch your timetable.</div>' +
        '<div class="custrow"><span>School email</span><input type="text" id="cr_email" class="crin" spellcheck="false" autocapitalize="none" autocomplete="off" placeholder="first.last1"></div>' +
        '<div class="custrow"><span>Password</span><input type="password" id="cr_pass" class="crin" autocomplete="off" placeholder="••••••••"></div>' +
        '<div class="custrow"><button class="btn" type="button" id="cr_save">Save login</button><button class="btn" type="button" id="cr_clear">Sign out</button></div>' +
        '<div class="hint" id="cr_state"></div>' +
      '</div>' +
    '</div>' +
    '<div class="dlg-f dlg-f2">' +
      '<div class="tabbtns" id="moresettings">' +
        '<button class="btn" type="button" id="openA11y">Access</button>' +
        '<button class="btn" type="button" id="openDisplay">Display</button>' +
      '</div>' +
      '<div class="tabbtns"><button class="btn" type="button" id="modetoggle"></button></div>' +
    '</div>' +
  '</dialog>' +
  '<dialog id="setA11y" class="setdlg">' +
    '<form method="dialog" class="dlg-h"><h2>Accessibility</h2><button class="btn icon" value="close">&#10005;</button></form>' +
    '<div class="dlg-b"><div class="field">' +
      '<div class="custrow"><span>Text size</span><input type="range" id="a_text" min="80" max="150" step="5"><b id="a_text_v"></b></div>' +
      '<div class="custrow"><span>Zoom</span><input type="range" id="a_zoom" min="70" max="150" step="5"><b id="a_zoom_v"></b></div>' +
      '<div class="custrow"><span>High contrast</span><input type="checkbox" id="a_contrast" class="sw"></div>' +
      '<div class="custrow"><span>Reduce motion</span><input type="checkbox" id="a_motion" class="sw"></div>' +
      '<div class="custrow"><span>Game sounds</span><input type="checkbox" id="g_sfx" class="sw"></div>' +
      '<div class="custrow"><span>Game animations</span><input type="checkbox" id="g_anim" class="sw"></div>' +
      '<div class="custrow"><button class="btn" type="button" id="a_reset">Reset accessibility</button></div>' +
    '</div></div>' +
    '<div class="dlg-f"><button class="btn primary" type="button" data-back>Done</button></div>' +
  '</dialog>' +
  '<dialog id="setDisplay" class="setdlg">' +
    '<form method="dialog" class="dlg-h"><h2>Display</h2><button class="btn icon" value="close">&#10005;</button></form>' +
    '<div class="dlg-b">' +
      '<div class="field"><label>Header</label><div class="modes" id="headers">' +
        '<button type="button" data-header="unified">Classic</button><button type="button" data-header="split">Separated</button></div></div>' +
      '<div class="field"><label>Layout</label><div class="modes" id="views">' +
        '<button type="button" data-view="compact">Compact</button><button type="button" data-view="full">Full</button></div></div>' +
      '<div class="field"><label>Room numbers</label><div class="modes" id="rooms">' +
        '<button type="button" data-room="full">Full</button><button type="button" data-room="building">New</button><button type="button" data-room="number">Legacy</button></div></div>' +
      '<div class="field"><label>Options</label>' +
        '<div class="custrow"><span>Week letter on day names</span><input type="checkbox" id="t_weekletter" class="sw"></div>' +
        '<div class="custrow"><span>Coloured subject outlines</span><input type="checkbox" id="t_outline" class="sw"></div>' +
        '<div class="custrow"><span>Progress bar on Now</span><input type="checkbox" id="t_progress" class="sw"></div>' +
        '<div class="custrow"><span>Transparent background</span><input type="checkbox" id="t_zen" class="sw"></div>' +
        '<div class="hint">These apply to your timetable. Subject colours and .ics export live on the timetable page.</div>' +
      '</div>' +
    '</div>' +
    '<div class="dlg-f"><button class="btn primary" type="button" data-back>Done</button></div>' +
  '</dialog>';
document.body.appendChild(host);

/* ── appearance ── */
function renderSkins(){
  skin = get(LS.skin, 'plain');
  const box = $('s_skins'); box.innerHTML = '';
  SKINS.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'skinbtn'; b.setAttribute('aria-pressed', String(s.id === skin));
    b.innerHTML = '<span class="sw" style="background:' + s.swatch + (s.border ? ';box-shadow:inset 0 0 0 1px ' + s.border : '') + '"></span>' +
                  '<span class="nm">' + s.name + '</span>';
    b.onclick = () => { skin = s.id; set(LS.skin, skin); apply(); renderSkins(); renderCustom(); };
    box.appendChild(b);
  });
}

/* ── custom theme ── */
function renderCustom(){
  const on = get(LS.skin, 'plain') === 'custom';
  $('s_customwrap').hidden = !on;
  if (!on) return;
  custom = Object.assign({}, CUSTOM_DEFAULTS, get(LS.custom, {}));
  const sel = $('c_font'); if (!sel.options.length) CUSTOM_FONTS.forEach(f => sel.add(new Option(f, f)));
  $('c_bg').value = custom.bg; $('c_panel').value = custom.panel; $('c_text').value = custom.text;
  $('c_accent').value = custom.accent; $('c_line').value = custom.line; $('c_accent2').value = custom.accent2;
  $('c_backdrop').value = custom.backdrop; $('c_shadow').value = custom.shadow; $('c_glass').checked = !!custom.glass;
  $('c_radius').value = custom.radius; $('c_radius_v').textContent = custom.radius + 'px';
  $('c_tint').value = custom.tint; $('c_tint_v').textContent = custom.tint + '%';
  $('c_border').value = custom.border; $('c_border_v').textContent = custom.border + 'px';
  sel.value = custom.font;
}
(function bindCustom(){
  const touch = (id, key, after) => $(id).addEventListener('input', ev => {
    custom[key] = (key === 'radius' || key === 'tint' || key === 'border') ? +ev.target.value : ev.target.value;
    set(LS.custom, custom); apply(); if (after) after();
  });
  touch('c_bg','bg'); touch('c_panel','panel'); touch('c_text','text');
  touch('c_accent','accent'); touch('c_accent2','accent2'); touch('c_line','line'); touch('c_font','font');
  touch('c_backdrop','backdrop'); touch('c_shadow','shadow');
  touch('c_radius','radius', () => { $('c_radius_v').textContent = custom.radius + 'px'; });
  touch('c_tint','tint',     () => { $('c_tint_v').textContent   = custom.tint + '%'; });
  touch('c_border','border', () => { $('c_border_v').textContent = custom.border + 'px'; });
  $('c_glass').addEventListener('change', ev => { custom.glass = ev.target.checked; set(LS.custom, custom); apply(); });
  $('c_reset').onclick = () => { custom = Object.assign({}, CUSTOM_DEFAULTS); set(LS.custom, custom); apply(); renderCustom(); };
})();

/* ── login ── */
function renderCreds(){
  creds = get(LS.creds, null);
  $('cr_email').value = creds ? String(creds.email || '').split('@')[0] : '';
  $('cr_pass').value  = creds ? creds.password : '';
  $('cr_state').textContent = creds ? 'Signed in as ' + creds.email : 'Not signed in.';
}
$('cr_save').onclick = () => {
  const user = $('cr_email').value.trim().toLowerCase().split('@')[0];
  const pass = $('cr_pass').value;
  if (!user || !pass){ $('cr_state').textContent = 'Enter both an email and a password.'; return; }
  creds = { email: user + '@' + EMAIL_DOMAIN, password: pass };
  set(LS.creds, creds); localStorage.removeItem(LS.cache);
  if (!get(LS.email, '')) set(LS.email, creds.email);
  renderCreds();
  $('cr_state').textContent = 'Saved. Open the timetable to load it.';
};
$('cr_clear').onclick = () => { creds = null; set(LS.creds, null); localStorage.removeItem(LS.cache); renderCreds(); };

/* ── accessibility ── */
function renderA11y(){
  const ts = get(LS.textScale,1), zm = get(LS.zoom,1);
  $('a_text').value = Math.round(ts*100); $('a_text_v').textContent = Math.round(ts*100)+'%';
  $('a_zoom').value = Math.round(zm*100); $('a_zoom_v').textContent = Math.round(zm*100)+'%';
  $('a_contrast').checked = get(LS.contrast,'normal') === 'high';
  $('a_motion').checked   = get(LS.motion,'normal') === 'reduced';
  $('g_sfx').checked  = get('tt.gamesfx', false);
  $('g_anim').checked = get('tt.gameanim', true);
}
$('a_text').addEventListener('input', ev => { set(LS.textScale, +ev.target.value/100); apply(); renderA11y(); });
$('a_zoom').addEventListener('input', ev => { set(LS.zoom, +ev.target.value/100); apply(); renderA11y(); });
$('a_contrast').addEventListener('change', ev => { set(LS.contrast, ev.target.checked?'high':'normal'); apply(); });
$('a_motion').addEventListener('change',   ev => { set(LS.motion, ev.target.checked?'reduced':'normal'); apply(); });
$('g_sfx').addEventListener('change',  ev => set('tt.gamesfx',  ev.target.checked));
$('g_anim').addEventListener('change', ev => set('tt.gameanim', ev.target.checked));
$('a_reset').onclick = () => { set(LS.textScale,1); set(LS.zoom,1); set(LS.contrast,'normal'); set(LS.motion,'normal'); apply(); renderA11y(); };

/* ── display ── */
function group(id, key, def){
  const wrap = $(id), attr = 'data-' + key, cur = get(LS[key], def);
  [...wrap.children].forEach(b => {
    b.setAttribute('aria-pressed', String(b.getAttribute(attr) === String(cur)));
    b.onclick = () => { set(LS[key], b.getAttribute(attr)); apply();
      [...wrap.children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
  });
}
function toggle(id, key, def){
  const box = $(id); box.checked = get(LS[key], def);
  box.onchange = () => { set(LS[key], box.checked); apply(); };
}
function renderDisplay(){
  group('headers','header','unified'); group('views','view','compact'); group('rooms','room','full');
  toggle('t_weekletter','weekletter', false); toggle('t_outline','outline', true);
  toggle('t_progress','progress', true); toggle('t_zen','zen', false);
}

/* ── mode toggle + open/close wiring ── */
function renderModeBtn(){ $('modetoggle').textContent = get(LS.mode, 'light') === 'dark' ? 'Light mode' : 'Dark mode'; }
$('modetoggle').onclick = () => { set(LS.mode, get(LS.mode,'light')==='dark'?'light':'dark'); apply(); renderModeBtn(); };
$('openA11y').onclick    = () => { renderA11y(); $('setDlg').close(); $('setA11y').showModal(); };
$('openDisplay').onclick = () => { renderDisplay(); $('setDlg').close(); $('setDisplay').showModal(); };
document.querySelectorAll('.setdlg [data-back]').forEach(b => b.onclick = () => {
  b.closest('dialog').close(); openSettings(); });

function openSettings(){
  renderSkins(); renderCustom(); renderCreds(); renderModeBtn();
  $('setDlg').showModal();
  /* finding Settings on your own retires the step that points at it */
  if (window.Tour){ Tour.mark('settings'); Tour.start('settings'); }
}

/* the home page's gear opens Settings now */
const gear = $('themebtn');
if (gear){ gear.onclick = openSettings; gear.title = 'Settings'; }
})();

/* ═══════════════════════════════════════════════════════════════════
   Vaporwave's visitors: what they say, and when.

   Windows 95 windows turn up in the margins beside the page, as if
   something in the machine were keeping itself busy and, now and then,
   trying to say something. This file is only the words and the timing;
   fx/vapor.js draws the windows. It is written to be edited: change a
   line, add one, change a number.

   There are two sorts. The passing windows (ambient: true) come and go all
   the time on a screen with room beside the page, and come round again: a
   note typing itself, something playing, a job that takes its time, a line
   or two. The conversations (the rest) each come once, and some have a
   follow-up hours later that depends on what you answered.

   Write in the same voice: quiet, a little uncanny, wistful, deadpan.
   No exclamation marks. Never hopeless or threatening: if a line sounds
   bleak, give it a gentle follow-up later (see "It's over" below).
   ═══════════════════════════════════════════════════════════════════ */
window.VW_ENTITY = {

  /* ── how often ─────────────────────────────────────────────────── */
  pace: {
    /* on a screen with room beside the page: somebody is usually about */
    firstAfterSeconds: [2, 5],    // after a page opens, the first window turns up within this long...
    idleSeconds: 2,               // ...once the pointer and the keys have been still this long
    staySeconds: [24, 44],        // how long a passing window stays before the other pointer comes and closes it
    gapSeconds: [5, 12],          // the pause between the last one leaving and the next arriving
    secondChance: 0.5,            // the chance that a second window joins the first...
    secondAfterSeconds: [12, 28], // ...this long after it
    maxOpen: 2,                   // never more than this many at once
    storyChance: 0.3,             // the chance that the next one is a conversation rather than a passing window
    typeCps: 30,                  // how fast their words type themselves, in letters a second

    /* on a narrow screen (a phone): none of the above. One small window, rarely: */
    quietSessions: 2,        // no visitors at all in the first 2 sessions after choosing the theme
    sessionGapMinutes: 30,   // away this long, and coming back counts as a new session
    minGapMinutes: 100,      // at least this long between one visitor and the next (about two periods)
    chancePerPage: 0.2,      // once that gap has passed, the chance that opening a page brings one
    maxPerDay: 4,            // never more than this many in a day
    callbackChance: 0.6,     // when a follow-up is due, the chance that the next page brings it
    rareAfter: 5,            // the rare ones (those with your name) only after this many others
    rareGapHours: 72,        // and at most one of them every this many hours
    rareChance: 0.3,         // and even then, only now and then
    narrowChance: 0.35,      // on a phone-sized screen they come this much less often (and never on the timetable)
    appearAfterSeconds: [3, 9],  // how long after a page opens a visitor turns up (a random time in this range)
    fadeAfterSeconds: 75     // how long a window that fades stays, if nobody touches it
  },

  /* ── who comes ─────────────────────────────────────────────────────
     id        a name for it, used by follow-ups
     title     the window's title bar
     text      what it says. {NAME} is the student's first name, DOS style (DEMO, ALEXAN~1)
     icon      door, folder, bin, sun, monitor, opaline (the company's logo) or none
     buttons   each: { label, do, say, open }
                 do: 'vanish' (the default) closes it
                     'reply'  it answers with `say`, then goes
                     'flee'   it jumps to another corner (twice at most), then goes
                     'open'   it goes, and the visitor named in `open` comes at once
                 disabled: true  a button that can't be pressed
     stay      'fade'    leaves by itself after a while, or when the page changes (the default)
               'persist' stays, page after page, until it's closed
               'evade'   its X makes it reappear somewhere else, twice, then it goes
                         (with `lastWord`, if it has one). Its buttons work as usual.
               'shy'     goes the moment your pointer comes near it
     ambient   true: a passing window (see the top of this file). It can come again.
     smear     true: a hung program. Dragged, it leaves copies of itself behind; when its
               time is up the other pointer drags it off the same way.
     after     a follow-up: { id, button, minHours, maxHours }. It comes only after that
               visitor (and, with `button`, only if that was the answer), between minHours
               and maxHours later. maxHours around 20 lets it wait for the next morning.
     weight    how likely, against the others (1 if not given)
     rare      true: one of the rare ones (see pace)
     pages     only on these pages; notOn: never on these. Page names: timetable, home,
               calendar, notes, games, finder, free, revision, resources, mahjong
     kind      'dialog' (the default), 'explorer', 'list', 'web' or 'sunrise' (the windows with more in them);
               'notepad'  lines: [...]  a note that types itself, line by line
               'player'   track, jp, en, length (seconds), from (where it has got to): something playing.
                          The titles are made up; no real songs.
               'progress' text, from, stopAt, done: a bar that fills to stopAt per cent, then says `done`

     Opaline Systems is a company we made up: a 90s software house whose programs
     are still running, cheerfully, for nobody. Its windows are signed with its logo.
  */
  events: [

    /* the owner's */
    { id: 'readonly', title: 'Memory', text: 'This memory is read-only.',
      buttons: [{ label: 'OK' }], stay: 'evade', lastWord: 'Fine.', weight: 2 },

    { id: 'over', title: 'Notice', text: "It's over",
      buttons: [{ label: 'OK' }], stay: 'evade', lastWord: 'Okay.', weight: 2 },
    { id: 'over-2', after: { id: 'over', minHours: 1, maxHours: 20 },
      title: 'Notice', text: "It wasn't, actually.", buttons: [{ label: 'OK' }] },

    { id: 'altenv', title: 'Display', text: 'An alternative environment has been detected.',
      buttons: [{ label: 'View', do: 'open', open: 'sunrise' }, { label: 'Dismiss' }], weight: 2 },

    { id: 'leave', title: 'Exit', icon: 'door', text: 'Would you like to leave this place?',
      buttons: [{ label: 'Stay' }, { label: 'Escape', do: 'flee' }], weight: 2 },
    { id: 'leave-stay', after: { id: 'leave', button: 'Stay', minHours: 1, maxHours: 20 },
      title: 'Exit', icon: 'door', text: 'You stayed. Thank you.', buttons: [{ label: 'OK' }] },
    { id: 'leave-back', after: { id: 'leave', button: 'Escape', minHours: 1, maxHours: 20 },
      title: 'Exit', icon: 'door', text: 'You came back.', buttons: [{ label: 'OK' }] },

    { id: 'drive', kind: 'explorer', title: 'CONSCIOUSNESS', path: 'C:\\{NAME}\\CONSCIOUSNESS\\', rare: true,
      folders: [
        { label: 'DREAMS', say: '3 items. Still loading.' },
        { label: 'MEMORY', say: 'This folder is read-only.' },
        { label: 'DO_NOT_OPEN', say: 'Access is denied.' },
        { label: 'SUMMER_1998', say: 'This folder is empty. It was not always.' }
      ] },

    { id: 'delete', title: 'Memory', text: '{NAME} is attempting to delete memories. Allow?', rare: true,
      buttons: [{ label: 'Allow' }, { label: 'Deny' }] },
    { id: 'delete-allow', after: { id: 'delete', button: 'Allow', minHours: 1, maxHours: 20 },
      title: 'Memory', text: 'Some of them came back anyway.', buttons: [{ label: 'OK' }] },
    { id: 'delete-deny', after: { id: 'delete', button: 'Deny', minHours: 1, maxHours: 20 },
      title: 'Memory', text: 'Kept. They are somewhere safe.', buttons: [{ label: 'OK' }] },

    { id: 'taskmgr', kind: 'list', title: 'Task Manager', icon: 'monitor',
      columns: ['Image Name', 'CPU'],
      rows: [['thoughts.exe', '99'], ['daydream.exe', '01'], ['opaline_update.exe', '00'], ['System Idle Process', '00']],
      foot: 'CPU Usage: 100%', ambient: true,
      buttons: [{ label: 'End Task', disabled: true }, { label: 'Close' }] },

    { id: 'bin', kind: 'list', title: 'Recycle Bin', icon: 'bin',
      columns: ['Name', 'Size'], rows: [['summer.zip', '0 bytes']], foot: '1 object(s)', ambient: true,
      buttons: [{ label: 'Restore', do: 'reply', say: 'There was nothing in it to restore.' }, { label: 'Close' }] },

    { id: 'sunrise', kind: 'sunrise', title: 'Sunrise', icon: 'sun', stay: 'persist' },

    /* Opaline Systems, still running */
    { id: 'opaline', title: 'Opaline System', icon: 'opaline', text: 'Opaline OS is still running. No users have been detected since 1999.',
      buttons: [{ label: 'OK' }] },
    { id: 'opaline-2', after: { id: 'opaline', minHours: 1, maxHours: 20 },
      title: 'Opaline System', icon: 'opaline', text: 'One user detected. Welcome back.', buttons: [{ label: 'OK' }] },
    { id: 'renew', title: 'Opaline System', icon: 'opaline', text: 'Your subscription to Summer 1998 has expired.',
      buttons: [{ label: 'Renew', do: 'reply', say: 'Renewal is no longer available.' }, { label: 'OK' }] },
    { id: 'thanks', title: 'Opaline System', icon: 'opaline', text: 'Thank you for choosing tomorrow.', buttons: [{ label: 'OK' }], ambient: true },

    /* a page from the old web, still up */
    { id: 'homepage', kind: 'web', title: 'welcome.htm', heading: 'Welcome to my page',
      counter: '000001', updated: 'Last updated 14 August 1998', ambient: true },

    /* a thread of our own */
    { id: 'wonder', title: 'Question', text: "Do you wonder what's beyond this screen?",
      buttons: [{ label: 'Yes' }, { label: 'No' }], weight: 2 },
    { id: 'wonder-yes', after: { id: 'wonder', button: 'Yes', minHours: 1, maxHours: 20 },
      title: 'Question', text: 'I looked. It goes on for a while.', buttons: [{ label: 'OK' }] },
    { id: 'wonder-no', after: { id: 'wonder', button: 'No', minHours: 1, maxHours: 20 },
      title: 'Question', text: 'Probably wise.', buttons: [{ label: 'OK' }] },

    /* and a few on their own */
    { id: 'anyone', title: 'Network', text: 'Is anyone there?',
      buttons: [{ label: 'Yes', do: 'reply', say: 'Oh. Hello.' }, { label: 'No', do: 'reply', say: 'Understood.' }] },
    { id: 'saved', title: 'Save', text: 'Your progress has been saved somewhere.', buttons: [{ label: 'OK' }], ambient: true },
    { id: 'mild', title: 'Weather', text: 'It is a mild day in here.', buttons: [{ label: 'OK' }], ambient: true },
    { id: 'forgot', title: 'Reminder', text: 'You came here for something. It will come back to you.', buttons: [{ label: 'OK' }], ambient: true },
    { id: 'nothing', title: 'System', text: 'This window has nothing to report.',
      buttons: [{ label: 'OK' }], stay: 'evade', lastWord: 'Noted.', ambient: true },

    /* ── the passing windows ── */

    /* notes, typing themselves */
    { id: 'pad-list', kind: 'notepad', title: 'list.txt - Notepad', ambient: true,
      lines: ['things to remember:', '- the light in the hall', '- a song, mostly the middle', '- where I put the'] },
    { id: 'pad-letter', kind: 'notepad', title: 'Untitled - Notepad', ambient: true,
      lines: ['Dear whoever finds this,', 'the machine is fine.', 'It only wanted the company.'] },
    { id: 'pad-log', kind: 'notepad', title: 'log.txt - Notepad', ambient: true,
      lines: ['08:55  nobody', '10:05  nobody', '11:45  somebody (you)', '11:46  hello'] },
    { id: 'pad-forecast', kind: 'notepad', title: 'forecast.txt - Notepad', ambient: true,
      lines: ['Forecast for inside:', 'mild, with a chance', 'of afternoon.'] },
    { id: 'pad-readme', kind: 'notepad', title: 'README.TXT - Notepad', ambient: true,
      lines: ['Thank you for installing', 'Opaline Sunrise 2.0.', '', 'There is no step two.'] },

    /* something playing, with no sound */
    { id: 'play-mall', kind: 'player', title: 'Media Player', ambient: true,
      track: '03', jp: '夕暮れのモール', en: 'mall at dusk (slowed)', length: 227, from: 74 },
    { id: 'play-pool', kind: 'player', title: 'Media Player', ambient: true,
      track: '07', jp: 'プールサイド 1998', en: 'poolside 1998', length: 198, from: 12 },
    { id: 'play-hold', kind: 'player', title: 'Media Player', ambient: true,
      track: '01', jp: '保留音', en: 'hold music, extended', length: 599, from: 341 },
    { id: 'play-rain', kind: 'player', title: 'Media Player', ambient: true,
      track: '11', jp: '雨の日のテレビ', en: 'television on a rainy day', length: 242, from: 130 },

    /* jobs that take their time */
    { id: 'defrag', kind: 'progress', title: 'Disk Defragmenter', icon: 'hour', ambient: true,
      text: 'Putting the afternoon back in order.', from: 12, stopAt: 99, done: '99%. The last piece is being shy.' },
    { id: 'copying', kind: 'progress', title: 'Copying', icon: 'folder', ambient: true,
      text: 'Copying summer.zip to Somewhere Safe.', from: 3, stopAt: 100, done: 'Copied. Nothing was lost.' },
    { id: 'dialup', kind: 'progress', title: 'Connecting', icon: 'monitor', ambient: true,
      text: 'Dialling the outside.', from: 0, stopAt: 64, done: 'No answer. It rang for a while, though.' },

    /* a hung program: drag it, or wait for the other pointer to */
    { id: 'frozen', title: 'daydream.exe', icon: 'hour', ambient: true, smear: true, weight: 0.7,
      text: 'This program is not responding. It is thinking about something else.', buttons: [{ label: 'Wait' }] },

    /* a shy one */
    { id: 'peek', title: 'Window', ambient: true, stay: 'shy', weight: 0.7,
      text: 'Oh. I did not think anyone was looking.' }
  ]
};

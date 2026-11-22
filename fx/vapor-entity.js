/* ═══════════════════════════════════════════════════════════════════
   Vaporwave's visitors: what they say, and when.

   Now and then a Windows 95 window turns up in the margin beside the page,
   as if something in the machine were trying to say something. This file
   is only the words and the timing; fx/vapor.js draws the windows. It is
   written to be edited: change a line, add one, change a number.

   Write in the same voice: quiet, a little uncanny, wistful, deadpan.
   No exclamation marks. Never hopeless or threatening: if a line sounds
   bleak, give it a gentle follow-up later (see "It's over" below).
   ═══════════════════════════════════════════════════════════════════ */
window.VW_ENTITY = {

  /* ── how often ─────────────────────────────────────────────────── */
  pace: {
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
     after     a follow-up: { id, button, minHours, maxHours }. It comes only after that
               visitor (and, with `button`, only if that was the answer), between minHours
               and maxHours later. maxHours around 20 lets it wait for the next morning.
     weight    how likely, against the others (1 if not given)
     rare      true: one of the rare ones (see pace)
     pages     only on these pages; notOn: never on these. Page names: timetable, home,
               calendar, notes, games, finder, free, revision, resources, mahjong
     kind      'dialog' (the default), 'explorer', 'list', 'web' or 'sunrise' (the windows with more in them)

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
      foot: 'CPU Usage: 100%',
      buttons: [{ label: 'End Task', disabled: true }, { label: 'Close' }] },

    { id: 'bin', kind: 'list', title: 'Recycle Bin', icon: 'bin',
      columns: ['Name', 'Size'], rows: [['summer.zip', '0 bytes']], foot: '1 object(s)',
      buttons: [{ label: 'Restore', do: 'reply', say: 'There was nothing in it to restore.' }, { label: 'Close' }] },

    { id: 'sunrise', kind: 'sunrise', title: 'Sunrise', icon: 'sun', stay: 'persist' },

    /* Opaline Systems, still running */
    { id: 'opaline', title: 'Opaline System', icon: 'opaline', text: 'Opaline OS is still running. No users have been detected since 1999.',
      buttons: [{ label: 'OK' }] },
    { id: 'opaline-2', after: { id: 'opaline', minHours: 1, maxHours: 20 },
      title: 'Opaline System', icon: 'opaline', text: 'One user detected. Welcome back.', buttons: [{ label: 'OK' }] },
    { id: 'renew', title: 'Opaline System', icon: 'opaline', text: 'Your subscription to Summer 1998 has expired.',
      buttons: [{ label: 'Renew', do: 'reply', say: 'Renewal is no longer available.' }, { label: 'OK' }] },
    { id: 'thanks', title: 'Opaline System', icon: 'opaline', text: 'Thank you for choosing tomorrow.', buttons: [{ label: 'OK' }] },

    /* a page from the old web, still up */
    { id: 'homepage', kind: 'web', title: 'welcome.htm', heading: 'Welcome to my page',
      counter: '000001', updated: 'Last updated 14 August 1998' },

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
    { id: 'saved', title: 'Save', text: 'Your progress has been saved somewhere.', buttons: [{ label: 'OK' }] },
    { id: 'mild', title: 'Weather', text: 'It is a mild day in here.', buttons: [{ label: 'OK' }] },
    { id: 'forgot', title: 'Reminder', text: 'You came here for something. It will come back to you.', buttons: [{ label: 'OK' }] },
    { id: 'nothing', title: 'System', text: 'This window has nothing to report.',
      buttons: [{ label: 'OK' }], stay: 'evade', lastWord: 'Noted.' }
  ]
};

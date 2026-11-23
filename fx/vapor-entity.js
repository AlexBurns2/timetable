/* ═══════════════════════════════════════════════════════════════════
   Vaporwave's messages: what they say, and when.

   Now and then a Windows 95 message box turns up at the side of the
   screen, beside the page (never in the middle of it). Rarely: three or four in a day for somebody who uses the
   site a lot; one, perhaps, for somebody who looks in once or twice.
   Most are found waiting when you come back after a while away, as if
   they had come while you were gone; a few arrive in front of you.
   This file is only the words and the timing; fx/vapor.js draws the
   windows. It is written to be edited: change a line, add one, change
   a number.

   To write one, copy a line from the list and change it:
     { id: 'a-name', title: 'the title bar', text: 'what it says',
       buttons: [{ label: 'one' }, { label: 'two' }] },

   The voice: short, lower case, deadpan. A notification that says a
   little too much. No exclamation marks, and nobody speaking as "I".
   A follow-up that explains or softens the first message spoils it.
   ═══════════════════════════════════════════════════════════════════ */
window.VW_ENTITY = {

  /* ── how often ─────────────────────────────────────────────────── */
  pace: {
    maxPerDay: 4,              // never more than this many in a day
    minGapMinutes: 120,        // at least this long between one and the next

    /* most are found waiting when you come back */
    awayMinutes: 20,           // "away": the site not looked at (its tab hidden, or closed) for this long
    awayChance: 0.5,           // coming back after that, the chance that one is waiting

    /* a few arrive in front of you */
    liveChance: 0.04,          // on any other page you open, the chance that one arrives while you're there...
    liveAfterSeconds: [20, 90],// ...this long after the page opens (a random time in this range)...
    idleSeconds: 2,            // ...once the pointer and the keys have been still this long

    stayMinutes: [3, 7],       // one that isn't answered stays this long (and follows you from page to page), then another pointer closes it
    repeatAfterDays: 14,       // one that has been seen can come again after this many days
    followUpChance: 0.7,       // when a follow-up is due, the chance that it is the one that comes

    rareAfter: 5,              // the rare ones (those with your name) only after this many others
    rareGapHours: 72,          // and at most one of them every this many hours
    rareChance: 0.3,           // and even then, only now and then

    phoneChance: 0.5,          // on a phone-sized screen they come this much less often (and never on the timetable)
    phoneStaySeconds: 75,      // and stay only this long: there, a window covers part of the page
    typeCps: 30                // how fast the words of one that arrives in front of you type themselves, in letters a second
  },

  /* ── the messages ──────────────────────────────────────────────────
     id        a name for it (any, but each its own): what follow-ups point at, and how it is remembered
     title     the window's title bar
     text      what it says. {NAME} is the student's first name, DOS style (DEMO, ALEXAN~1)
     buttons   each: { label, do, say, open }
                 do: 'vanish' (the default) closes it
                     'reply'  it answers with `say`, then goes
                     'flee'   it jumps to another corner (twice at most), then goes
                     'open'   it goes, and the one named in `open` comes at once
                 disabled: true  a button that can't be pressed
     icon      door, folder, bin, sun, monitor, hour, opaline or none
     stay      (nothing)  it stays a few minutes, or until it is answered or closed
               'persist'  stays until it's closed
               'evade'    its X makes it reappear somewhere else, twice, then it goes
                          (with `lastWord`, if it has one). Its buttons work as usual.
               'shy'      goes the moment your pointer comes near it
     hours     [from, to]: only between these hours of the day (24-hour; [5, 12] is the morning)
     after     a follow-up: { id, button, minHours, maxHours }. It comes only after that
               one (and, with `button`, only if that was the answer), between minHours
               and maxHours later. maxHours around 20 lets it wait for the next morning.
     weight    how likely, against the others (1 if not given)
     again     days before it can come again (repeatAfterDays, above, if not given)
     rare      true: one of the rare ones (see pace)
     hidden    true: never comes by itself, only when another's button opens it
     smear     true: a hung program. Dragged, it leaves copies of itself behind; when its
               time is up the other pointer drags it off the same way.
     pages     only on these pages; notOn: never on these. Page names: timetable, home,
               calendar, notes, games, finder, free, revision, resources, mahjong
     kind      'dialog' (the default: a message with buttons); the windows with more in them:
               'explorer' (path, folders), 'list' (columns, rows, foot), 'sunrise',
               'player'   track, jp, en, length (seconds), from (where it has got to): something
                          playing, with no sound. The titles are made up; no real songs.
               'notepad'  lines: [...]  a note that types itself, line by line
               'progress' text, from, stopAt, done: a bar that fills to stopAt per cent, then says `done`
               (also there to use: 'web', heading, counter, updated: a page from the old web)
  */
  events: [

    /* ── the owner's ── */
    { id: 'checking', title: 'just checking', text: 'you still think about it?',
      buttons: [{ label: 'no' }, { label: 'sometimes' }, { label: 'everyday' }] },
    { id: 'goback', title: 'reminder', text: 'you cannot go back there',
      buttons: [{ label: 'ok' }, { label: 'dismiss' }] },
    { id: 'happy', title: 'hello?', text: 'are you happy with how things turned out?',
      buttons: [{ label: 'next question' }, { label: 'not really' }] },
    { id: 'advice', title: 'advice', text: 'if he wanted to, he would',
      buttons: [{ label: 'unfortunately' }, { label: 'block' }] },
    { id: 'update', title: 'a little update', text: 'nothing has changed',
      buttons: [{ label: 'good' }, { label: 'oh' }] },
    { id: 'morning', title: 'good morning', text: 'you are not behind', hours: [5, 12],
      buttons: [{ label: 'thanks' }, { label: 'dismiss' }] },
    { id: 'lastseen', title: 'last seen', text: 'online 8 years ago',
      buttons: [{ label: 'delete' }, { label: 'message' }] },

    /* existential system messages */
    { id: 'tomorrows', title: 'system notice', text: 'you are running out of tomorrows',
      buttons: [{ label: 'continue' }] },
    { id: 'unsaved', title: 'You have unsaved changes.', text: 'Would you like to save the person you used to be?',
      buttons: [{ label: 'Save' }, { label: 'Discard' }] },
    { id: 'youngest', title: 'reminder', text: 'this is the youngest you will ever be again',
      buttons: [{ label: 'ok' }] },
    { id: 'restore', title: 'restore point', text: 'backup found 06-11-2019',
      buttons: [{ label: 'restore' }, { label: 'delete' }] },

    /* satire */
    { id: 'story', title: 'new notification', text: "someone you don't know liked your story",
      buttons: [{ label: 'view' }, { label: 'ignore' }] },
    { id: 'advert', title: 'advertisement', text: "buy something. you'll feel better",
      buttons: [{ label: 'shop now' }, { label: 'shop later' }] },
    { id: 'privacy', title: 'privacy settings', text: 'your data has been shared with 157 licensed partners',
      buttons: [{ label: 'okay' }] },
    { id: 'terms', title: 'terms of service', text: 'you have agreed to everything',
      buttons: [{ label: 'continue' }] },
    { id: 'follower', title: 'new follower', text: 'another person is watching you',
      buttons: [{ label: 'follow back' }, { label: 'ignore' }] },

    /* absurd */
    { id: 'moon', title: 'important', text: 'the moon is not real. my bad',
      buttons: [{ label: 'ok' }] },
    { id: 'optimised', title: 'system update', text: 'you have been optimised',
      buttons: [{ label: 'undo' }] },
    { id: 'blank', title: 'new document', text: 'a blank page. how exciting.',
      buttons: [{ label: 'start' }, { label: 'panic' }] },

    /* ── kept from the first set ── */
    { id: 'readonly', title: 'Memory', text: 'This memory is read-only.',
      buttons: [{ label: 'OK' }], stay: 'evade', lastWord: 'Fine.' },

    { id: 'over', title: 'Notice', text: "It's over",
      buttons: [{ label: 'OK' }], stay: 'evade', lastWord: 'Okay.' },

    { id: 'altenv', title: 'Display', text: 'An alternative environment has been detected.',
      buttons: [{ label: 'View', do: 'open', open: 'sunrise' }, { label: 'Dismiss' }] },
    { id: 'sunrise', kind: 'sunrise', title: 'Sunrise', icon: 'sun', stay: 'persist', hidden: true },

    { id: 'leave', title: 'Exit', icon: 'door', text: 'Would you like to leave this place?',
      buttons: [{ label: 'Stay' }, { label: 'Escape', do: 'flee' }] },
    { id: 'leave-back', after: { id: 'leave', button: 'Escape', minHours: 1, maxHours: 20 },
      title: 'Exit', icon: 'door', text: 'You came back.', buttons: [{ label: 'OK' }] },

    { id: 'wonder', title: 'Question', text: "Do you wonder what's beyond this screen?",
      buttons: [{ label: 'Yes' }, { label: 'No' }] },
    { id: 'wonder-no', after: { id: 'wonder', button: 'No', minHours: 1, maxHours: 20 },
      title: 'Question', text: 'Probably wise.', buttons: [{ label: 'OK' }] },

    { id: 'saved', title: 'Save', text: 'Your progress has been saved somewhere.', buttons: [{ label: 'OK' }] },

    { id: 'renew', title: 'Subscription', text: 'Your subscription to MSC Unofficial has expired.',
      buttons: [{ label: 'Renew', do: 'reply', say: 'Renewal is no longer available.' }, { label: 'OK' }] },

    { id: 'opaline', title: 'Opaline System', icon: 'opaline', text: 'Opaline OS is still running. No users have been detected since 1999.',
      buttons: [{ label: 'OK' }] },

    /* a hung program: drag it, or wait for the other pointer to */
    { id: 'frozen', title: 'thoughts.exe', icon: 'hour', smear: true, weight: 0.7,
      text: 'This program is not responding.', buttons: [{ label: 'Wait' }] },

    /* the rare ones, with your name */
    { id: 'delete', title: 'Memory', text: '{NAME} is attempting to delete memories. Allow?', rare: true,
      buttons: [{ label: 'Allow' }, { label: 'Deny' }] },

    { id: 'drive', kind: 'explorer', title: 'CONSCIOUSNESS', path: 'C:\\{NAME}\\CONSCIOUSNESS\\', rare: true,
      folders: [
        { label: 'DREAMS', say: '3 items. Still loading.' },
        { label: 'MEMORY', say: 'This folder is read-only.' },
        { label: 'DO_NOT_OPEN', say: 'Access is denied.' },
        { label: 'SUMMER_1998', say: 'This folder is empty.' }
      ] },

    /* windows with more in them */
    { id: 'taskmgr', kind: 'list', title: 'Task Manager', icon: 'monitor', weight: 0.7,
      columns: ['Image Name', 'CPU'],
      rows: [['thoughts.exe', '99'], ['explorer.exe', '01'], ['System Idle Process', '00']],
      foot: 'CPU Usage: 100%',
      buttons: [{ label: 'End Task', disabled: true }, { label: 'Close' }] },

    { id: 'bin', kind: 'list', title: 'Recycle Bin', icon: 'bin', weight: 0.7,
      columns: ['Name', 'Size'], rows: [['New Folder', '0 bytes']], foot: '1 object(s)',
      buttons: [{ label: 'Restore', do: 'reply', say: 'The original location no longer exists.' }, { label: 'Close' }] },

    /* ── notes, typing themselves, and left unfinished ── */
    { id: 'pad-remember', kind: 'notepad', title: 'Untitled - Notepad', weight: 0.8,
      lines: ['remember to'] },
    { id: 'pad-list', kind: 'notepad', title: 'list.txt - Notepad', weight: 0.8,
      lines: ['things to remember:', '1.', '2.', '3. where i put the'] },
    { id: 'pad-todo', kind: 'notepad', title: 'to do.txt - Notepad', weight: 0.8,
      lines: ['to do:', '1. reply', '2.'] },
    { id: 'pad-draft', kind: 'notepad', title: 'draft.txt - Notepad', weight: 0.8,
      lines: ['hey', 'hey, sorry', 'never mind'] },

    /* ── jobs that take their time ── */
    { id: 'defrag', kind: 'progress', title: 'Disk Defragmenter', icon: 'hour', weight: 0.7,
      text: 'Putting the afternoon back in order.', from: 12, stopAt: 99, done: '99%. The last piece is being shy.' },
    { id: 'copying', kind: 'progress', title: 'Copying', icon: 'folder', weight: 0.7,
      text: 'Copying summer.zip to Somewhere Safe.', from: 3, stopAt: 100, done: 'Copied. Nothing was lost.' },
    { id: 'dialup', kind: 'progress', title: 'Connecting', icon: 'monitor', weight: 0.7,
      text: 'Dialling the outside.', from: 0, stopAt: 64, done: 'No answer. It rang for a while, though.' },

    /* ── something playing, with no sound. The titles are made up; no real songs. ── */
    { id: 'play-lawn', kind: 'player', title: 'Media Player', weight: 0.8,
      track: '03', jp: 'ローンチェア', en: 'lawnchairs', length: 227, from: 74 },
    { id: 'play-indigo', kind: 'player', title: 'Media Player', weight: 0.8,
      track: '07', jp: 'インディゴの女', en: 'indigo woman', length: 198, from: 12 },
    { id: 'play-fruit', kind: 'player', title: 'Media Player', weight: 0.8,
      track: '01', jp: 'ガラスの果物', en: 'glass fruit', length: 599, from: 341 },
    { id: 'play-soft', kind: 'player', title: 'Media Player', weight: 0.8,
      track: '11', jp: 'やわらかい家電', en: 'soft appliances', length: 242, from: 130 },
    { id: 'play-pale', kind: 'player', title: 'Media Player', weight: 0.8,
      track: '05', jp: '青白いエスカレーター', en: 'pale escalator', length: 264, from: 201 },
    { id: 'play-ocean', kind: 'player', title: 'Media Player', weight: 0.8,
      track: '09', jp: '二番目の海', en: 'second ocean', length: 312, from: 47 }
  ]
};

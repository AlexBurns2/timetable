# Animation rules

Every animation on the timetable (`andre/index.html`) uses the Calendar's timing.
Build new ones from the code below, so they can't drift apart. Don't write new
timings.

## The timing

These live in the code. Change them there, not here, and every animation follows.

| Name | Value | Used for |
|---|---|---|
| `MOVE.v` | 440ms | Moving up or down |
| `MOVE.h` | 440ms | Moving sideways |
| `MAZE` | see the code | Lanes opening, closing and holding, and sliding speed |
| `EASE` | `cubic-bezier(.45,0,.25,1)` | Every block move |

A week change plays on one shared clock, starting the moment the button is pressed:

| When | What happens |
|---|---|
| 0 | Everything starts. Don't wait for anything, including the page scrolling up. |
| 0 to 220ms | Headings that are changing fade out. |
| From 0 | Blocks with nothing to become slide off in waves (below). Everything else waits for the last lane to close, at `T0`. With nothing leaving, `T0` is 0. |
| `T0` to +180ms | The text on a block that's changing fades out. |
| `T0` to +440ms | Blocks move up or down to their new height. |
| +440 to +880ms | Blocks move sideways. Colour and content change: the new look fades in across the whole step, and the old look fades out over the last 55%. Score fills and graph lines grow. |
| +760 to +1080ms | Headings that are changing fade in. |
| From +880ms | New blocks slide on in waves. |

## Waves

Blocks only ever slide on or off the side of the screen, the way the week arrows do
it, with `MAZE` timing. Nothing fades, shrinks or gets cut off.

- A block goes to the side with the fewest staying blocks in its way, else the nearer
  side, with the rest of its day. So a block that's opening out is left where it is.
- Lanes open: in every day it crosses, the blocks in the way and everything below them
  move down, then move back once it has passed.
- Going off, the day nearest the edge goes first. Coming on, the middle days come first.

## Which block becomes which

`matchBlocks` pairs old blocks with new ones, closest first and in any day:

1. The same block (`data-sig`).
2. The same thing at an overlapping time (`data-who` and `data-span`).
3. Whatever's closest. Inside a block's own width counts as no distance, so a two-day
   Mahjong block is as near to a lesson in either day.

A pair is only taken if it can make its moves without touching a pair already taken.
Anything left over slides off or on.

## No block touches another

No block may overlap another at any moment, at any step of an animation. This is
why the order above can't change:

1. **Blocks never cross.** `matchBlocks` turns down a pair whose path touches another,
   so `pathsClash` has to match what the blocks really do. For example, when a game
   changes the ranks, a player who jumps up slides off and on again.
2. **Blocks slide off before anything else moves.** Nothing is in their way but
   blocks standing still, and those step aside.
3. **A wave waits for the lanes it crosses to close.** A day's blocks are only ever in
   one lane at a time.
4. **New blocks slide on last,** once everything else has stopped.

Rule 1 works because every block moves on the same clock with the same easing. Give
one block a different delay, duration or easing and this breaks.

## Adding an animation

To change what the week shows, change the state inside `shiftWeek`:

```js
const flip = () => { myThing = !myThing; paintMyTile(); };
shiftWeek(flip);
```

`shiftWeek` measures the week before and after and works out every move itself. It
also covers scrolling up to the timetable, phones, a press mid-animation, and the
Animations setting being off. Nothing else needs writing.

Anything that draws blocks needs:

- `data-sig`: the same value on the same block before and after, if it can stay
  the same block.
- `data-who` and `data-span`: what it is and its time span, so a period that changes
  length still counts as the same block.
- A class listed in `weekSide`, currently `.blk`, `.gap` and `.mjb` (phone: `.card`,
  `.brk` and `.mjb`). Anything else isn't animated.

## Other animations

- **Week arrows** use `turnWeek`, with lanes that open to let blocks through. It's a
  different animation, and a press can speed it up, so it keeps its own timing.
- **Calendar** uses `morphPlay`. It plays on the same clock but sends days out
  sideways along rows. Don't copy that for a new animation: use waves.
- **Opening a tile** (`flyTiles`) and **opening a lesson** only move the thing you
  pressed.

## Checking one

Don't judge an animation by eye alone. Freeze it at several points and measure:

```js
morphing.forEach(a => { a.pause(); a.currentTime = 600; });
```

Then compare the rectangles of `.morph .mp`, skipping pieces with no height and the
headings (their inline `border-radius` reads `0px`). No two should overlap by more than 1px. Check Who's free, Custom periods, Mahjong and Games in both directions, plus saving
a game that changes the ranks.

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
| `EASE` | `cubic-bezier(.45,0,.25,1)` | Every block move |

A week change plays on one shared clock, starting the moment the button is pressed:

| When | What happens |
|---|---|
| 0 | Everything starts. Don't wait for anything, including the page scrolling up. |
| 0 to 180ms | The text on a block that's changing fades out. |
| 0 to 220ms | Headings that are changing fade out. |
| 0 to 440ms | Blocks move up or down to their new height. Blocks with nothing to become close up. |
| 440 to 880ms | Blocks move sideways. Colour and content change: the new look fades in across the whole step, and the old look fades out over the last 55%. Score fills and graph lines grow. |
| 760 to 1080ms | Headings that are changing fade in. |
| 880 to 1320ms | New blocks open up. |

## No block touches another

No block may overlap another at any moment, at any step of an animation. This is
why the order above can't change:

1. **Blocks never cross.** Pairs that would swap places aren't moved. `keepOrder`
   keeps the most blocks it can in their order, and the rest close up in one place
   and open up in the other. For example, when a game changes the ranks, a player
   who jumps up closes and reopens.
2. **Blocks with nothing to become close up inside their own day.** They shrink to
   nothing between their neighbours while those neighbours move. They never slide
   across another day.
3. **Everything leaves before anything spreads.** Blocks that are closing finish by
   440ms, and sideways moves start after that. A block getting wider always has
   clear space.
4. **New blocks open last,** once everything else has stopped, into space that's
   already clear.

Rules 1 and 2 work because every block moves on the same clock with the same easing.
Two blocks in order at the start and end stay in order the whole way. Give one block
a different delay, duration or easing and this breaks.

## Adding an animation

To change what the week shows, change the state inside `shiftWeek`:

```js
const flip = () => { myThing = !myThing; paintMyTile(); };
shiftWeek(flip);        // a block stays the same block: same subject, same period
shiftWeek(flip, true);  // loose: any overlapping blocks can turn into each other
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
  sideways along rows. Don't copy that for a new animation: rule 2 above applies.
- **Opening a tile** (`flyTiles`) and **opening a lesson** only move the thing you
  pressed.

## Checking one

Don't judge an animation by eye alone. Freeze it at several points and measure:

```js
morphing.forEach(a => { a.pause(); a.currentTime = 600; });
```

Then compare the rectangles of `.morph .mp`, skipping pieces with no height and the
headings (their inline `border-radius` reads `0px`). No two should overlap by more
than 1px. Check Who's free, Custom periods and Mahjong in both directions, plus saving
a game that changes the ranks.

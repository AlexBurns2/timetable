# Synthwave: re-making the models and the stills

Tools for the Synthwave theme (`fx/synth.js`, `skins/synth.css`). `tools/` is not deployed.

## The towers (`models/synth/towers.glb`)

The towers and the street's cinema (next section) are the only models. The car and the palms are
built in code in `fx/synth.js` (`carArrays` and `palmArrays`, seeded), so they have nothing to
regenerate.

One thing to know before tuning a material there: this Three.js (r170) ignores a material's
`envMapIntensity` when the sky light comes from `scene.environment`, so those numbers (and
`DAY.*.env`) do nothing. A material that should take less of the sky sets
`userData.envK = [dusk, night]`; it is then given the map itself and that strength. Only the
car's paint and its small pale parts do.

The towers are a lean copy of three of Kenney's CC0 skyscrapers. The triangles are split by what
they are (glass, frame, wall, dark). There are no textures, UVs, normals or vertex colours, and
positions are stored as int16 (`KHR_mesh_quantization`).

1. Put these in one folder, outside the repo:
   - from **City Kit Commercial**: `building-skyscraper-a.glb`, `-c.glb` and `-e.glb`;
   - the kit's `Textures/colormap.png`, renamed `colormap-city.png`.
2. From the repo root (needs Pillow), run:

   ```
   python -P tools/synth/conv.py --src <that folder>
   ```

   It writes `towers.glb` into `models/synth`. Use `--out` to write it somewhere else, and
   `--towers a,c,e` to pick the towers. `fx/synth.js` expects `tower-a`, `tower-c` and
   `tower-e`; change its `names` list if you change them.

Run it with `-P` and never from inside the download folder: downloaded files are data, not code.

## The cinema (`models/synth/cinema.glb`)

The street scene is built round a model the owner makes in Blender (`models/synth/cinema.blend`;
`.vercelignore` keeps `.blend` files off the site). `cinema.py` turns an export of it into the lean
file the page loads, and works out where things go. Nothing in the page knows the model's shapes,
so the model can change: only these names matter.

| In Blender | What the page does with it |
|---|---|
| material `building` | a dark wall, lit by whatever neon is near it |
| material `glass facade` | glass, with frames added and a lit lobby built behind it |
| material containing `sign` (now `CINEMA sign`) | the letters become black holders, and neon tubes are bent round them: round each heavy stroke, down the middle of each hairline. Flat or curved lettering both work |
| materials `neon blue`, `neon red`… | lit tubes. Colours known: blue, cyan, green, yellow, red, pink, white, orange, purple |
| no material | dark painted metal (the canopy's rings, the tower, the fin), lit by the neon near it |
| material `road` | the biggest such mesh is the ground: only its extent is kept (the page's ground is one wet mirror, and water starts past its far edge). Every raised flat top in any `road` mesh, 14 cm or more above the road, becomes a pavement. The pavement left of the street that reaches nearest the camera is taken as an L (a strip along the street, an arm along the waterfront road): the page lays a tiled plaza, bollards and a bench on the ground inside it |
| an object named `car` | where the page parks its own car, and which way it faces (the box's long side) |
| an object named `video store` (or starting `store` or `record`) | the box the page builds the shop on: brick, neon, windows, the lit shop inside |
| the camera | where we stand (the page stands there, lower, and turned less to the right) |

Meshes can be inside out: nothing relies on which way a face is wound. Pavements cut off at the
model's edge are run on (towards the viewer, and out to both sides along the waterfront).

To update the site after changing the model:

1. In Blender: File > Export > glTF 2.0, format glTF Binary, Include: Visible Objects and
   Cameras, Transform: +Y Up, Mesh: Apply Modifiers. Save it outside the repo.
2. From the repo root (needs NumPy and OpenCV):

   ```
   python -P tools/synth/cinema.py <that file.glb>
   ```

   It writes `models/synth/cinema.glb` and lists each part. `--debug sign.png` saves a picture of
   the lines the sign's neon will follow, to check them.
3. Re-make the street's stills (below), and bump the asset version.

### Traps in lighting it (all met on 2026-11-23: "possibly too washed out? The neon looks a bit too pale")

- **Coloured lights that overlap add up to grey.** The canopy's four rings each lit everything within three metres; blue, green,
  yellow and red together are a pale grey, and the whole canopy was that. A tube's light on what is near it has to fall off
  within about half a metre (`glowLit`), so each tier takes its own ring's colour.
- **A bright colour needs its other two channels near nothing.** The last pass's tone curve lifts whatever is dim in a bright
  pixel, so a tube given a little white "so it blooms" comes out pastel. `TUBE` holds the lesser channels at a few per cent.
  The same goes for lamps: a tail lamp with 4% green in it is pink.
- **A lamp near something glossy is a white dot on it.** A fill lamp at head height in front of the car stood on its roof like a
  police light; the lobby's lamp stood in the middle of its window. Put a fill lamp where no surface that faces us can mirror
  it (below the car's waist), and don't make window glass a mirror.
- **Silver is the colour of whatever is round it.** Under a pink sky a silver car is pink all over, flat, and every simple panel
  shows. Dark and glossy reads as a shape with lit edges.
- **A pale thing behind a tube takes the tube away.** The shop had a pale band behind each neon line; the line was lost in it.

## The street's parked car (`models/synth/car.glb`, `images/synth/car.webp`)

Shotkey's "Alfa Romeo 164" (Sketchfab, **CC BY-SA 4.0**: credited in About, and our two files carry the same licence). The
owner chose it and downloaded it. `tools/synth/car.py` makes both files from the download (`alfa-164.obj`, `main.png`):

```
python -P tools/synth/car.py --src <folder holding alfa-164.obj and main.png> [--paint '#0f5a66'] [--debug <prefix>]
```

- The mesh is unchanged (4,180 triangles, its own normals). The picture is **redrawn in flat colours**: each bit of it is
  sorted into a kind (bodywork, glass, window surround, lamp, plate, tyre, wheel, dark trim) and given that kind's one colour.
  No badges, no lettering, blank plates. The rear lamps are one straight bar across the tail.
- The picture's **alpha is gloss, not transparency** (128 matt to 255 mirror). The page's shader reads it.
- `--debug` writes the flat picture, the gloss channel and the kinds as PNGs: look at them after any change to the sorting.
- Run it from the repo root with `-P`, never from inside the download folder.

In the page (`fx/synth.js`, the street scene, "the car"):

- **Its light is worked out in its own shader**, from where the cinema, the shop and the street lamp stand. The cinema's and
  the shop's real lights do not reach it.
- **Its shadow must draw after the light pools on the road** (`renderOrder` 1.3 against the pools' 1.2), or the lamp's pool
  lights the road under the car and it floats.
- **`look.place` parks it by the window**, once a resize: forward along the kerb until its nose clears the page column, but
  never so far that its tail leaves the picture. The table of where it lands is in HANDOFF 8.182. If the page column's width
  changes (960 px now), nothing here needs editing: it measures `.wrap`.
- The street lamp stays at the model's place for the car, whatever the car does.

Traps met while lighting it:

| What went wrong | Why | What holds now |
|---|---|---|
| The roof came out pale lavender, not magenta | The shop's blue wrapped round onto the roof and lay on top of the cinema's magenta | The blue lights only what is turned to the shop |
| Magenta came out pale pink | Too strong: the tone curve takes the colour out of anything bright | Every term kept weak; no green in the magenta |
| The whole top of the car was a pink wash | The mirrored glow was let in from every height | The cinema's glow is mirrored only from low elevations, where the cinema is |
| The rear window went a flat orange | The lamp's mirrored glow too broad and too strong | A narrow lobe at a third of the strength |

## The ground (`images/synth/ground-*.webp`)

The street scene's road and plaza are drawn by the mirror's own shader (`STREET` in `fx/synth.js`); two small textures made
from Poly Haven's CC0 scans of real surfaces give it real grain:

| file | made from | what the shader reads |
|---|---|---|
| `ground-asphalt.webp` (512, grey) | `asphalt_pit_lane` (diffuse) | the road's grain: bright is a stone's wet top, dark the pores between |
| `ground-concrete.webp` (512) | `concrete_floor_worn_001` (diffuse, roughness), `scuffed_cement` (displacement) | r the concrete's tone, g how rough it is, b where it dips (water stands there) |

To make them again: download the 1k JPGs of those three textures from polyhaven.com into any folder, then

    python -P tools/synth/ground.py <that folder>

The sources stay out of the repo (they are logged in `PHOTO-LOG.md`). To use a different scan, change the file names in
`ground.py`; each channel is spread to the same range, so the shader's numbers need not change. If a texture fails to load
the scene still draws, with smooth ground.

How the wet look is made, and the traps (they are also in the comment over `STREET`):
- The mirror's picture is never shown as it is. It is smeared down the screen (eleven samples, seven on a phone) from its
  own mipmaps: long on the rough road, short on the concrete, next to nothing in a puddle or on the bay.
- Each pixel takes its samples from a slightly different height, fixed from frame to frame. That turns a streak into grain,
  and stops a small bright lamp showing as a row of copies.
- Roughness must change slowly across the ground. Sharp-edged patches a step apart made the road look like choppy water.
- The mirror's mipmaps are only switched on for this scene (`makeSea`): the other scenes' water is unchanged.

## Flicker: what caused it, and how to check

Every scene but the road is steadied: each frame is drawn a fraction of a pixel off from the last and folded into the frames
before it (`TAA_F`, `render`). That steadies fine things, but anything whose look depends on that fraction of a pixel flickers
instead. Three things did, all found in November 2026 ("a lot of flickering where ever theres water"):

- **Noise finer than a pixel.** The water's swell (`SEA`'s `n1`, and the street's bay) has a wavelength of about a metre in
  depth; towards the horizon that is far less than a pixel, so each pixel read a different random value every frame. Worst along
  the waterline. Every such term must fade out by its own footprint (`fwidth`), as `a1`, `a2`, `a3` do.
- **The mirror's picture moving with the frame.** The mirror is half the screen's size. Drawn with the frame's shift, each small
  bright thing in it (a lit window) landed on different pixels every frame. It is now drawn from the same place every frame
  (`makeSea` wraps the mirror's `onBeforeRender` and puts the camera's shift back afterwards).
- **Hard edges drawn in a shader.** Edges of real geometry are smoothed by the renderer; an edge made with `step()` in a shader
  is not. The towers' windows were such edges, so they twinkled, and so did their reflections. They are now a pixel soft and
  blend into their neighbours (`towers`).

Also `TAA_K` went from .1 to .06 (one whole round of the sixteen shifts), which roughly halves what twinkle is left on small
bright things, for a few per cent of softness on what moves.

A phone or tablet (`SMALL`) twinkles more than a computer: its picture is drawn smaller and without multisampling, so everything
small and lit is about a pixel across. There `TAA_K` is .03. Measure a change at a phone's size too (390 x 760 with touch on, which
draws 273 x 532), not only at 1280 x 720: the 8.176 work never did, and the street's far city twinkled on a phone until 8.178.

To check a change for flicker, compare consecutive frames, not screenshots seconds apart: slow real motion (the sun's bands, the
fronds, the swell) looks the same as flicker in a pair of screenshots. The measure used here: replace the page's clock with one
that steps a thirtieth of a second per frame, read the canvas after every frame for forty frames, and take each pixel's average
change from one frame to the next. Freezing the scene's time first shows how much of that is flicker and how much is motion.

## The stills (`images/synth/*.webp`)

These are what a visitor sees when the 3D doesn't run (Animation off, Reduce motion, a weak
device, no WebGL 2), and under the scene while it loads. Each one is the scene's own frame.
Re-make them after changing anything in `fx/synth.js` that changes the picture.

1. Serve the site locally from the repo root, for example `python -m http.server 3000`.
2. Run:

   ```
   node tools/synth/stills.mjs --base http://localhost:3000
   ```

   - Needs Node 22 or later and Chrome. Pass `--chrome <path>` if Chrome isn't in the usual place.
   - Writes 11 files to `images/synth`: `drive`, `bay`, `pyramid`, `street` and `shore-b`, each as
     `-night` (1600 × 900) and `-night-p` (a phone, 430 × 932 at 1.5×); and `street-night-m`
     (1200 × 900), the street for a tablet on its side. Synthwave is dark only, so
     there are no `-dusk` stills any more.
   - `--only drive,bay` does just those scenes; `--out <folder>` writes somewhere else.
   - `--t 40` sets the moment in the scene; `--quality 70` sets the WebP quality.
   - The road scene's dense grid compresses poorly, so its stills were made with
     `--only drive --quality 58` (about 100 KB on a computer, 40 KB on a phone).

The page opens with `sessionStorage synth.still = 1`, which is `fx/synth.js`'s still mode: the
page itself is hidden and time is fixed (there is no film grain any more, only a still dither). localStorage gets only the theme,
light or dark, and the moderator flag a mod-only theme needs, so no account or real data is used.
A still only matches its scene if the cameras in `fx/synth.js` are unchanged.

`skins/synth.css` picks the still by the screen's shape, and the browser cuts it to fit: `-p` for
anything upright (as tall as it is wide, or taller), the 16 : 9 one for the rest; and for the
street `-m` between them (up to 13 : 8), because the 16 : 9 picture cut to a tablet's shape loses
the edge of the sun and the end of the cinema.

## The street on every shape of screen

The street is a picture of two things: the far city under the sun, at the left, and the cinema, at
the right. The video shop past the cinema is for a wide screen. So its camera does not use the
usual pair of framings (one for a wide screen, one for a tall one, blended): it stands in one place
and the lens is fitted to the screen's shape (`look.cam` in the street's block; `frame()` uses it
when a scene has one).

| screen (width : height) | what it takes in |
|---|---|
| 16 : 9 | the sun's edge at the left edge, the cinema ending at the right, a sliver of the shop (`FOV`, `YAW`) |
| narrower, down to an upright tablet | the same from side to side, more sky and wet ground |
| a phone | nine tenths of that from side to side (`PHONE`); the sun's edge and the canopy's end are just cut |
| wider, to about 2.1 : 1 (`LAP`: a laptop's browser window) | the same from side to side, less sky and foot, looking up a touch (`LAP_Y`) |
| wider still, to 2.78 : 1 and beyond (`WIDE`) | opens out to the right: the whole shop, the park's wall past the sun |

The numbers are fitted by eye to the model as it is. If the cinema moves or grows, look at `YAW`
and `FOV` again, at the sizes below.

Before 2026-11-23 the camera walked up to the cinema as the screen narrowed: a tablet on its side
lost half the sun, an upright tablet and a phone lost the city altogether, and on a laptop the
shop's wall stood in the page's right margin with the cinema behind the page.

To check: Home at 1280 × 600, 1366 × 650, 1440 × 790, 1536 × 730, 1920 × 950, 2560 × 1300,
3440 × 1235, 1024 × 700, 1180 × 750, 768 × 950, 820 × 1100 and 390 × 760, with the page and
without it (hide `.wrap`). The other four scenes hold both their things at all of these.

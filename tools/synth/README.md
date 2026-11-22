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
   - Writes 10 files to `images/synth`: `drive`, `bay`, `pyramid`, `street` and `shore-b`, each as
     `-night` (1600 × 900) and `-night-p` (a phone, 430 × 932 at 1.5×). Synthwave is dark only, so
     there are no `-dusk` stills any more.
   - `--only drive,bay` does just those scenes; `--out <folder>` writes somewhere else.
   - `--t 40` sets the moment in the scene; `--quality 70` sets the WebP quality.
   - The road scene's dense grid compresses poorly, so its stills were made with
     `--only drive --quality 58` (about 100 KB on a computer, 40 KB on a phone).

The page opens with `sessionStorage synth.still = 1`, which is `fx/synth.js`'s still mode: the
page itself is hidden and time is fixed (there is no film grain any more, only a still dither). localStorage gets only the theme,
light or dark, and the moderator flag a mod-only theme needs, so no account or real data is used.
A still only matches its scene if the cameras in `fx/synth.js` are unchanged.

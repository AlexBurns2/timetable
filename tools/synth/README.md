# Synthwave: re-making the models and the stills

Tools for the Synthwave theme (`fx/synth.js`, `skins/synth.css`). `tools/` is not deployed.

## The towers (`models/synth/towers.glb`)

Only Home's towers are models. The car and the palms are built in code in `fx/synth.js`
(`carArrays` and `palmArrays`, seeded), so they have nothing to regenerate.

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
   - Writes 20 files to `images/synth`: `drive`, `bay`, `pyramid`, `shore-a` and `shore-b`, each
     as `-dusk` and `-night` (1600 × 900), plus the same with `-p` (a phone, 430 × 932 at 1.5×).
   - `--only drive,bay` does just those scenes; `--out <folder>` writes somewhere else.
   - `--t 40` sets the moment in the scene; `--quality 70` sets the WebP quality.
   - The timetable's dense grid compresses poorly, so its stills were made with
     `--only drive --quality 58` (about 125 KB on a computer, 41 KB on a phone).

The page opens with `sessionStorage synth.still = 1`, which is `fx/synth.js`'s still mode: the
page itself is hidden, time is fixed and the grain is steady. localStorage gets only the theme,
light or dark, and the moderator flag a mod-only theme needs, so no account or real data is used.
A still only matches its scene if the cameras in `fx/synth.js` are unchanged.

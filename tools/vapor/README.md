# Vaporwave: re-rendering the scenes

Tools for the reworked Vaporwave theme (`fx/vapor.js`, `skins/vapor.css`). `tools/` is not deployed.

The scenes are rendered offline with three.js in headless Chrome and shipped as WebP in
`images/th/vw-*.webp`. `fx/vapor.js` lays them over a drifting sky photograph and places each
group beside the page's column using the `META` table, which `ship.py` writes.

Nothing downloaded goes in the repo. Everything you download or make lives in a **work folder**
outside it, passed as `--work` (or `VW_WORK`). No student data is used anywhere.

## 1. The work folder

Make a folder outside the repo, for example `C:\vapor-work`, and put these in it:

- `three/`: three.js r170 from npm. Run `npm pack three@0.170.0` and unpack the tarball's
  `package/` folder as `three/`, so that `three/build/three.module.js` and `three/examples/jsm/`
  exist.
- `ph-dl/`: from Poly Haven (CC0). `PHOTO-LOG.md` lists them:
  - `marble_01/`: the 2k textures `marble_01_diff_2k.jpg`, `_rough_2k.jpg`, `_nor_gl_2k.jpg`.
  - `television_02/`: the 2k glTF (`television_02_2k.gltf`, its `.bin` and `textures/`).
  - `kloofendal_48d_partly_cloudy_puresky/`: `kloofendal_48d_partly_cloudy_puresky_2k.hdr`.
  - `sky/`: the same sky's 8k tonemapped JPG, `kloofendal_48d_partly_cloudy_puresky_tonemapped.jpg`.
- `cma/`: from the Cleveland Museum of Art Open Access (CC0):
  - `1947.188.jpg`: Portrait Head of a Youth;
  - `2023.108.jpg`: Head of Apollo;
  - `1947.188_alt4.jpg`: the youth again, the museum's alternate view 4 (turned about 25 degrees; mirrored, it looks to the
    right, into the page). This is the timetable's head;
  - `1947.188_alt2.jpg`: alternate view 2 (three-quarters on), turned further: tried, not used.

  Use the print-size JPGs, about 2500 × 3400.
- `palms-dl/` (only if the palms come back): from Wikimedia Commons (CC0), the 2400-px downloads (they arrive 3840 wide):
  - `p5.jpg`: Venice Beach palm trees at sunset (Unsplash);
  - `p2.jpg`: Phoenix canariensis in silhouette at sunset Palm Lakes Resort Ballina NSW L1030167.
- `film-dl/soapfilm1.jpg`: Soap Film 1 (Commons, CC BY 4.0), 1920 wide.

You need Node 22 or later, Chrome, a GPU (`--cpu` works but is slow), and Python with Pillow,
NumPy and OpenCV. Run Python with `-P`, and never from inside a download folder: downloaded files
are data, not code.

## 2. The photographs

From the repo root:

```
python -P tools/vapor/cutout.py <work>/cma/1947.188.jpg <work>/photo/youth.png 1.0 1400
python -P tools/vapor/cutout.py <work>/cma/2023.108.jpg <work>/photo/apollo.png 0.74 1400
python -P tools/vapor/grade.py  <work>/photo/youth.png <work>/photo/youth-l.png l .03
python -P tools/vapor/grade.py  <work>/photo/youth.png <work>/photo/youth-d.png d .03
python -P tools/vapor/eyes.py   <work>/photo/youth-l.png <work>/photo/youth-g-l.png 538 668 150 700 11
python -P tools/vapor/eyes.py   <work>/photo/youth-d.png <work>/photo/youth-g-d.png 538 668 150 700 11
python -P tools/vapor/cutout.py <work>/cma/1947.188_alt2.jpg <work>/photo/youth34.png 1.0 1400 .74
python -P tools/vapor/grade.py  <work>/photo/youth34.png <work>/photo/youth34-l.png l .03
python -P tools/vapor/grade.py  <work>/photo/youth34.png <work>/photo/youth34-d.png d .03
python -P tools/vapor/eyes.py   <work>/photo/youth34-l.png <work>/photo/youth34-g-l.png plane 455 910 697 561 -.125 130 .12 80 7
python -P tools/vapor/eyes.py   <work>/photo/youth34-d.png <work>/photo/youth34-g-d.png plane 455 910 697 561 -.125 130 .12 80 7
python -P tools/vapor/cutout.py <work>/cma/1947.188_alt4.jpg <work>/photo/youth4raw.png 1.0 1400 .74
python -P -c "from PIL import Image, ImageOps; ImageOps.mirror(Image.open('<work>/photo/youth4raw.png')).save('<work>/photo/youth4.png')"
python -P tools/vapor/grade.py  <work>/photo/youth4.png <work>/photo/youth4-l.png l .03
python -P tools/vapor/grade.py  <work>/photo/youth4.png <work>/photo/youth4-d.png d .03
python -P tools/vapor/eyes.py   <work>/photo/youth4-l.png <work>/photo/youth4-g-l.png plane 300 850 541 548 -.028 125 .07 80 7
python -P tools/vapor/eyes.py   <work>/photo/youth4-d.png <work>/photo/youth4-g-d.png plane 300 850 541 548 -.028 125 .07 80 7
python -P tools/vapor/palms.py  <work>/palms-dl/p5.jpg <work>/palms/venice.png dark .62 .04 1 1 1300 45
python -P tools/vapor/palms.py  <work>/palms-dl/p2.jpg <work>/palms/canary.png dark .12 0 .92 .69 1100 40
python -P tools/vapor/word.py   <work>/film-dl/soapfilm1.jpg <work>/word/timetable.png 時間割 440 5
python -P tools/vapor/sky.py    <work>/ph-dl/sky/kloofendal_48d_partly_cloudy_puresky_tonemapped.jpg <work>/final 4400 540
python -P tools/vapor/paint.py  <work>/photo/apollo.png <work>/ph-dl/sky/kloofendal_48d_partly_cloudy_puresky_tonemapped.jpg <work>/final/vw-notes-paint-l.webp l
python -P tools/vapor/paint.py  <work>/photo/apollo.png <work>/ph-dl/sky/kloofendal_48d_partly_cloudy_puresky_tonemapped.jpg <work>/final/vw-notes-paint-d.webp d
```

- `cutout.py` cuts the head off its studio background (GrabCut, seeded by the background's
  colour) and feathers the edge. The third number crops off the bottom, here Apollo's stand.
- `grade.py` tints the cut-out for the daylight (`l`) or the twilight (`d`).
- `cutout.py`'s fifth number drops the studio floor's shadow below that fraction of the height (it is grey; the stone stays warm in shadow).
- The timetable's head is `youth4-g`: the museum's view alt4, mirrored, turned about 25 degrees toward the page (alt2, `youth34`,
  turned about 50, looked too far away from us), its eyes hidden by `eyes.py plane` (for it: near end x 300, far end x 850,
  through 541, 548 at slope −0.028, 125 px tall, 7% taper). For `youth34-g` the panel was: a flat glitched panel standing just in front of the eyes, square to the way the face is turned,
  seen in perspective. Its long edges run along the eye line (through 697, 561 at slope −0.125), it is 130 px tall at its near
  end (x 455) and 12% shorter at its far end (x 910, out past the profile, in the air), and its mosaic cells and rows are laid out
  on the panel, so they shrink toward the far end. Solid, so the eyes don't read; a soft shadow under it on the face. The picture
  is padded 80 px each side so the far end has room. (`eyes.py wrap` is the earlier band that followed the head round, kept for
  reference.) `head=` picks another: `youth4` (no glitch), `youth34-g`, `youth34`, `youth-g` (the old head-on one).
- `palms.py` (palms are out of the scene for now) reduces a photograph of palms against the sky to their silhouette (white, the shape in the alpha); the page tints it
  pale. The numbers are the part of the photograph kept (fractions), the height, and the darkness threshold.
- `word.py` sets a page's word vertically in Yu Gothic Bold, filled with the soap film recoloured to the theme's pastels, with a
  bevel, a pale line, a violet outline and a slipped row to a glyph (three at most); the long-vowel bar is turned to stand
  upright. Every page has one, all made at 440 px a glyph and saved at half that as `images/th/vw-word-<page>.webp`
  (`pack.py` doesn't handle them), so the page can show them all at one scale. The words and their seeds: timetable 時間割 5,
  home ホーム 12, calendar カレンダー 21, notes ノート 8, games ゲーム 14, finder 検索 3, free 空き時間 17, revision 復習 9,
  resources 資料 6, mahjong 麻雀 11, themes テーマ 4.
- `eyes.py` glitches a band across the head's eyes (smeared and slipped rows, parted colour channels, a missing line) so it
  doesn't stare out of the screen. The numbers are the band's rows and span in the cut-out, then the seed.
- `sky.py` makes `vw-sky-l.webp` and `vw-sky-d.webp`, a seamless band of the photographed sky
  tinted pastel.
- `paint.py` makes the Notes page's picture: the Apollo head, duotone with one glitch slice, in a
  paint program's window of our own drawing.

## 3. Rendering

In one terminal, from the repo root:

```
node tools/vapor/serve.mjs --work <work>
```

In another:

```
VW_WORK=<work> bash tools/vapor/runall.sh "tt cal notes home stairs planets solids" "l d" 96
```

Or render one piece:

```
node tools/vapor/render.mjs --work <work> "scene=tt&mode=l&part=left&n=96"
```

Each scene renders these parts:

- `plate`: the floor and anything far off, with alpha where the sky shows.
- `platew`: the plate again, 5280 wide (the same lens, so its middle is the plate exactly), for windows wider than 2.4 to 1.
  Render it for every scene with a floor (tt, cal, home, planets, solids); `runall.sh` doesn't, so render them one at a time.
- `left` / `right`: a group on its own, with the shadow and reflection it lays on the floor.
- floating things (`planet`, `moon`): these get their own image so the page can let them bob.
- `phone`: the whole picture framed for a tall screen.

`n` is the number of frames averaged. Each frame jitters the camera, the sun and a sky light,
which gives anti-aliasing, soft shadows and ambient occlusion; 96 is plenty. The scenes, their
camera and their light are in `scenes.js`; the columns, materials and the CRT are in `props.js`.
A column can be broken off on a slant (`column({ broken:true })`, or `broken:{ sl, phi, rag }` for
the slope, the way it faces and how ragged the break is: 0 is a saw cut, 1.3 is what Home has).
The break always has a face: never an open, jagged rim.

## 4. Into the site

```
python -P tools/vapor/pack.py --work <work>
python -P tools/vapor/ship.py --work <work>
```

`pack.py` turns `<work>/out/*.png` into WebP in `<work>/final`, along with the placement table.
`ship.py` copies `vw-*.webp` into `images/th` and writes the table into `fx/vapor.js`. Bump the
asset version as usual afterwards.

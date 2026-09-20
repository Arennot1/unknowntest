# Portfolio Drive — handoff build

A drivable-car mini-world for the web (an original build in the spirit of
bruno-simon.com). Three.js r128, EffectComposer bloom, purple/orange stylized
lighting, wind + crush shaders, noise water, instanced stones and petals.

## Folder layout

```
portfolio-drive/
├── index.html          page shell, styles, CDN script tags
├── js/
│   └── game.js         the whole game (config at the top)
└── assets/
    └── models/         put your GLB files here (see below)
```

## 1. Drop in your assets

Copy your GLBs into `assets/models/` with these names (or edit `ASSET_PATHS`
at the top of `js/game.js` to match your filenames):

| file                | source asset                                   |
|---------------------|------------------------------------------------|
| `car.glb`           | Range Rover by IvOfficial                      |
| `pine.glb`          | Pine (Quaternius Stylized Nature MegaKit)      |
| `twisted-tree.glb`  | Twisted Tree (Quaternius)                      |
| `bush.glb`          | Bush (Quaternius)                              |
| `pebble.glb`        | Pebble Round (Quaternius)                      |
| `rock-path.glb`     | Rock Path Round Wide (Quaternius)              |
| `petal.glb`         | Flower Petal (Quaternius)                      |

The originals work as-is: the code converts the BLEND leaf/petal cards to
alpha-cutout, fixes sRGB texture encoding, hides the car GLB's tire nodes
(replaced by animated procedural wheels — the FBX-derived tire transforms
shear if reparented for steering), and renders the car shell double-sided
with an underbody tub so it never looks hollow. If any file fails to load,
a procedural stand-in is built automatically and the game still runs.

## 2. Run it

GLB fetching needs http(s), not `file://`. Any static server works:

```
npx serve .          # or: python3 -m http.server 8000
```

Then open the shown localhost URL. Deploy = upload the folder anywhere
static (Netlify, Vercel, GitHub Pages, S3, your own host).

## Dependencies

Loaded from CDNs in `index.html`, all pinned to three.js **r128**
(three core from cdnjs; GLTFLoader, EffectComposer, RenderPass, ShaderPass,
UnrealBloomPass, CopyShader, LuminosityHighPassShader, GammaCorrectionShader
from jsDelivr). To self-host, download those files and change the
`<script src>` URLs — no other changes needed. If you ever upgrade three,
note that r129+ moved these helpers to ES modules, so the script-tag setup
would need converting to imports.

## Integrating into an existing site

As shipped it is a fullscreen page — the simplest embed is an `<iframe>`
pointing at `index.html`. To mount it inside a section instead, replace the
`position:fixed; inset:0` rules on `#c` / overlays with a sized container and
swap `innerWidth/innerHeight` in `onResize()` for the container's
`clientWidth/clientHeight`.

## Tuning knobs (top of the relevant sections in game.js)

- `ASSET_PATHS` — file locations.
- `bloomPass` args — bloom strength `0.5`, radius `0.45`, threshold `0.74`.
- Lights — `purpleAmbient` (0x5c3f99), `sun` (0xff9a3a @ 1.55), `hemi`.
- Kit sizing — `targetHeight` / `targetWidth` per asset in the `loadJobs`
  block (pine 8.0, twisted tree 6.4, bush 1.25, pebble 0.95, path stone 2.0,
  petal 0.30) and the sway `{amp, height}` passed next to them.
- Density — cluster anchors + counts in `spawnCluster`, `scatterGrass(2600)`,
  `recordPathStones` spacing (2.7), petal counts in `initPetalSystems`.
- Car — `CAR_SCALE` 0.75, physics constants in `updateCar`
  (maxFwd 24, accel 20, jump 11.5), camera angle `CAM_DIR`.
- Content — project pod titles in `projectPods`, sign text, HUD copy.

## Performance notes

The kit GLBs carry 1024px textures (~7.7 MB total). They work fine, but for
faster page loads consider resizing textures to 256px with
`npx @gltf-transform/cli resize in.glb out.glb --width 256 --height 256`.

## Credits / licenses

- Nature models by Quaternius (via poly.pizza) — CC0.
- Range Rover model by IvOfficial — check its license terms for use on
  your site and credit accordingly.
- Concept homage: Bruno Simon's portfolio (bruno-simon.com). This is an
  original implementation, not affiliated with him.

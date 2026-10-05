# Dragon figures

Put transparent PNGs in this folder. A PNG is a full-body dragon in side view,
facing RIGHT; the enemy is mirrored by the view. Leave a small transparent
margin and align the feet near the bottom. Suggested canvas: 640 × 480.

The filename is the engine's dragon id, in lowercase:
`vorathion.png`, `aurion.png`, `sylvara.png`, `cinder.png`.
Legacy ids also work: `nyx`, `glacier`, `volt`, `umbra`, `obsidian`, `solaris`.

Optional forms: `<id>-stage2.png`, `<id>-stage3.png`, `<id>-fused.png`.
The base `<id>.png` works by itself. Missing forms use the base PNG; missing
base art uses a code-drawn silhouette with stage/fusion variations.

Run the existing `node scripts/build-prototype.mjs` export after adding files.
It discovers every PNG and writes the exported manifest automatically. No code
or hand-edited manifest is required. Keep each PNG at or below 600 KB for mobile.
The source's empty manifest deliberately permits silhouette-only development.

The compiled public folder is `assets/battle/sprites/`. To keep the previous
card view, open the same playtest with `?battleView=cards`; the default is arena.

## Assets

This project uses Vite static assets under `public/assets/`.

### Recommended folder layout

- `public/assets/`
    - `ui/` (buttons, panels, icons)
    - `cards/` (card frames, icons, vfx)
    - `characters/` (customers, NPCs)
    - `decor/` (shelves, rugs, signage)
    - `generated/` (Sorceress exports; checked in as a folder)

The Sorceress export target is:

- `public/assets/generated/`

### Suggested sprite sizes (MVP-friendly)

- **Cards (in-game)**: 64×96 or 80×120
- **Card art source**: 256×384 (scales down well)
- **Customer sprites**: 32×48 or 48×64
- **Tiles / decor**: 16×16 or 32×32 (pick one and stick with it)
- **UI icons**: 16×16, 24×24, or 32×32

### Notes

- Keep textures power-of-two-ish where convenient (not required, but often helpful).
- Prefer **PNG** for sprites with alpha; use **WebP** where size matters and alpha is needed.
- If you add sprite atlases, use `public/assets/...` and load via Phaser in `Preloader`.

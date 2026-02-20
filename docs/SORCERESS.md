## Sorceress integration notes

Sorceress-generated assets should be exported into:

- `public/assets/generated/`

This keeps generated content separate from hand-authored art, while still being
served by Vite/Phaser with stable URLs.

### Recommended export settings

- **Export root**: `public/assets/generated/`
- **Subfolders** (optional but recommended):
    - `public/assets/generated/ui/`
    - `public/assets/generated/cards/`
    - `public/assets/generated/characters/`

### “Build for preview” flow

Sorceress can preview the final built output by pointing at `dist/`.

- Build the project:

```bash
npm run build:sorceress
```

- Use the printed **Sorceress preview path** (the `dist/` folder) as the preview root.

### Why this flow?

- Vite’s dev server serves assets from `public/` directly.
- A production build outputs everything to `dist/`, which is the most reliable
  folder for file-based preview workflows.

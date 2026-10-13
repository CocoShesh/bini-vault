# Contributing to bini-vault

## Start with the correct application

Use a maintained Node.js version with built-in fetch (Node.js 24 is used by the maintenance checks). Run `npm ci`, copy `.env.example` to `.env`, configure the required public Google Sheets source IDs/GIDs, and run `npm start`. Open http://localhost:3000; PORT can change this. `npm run dev` uses Node watch mode.

## Keep changes reviewable

Describe the observed problem and the behavior after your change. Keep one concern per pull request; avoid unrelated dependency updates and formatting churn. Read existing repository instructions before changing source.

## Verification

Run `python3 scripts/source-preflight.py` once available. Start the server and check `GET /api/health` independently of upstream catalogs, then `GET /api/source-health` and a small `GET /api/videos?page=1&limit=2` request. A healthy process does not prove every sheet or video host is available. No test/build script is declared in package.json.

For browser changes, check 390 × 844, 768 × 1024 and 1440 × 900 viewports. Look for horizontal overflow, clipped controls, readable text and keyboard focus. Record the actual browser and dimensions; a screenshot alone does not prove the whole journey.

Useful end-to-end check: Open the archive, search/filter, load another page, save an item to My List, reload, and check playback for a permitted fixture link. Verify a missing source or unavailable video produces an understandable state.

## Handle sensitive data

Never attach personal watch history, local-storage dumps or private spreadsheet content. Catalogs must be public as intended. Redact sensitive links and screenshots.

## Before opening a pull request

- Explain what changed and why.
- List commands actually run and their results; state skipped checks explicitly.
- Include reproducible steps for bug fixes and relevant screenshots for UI changes.
- Describe migration or rollback needs when changing persisted data.

## Problem and resulting behavior

Explain the concrete trigger, what happened before, and what happens now.

## Verification

List the commands or manual steps actually run, browser/viewports if relevant, and pass/fail results. Do not check off tests that were not run.

Suggested project checks: Run `python3 scripts/source-preflight.py` once available. Start the server and check `GET /api/health` independently of upstream catalogs, then `GET /api/source-health` and a small `GET /api/videos?page=1&limit=2` request. A healthy process does not prove every sheet or video host is available. No test/build script is declared in package.json.

Relevant user journey: Open the archive, search/filter, load another page, save an item to My List, reload, and check playback for a permitted fixture link. Verify a missing source or unavailable video produces an understandable state.

## Risks and recovery

Describe persisted-data effects, provider/API changes, and rollback steps if applicable.

## Privacy

Never attach personal watch history, local-storage dumps or private spreadsheet content. Catalogs must be public as intended. Redact sensitive links and screenshots.

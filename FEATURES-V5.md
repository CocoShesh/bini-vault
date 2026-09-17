# BINI Vault V5 — Feature Pack

This build keeps the existing Node/Express architecture and adds a larger streaming-archive experience around it.

## Personal experience
- Continue Watching with local progress
- History and Watched states
- My List and Favorites
- Local playlists
- Queue / Up Next
- Personal stats
- Backup & Restore for local data

## Discovery
- Curated Collections
- Member explorer
- Era Timeline
- On This Day
- Surprise Me that prioritizes unfinished videos
- Search suggestions / command palette
- Multi-member/year/source filtering
- Related videos
- Duplicate-source grouping in the catalog

## Player
- YouTube IFrame resume tracking
- Direct-video resume tracking
- Mark as Watched
- Playback speed
- Picture-in-picture for direct video
- Keyboard shortcuts
- Queue
- Next Up
- Shareable video URLs
- QR share (loads a client-side QR library only when requested)

## Archive / backend
- Server-side spreadsheet configuration through `.env`
- Stale-while-revalidate source caching
- Source health endpoint
- API ETags / HTTP caching
- Rate limiting
- Security headers
- Redirect-aware SSRF protection for media proxy endpoints
- Canonical duplicate grouping using YouTube IDs when available
- Video-by-source endpoint for deep links

## PWA
- Web app manifest
- Service worker shell caching
- API cache fallback for catalog/source requests
- Browser install prompt support when available

## Important setup note
The real spreadsheet IDs belong in `.env`. This ZIP intentionally does **not** contain your real `.env` file.
Copy your existing `.env` into the new working folder before starting the server.

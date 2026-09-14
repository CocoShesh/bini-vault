# BINI Vault v16

BINI Vault is a fast, BINI-focused media archive/streaming interface backed by the existing public Google Sheets catalogs.

## Highlights

- Background-only cinematic hero with blurred BINI artwork
- Custom BINI Vault branding
- 24-video initial batch + true vertical infinite scrolling
- Append-only grid updates; existing cards are not rebuilt during pagination
- Continue Watching (local)
- My List with local snapshots
- Search by title, source, date, description and tags
- Member filtering and year archive filtering
- Sorting: Newest, Oldest, Title A–Z
- Surprise Me random playback
- Vault Stats panel
- On This Day archive section
- Video detail/player modal with Next action
- Lazy thumbnail loading with a single successful fallback chain
- YouTube thumbnail fallback + description image + direct video frame fallback
- Responsive 6/5/4/3/2 column video grid
- Browser-side local storage only; no database required

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.


## v17 fix
- Fixed the On This Day container reference that caused `Cannot set properties of undefined (setting 'innerHTML')`.
- Replaced the intrusive "Loading the archive…" hero text with a polished shimmer/skeleton loading state.
- Added a friendly retry state when the API is unavailable.
- Loading shell preserves the visual layout while data is being fetched.

Responsive navigation: mobile and tablet layouts keep Home, Browse, Collections, and My List visible in a horizontally scrollable second nav row instead of hiding the navigation below 900px.

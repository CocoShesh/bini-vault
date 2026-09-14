# BINI Vault

> A BINI-focused media archive with a modern streaming-style interface.

BINI Vault organizes the existing public BINI video catalogs into a fast, responsive browsing experience. The app is designed around discovery first: a cinematic hero, searchable collections, member/year filters, an infinite video grid, and local personalization features.

## What it includes

### Discovery
- Cinematic background-only featured hero with BINI artwork
- Collections: Kumu, Exclusives, Concerts, Fancams, Misc
- Member and year filters
- Newest / Oldest / Title A–Z sorting
- Search across title, source, date, description, and tags
- Surprise Me random playback
- On This Day archive discovery

### Watching
- YouTube and direct-video playback
- Continue Watching with local progress
- My List stored locally on the device
- Video details modal with next-video navigation
- Responsive player and modal behavior

### Performance
- Server-side catalog caching
- 24-item initial batch
- Append-only vertical infinite scrolling
- Existing cards remain mounted when the next batch arrives
- Lazy thumbnail loading with fallback sources
- Browser-side local storage for user preferences and watch progress
- No database required for the current version

## Responsive design

BINI Vault uses different navigation patterns based on available width instead of hiding core navigation.

| Viewport | Navigation | Grid | Main behavior |
| --- | --- | --- | --- |
| Desktop | Full top navigation | 6 → 5 columns | Full search + filters |
| Tablet / iPad | Compact top navigation | 4 columns | Full browsing controls with reduced spacing |
| Phone | Logo + search on top, bottom navigation dock | 2 columns | Touch-friendly controls and fixed bottom navigation |
| Small phone | Compact bottom navigation | 2 columns | Tighter hero typography and card spacing |

### Responsive references

These screenshots document the intended responsive layouts used while testing the interface:

**Desktop — MacBook Air**

![Desktop](docs/responsive/macbook-air.png)

**Tablet — iPad Air 5**

![Tablet](docs/responsive/ipad-air-5.png)

**Phone — iPhone 14 Pro**

![iPhone 14 Pro](docs/responsive/iphone-14-pro.png)

**Phone — iPhone 14 Pro Max**

![iPhone 14 Pro Max](docs/responsive/iphone-14-pro-max.png)

**Phone — Pixel 7 Pro**

![Pixel 7 Pro](docs/responsive/pixel-7-pro.png)

## Data source architecture

```text
Public Google Sheets catalogs
          ↓
      Server fetcher
          ↓
       CSV parser
          ↓
     Normalized video data
          ↓
      Server-side cache
          ↓
          API
          ↓
   Responsive BINI Vault UI
          ↓
     Video source / player
```

The catalog is sourced from the public Google Sheets already used by the project. The app does not require a database for the current release.

## Source format

The normalizer understands the following catalog fields:

```text
title
chapter
duration
description
tags
uid
thumbnail
date
link
ORIGINAL
```

A playable URL is resolved from `link` first and falls back to `ORIGINAL` when necessary.

## Local development

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Project structure

```text
bini-vault/
├── public/
│   ├── index.html
│   ├── app.js
│   └── assets/
├── src/
│   └── sheets.js
├── server.js
├── package.json
├── vercel.json
└── docs/
    └── responsive/
```

## Design principles

BINI Vault is intentionally image-led and content-dense without becoming crowded:

- The hero uses artwork as a blurred background rather than a foreground crop, keeping the interface readable while avoiding chopped group photos.
- Video discovery uses a grid so the catalog is scannable instead of forcing a single horizontal row.
- Mobile navigation moves to a bottom dock so Home, Browse, Collections, and My List stay reachable without squeezing the header.
- Loading states use skeletons rather than developer-style loading messages.
- Filtering and pagination append content instead of rebuilding the whole catalog.

## Status

BINI Vault is currently optimized as a lightweight archive and streaming frontend backed by public catalog data. It is designed to remain fast without introducing authentication or a database until those features are actually needed.



```bash
vercel
```

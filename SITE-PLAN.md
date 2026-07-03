# 1980D Site Growth Plan — Execution Spec

Written 2026-07-02. This is the full spec for the next work session to execute.
Read this whole file before touching anything.

## Context a fresh session needs

- **Repo:** `C:\Users\awans\Documents\git\1980D` → GitHub `198dband/comingsoon` (main) → Netlify auto-deploys → `https://www.1980d.com` (and `/beta.html`).
- **Architecture:** `index.html` and `beta.html` are single-file compiled bundles (currently identical, ~3.6MB). Outer shell = plain hand-editable HTML/CSS/JS (cassette deck header, mobile header, two iframes). Each iframe side (dark "After Dark", light "Mall Era") is filled by a `__bundler` loader in the outer shell that unpacks gzip+base64 JS modules from `<script type="__bundler/manifest">` JSON blocks.
- **Patch pipeline (in repo, tested):**
  - `node tools/extract.js <html> <outdir>` — dump all modules as `<uuid>.js/.jsx`
  - edit modules → `node tools/repack.js <html> <moduledir> <out.html>` — re-inject (only touches `data` fields)
  - `node tools/verify.js <out.html>` — must print `blobs: N ok: N` before installing
  - Note: repack re-gzips, so total byte size shifts slightly — that's normal.
- **Current app modules** (in both files, same uuids): dark app = `04fd0fbd-…`, light app = `4136dcb9-…`. The two ~3.14MB blobs (`fedd9644-…`, `c8451754-…`) are Babel standalone, one per side. The ~1.08MB pair is React/ReactDOM dev builds. `f6db5b58-….jsx` (25KB, mime `text/jsx`) is a runtime-transpiled JSX module.
- **Firebase RTDB:** `https://d-1a745-default-rtdb.firebaseio.com` (project `d-1a745`). Paths in use: `wall` (17 songs; fields: song, artist, by, submittedBy, anonymous, votes, added, visible, order), `shows` (3 shows). Rules currently allow open read/write on both. Console edits bypass rules.
- **Workflow rule:** implement + test on `beta.html` first, then copy to `index.html` to publish. Test locally with the `1980d-static` preview server (port 5566, defined in `~/.claude/launch.json`) before every commit. Verify live sizes with `curl -s <url> | wc -c` after push.
- **Known content warning:** the bundles contain UNMOUNTED components with **fabricated placeholder content** — Testimonials/Quotes ("The Garcias", "KEXP listener") and a Watch section with fake video entries. Do NOT publish these as-is; Phase 3 replaces them with Firebase-driven empty-state sections.

## Firebase rules — USER PASTES THIS FIRST (Console → Realtime Database → Rules)

```json
{
  "rules": {
    "wall": {
      ".read": true,
      ".write": true,
      "$song": { "votes": { ".validate": "newData.isNumber() && newData.val() >= 0" } }
    },
    "shows":    { ".read": true,  ".write": true },
    "mixtapes": { ".read": true,  ".write": true },
    "videos":   { ".read": true,  ".write": false },
    "quotes":   { ".read": true,  ".write": false },
    "config":   { ".read": true,  ".write": false },
    "mailinglist": { ".read": false, ".write": true }
  }
}
```

Why: `videos`/`quotes`/`config` are band-managed via console only (console bypasses rules, public can't tamper). `mailinglist` is a **write-only drop box** — subscribers' emails must never be publicly readable. `mixtapes` is open like `wall`.

---

## Phase 1 — Performance first (do before adding anything)

The site ships Babel to the browser twice and transpiles JSX at runtime (console warns about it). Everything later adds weight, so shrink first.

1. Extract modules from `beta.html`.
2. Read the `__bundler` loader in the outer shell to confirm exactly how JSX modules are detected/transpiled (mime `text/jsx` and/or Babel transform of script tags).
3. Precompile the JSX-bearing modules with `npx @babel/cli` + `@babel/preset-react` (the two app modules `04fd0fbd`/`4136dcb9` and the `f6db5b58` jsx module — and any others the loader routes through Babel).
4. Update those modules' `mime` in the manifests to `text/javascript`, remove the two Babel blobs and whatever loader code invokes Babel. This is the delicate step — keep a backup, verify, and visually regression-test both sides before proceeding.
5. Defer the inactive iframe: both bundles currently unpack eagerly. Unpack the visible side first; unpack the second on first flip or `requestIdleCallback` after `load`. Keep the flip animation working.
6. Stretch (only if 1–5 goes cleanly): swap React/ReactDOM dev builds for production minified builds.
7. Measure before/after: file size on disk, and load behavior at mobile viewport. Target: no Babel console warnings, file well under 2MB.

Test matrix (applies to every phase): desktop 1280, tablet 768, mobile 375 via preview_resize; console clean; both sides flip correctly; wall + shows still pull live Firebase data (counts match `curl …/wall.json`).

## Phase 2 — SEO

All in the outer shell of `beta.html` (carries to `index.html` on publish) plus small new static files:

1. `<title>`: `1980D — Pop-Punk & Alt-Rock Cover Band | Snohomish County / Seattle, WA` (keep "Pick Your Side" flavor in og:title if desired).
2. `<meta name="description">`: one sentence with the search terms that matter — cover band, wedding band, private party, Edmonds/Everett/Snohomish County/Seattle, 90s/2000s pop-punk alt-rock.
3. Open Graph + Twitter card: og:title, og:description, og:url, `og:image` = absolute URL to `/1980D.png` for now (a proper 1200×630 card is a later nice-to-have), `twitter:card=summary_large_image`.
4. `<link rel="canonical" href="https://www.1980d.com/">` in the shell. **Use canonical, not a noindex meta** — the beta→index copy workflow would otherwise copy a noindex tag onto the homepage. Canonical is copy-safe (index points at itself; beta dedupes to index).
5. Netlify `_headers` file (new, at repo root — survives the copy workflow because it's per-URL):
   ```
   /beta.html
     X-Robots-Tag: noindex
   ```
6. JSON-LD in the shell:
   - Static `MusicGroup` block: name, genre, areaServed, email, `sameAs` (Instagram/YouTube URLs — already in the bundles' footer links).
   - Small script that fetches `shows.json` from Firebase and injects a `MusicEvent` array (skip `isBooked` private events; build ISO dates from year/moNum/dayNum; omit time when "TBD"/"TBA"; Place = venue name + city + ", WA"). Google renders JS, and this keeps events in sync with the DB. Consider adding an optional `address` field to show entries for richer event schema.
7. `robots.txt` (allow all, point to sitemap) + `sitemap.xml` (`/`, `/epk.html`).
8. `/epk.html` — new small static page, text-rich and crawlable (this partially compensates for the iframe architecture being nearly invisible to crawlers): bio, photos, setlist, booking types + prices, contact, service area. Brand-styled but lightweight (no bundles). Print CSS so "Save as PDF" produces the one-sheet for cold-emailing venues. Placeholder blocks marked clearly where the band must supply photos/bio. Link it from both sides' footers ("Press Kit / EPK").
9. USER TASKS: verify domain in Google Search Console + Bing Webmaster; submit sitemap.

## Phase 3 — Turn dead content into Firebase-driven sections

Pattern for all three: section reads a Firebase node; if node is empty/missing, the section renders nothing. Band adds real content in the console → appears live, no redeploy. Mount in **both** sides' `App()`.

1. **Setlist** — components already exist with the real 16 songs and genre filters; just mount them (dark has `Setlist`-style section around line ~290 of its module; light equivalent). This is real content, safe to publish immediately.
2. **Watch** — replace the fake `VIDEOS` array with a `videos` node read (`{title, meta, youtubeId, big}`). Also read `config/youtubeChannelId`: when present, render the channel's uploads-playlist embed (`https://www.youtube.com/embed/videoseries?list=UU<channel-id-minus-UC-prefix>`) which auto-updates as they upload. Empty node + no channelId = section hidden. Lazy-load iframes (`loading="lazy"`).
3. **Quotes/Testimonials** — replace fabricated quotes with a `quotes` node read (`{text, who, where}`). Hidden until the band adds real ones. Never ship the placeholder quotes.
4. **Mailing list** — the footer Join forms are currently dead. Wire both sides to push `{email, t: timestamp, side}` to `mailinglist` (write-only node). Client-side email sanity check, success state, error state. Update copy to give a reason to join: e.g. "Get show dates first + early access to vote on the wall."
5. **Config node** — create `config` (`youtubeChannelId`, `instagramHandle`) so identifiers live in data, not code.

## Phase 4 — Instagram embeds

Instagram has content (YouTube doesn't yet — that's covered by Phase 3's channel embed appearing when they upload).

1. Get from band: Instagram handle + 2–4 post/reel URLs to feature (USER TASK — a full auto-feed needs the paid/third-party widget route; curated official embeds are free and reliable).
2. Add a "Follow the chaos" section (both sides) with official Instagram blockquote embeds. Load `embed.js` only when the section scrolls into view (IntersectionObserver) — it's heavy and Phase 1's gains shouldn't be given back.
3. Fallback if embeds are blocked (privacy browsers): styled link cards to the posts.

## Phase 5 — Side C: The Mixtape Maker

The interactive/retro centerpiece. A fan builds their dream 1980D setlist on a cassette, saves it, shares it — and every save lands in Firebase so the band can mine it for "songs people actually want."

**Placement/architecture (key decision):** built in the **outer shell** as a full-screen overlay, NOT inside the compiled bundles.
- Trigger: a `SIDE C` button added to the desktop deck header (next to the flip readout) and the mobile header (`.mdeck`). Style it as the "bonus track" oddity — mismatched label tape, why-is-this-here energy.
- Code ships as separate lazy files: `/mixtape.js` + `/mixtape.css`, injected on first open. Zero cost to initial page load; independently cacheable; one implementation serves both sides; no bundle patching.

**Mechanics:**
- Catalog = the 16-song setlist (hardcoded in mixtape.js) + visible `wall` songs (fetched live) + a free-text "write your own" line (this is the interesting data — songs *not* already on our radar).
- Tap-to-add UI (no drag-drop — must work on touch). A-side / B-side, 6 slots each. Running "tape length" gag meter. Name your tape; handle optional; reuse the anonymous convention.
- Cassette rendered on `<canvas>` — hand-written label with their tape name and track list, side A/B. Canvas scales responsively (375px+).
- **Save** → push to `mixtapes`: `{title, by, anonymous, aSide:[{title,artist,custom}], bSide:[…], theme: currentSide, createdAt: serverTimestamp, ua: mobile|desktop}`. Store the push id in `localStorage['198d_my_mixtape']` — returning visitors reopen theirs and can edit (PATCH same id).
- **Share/Download** → canvas `toBlob` PNG download; on mobile use Web Share API (`navigator.share` with the image file) so it goes straight to stories/messages. The shared image is the marketing loop — make sure "1980d.com" is drawn on the cassette.
- **Band analytics** → new static page `/tape-stats.html` (unlinked, band bookmark): fetches all `mixtapes`, tallies song frequency (split known-catalog vs custom write-ins), sortable table. Custom write-ins ranked separately = the "maybe we should learn this" list.

**Tests:** create/edit/save/download on 375, 768, 1280; Firebase entry verified via curl; localStorage reopen works; Web Share on mobile viewport (falls back to download on desktop); overlay doesn't break flip or scroll-lock the page behind it.

## Phase 6 — Being findable elsewhere (mostly USER TASKS, site hooks where relevant)

Ordered by gigs-per-effort:

1. **Google Business Profile** — register "1980D" as a service-area business (live band / wedding entertainment, Snohomish County + Seattle metro). This is what makes you exist for "cover band near me" / "wedding band Everett". Free.
2. **GigSalad + The Bash** — the two marketplaces where people with budgets actually book private-event bands. Needs: bio, photos, price ranges (already public on the site: $1.8K/$3.2K/$2.4K), and the EPK from Phase 2.
3. **Bandsintown for Artists** — claim artist page, mirror show dates (5 min per show). Feeds fan notifications, Google event results, Shazam/Spotify surfaces. Site hook: add a "Track us on Bandsintown" follow button near the shows section. Keep Firebase as the source of truth; don't embed their widget (avoids duplicate show listings).
4. **Facebook Page + Events** — block-party/bar crowds RSVP there; venues cross-promote FB events.
5. **Local calendars** — EverOut Seattle, The Stranger, Everett Herald events, Visit Snohomish County: submit each public show. Checklist item per gig, not code.
6. Search Console + sitemap submission (from Phase 2).

## Publish flow (every phase)

1. Patch/edit → `tools/verify.js` → install to `beta.html`
2. Local preview (desktop/tablet/mobile; console; Firebase round-trip)
3. Commit + push → verify live `/beta.html` (size match via curl)
4. Copy `beta.html` → `index.html` → quick re-test → commit + push → verify live homepage
5. Keep commits per-phase, not one mega-commit

## What the band must supply (blockers marked)

- [ ] Paste the Firebase rules above (BLOCKS Phases 3/5 writes)
- [ ] Instagram handle + 2–4 post URLs to feature (BLOCKS Phase 4)
- [ ] YouTube channel ID (enables auto video section when first upload lands)
- [ ] 2–3 REAL testimonials (quotes section stays hidden until then)
- [ ] Band photos + ~150-word bio (BLOCKS EPK polish; scaffold ships with placeholders)
- [ ] Sign-ups: Google Business Profile, GigSalad, The Bash, Bandsintown, Facebook Page, Google Search Console
- [ ] Confirm: fake testimonials/videos in the old bundle content are never published (plan already handles this)

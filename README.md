# Mintzu & Zwe · Wedding invitation

Live at <https://mzforever.wedding/> (Vercel; domain from Z.com, DNS records there; a spare copy runs
on Render from `render.yaml`). The old <https://mom-wedding-design.vercel.app/> redirects to it, so
QR codes made before the domain still work. Guests scan the QR, land on a sealed
envelope, tap the seal and the printed card comes out. No build step and no outside requests: fonts,
scripts and images are all in this repo.

## Layout

```
index.html                 the invitation (envelope → card → details)
qr.html                    makes the QR and the poster for sharing / printing
memories.html              keepsake after the wedding: thank-you, the evening, favourites, full album (/memories)
public/
  css/base.css             fonts, palette, base styles (shared)
  css/invitation.css       styles for index.html
  css/qr.css               styles for qr.html
  css/memories.css         styles for memories.html
  js/invitation.js         greeting, calendar link, card turning, envelope animation
  js/qr.js                 QR drawing and downloads
  js/memories.js           albums, album chips, full-screen photo/video viewer
  memories/                albums.json + resized photos, one folder per album
  fonts/                   Cormorant Garamond, Great Vibes, Jost, Pinyon Script (woff2, SIL OFL licences alongside)
  audio/                   background music: "Wedding Music" by andriih, Pixabay (Pixabay Content License)
  images/                  card + couple photos (jpg + webp), seal, sprig, icons, favicon, link preview
  vendor/                  qrcode-generator 1.4.4 (MIT)
  mintzu-zwe-wedding.ics   calendar event
tools/add-memories.py      resizes new photos and adds them to an album
memories-inbox/            full-size originals (not in git: back this folder up yourself)
```

## Preview locally

Asset paths start with `/`, so serve the folder instead of opening the file directly:

```
npx serve . -l 5173             # or: python -m http.server 5173
```

Use `npx serve` when testing on an iPhone: iOS Safari only plays the music from a server that
answers range requests, and Python's server does not (Vercel does).

## Changing things

- **Wording, names, venue:** `index.html`. Date or venue changes also need the `.ics` file, the
  Google Calendar link (`data-google` on `#add-calendar`) and the poster text in `public/js/qr.js`.
- **Card or photo:** replace the `.jpg` in `public/images/` and its `.webp` copy, keeping the size
  (the layout assumes the card's 1143 × 1600 proportions).
- **Music:** replace `public/audio/wedding-piano.mp3` (or change `src` on `#music` in
  `index.html`, and the lock-screen title in `public/js/invitation.js`). Keep it small (~2 MB,
  96 kbps MP3). It starts when the guest taps the seal; the round button bottom-right turns it
  off and on.
- **Colours:** `public/css/base.css` (`:root`). The QR reads its colours from there too.
- **QR code and poster:** open `/qr`, check the link (it defaults to `https://mzforever.wedding/`,
  `LIVE_URL` in `public/js/qr.js`), download, and scan with two phones before printing.

Personal links: add `?to=Ko%20Aung` to the URL and the envelope says "Dear Ko Aung,".

## Adding memories

Photos (needs Pillow: `pip install pillow`):

1. Put the full-size photos in a folder under `memories-inbox/` (git ignores it), e.g.
   `memories-inbox/dinner/`.
2. Run, with a short album id and a title:
   ```
   python tools/add-memories.py dinner memories-inbox/dinner --title "The dinner" --note "Family and friends at the tables"
   ```
   Adding to an album that exists needs only the id: `python tools/add-memories.py bride memories-inbox/more`.
   Each photo becomes a 720 px thumbnail and a 1600 px copy for the viewer (WebP, ~360 KB together,
   sharp on any phone). The page is an album to look at: there is no download button.
3. In `public/memories/albums.json`, replace each new photo's `"alt"` with a short description
   (screen readers read it). Optional: add `"caption"`, shown under the photo in the viewer.
4. The thank-you card, the timeline and the favourites are written in `memories.html`; each photo
   there names its album photo, e.g. `data-photo="couple-01"`, to swap one, change that and the
   image paths beside it. The thank-you note and the timeline lines are drafts to change freely.

Music on the memories page: `public/audio/canon-in-d-guitar.mp3` (credit in the page footer). To
play another song, put the MP3 in `public/audio/` and change `src` on `#music` in `memories.html`,
plus the credit line and the title in `setUpSong()` in `public/js/memories.js`.

Videos go in the `videos` album in `albums.json`, by hand. Large video files do not belong in git
(GitHub refuses files over 100 MB), so upload the film to YouTube (Unlisted is fine) and add:
```json
{ "type": "video", "youtube": "VIDEO_ID", "title": "The first dance" }
```
`VIDEO_ID` is the part after `v=` in the YouTube link. A short clip can also live in the repo:
```json
{ "type": "video", "src": "/public/memories/videos/toast.mp4", "poster": "/public/memories/videos/toast.jpg", "title": "The toast" }
```
An empty album shows a "coming soon" card.

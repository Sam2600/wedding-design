# Mintzu & Zwe · Wedding invitation

Static site on Vercel: <https://mom-wedding-design.vercel.app/>. Guests scan the QR, land on a sealed
envelope, tap the seal and the printed card comes out. No build step and no outside requests: fonts,
scripts and images are all in this repo.

## Layout

```
index.html                 the invitation (envelope → card → details)
qr.html                    makes the QR and the poster for sharing / printing
public/
  css/base.css             fonts, palette, base styles (shared)
  css/invitation.css       styles for index.html
  css/qr.css               styles for qr.html
  js/invitation.js         greeting, calendar link, card turning, envelope animation
  js/qr.js                 QR drawing and downloads
  fonts/                   Cormorant Garamond, Great Vibes, Jost (woff2, SIL OFL licences alongside)
  audio/                   background music: Bach, "Air on the G String", US Air Force Band (public domain)
  images/                  card + couple photos (jpg + webp), seal, sprig, icons, favicon, link preview
  qr/                      the finished QR files for the live link
  vendor/                  qrcode-generator 1.4.4 (MIT)
  mintzu-zwe-wedding.ics   calendar event
templates/                 the earlier design samples
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
- **Music:** replace `public/audio/air-on-the-g-string.mp3` (or change `src` on `#music` in
  `index.html`). Keep it small (~2 MB, 96 kbps MP3). It starts when the guest taps the seal; the
  round button bottom-right turns it off and on.
- **Colours:** `public/css/base.css` (`:root`). The QR reads its colours from there too.
- **New QR** (only if the link changes): open `/qr.html`, check the link, download, scan with two
  phones, then replace the files in `public/qr/`.

Personal links: add `?to=Ko%20Aung` to the URL and the envelope says "Dear Ko Aung,".

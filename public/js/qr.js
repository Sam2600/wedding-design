/*
 * QR page (qr.html): draws a styled QR for the invitation link and offers it as
 *   - a 1080 × 1350 poster (PNG) for social posts,
 *   - the code alone (PNG, 1600 px),
 *   - the code alone (SVG) for print.
 * The QR matrix comes from qrcode-generator (public/vendor), loaded before this module.
 */

const LIVE_URL = 'https://mzforever.wedding/';
const QUIET = 4;               // modules of clear space around the code (the QR minimum)
const QR_PNG_SIZE = 1600;
const POSTER_W = 1080;
const POSTER_H = 1350;

const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();
const COLORS = {
  ink: token('--ink'),
  muted: token('--ink-muted'),
  plum: token('--plum'),
  lilac: token('--lilac'),
  paper: token('--paper'),
};

const byId = (id) => document.getElementById(id);
const input = byId('url');
const encodedText = byId('encoded');
const errorText = byId('url-error');
const localWarning = byId('local-warning');
const posterImage = byId('poster');
const links = { poster: byId('dl-poster'), png: byId('dl-png'), svg: byId('dl-svg') };

let sprig = null;              // Path2D of public/images/sprig.svg, for the poster corners
let objectUrls = [];


/* ---------- Geometry (in module units, shared by the canvas and SVG renderers) ---------- */

function roundRect(x, y, w, h, r) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/* One module square with its own corner radii: [top-left, top-right, bottom-right, bottom-left] */
function modulePath(x, y, [tl, tr, br, bl]) {
  const arc = (r, ex, ey) => (r ? `A${r} ${r} 0 0 1 ${ex} ${ey}` : '');
  return `M${x + tl} ${y}H${x + 1 - tr}${arc(tr, x + 1, y + tr)}` +
    `V${y + 1 - br}${arc(br, x + 1 - br, y + 1)}` +
    `H${x + bl}${arc(bl, x, y + 1 - bl)}` +
    `V${y + tl}${arc(tl, x + tl, y)}Z`;
}

/*
 * Error correction level H recovers ~30% damage, so the emblem hole in the middle is safe.
 * Modules are joined: a corner is rounded only where neither side has a neighbour, so every
 * module stays a full square at its edges. (Separate round dots look nice, but leave gaps
 * that some phone scanners cannot read.)
 */
function buildQr(text) {
  const qr = window.qrcode(0, 'H');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();

  let holeSize = Math.round(n * 0.22);
  if (holeSize % 2 === 0) holeSize += 1;
  const holeStart = (n - holeSize) / 2;

  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const inHole = (r, c) => r >= holeStart && r < holeStart + holeSize && c >= holeStart && c < holeStart + holeSize;
  const drawn = (r, c) => r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c) && !inFinder(r, c) && !inHole(r, c);

  const R = 0.5;
  let modules = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!drawn(r, c)) continue;
      const up = drawn(r - 1, c);
      const down = drawn(r + 1, c);
      const left = drawn(r, c - 1);
      const right = drawn(r, c + 1);
      modules += modulePath(c, r, [
        !up && !left ? R : 0,
        !up && !right ? R : 0,
        !down && !right ? R : 0,
        !down && !left ? R : 0,
      ]);
    }
  }

  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]];
  const centre = holeStart + holeSize / 2;
  return {
    n,
    modules,
    eyeRings: eyes.map(([x, y]) => roundRect(x, y, 7, 7, 2.2) + roundRect(x + 1, y + 1, 5, 5, 1.4)).join(''),
    eyeDots: eyes.map(([x, y]) => roundRect(x + 2, y + 2, 3, 3, 0.9)).join(''),
    emblem: {
      plate: roundRect(holeStart + 0.35, holeStart + 0.35, holeSize - 0.7, holeSize - 0.7, holeSize * 0.28),
      ringRadius: holeSize * 0.2,
      ringWidth: Math.max(0.32, holeSize * 0.06),
      rings: [   // two wedding rings, slightly offset
        { x: centre - holeSize * 0.12, y: centre + holeSize * 0.024, color: COLORS.plum },
        { x: centre + holeSize * 0.12, y: centre - holeSize * 0.024, color: COLORS.lilac },
      ],
    },
  };
}


/* ---------- Renderers ---------- */

function drawQr(ctx, qr, x, y, modulePx) {
  const { emblem } = qr;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(modulePx, modulePx);
  ctx.fillStyle = COLORS.ink;
  ctx.fill(new Path2D(qr.modules));          // one fill, so neighbouring squares show no seams
  ctx.fillStyle = COLORS.plum;
  ctx.fill(new Path2D(qr.eyeRings), 'evenodd');
  ctx.fill(new Path2D(qr.eyeDots));
  ctx.fillStyle = COLORS.paper;
  ctx.fill(new Path2D(emblem.plate));
  ctx.lineWidth = emblem.ringWidth;
  for (const ring of emblem.rings) {
    ctx.strokeStyle = ring.color;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, emblem.ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function qrSvg(qr) {
  const { emblem } = qr;
  const total = qr.n + QUIET * 2;
  const rings = emblem.rings
    .map((ring) => `<circle stroke="${ring.color}" cx="${ring.x.toFixed(3)}" cy="${ring.y.toFixed(3)}" r="${emblem.ringRadius.toFixed(3)}"/>`)
    .join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="1000" height="1000">`,
    `<rect width="${total}" height="${total}" fill="${COLORS.paper}"/>`,
    `<g transform="translate(${QUIET} ${QUIET})">`,
    `<path fill="${COLORS.ink}" d="${qr.modules}"/>`,
    `<path fill="${COLORS.plum}" fill-rule="evenodd" d="${qr.eyeRings}"/>`,
    `<path fill="${COLORS.plum}" d="${qr.eyeDots}"/>`,
    `<path fill="${COLORS.paper}" d="${emblem.plate}"/>`,
    `<g fill="none" stroke-width="${emblem.ringWidth.toFixed(3)}">${rings}</g>`,
    '</g>',
    '</svg>',
  ].join('\n');
}

/* Letter-spaced, centred text, without ctx.letterSpacing (missing in older Safari) */
function spacedText(ctx, text, centreX, y, spacing) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  let x = centreX - (widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)) / 2;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = 'center';
}

/* Centred line made of differently coloured parts */
function colouredLine(ctx, parts, centreX, y) {
  const widths = parts.map(([text]) => ctx.measureText(text).width);
  let x = centreX - widths.reduce((a, b) => a + b, 0) / 2;
  ctx.textAlign = 'left';
  parts.forEach(([text, colour], i) => {
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
    x += widths[i];
  });
  ctx.textAlign = 'center';
}

/* The sprig's stem starts at (18, 216) in its own drawing; pin that point to (x, y) */
function drawSprig(ctx, x, y, scale, angle) {
  if (!sprig) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.translate(-18, -216);
  ctx.strokeStyle = COLORS.lilac;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(sprig);
  ctx.restore();
}

function drawPoster(qr) {
  const W = POSTER_W;
  const H = POSTER_H;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Paper: white to lilac, with blush in the lower right
  const paper = ctx.createLinearGradient(0, 0, 0, H);
  paper.addColorStop(0, '#FFFFFF');
  paper.addColorStop(1, '#EFE7F2');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  const blush = ctx.createRadialGradient(W, H, 0, W, H, 760);
  blush.addColorStop(0, 'rgba(241, 220, 229, 0.85)');
  blush.addColorStop(1, 'rgba(241, 220, 229, 0)');
  ctx.fillStyle = blush;
  ctx.fillRect(0, 0, W, H);

  // Double hairline frame, sprigs growing out of two corners
  ctx.strokeStyle = COLORS.lilac;
  ctx.lineWidth = 2;
  ctx.stroke(new Path2D(roundRect(40, 40, W - 80, H - 80, 18)));
  ctx.lineWidth = 1;
  ctx.stroke(new Path2D(roundRect(54, 54, W - 108, H - 108, 12)));
  drawSprig(ctx, 64, 64, 0.75, Math.PI / 2);
  drawSprig(ctx, W - 64, H - 64, 0.7, -Math.PI / 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.muted;
  ctx.font = '500 25px Jost, sans-serif';
  spacedText(ctx, 'YOU ARE INVITED TO THE WEDDING OF', W / 2, 196, 5.5);

  ctx.font = '400 132px "Great Vibes", cursive';
  colouredLine(ctx, [['Mintzu ', COLORS.ink], ['&', COLORS.lilac], [' Zwe', COLORS.ink]], W / 2, 336);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '500 25px Jost, sans-serif';
  spacedText(ctx, 'SATURDAY  ·  31 OCTOBER 2026', W / 2, 410, 5.5);

  // The code on a white tile
  const tile = 560;
  const tileX = (W - tile) / 2;
  const tileY = 470;
  ctx.save();
  ctx.shadowColor = 'rgba(62, 43, 66, 0.22)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = COLORS.paper;
  ctx.fill(new Path2D(roundRect(tileX, tileY, tile, tile, 28)));
  ctx.restore();
  const modulePx = tile / (qr.n + QUIET * 2);
  drawQr(ctx, qr, tileX + QUIET * modulePx, tileY + QUIET * modulePx, modulePx);

  ctx.fillStyle = COLORS.ink;
  ctx.font = 'italic 500 46px "Cormorant Garamond", serif';
  ctx.fillText('Scan to open your invitation', W / 2, 1108);

  // Jost, not Cormorant: canvas cannot switch Cormorant's old-style figures to lining ones
  ctx.fillStyle = COLORS.muted;
  ctx.font = '400 25px Jost, sans-serif';
  ctx.fillText('6 PM – 9 PM  ·  The Memorial Venue, Hlaing Township, Yangon', W / 2, 1160);

  return canvas;
}

function drawQrOnly(qr) {
  const canvas = document.createElement('canvas');
  canvas.width = QR_PNG_SIZE;
  canvas.height = QR_PNG_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, QR_PNG_SIZE, QR_PNG_SIZE);
  const modulePx = QR_PNG_SIZE / (qr.n + QUIET * 2);
  drawQr(ctx, qr, QUIET * modulePx, QUIET * modulePx, modulePx);
  return canvas;
}

const toPng = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));


/* ---------- Page ---------- */

function parseUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

const isLocal = (url) => /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(url.hostname);

function disableDownloads() {
  for (const link of Object.values(links)) {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
  }
}

function publishDownloads(files) {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = Object.keys(links).map((key) => {
    const url = URL.createObjectURL(files[key]);
    links[key].href = url;
    links[key].removeAttribute('aria-disabled');
    return url;
  });
  posterImage.src = links.poster.href;
}

let renderId = 0;
async function render() {
  const id = ++renderId;
  const url = parseUrl(input.value);
  errorText.hidden = Boolean(url);
  if (url) input.removeAttribute('aria-invalid');
  else input.setAttribute('aria-invalid', 'true');
  disableDownloads();
  if (!url) return;

  localWarning.hidden = !isLocal(url);
  encodedText.textContent = url.href;
  const qr = buildQr(url.href);
  const [poster, png] = await Promise.all([toPng(drawPoster(qr)), toPng(drawQrOnly(qr))]);
  if (id !== renderId) return;               // a newer edit is already rendering
  publishDownloads({ poster, png, svg: new Blob([qrSvg(qr)], { type: 'image/svg+xml' }) });
}

/* The poster sprig is read from the same SVG the invitation page shows (all of its paths,
   drawn fully grown: the growing animation only exists on the page) */
async function loadSprig() {
  try {
    const svg = await (await fetch('/public/images/sprig.svg')).text();
    const paths = new DOMParser().parseFromString(svg, 'image/svg+xml').querySelectorAll('path');
    return new Path2D([...paths].map((path) => path.getAttribute('d')).join(''));
  } catch {
    return null;                             // the poster just goes without corner sprigs
  }
}

/* Canvas text only uses a web font once it has loaded, so wait for them (but never forever) */
function loadFonts() {
  const faces = ['132px "Great Vibes"', '500 25px Jost', '400 25px Jost', 'italic 500 46px "Cormorant Garamond"'];
  const loaded = Promise.all(faces.map((face) => document.fonts.load(face))).catch(() => {});
  return Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 3000))]);
}


// Always the wedding's own domain, even when this page is opened on mzforever.vercel.app,
// the Render copy or a local preview; ?url= or the field can still change it
input.value = new URLSearchParams(window.location.search).get('url') || LIVE_URL;

let debounce = 0;
input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(render, 250);
});

Promise.all([loadFonts(), loadSprig()]).then(([, sprigPath]) => {
  sprig = sprigPath;
  render();
});

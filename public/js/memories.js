/*
 * Memories page (memories.html)
 *   1. Albums: built from public/memories/albums.json (tools/add-memories.py adds photos to it);
 *      the photos written into the page (thank-you card, timeline, favourites) open the viewer too
 *   2. Album chips: jump to an album; the one on screen is highlighted
 *   3. Motion: album titles rise, photos settle and develop like prints, petals drift
 *   4. Viewer: full screen, swipe or arrow keys between photos, swipe down or Back to close
 *   5. Our song: takes over from the invitation's music. It starts by itself (or, where the browser
 *      wants a tap first, with the guest's first tap) unless the guest turned music off
 *   6. Section by section: a short scroll glides on to the next section
 *   7. Signing day: a book made like our certificate folder, its pages to turn
 */

const root = document.documentElement;
const $ = (selector) => document.querySelector(selector);

const MANIFEST = '/public/memories/albums.json';
const TILE_SIZES = '(min-width: 1120px) 262px, (min-width: 1024px) 24vw, (min-width: 640px) 32vw, 48vw';
const SWIPE_PX = 50;         // sideways distance that counts as "next" / "previous"
const CLOSE_PX = 90;         // downward distance that closes the viewer
const MUSIC_KEY = 'mz-music'; // "on" / "off" for this visit, shared with invitation.js
const SONG_VOLUME = 0.7;

function make(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `/public/images/icons.svg#i-${name}`);
  svg.append(use);
  return svg;
}

const youtubePoster = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function countText(items) {
  const photos = items.filter((item) => item.type === 'photo').length;
  const videos = items.length - photos;
  return [photos && plural(photos, 'photo'), videos && plural(videos, 'video')].filter(Boolean).join(' · ');
}


/* ---------- 1. Albums ---------- */

function tileFor(item, index) {
  const tile = make('button', { type: 'button', className: 'tile' });
  tile.dataset.index = index;
  if (item.type === 'photo') {
    tile.append(make('img', {
      src: item.thumb,
      srcset: `${item.thumb} 720w, ${item.full} ${item.width}w`,
      sizes: TILE_SIZES,
      width: item.width,
      height: item.height,
      alt: item.alt || '',
      loading: 'lazy',
      decoding: 'async',
    }));
  } else {
    tile.classList.add('tile-video');
    tile.setAttribute('aria-label', `Play video: ${item.title || 'Wedding video'}`);
    tile.append(
      make('img', { src: item.poster || youtubePoster(item.youtube), width: 640, height: 360, alt: '', loading: 'lazy', decoding: 'async' }),
      make('span', { className: 'play' }, [icon('play')]),
    );
    if (item.title) tile.append(make('span', { className: 'tile-title', textContent: item.title }));
  }
  return tile;
}

function albumSection(album, openViewer) {
  const headingId = `${album.id}-title`;
  const section = make('section', { className: 'album', id: album.id });
  section.setAttribute('aria-labelledby', headingId);

  const head = make('header', { className: 'album-head' }, [
    make('span', { className: 'label', textContent: countText(album.items) || 'Coming soon' }),
    make('h2', { id: headingId, textContent: album.title }),
  ]);
  if (album.note) head.append(make('p', { className: 'album-note', textContent: album.note }));
  const rule = make('div', { className: 'album-rule' });
  rule.setAttribute('aria-hidden', 'true');
  rule.innerHTML = '<svg viewBox="0 0 14 14"><path d="M7 0 9 5 14 7 9 9 7 14 5 9 0 7 5 5Z"/></svg>';
  head.append(rule);
  section.append(head);

  if (!album.items.length) {
    const videos = album.id === 'videos';
    section.append(make('div', { className: 'empty' }, [
      icon(videos ? 'video' : 'images'),
      make('p', { textContent: videos ? 'Videos from the evening will be added here soon.' : 'More photos will be added here soon.' }),
    ]));
    return section;
  }

  const grid = make('div', { className: 'grid' }, album.items.map(tileFor));
  if (album.items.length <= 4) {
    grid.classList.add('grid-row');
    grid.style.setProperty('--n', String(album.items.length));
  }
  grid.addEventListener('click', (event) => {
    const tile = event.target.closest('.tile');
    if (tile) openViewer(album, Number(tile.dataset.index), tile);
  });
  section.append(grid);
  return section;
}

/* Photos written into the page carry data-photo="<album>-NN": look them up in the albums so
   the viewer gets the sharp copy. Tapping one shows that section's photos. */
function wirePagePhotos(manifest, openViewer) {
  const byId = new Map();
  manifest.albums.forEach((album) => album.items.forEach((item) => {
    if (item.type === 'photo') byId.set(item.full.split('/').pop().replace(/-\d+\.webp$/, ''), item);
  }));
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-photo]');
    if (!button) return;
    const section = button.closest('[data-title]');
    const buttons = [...section.querySelectorAll('[data-photo]')].filter((b) => byId.has(b.dataset.photo));
    const at = buttons.indexOf(button);
    if (at < 0) return;
    openViewer({ title: section.dataset.title, items: buttons.map((b) => byId.get(b.dataset.photo)) }, at, button);
  });
}


/* ---------- 2. Album chips ---------- */

function buildNav(albums) {
  const nav = $('#album-nav');
  const chips = albums.map((album) => {
    const chip = make('a', { className: 'chip', href: `#${album.id}` }, [album.title]);
    if (album.items.length) chip.append(make('span', { className: 'count', textContent: album.items.length }));
    return chip;
  });
  nav.append(...chips);
  nav.hidden = albums.length < 2;

  const setCurrent = (id) => chips.forEach((chip) => {
    const on = chip.hash === `#${id}`;
    chip.setAttribute('aria-current', String(on));
    // Centre the chip by scrolling the row only (scrollIntoView would also scroll the page to it)
    if (on && nav.scrollWidth > nav.clientWidth) {
      nav.scrollTo({ left: chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
    }
  });
  setCurrent(albums[0].id);

  if (!('IntersectionObserver' in window)) return;
  const watcher = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) setCurrent(entry.target.id); });
  }, { rootMargin: '-35% 0px -60% 0px' });
  albums.forEach((album) => watcher.observe(document.getElementById(album.id)));

  // The last album may be too short to reach the middle of the screen: at the bottom, it's the one
  let queued = false;
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setCurrent(albums[albums.length - 1].id);
    });
  }, { passive: true });
}


/* ---------- 3. Motion on scroll ---------- */

/* Sections rise, photos develop like prints (album tiles also settle from a slight tilt), the
   timeline line draws down, the signature is written in: each when it scrolls into view.
   Returns a function that watches more elements (the album tiles, once they are built). */
function revealOnScroll() {
  if (!('IntersectionObserver' in window)) return () => {};
  root.classList.add('js-reveal');
  const watcher = new IntersectionObserver((entries) => {
    let batch = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      watcher.unobserve(el);
      if (el.classList.contains('tile')) {
        const i = batch++ % 8;
        el.style.setProperty('--i', String(i));
        el.style.setProperty('--tilt', `${(Math.random() * 5 - 2.5).toFixed(2)}deg`);
        // Once settled, hand back the quick press/hover transitions
        setTimeout(() => el.classList.add('is-settled'), 2000 + i * 90);
      }
      el.classList.add('is-in');
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  const watch = (selector) => document.querySelectorAll(selector).forEach((el) => watcher.observe(el));
  watch('.reveal, .timeline, .sign');
  return watch;
}

/* Petals drifting down: most behind the page, a few larger ones in front. Negative delays so
   some are already falling when the page opens. */
function driftPetals() {
  const random = (min, max) => min + Math.random() * (max - min);
  const small = window.innerWidth < 640;
  const layer = (className, count, size, alpha) => {
    const box = make('div', { className });
    box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < count; i++) {
      const fall = random(11, 20);
      const petal = make('span', { className: 'petal' }, [make('i')]);
      petal.style.cssText = [
        `--x: ${random(-2, 98).toFixed(1)}vw`,
        `--size: ${random(size[0], size[1]).toFixed(0)}px`,
        `--sway: ${random(-70, 70).toFixed(0)}px`,
        `--drift: ${random(-110, 110).toFixed(0)}px`,
        `--turn: ${random(0, 360).toFixed(0)}deg`,
        `--flutter: ${random(1.4, 2.8).toFixed(2)}s`,
        `--fall: ${fall.toFixed(1)}s`,
        `--delay: ${(-random(0, fall)).toFixed(1)}s`,
        `--alpha: ${alpha}`,
      ].join('; ');
      box.append(petal);
    }
    return box;
  };
  document.body.prepend(layer('petals', small ? 12 : 20, [14, 24], 0.95));
  document.body.append(layer('petals petals-front', small ? 3 : 5, [24, 34], 0.85));
}


/* ---------- 4. Viewer ---------- */

function setUpViewer() {
  const dialog = $('#viewer');
  const stage = $('#viewer-stage');
  const count = $('#viewer-count');
  const caption = $('#viewer-caption');
  const prev = $('#viewer-prev');
  const next = $('#viewer-next');
  let album = null;
  let index = 0;
  let trigger = null;
  let shown = null;          // the <img> currently on stage (photos only)
  let token = 0;

  const preload = (item) => { if (item && item.type === 'photo') new Image().src = item.full; };

  function render(dir = 0) {
    const item = album.items[index];
    const mine = ++token;
    const total = album.items.length;
    count.textContent = `${album.title} · ${index + 1} / ${total}`;
    caption.textContent = item.caption || '';
    prev.hidden = next.hidden = total < 2;

    if (item.type === 'photo') {
      // The grid's thumbnail is already loaded: show it at once, swap in the sharp one when ready
      const img = make('img', { src: item.thumb, alt: item.alt || '', width: item.width, height: item.height, draggable: false });
      const sharp = new Image();
      sharp.src = item.full;
      (sharp.decode ? sharp.decode() : Promise.resolve()).then(() => { if (mine === token) img.src = item.full; }, () => {});
      stage.replaceChildren(img);
      shown = img;
      if (dir && img.animate) {
        img.animate([
          { opacity: 0, transform: `translateX(${dir * 28}px)` },
          { opacity: 1, transform: 'none' },
        ], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      }
      preload(album.items[(index + 1) % total]);
      preload(album.items[(index - 1 + total) % total]);
    } else if (item.youtube) {
      shown = null;
      stage.replaceChildren(make('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.youtube)}?autoplay=1&rel=0&playsinline=1`,
        title: item.title || 'Wedding video',
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowFullscreen: true,
      }));
    } else {
      shown = null;
      stage.replaceChildren(make('video', { src: item.src, poster: item.poster || '', controls: true, autoplay: true, playsInline: true, preload: 'metadata' }));
    }
  }

  function go(step) {
    const total = album.items.length;
    if (total < 2) return;
    index = (index + step + total) % total;
    render(step);
  }

  /* Back on the phone closes the viewer instead of leaving the page */
  let ownHistory = false;

  function open(nextAlbum, at, from) {
    album = nextAlbum;
    index = at;
    trigger = from;
    root.classList.add('viewer-open');
    dialog.showModal();
    render();
    window.history.pushState({ viewer: true }, '');
    ownHistory = true;
  }

  dialog.addEventListener('close', () => {
    token++;
    stage.replaceChildren();               // stops a playing video
    shown = null;
    root.classList.remove('viewer-open');
    if (ownHistory) {
      ownHistory = false;
      window.history.back();
    }
    if (trigger) trigger.focus({ preventScroll: true });
  });
  window.addEventListener('popstate', () => {
    if (!dialog.open) return;
    ownHistory = false;
    dialog.close();
  });

  $('#viewer-close').addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'ArrowRight') go(1);
  });

  /* Swipe: the photo follows the finger; far enough sideways changes photo, down closes.
     Pinch-to-zoom stays with the phone; while zoomed in, swipes are left alone. */
  let start = null;
  const zoomed = () => window.visualViewport && window.visualViewport.scale > 1.01;

  // The <img> fills the stage and letterboxes the photo: was (x, y) on the photo itself?
  function onPhoto(img, x, y) {
    const box = img.getBoundingClientRect();
    const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const left = box.left + (box.width - w) / 2;
    const top = box.top + (box.height - h) / 2;
    return x >= left && x <= left + w && y >= top && y <= top + h;
  }

  stage.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || zoomed()) return;
    start = { x: event.clientX, y: event.clientY, target: event.target };
  });
  stage.addEventListener('pointermove', (event) => {
    if (!start || !shown || !event.isPrimary) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    shown.style.transition = 'none';
    shown.style.transform = Math.abs(dx) > Math.abs(dy)
      ? `translateX(${dx * 0.6}px)`
      : `translateY(${Math.max(0, dy) * 0.5}px) scale(${1 - Math.min(Math.max(0, dy), 300) / 3000})`;
  });
  const settle = () => {
    if (!shown) return;
    shown.style.transition = '';
    shown.style.transform = '';
  };
  stage.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const tapped = Math.abs(dx) < 8 && Math.abs(dy) < 8;
    const tappedBackground = tapped && (start.target === stage
      || (start.target === shown && shown.naturalWidth && !onPhoto(shown, event.clientX, event.clientY)));
    start = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
    } else if (dy > CLOSE_PX && dy > Math.abs(dx)) {
      dialog.close();
    } else if (tappedBackground) {
      dialog.close();                        // tap beside the photo
    } else {
      settle();
    }
  });
  stage.addEventListener('pointercancel', () => {
    start = null;
    settle();
  });

  return { open };
}


/* ---------- Start ---------- */

async function start() {
  const watchMore = revealOnScroll();
  const box = $('#albums');
  const loading = $('#loading');
  let manifest;
  try {
    const response = await fetch(MANIFEST);
    if (!response.ok) throw new Error(String(response.status));
    manifest = await response.json();
  } catch {
    loading.textContent = 'The photos could not load. Check your connection, then ';
    const retry = make('a', { href: window.location.pathname, textContent: 'try again' });
    loading.append(retry, '.');
    return;
  }

  const albums = manifest.albums.filter((album) => album.items.length || album.id === 'videos');
  const viewer = setUpViewer();
  wirePagePhotos(manifest, viewer.open);
  box.replaceChildren(...albums.map((album) => albumSection(album, viewer.open)));
  buildNav(albums);
  watchMore('.album, .tile');

  // A link to one album (memories#videos) can only scroll once the albums exist
  const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
  if (target) target.scrollIntoView();
}

/* ---------- 5. Our song ---------- */

function setUpSong() {
  const audio = $('#music');
  const button = $('#song');
  const label = $('#song-label');
  let wanted = false;
  let hiddenPause = false;
  let compactTimer = 0;
  let fade = 0;
  button.setAttribute('aria-label', 'Our song, Canon in D');

  const choice = () => {
    try { return window.sessionStorage.getItem(MUSIC_KEY); } catch { return null; }
  };
  const remember = (on) => {
    try { window.sessionStorage.setItem(MUSIC_KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
  };

  // A gentle fade in (iPhones keep the volume fixed; there the track simply starts)
  function fadeIn() {
    cancelAnimationFrame(fade);
    audio.volume = 0;
    if (audio.volume !== 0) return;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 1500));
      audio.volume = SONG_VOLUME * t * t;
      if (t < 1) fade = requestAnimationFrame(step);
    };
    fade = requestAnimationFrame(step);
  }

  const show = (playing) => {
    button.setAttribute('aria-pressed', String(playing));
    label.textContent = playing ? 'Now playing' : 'Play our song';
    clearTimeout(compactTimer);
    if (playing) compactTimer = setTimeout(() => button.classList.add('is-compact'), 2500);
    else button.classList.remove('is-compact');
  };

  function play() {
    show(true);
    const playing = audio.play();
    if (playing) playing.catch(() => { wanted = false; show(false); });
  }

  button.addEventListener('click', () => {
    wanted = !wanted;
    remember(wanted);
    disarm();
    if (wanted) {
      fadeIn();
      play();
    }
    else {
      audio.pause();
      show(false);
    }
  });

  // Stopped from outside (lock screen, a call, another app): keep the button in step
  audio.addEventListener('pause', () => {
    if (hiddenPause) {
      hiddenPause = false;
      return;
    }
    if (wanted) { wanted = false; show(false); }
  });
  audio.addEventListener('play', () => { if (!wanted && !document.hidden) { wanted = true; show(true); } });
  audio.addEventListener('error', () => { button.hidden = true; });

  // Quiet while the page is hidden; carry on when it comes back
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!audio.paused) { hiddenPause = true; audio.pause(); }
    } else if (wanted) {
      play();
    }
  });

  /* Start by itself: straight away if the browser allows it, otherwise with the guest's first
     tap or key press anywhere (a scroll does not count; browsers only accept a tap) */
  const firstTouch = ['pointerup', 'touchend', 'keydown', 'click'];
  function tryStart(event) {
    if (event && event.target.closest && event.target.closest('#song')) return disarm();  // the button decides
    if (wanted || choice() === 'off') return disarm();
    audio.volume = 0;
    const attempt = audio.play();
    if (!attempt) return disarm();
    attempt.then(() => {
      disarm();
      wanted = true;
      fadeIn();
      show(true);
    }, () => { /* not allowed yet: wait for a tap */ });
  }
  function disarm() {
    firstTouch.forEach((type) => document.removeEventListener(type, tryStart, true));
  }
  if (choice() !== 'off') {
    firstTouch.forEach((type) => document.addEventListener(type, tryStart, true));
    tryStart();
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: 'Canon in D',
      artist: 'Pachelbel · played by Aitua',
      album: 'Mintzu & Zwe · Memories',
      artwork: [{ src: '/public/images/og-memories.jpg', sizes: '1200x630', type: 'image/jpeg' }],
    });
  }
}


/* ---------- 6. Section by section ---------- */

/* After the guest's own scroll comes to rest: if the next section has started to show, glide to
   its top (or back up to the top of this one). Inside a section taller than the screen the guest
   scrolls freely; the glide comes only once the next section is in view, so nothing is skipped.
   (CSS scroll-snap would pull a single mouse-wheel notch straight back, which feels stuck.) */
function settleOnSections() {
  const REACH = 0.85;        // the next section's top must be within this share of the screen
  let settled = window.scrollY;
  let moved = false;         // the guest scrolled (wheel, touch, keys) since the last rest
  let gliding = false;       // our own smooth scroll is running
  let touching = false;
  let timer = 0;

  function points() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const tops = [...document.querySelectorAll('.thanks, .journey, .evening, .favourites, .all, .album')].map((el) => {
      const margin = parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0;
      return Math.round(el.getBoundingClientRect().top + window.scrollY - margin);
    });
    return [...new Set([0, ...tops, max].map((y) => Math.min(Math.max(0, y), max)))].sort((a, b) => a - b);
  }

  function rest() {
    if (touching) return;
    const y = window.scrollY;
    if (gliding || !moved || root.classList.contains('viewer-open')) {
      gliding = false;
      moved = false;
      settled = y;
      return;
    }
    moved = false;
    const reach = window.innerHeight * REACH;
    const all = points();
    let target = null;
    if (y > settled + 2) {
      const next = all.find((p) => p > y + 2);
      if (next !== undefined && next < y + reach) target = next;
    } else if (y < settled - 2) {
      const prev = [...all].reverse().find((p) => p < y - 2);
      if (prev !== undefined && prev > y - reach) target = prev;
    }
    settled = y;
    if (target === null) return;
    gliding = true;
    settled = target;
    window.scrollTo({ top: target, behavior: 'smooth' });
  }

  const guestScroll = () => { moved = true; gliding = false; };
  window.addEventListener('wheel', guestScroll, { passive: true });
  window.addEventListener('touchmove', guestScroll, { passive: true });
  window.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(event.key)) guestScroll();
  });
  window.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  const lift = () => {
    touching = false;
    clearTimeout(timer);
    timer = setTimeout(rest, 160);
  };
  window.addEventListener('touchend', lift, { passive: true });
  window.addEventListener('touchcancel', lift, { passive: true });
  window.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(rest, 160);
  }, { passive: true });
}


/* ---------- 7. Signing day: a book made like our certificate folder ---------- */

/* Sheets turn over one at a time: the cover first, then three sheets with a photo on each side;
   the signatures page lies under them all. A tap on the second page (right, or lower on phones)
   turns forward, on the first page turns back; a tap on a photo opens the viewer. Swipes, the
   arrows and the arrow keys turn pages too. Taps are placed by position, not by the element the
   browser reports: in a 3D book its hit-testing can land on the hidden side of a page.
   While on screen the book also reads itself: the cover opens, the pages turn, and after the
   signatures it closes and starts again, until the guest turns a page (then only the play button
   starts it again). It holds still under the pointer, for keyboard focus, in the viewer, and never
   moves by itself when reduced motion is asked for. */
function setUpBook() {
  const book = $('#book');
  if (!book) return;
  const stage = $('#book-stage');
  const sheets = [...book.querySelectorAll('.sheet')];
  const base = book.querySelector('.page-base');
  const count = $('#book-count');
  const hint = $('#book-hint');
  const status = $('#book-status');
  const prevButton = $('#book-prev');
  const nextButton = $('#book-next');
  const playButton = $('#book-play');
  const LAST = sheets.length;          // sheets turned at the last spread
  const TURN_MS = 1200;                // matches --turn-ms in the CSS
  const COVER_MS = 1600;               // matches --cover-ms: the cover opens slower
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 760px)');
  const pad = (n) => String(n).padStart(2, '0');
  const timers = new Map();
  let turned = 0;
  let lift = 0;

  // The two pages showing now: [first (left / upper), second (right / lower)]
  function showing() {
    if (turned === 0) return [null, sheets[0].querySelector('.face-front')];
    return [
      sheets[turned - 1].querySelector('.face-back'),
      turned < LAST ? sheets[turned].querySelector('.face-front') : base,
    ];
  }

  function describe() {
    if (turned === 0) return 'The book is closed.';
    const words = showing().map((face) => {
      const caption = face.querySelector('.page-caption');
      if (caption) return caption.textContent;
      return face.classList.contains('page-intro') ? 'The certificate' : 'Our signatures';
    });
    return `Pages ${turned} of ${LAST}: ${words.join(', and ')}`;
  }

  function render() {
    sheets.forEach((sheet, k) => {
      sheet.style.setProperty('--turned', k < turned ? '1' : '0');
      sheet.classList.toggle('is-turned', k < turned);
      if (!timers.has(sheet)) sheet.style.zIndex = String(k < turned ? 10 + k : 100 - k);
    });
    const visible = showing();
    let lostFocus = false;
    book.querySelectorAll('.face, .page-base').forEach((face) => {
      const on = visible.includes(face);
      face.setAttribute('aria-hidden', String(!on));
      face.querySelectorAll('button').forEach((button) => {
        button.tabIndex = on ? 0 : -1;
        if (!on && button === document.activeElement) lostFocus = true;
      });
    });
    if (lostFocus) (turned < LAST ? nextButton : prevButton).focus({ preventScroll: true });
    book.classList.toggle('is-open', turned > 0);
    book.classList.toggle('at-end', turned === LAST);
    count.textContent = turned === 0 ? 'Cover' : `${pad(turned)} / ${pad(LAST)}`;
    hint.textContent = turned === 0 ? 'Tap the cover to open' : 'Tap a page or swipe to turn';
    prevButton.disabled = turned === 0;
    nextButton.disabled = turned === LAST;
    nextButton.setAttribute('aria-label', turned === 0 ? 'Open the book' : 'Next page');
    prevButton.setAttribute('aria-label', turned === 1 ? 'Close the book' : 'Previous page');
  }

  function turn(dir, quiet = false) {
    const next = turned + dir;
    if (next < 0 || next > LAST) return;
    const sheet = dir > 0 ? sheets[turned] : sheets[turned - 1];
    clearTimeout(timers.get(sheet));
    sheet.style.zIndex = String(200 + (lift += 1));   // above both sides, and above pages turned before it
    sheet.classList.remove('is-turning');
    void sheet.offsetWidth;
    sheet.classList.add('is-turning');
    timers.set(sheet, setTimeout(() => {
      timers.delete(sheet);
      sheet.classList.remove('is-turning');
      render();
    }, reduced.matches ? 0 : sheet === sheets[0] ? COVER_MS : TURN_MS));
    turned = next;
    render();
    status.textContent = quiet ? '' : describe();
  }

  // A page turned by the guest: they have taken over from the self-reading book
  function userTurn(dir) {
    takeOver();
    turn(dir);
  }

  prevButton.addEventListener('click', () => userTurn(-1));
  nextButton.addEventListener('click', () => userTurn(1));
  $('#book-open').addEventListener('click', () => userTurn(1));   // keyboard; taps are handled below
  book.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    userTurn(event.key === 'ArrowRight' ? 1 : -1);
  });

  /* Swipe sideways to turn (on phones too); up-and-down stays a scroll */
  let press = null;
  let swiped = false;
  stage.addEventListener('pointerdown', (event) => {
    if (event.isPrimary) press = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.id) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    press = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swiped = true;
      setTimeout(() => { swiped = false; }, 0);
      userTurn(dx < 0 ? 1 : -1);
    }
  });
  stage.addEventListener('pointercancel', () => { press = null; });

  /* Taps, placed by position */
  let passing = false;
  const inside = (el, x, y) => {
    const box = el.getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  };
  stage.addEventListener('click', (event) => {
    if (passing || event.detail === 0) return;      // our own click, or Enter/Space on a control
    event.stopPropagation();
    event.preventDefault();
    if (swiped) return;
    if (turned === 0) { userTurn(1); return; }
    const box = stage.getBoundingClientRect();
    const second = wide.matches
      ? event.clientX > box.left + box.width / 2
      : event.clientY > box.top + box.height / 2;
    const page = showing()[second ? 1 : 0];
    const photo = page && page.querySelector('.photo');
    if (photo && inside(photo, event.clientX, event.clientY)) {
      takeOver();
      passing = true;                                // open the viewer (wirePagePhotos)
      photo.click();
      passing = false;
      return;
    }
    userTurn(second ? 1 : -1);
  }, true);

  /* Reading itself */
  const WAIT_COVER = 2500;     // ms the closed cover shows before it opens
  const WAIT_PAGE = 4500;      // ms on each spread
  const WAIT_END = 6500;       // on the last spread, while our signatures write themselves in
  const CLOSE_GAP = 320;       // ms between pages as the book closes to start again
  let playing = !reduced.matches;
  let visible = false;
  let hovering = false;
  let focused = false;
  let timer = 0;
  let closing = 0;
  const active = () => playing && visible && !hovering && !focused && !document.hidden
    && !root.classList.contains('viewer-open');

  function schedule() {
    clearTimeout(timer);
    book.classList.remove('is-playing');
    if (!active() || closing) return;
    const wait = turned === 0 ? WAIT_COVER : turned === LAST ? WAIT_END : WAIT_PAGE;
    book.style.setProperty('--wait', `${wait}ms`);
    void book.offsetWidth;                   // restart the timer line
    book.classList.add('is-playing');
    timer = setTimeout(advance, wait);
  }
  function advance() {
    if (turned < LAST) {
      turn(1, true);
      schedule();
      return;
    }
    book.classList.remove('is-playing');
    const step = () => {                     // close, page by page, then start again
      if (!active()) { closing = 0; schedule(); return; }
      turn(-1, true);
      if (turned > 0) {
        closing = setTimeout(step, CLOSE_GAP);
      } else {
        closing = setTimeout(() => { closing = 0; schedule(); }, COVER_MS);
      }
    };
    step();
  }
  function setPlaying(on) {
    playing = on;
    if (!on && closing) { clearTimeout(closing); closing = 0; }
    playButton.setAttribute('aria-label', on ? 'Pause turning the pages' : 'Turn the pages by themselves');
    playButton.querySelector('use').setAttribute('href', `/public/images/icons.svg#i-${on ? 'pause' : 'play'}`);
    schedule();
  }
  function takeOver() { if (playing) setPlaying(false); }

  playButton.addEventListener('click', () => setPlaying(!playing));
  book.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') { hovering = true; schedule(); } });
  book.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') { hovering = false; schedule(); } });
  book.addEventListener('focusin', (event) => {
    focused = event.target !== playButton && event.target.matches(':focus-visible');
    schedule();
  });
  book.addEventListener('focusout', (event) => {
    if (!book.contains(event.relatedTarget)) { focused = false; schedule(); }
  });
  document.addEventListener('visibilitychange', schedule);
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['class'] });
  reduced.addEventListener('change', () => { if (reduced.matches) setPlaying(false); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => { visible = entry.isIntersecting; schedule(); });
    }, { threshold: 0.4 }).observe(stage);
  } else {
    visible = true;
  }

  render();
  setPlaying(playing);
}


driftPetals();
setUpSong();
settleOnSections();
start();
setUpBook();

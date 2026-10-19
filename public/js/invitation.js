/*
 * Invitation page (index.html)
 *   1. Personal greeting from ?to=Name
 *   2. "Add to calendar": Google Calendar on Android, the .ics file everywhere else
 *   3. Turning the card over (invitation ⇄ couple photo)
 *   4. The envelope: the seal breaks, the flap opens, the card rises out and comes forward
 *
 * The inline script in index.html's <head> decides before first paint whether the
 * envelope shows (html.intro-on), using the same STORAGE_KEY.
 */

const root = document.documentElement;
const STORAGE_KEY = 'mz-envelope-opened';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const $ = (selector) => document.querySelector(selector);

const CARD_DELAY_MS = 750;   // the seal breaks and the flap opens before the card moves
const CARD_MS = 1850;        // rise out of the envelope, then come forward to the slot
const RISE_PART = 0.3;       // share of CARD_MS spent rising
const PETAL_COUNT = 22;

function rememberOpened(opened) {
  try {
    if (opened) window.sessionStorage.setItem(STORAGE_KEY, '1');
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): the envelope simply shows again next time
  }
}


/* ---------- 1. Personal greeting ---------- */

function greetGuest() {
  const name = (new URLSearchParams(window.location.search).get('to') || '').trim().slice(0, 60);
  if (!name) return;
  document.querySelectorAll('[data-guest-name]').forEach((el) => { el.textContent = name; });
  document.querySelectorAll('[data-guest-greeting]').forEach((el) => { el.hidden = false; });
}


/* ---------- 2. Calendar link ---------- */

function useGoogleCalendarOnAndroid() {
  const link = $('#add-calendar');
  if (!link || !/Android/i.test(navigator.userAgent)) return;
  link.href = link.dataset.google;
  link.target = '_blank';
  link.rel = 'noopener';
}


/* ---------- 3. The card ---------- */

const TURN_PERSPECTIVE = 'perspective(1400px)';

function setUpCard() {
  const el = $('#card');
  const flip = $('#card-flip');
  const faces = el.querySelectorAll('.card-face');
  const photo = faces[1].querySelector('img');
  const turnButton = $('#turn');
  const turnLabel = $('#turn-label');
  const status = $('#status');
  let turned = false;
  let turning = false;

  function showSide(back, announce) {
    turned = back;
    el.classList.toggle('is-turned', back);
    turnButton.classList.toggle('is-turned', back);
    faces[0].setAttribute('aria-hidden', String(back));
    faces[1].setAttribute('aria-hidden', String(!back));
    turnLabel.textContent = back ? 'See the invitation' : 'See our photo';
    if (announce) status.textContent = back ? 'Showing our photo.' : 'Showing the invitation card.';
  }

  const stopTurning = () => {
    if (flip.getAnimations) flip.getAnimations().forEach((animation) => animation.cancel());
  };

  const halfTurn = (fromDeg, toDeg, fromScale, toScale, easing, duration) => flip.animate([
    { transform: `${TURN_PERSPECTIVE} rotateY(${fromDeg}deg) scale(${fromScale})` },
    { transform: `${TURN_PERSPECTIVE} rotateY(${toDeg}deg) scale(${toScale})` },
  ], { duration, easing, fill: 'forwards' }).finished;

  /* Turn in two halves: lift and turn to edge-on, swap the faces, turn back down flat.
     Swapping the faces ourselves (rather than a 180° turn with backface-visibility) looks
     the same everywhere, including mobile browsers that get 3D backfaces wrong. */
  async function turn() {
    if (!el.classList.contains('is-ready') || turning) return;
    const back = !turned;
    if (reducedMotion.matches || !flip.animate) {
      showSide(back, true);                // CSS cross-fades the faces
      return;
    }
    turning = true;
    try {
      await Promise.all([
        halfTurn(0, 90, 1, 1.05, 'cubic-bezier(0.55, 0, 1, 0.45)', 360),
        back ? imageReady(photo, 1500) : null,
      ]);
      showSide(back, true);
      await halfTurn(-90, 0, 1.05, 1, 'cubic-bezier(0.22, 1, 0.36, 1)', 560);
    } catch {
      // Cancelled by a reset
    } finally {
      stopTurning();
      turning = false;
    }
  }

  flip.addEventListener('click', turn);
  turnButton.addEventListener('click', turn);

  return {
    el,
    image: faces[0].querySelector('img'),
    /* Decode the photo ahead of time, so the first turn never shows an empty back */
    warmUp: () => imageReady(photo),
    reset: () => {
      stopTurning();
      showSide(false, false);
    },
  };
}


/* ---------- 4. Envelope → card ---------- */

function imageReady(img, timeoutMs = 3000) {
  const loaded = img.decode
    ? img.decode().catch(() => {})
    : new Promise((resolve) => (img.complete ? resolve() : img.addEventListener('load', resolve, { once: true })));
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([loaded, timeout]);
}

function scatterPetals() {
  const random = (min, max) => min + Math.random() * (max - min);
  const box = document.createElement('div');
  box.className = 'petals';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < PETAL_COUNT; i++) {
    const petal = document.createElement('span');
    petal.className = 'petal';
    petal.style.cssText = [
      `--x: ${random(0, 100).toFixed(1)}vw`,
      `--size: ${random(10, 21).toFixed(0)}px`,
      `--drift: ${random(-90, 90).toFixed(0)}px`,
      `--spin: ${random(-300, 300).toFixed(0)}deg`,
      `--fall: ${random(5, 8).toFixed(2)}s`,
      `--delay: ${random(0, 2.2).toFixed(2)}s`,
    ].join('; ');
    box.append(petal);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 11000);
}

function setUpEnvelope(card) {
  const intro = $('#intro');
  const envelope = $('#envelope');
  const pocket = $('#env-pocket');
  const seal = $('#seal');
  const slot = $('#card-slot');
  const replay = $('#replay');

  let state = 'closed';      // closed → opening → open
  let run = 0;               // bumps on every reset, so callbacks from an older run do nothing
  let animation = null;
  let timers = [];

  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const wait = (ms) => new Promise((resolve) => later(resolve, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  /* Geometry. The card's layout box is its final size, parked at the envelope's top-left
     corner. A frame moves its centre, then rotates and scales it around that centre. */
  const frame = (f) => `translate(${f.x}px, ${f.y}px) rotate(${f.r}deg) scale(${f.s})`;

  function restFrame() {
    const ew = envelope.offsetWidth;
    const eh = envelope.offsetHeight;
    const cw = card.el.offsetWidth;
    const ch = card.el.offsetHeight;
    const s = (ew * 0.9) / ch;               // lying on its side, like a 5×7 card in its envelope
    const visibleH = cw * s;
    return { x: ew / 2 - cw / 2, y: eh * 0.06 + visibleH / 2 - ch / 2, r: -90, s, visibleH };
  }

  function risenFrame(rest) {
    const y = rest.y - rest.visibleH - envelope.offsetHeight * 0.04;
    // On short screens rise only as far as the top edge, so the card never leaves the view
    const topLimit = 8 - envelope.getBoundingClientRect().top - card.el.offsetHeight / 2 + rest.visibleH / 2;
    return { ...rest, y: Math.min(rest.y, Math.max(y, topLimit)) };
  }

  function slotFrame() {
    const e = envelope.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    return { x: s.left - e.left, y: s.top - e.top, r: 0, s: 1 };
  }

  function placeAtRest() {
    card.el.style.transform = frame(restFrame());
  }

  function cancelAnimation() {
    if (animation) animation.cancel();
    animation = null;
  }

  /* Put everything back: the card tucked inside a closed envelope. On a replay, transitions
     are paused for the reset and the arrival animation plays again; on first load it is
     already playing (CSS starts it at first paint) and must not restart. */
  function show({ replay = false } = {}) {
    run += 1;
    clearTimers();
    cancelAnimation();
    state = 'closed';
    if (replay) root.classList.add('no-anim');
    root.classList.add('intro-on');
    intro.classList.remove('is-opening', 'is-leaving');
    envelope.classList.remove('is-open', 'is-dropping');
    card.el.classList.remove('is-ready', 'is-landed', 'is-out');
    card.reset();
    card.el.classList.add('is-traveling');
    envelope.insertBefore(card.el, pocket);
    placeAtRest();
    window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    intro.scrollTop = 0;
    if (replay) {
      void root.offsetWidth;                 // commit the reset before transitions come back
      root.classList.remove('no-anim');
    }
  }

  /* The card has reached its slot: hand over to the page */
  function land() {
    clearTimers();
    state = 'open';
    card.el.classList.remove('is-traveling', 'is-out');
    card.el.style.transform = '';
    slot.append(card.el);
    cancelAnimation();                       // same task as the move, so no frame shows in between
    root.classList.remove('intro-on');
    card.el.classList.add('is-ready');
    card.warmUp();
    if (!reducedMotion.matches) {
      card.el.classList.add('is-landed');
      scatterPetals();
    }
    card.el.focus({ preventScroll: true });
  }

  function travel(token) {
    if (token !== run) return;
    const rest = restFrame();
    animation = card.el.animate([
      { transform: frame(rest), easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
      { transform: frame(risenFrame(rest)), offset: RISE_PART, easing: 'cubic-bezier(0.3, 0.85, 0.35, 1.06)' },
      { transform: frame(slotFrame()) },
    ], { duration: CARD_MS, fill: 'forwards' });
    later(() => {
      card.el.classList.add('is-out');       // above the pocket and flap from here on
      envelope.classList.add('is-dropping');
    }, CARD_MS * RISE_PART - 40);
    animation.finished.then(
      () => { if (token === run) land(); },
      () => { /* cancelled by a reset */ },
    );
  }

  function open() {
    if (state !== 'closed') return;
    state = 'opening';
    rememberOpened(true);
    const token = run;
    intro.classList.add('is-opening');
    if (reducedMotion.matches || !card.el.animate) {
      intro.classList.add('is-leaving');
      later(land, 260);
      return;
    }
    envelope.classList.add('is-open');
    Promise.all([imageReady(card.image), wait(CARD_DELAY_MS)]).then(() => travel(token));
  }

  // The seal button is inside the envelope, so keyboard Enter/Space on it lands here too
  envelope.addEventListener('click', open);

  replay.hidden = false;
  replay.addEventListener('click', () => {
    rememberOpened(false);
    show({ replay: true });
    seal.focus({ preventScroll: true });
  });

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (state !== 'closed' || !root.classList.contains('intro-on') || resizeQueued) return;
    resizeQueued = true;
    window.requestAnimationFrame(() => {
      resizeQueued = false;
      placeAtRest();
    });
  });

  if (root.classList.contains('intro-on')) {
    show();
  } else {
    card.el.classList.add('is-ready');
    card.warmUp();
  }
}


greetGuest();
useGoogleCalendarOnAndroid();
setUpEnvelope(setUpCard());

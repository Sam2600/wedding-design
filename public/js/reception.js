/*
 * Wedding reception invitation (reception.html)
 *   1. Personal greeting from ?to=Name, and the language (Myanmar / English)
 *   2. "Add to calendar": Google Calendar on Android, the .ics file everywhere else
 *   3. Turning the card over (printed card ⇄ our photo); on arrival the photo shows first
 *   4. The envelope: the seal lifts off, the flap opens, the card rises out and comes forward
 *   5. Background music: starts with the seal tap, a corner button turns it off and on
 *   6. Countdown to the morning of the reception
 *   7. Sections rise in as they arrive
 *   8. Gallery: a small 3D coverflow that plays by itself, and a full-screen viewer
 *
 * Sections 3 to 5 are the invitation's (invitation.js), with this page's ids.
 */

const root = document.documentElement;
const $ = (selector) => document.querySelector(selector);

const CARD_DELAY_MS = 750;
const CARD_MS = 1850;
const RISE_PART = 0.3;
const PHOTO_FIRST_MS = 1800;
const PETAL_COUNT = 14;
const MUSIC_VOLUME = 0.6;
const MUSIC_OUT_MS = 1500;
const MUSIC_HINT_MS = 4000;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');


/* ---------- 1. Greeting and language ---------- */

function greetGuest() {
  const name = (new URLSearchParams(window.location.search).get('to') || '').trim().slice(0, 60);
  if (!name) return;
  document.querySelectorAll('[data-guest-name]').forEach((el) => { el.textContent = name; });
  document.querySelectorAll('[data-guest-greeting]').forEach((el) => { el.hidden = false; });
}

/* Myanmar first; the choice is remembered on this phone (the <head> script applies it before
   first paint). ?lang=en in the link picks English for a guest who has not chosen yet. */
function setUpLanguage() {
  const buttons = document.querySelectorAll('[data-set-lang]');
  const apply = (lang) => {
    root.dataset.lang = lang;
    root.lang = lang;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
  };
  let saved = null;
  try { saved = localStorage.getItem('reception-lang'); } catch { /* storage blocked */ }
  const asked = new URLSearchParams(window.location.search).get('lang');
  apply(saved || (asked === 'en' ? 'en' : 'my'));
  buttons.forEach((button) => button.addEventListener('click', () => {
    apply(button.dataset.setLang);
    try { localStorage.setItem('reception-lang', button.dataset.setLang); } catch { /* storage blocked */ }
  }));
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
  const el = $('#the-card');
  const flip = $('#card-flip');
  const faces = el.querySelectorAll('.card-face');
  const photo = faces[1].querySelector('img');
  const turnButton = $('#turn');
  const status = $('#status');
  let turned = false;
  let turning = false;

  function showSide(back, announce) {
    turned = back;
    el.classList.toggle('is-turned', back);
    turnButton.classList.toggle('is-turned', back);
    faces[0].setAttribute('aria-hidden', String(back));
    faces[1].setAttribute('aria-hidden', String(!back));
    if (announce) status.textContent = back ? 'Showing our photo.' : 'Showing the invitation card.';
  }

  const stopTurning = () => {
    if (flip.getAnimations) flip.getAnimations().forEach((animation) => animation.cancel());
  };

  const halfTurn = (fromDeg, toDeg, fromScale, toScale, easing, duration) => flip.animate([
    { transform: `${TURN_PERSPECTIVE} rotateY(${fromDeg}deg) scale(${fromScale})` },
    { transform: `${TURN_PERSPECTIVE} rotateY(${toDeg}deg) scale(${toScale})` },
  ], { duration, easing, fill: 'forwards' }).finished;

  async function turn() {
    if (!el.classList.contains('is-ready') || turning) return;
    const back = !turned;
    if (!flip.animate) {
      showSide(back, true);
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

  let autoTurn = 0;
  const cancelAutoTurn = () => clearTimeout(autoTurn);
  const turnByHand = () => {
    cancelAutoTurn();
    turn();
  };
  flip.addEventListener('click', turnByHand);
  turnButton.addEventListener('click', turnByHand);

  return {
    el,
    warmUp: () => imageReady(photo),
    showPhoto: () => showSide(true, false),
    turnToInvitationSoon: (delayMs) => {
      cancelAutoTurn();
      autoTurn = setTimeout(async () => {
        if (!turned) return;
        await turn();
        if (!turned) {
          el.classList.remove('is-landed');
          void el.offsetWidth;
          el.classList.add('is-landed');
        }
      }, delayMs);
    },
    reset: () => {
      cancelAutoTurn();
      stopTurning();
      showSide(false, false);
    },
  };
}


/* ---------- 4. Envelope → card ---------- */

function imageReady(img, timeoutMs = 3000) {
  if (!img) return Promise.resolve();
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

function setUpEnvelope(card, music) {
  const intro = $('#intro');
  const envelope = $('#envelope');
  const pocket = $('#env-pocket');
  const seal = $('#seal');
  const slot = $('#card-slot');
  const replay = $('#replay');

  let state = 'closed';
  let run = 0;
  let animation = null;
  let timers = [];

  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const wait = (ms) => new Promise((resolve) => later(resolve, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const frame = (f) => `translate(${f.x}px, ${f.y}px) rotate(${f.r}deg) scale(${f.s})`;

  function restFrame() {
    const ew = envelope.offsetWidth;
    const eh = envelope.offsetHeight;
    const cw = card.el.offsetWidth;
    const ch = card.el.offsetHeight;
    const s = (ew * 0.9) / ch;
    const visibleH = cw * s;
    return { x: ew / 2 - cw / 2, y: eh * 0.06 + visibleH / 2 - ch / 2, r: -90, s, visibleH };
  }

  function risenFrame(rest) {
    const y = rest.y - rest.visibleH - envelope.offsetHeight * 0.04;
    const topLimit = 8 - envelope.getBoundingClientRect().top - card.el.offsetHeight / 2 + rest.visibleH / 2;
    return { ...rest, y: Math.min(rest.y, Math.max(y, topLimit)) };
  }

  function slotFrame() {
    const e = envelope.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    return { x: s.left - e.left, y: s.top - e.top, r: 0, s: 1 };
  }

  const placeAtRest = () => { card.el.style.transform = frame(restFrame()); };

  function cancelAnimation() {
    if (animation) animation.cancel();
    animation = null;
  }

  function show({ replay: again = false } = {}) {
    run += 1;
    clearTimers();
    cancelAnimation();
    state = 'closed';
    if (again) {
      root.classList.add('no-anim');
      document.querySelectorAll('.petals').forEach((box) => box.remove());
    }
    root.classList.add('intro-on');
    intro.classList.remove('is-opening', 'is-leaving');
    envelope.classList.remove('is-open', 'is-dropping');
    card.el.classList.remove('is-ready', 'is-landed', 'is-out');
    card.reset();
    card.showPhoto();
    card.el.classList.add('is-traveling');
    envelope.insertBefore(card.el, pocket);
    placeAtRest();
    window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    intro.scrollTop = 0;
    if (again) {
      void root.offsetWidth;
      root.classList.remove('no-anim');
    }
  }

  function land() {
    clearTimers();
    state = 'open';
    card.el.classList.remove('is-traveling', 'is-out');
    card.el.style.transform = '';
    slot.append(card.el);
    cancelAnimation();
    root.classList.remove('intro-on');
    card.el.classList.add('is-ready');
    card.turnToInvitationSoon(PHOTO_FIRST_MS);
    scatterPetals();
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
      card.el.classList.add('is-out');
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
    music.startWithIntro();
    const token = run;
    intro.classList.add('is-opening');
    if (!card.el.animate) {
      intro.classList.add('is-leaving');
      later(land, 260);
      return;
    }
    envelope.classList.add('is-open');
    Promise.all([card.warmUp(), wait(CARD_DELAY_MS)]).then(() => travel(token));
  }

  envelope.addEventListener('click', open);

  replay.hidden = false;
  replay.addEventListener('click', () => {
    music.stopForIntro();
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


/* ---------- 5. Background music ---------- */

function setUpMusic() {
  const audio = $('#music');
  const button = $('#music-toggle');
  const status = $('#status');
  let wanted = false;
  let fade = 0;
  let hintTimer = 0;
  let hiddenPause = false;
  let turnedOff = false;

  const showState = (playing) => button.setAttribute('aria-pressed', String(playing));

  audio.volume = 0.5;
  const canFade = audio.volume === 0.5;   // iOS keeps volume fixed at 1

  function rampTo(target, ms, then) {
    cancelAnimationFrame(fade);
    if (!canFade || document.hidden) {
      if (canFade) audio.volume = target;
      if (then) then();
      return;
    }
    const from = audio.volume;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      const eased = target < from ? 1 - (1 - t) ** 2 : t * t;
      audio.volume = from + (target - from) * eased;
      if (t < 1) fade = requestAnimationFrame(step);
      else if (then) then();
    };
    fade = requestAnimationFrame(step);
  }

  function play() {
    if (canFade) audio.volume = 0;
    showState(true);
    const playing = audio.play();
    rampTo(MUSIC_VOLUME, 1200);
    if (playing) playing.catch(() => { wanted = false; showState(false); });
  }

  function pause() {
    showState(false);
    rampTo(0, 300, () => audio.pause());
  }

  function setWanted(on) {
    wanted = on;
    turnedOff = !on;
    status.textContent = on ? 'Music on.' : 'Music off.';
  }

  audio.addEventListener('play', () => { if (!document.hidden && !wanted) setWanted(true); showState(true); });
  audio.addEventListener('pause', () => {
    if (hiddenPause) {
      hiddenPause = false;
      return;
    }
    if (button.getAttribute('aria-pressed') === 'true') { setWanted(false); showState(false); }
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: 'Wedding Music',
      artist: 'andriih',
      album: 'Mintzu & Zwe · Wedding Reception',
      artwork: [{ src: '/public/images/reception/card-photo-900.jpg', sizes: '900x1351', type: 'image/jpeg' }],
    });
    navigator.mediaSession.setActionHandler('play', () => { setWanted(true); play(); });
    navigator.mediaSession.setActionHandler('pause', () => { setWanted(false); pause(); });
  }

  function hint() {
    clearTimeout(hintTimer);
    button.classList.add('show-hint');
    hintTimer = setTimeout(() => button.classList.remove('show-hint'), MUSIC_HINT_MS);
  }

  button.addEventListener('click', () => {
    const on = button.getAttribute('aria-pressed') !== 'true';
    setWanted(on);
    button.classList.remove('show-hint');
    if (on) play(); else pause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(fade);
      if (!audio.paused) {
        hiddenPause = true;
        audio.pause();
      }
    } else if (wanted) {
      play();
    }
  });

  audio.addEventListener('error', () => { wanted = false; button.hidden = true; });
  button.hidden = false;

  return {
    startWithIntro() {
      if (wanted || turnedOff) return;
      wanted = true;
      play();
      setTimeout(() => { if (wanted) hint(); }, CARD_DELAY_MS + CARD_MS);
    },
    stopForIntro() {
      clearTimeout(hintTimer);
      button.classList.remove('show-hint');
      if (!wanted) return;
      wanted = false;
      showState(false);
      rampTo(0, MUSIC_OUT_MS, () => { audio.pause(); audio.currentTime = 0; });
    },
  };
}


/* ---------- 6. Countdown ---------- */

/* Counts down to 9 AM Myanmar time; during the reception and after it, a line in its place */
function setUpCountdown() {
  const box = $('.countdown');
  if (!box) return;
  const start = Date.parse(box.dataset.at);
  const end = Date.parse(box.dataset.until);
  const list = $('#count');
  const now = $('#count-now');
  const sr = $('#count-sr');
  const cells = {};
  list.querySelectorAll('[data-unit]').forEach((cell) => { cells[cell.dataset.unit] = cell; });
  const pad = (n) => String(n).padStart(2, '0');
  let timer = 0;

  const LINES = {
    during: '<span class="t-my">မင်္ဂလာဧည့်ခံပွဲ ယခု ကျင်းပနေပါပြီ</span><span class="t-en">Happening now</span>',
    after: '<span class="t-my">ကြွရောက်ချီးမြှင့်ခဲ့ကြသည့်အတွက် ကျေးဇူးတင်ပါသည်</span><span class="t-en">Thank you for celebrating with us</span>',
  };

  function tick() {
    const left = start - Date.now();
    if (left <= 0) {
      list.hidden = true;
      now.hidden = false;
      now.innerHTML = Date.now() < end ? LINES.during : LINES.after;
      sr.textContent = '';
      return;
    }
    const s = Math.floor(left / 1000);
    const d = Math.floor(s / 86400);
    cells.d.textContent = pad(d);
    cells.h.textContent = pad(Math.floor((s % 86400) / 3600));
    cells.m.textContent = pad(Math.floor((s % 3600) / 60));
    cells.s.textContent = pad(s % 60);
    sr.textContent = `${d} days to go.`;
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  }
  tick();
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) tick();
  });
}


/* ---------- 7. Sections rise in as they arrive ---------- */

function setUpSections() {
  if (!('IntersectionObserver' in window)) return;
  root.classList.add('js-rv');
  const riser = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      riser.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.rv').forEach((el) => riser.observe(el));
}


/* ---------- 8. Gallery: a small 3D coverflow, and the viewer ---------- */

/* Every photo sits at its offset from a moving position `pos` (in photos): the one at 0 faces
   the guest, the others turn away on either side and sink back. `pos` springs towards `target`
   each frame (a little overshoot, then rest), and follows a finger or the mouse exactly while
   dragged; letting go keeps the throw's momentum and lands on the nearest photo. The ring has no
   ends. It moves on by itself (the book's manners: it waits while a mouse is over it, a key has
   focus in it, the tab is hidden, the viewer is open or it is off screen); any move by the guest
   hands it over to them; reduced motion: no auto-play, no spring. */
function setUpFlow() {
  const flow = $('#flow');
  if (!flow) return;
  const gallery = flow.closest('.gallery');
  const items = [...flow.querySelectorAll('.flow-item')];
  const cards = items.map((item) => item.querySelector('.flow-card'));
  const n = items.length;
  const count = $('#flow-count');
  const status = $('#flow-status');
  const prevButton = $('#flow-prev');
  const nextButton = $('#flow-next');
  const playButton = $('#flow-play');
  const WAIT = 3600;
  const pad = (k) => String(k).padStart(2, '0');
  const wrap = (k) => ((k % n) + n) % n;
  let pos = 0;
  let target = 0;
  let vel = 0;
  let raf = 0;
  let center = -1;
  let drag = null;
  let justDragged = false;

  const spacing = () => items[0].offsetWidth * 0.62;
  // Offset of photo i from the front, the short way round the ring
  const offset = (i, from = pos) => {
    let o = (i - from) % n;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  };

  function layout() {
    const fw = items[0].offsetWidth;
    items.forEach((item, i) => {
      const o = offset(i);
      const a = Math.abs(o);
      const side = Math.sign(o);
      const near = Math.min(a, 1);
      const x = side * (near * fw * 0.62 + Math.max(0, a - 1) * fw * 0.34);
      const z = -Math.min(a, 4) * 150;
      const turn = -side * near * 50;
      const scale = 1 - Math.min(a, 3) * 0.045;
      item.style.transform = `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${turn.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      item.style.zIndex = String(100 - Math.round(a * 10));
      item.style.opacity = Math.max(0, Math.min(1, 3.3 - a)).toFixed(3);
      item.style.visibility = a > 3.4 ? 'hidden' : 'visible';
      cards[i].style.setProperty('--dim', Math.min(a * 0.2, 0.55).toFixed(3));
    });
    const front = wrap(Math.round(pos));
    if (front !== center) {
      if (center >= 0) items[center].classList.remove('is-center', 'is-arrived');
      center = front;
      items[center].classList.add('is-center');
      void items[center].offsetWidth;
      items[center].classList.add('is-arrived');
      cards.forEach((card, i) => {
        card.tabIndex = -1;
        card.setAttribute('aria-label', `Photo ${i + 1} of ${n}${i === center ? ', tap to enlarge' : ''}`);
      });
      count.textContent = `${pad(center + 1)} / ${pad(n)}`;
    }
  }

  function frame() {
    raf = 0;
    if (!drag) {
      if (reducedMotion.matches) {
        pos = target;
        vel = 0;
      } else {
        vel = (vel + (target - pos) * 0.07) * 0.8;
        pos += vel;
        if (Math.abs(target - pos) < 0.0008 && Math.abs(vel) < 0.0008) {
          pos = target;
          vel = 0;
        }
      }
    }
    layout();
    if (drag || pos !== target) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const go = (to) => { target = to; kick(); };
  // Bring photo i to the front, the short way round
  const bring = (i) => go(Math.round(target) + offset(i, Math.round(target)));

  function userGo(dir) {
    takeOver();
    go(Math.round(target) + dir);
    status.textContent = `Photo ${wrap(Math.round(target)) + 1} of ${n}`;
  }
  prevButton.addEventListener('click', () => userGo(-1));
  nextButton.addEventListener('click', () => userGo(1));
  flow.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      userGo(event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openViewer(center);
    }
  });

  /* Drag: follow the pointer once it has moved sideways; up-and-down stays a scroll */
  flow.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button > 0) return;
    drag = null;
    flow.dataset.press = '1';
    const press = { id: event.pointerId, x0: event.clientX, y0: event.clientY, pos0: pos, lastX: event.clientX, lastT: event.timeStamp, v: 0, moved: false };
    const move = (e) => {
      if (e.pointerId !== press.id) return;
      const dx = e.clientX - press.x0;
      if (!press.moved) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - press.y0)) return;
        press.moved = true;
        drag = press;
        takeOver();
        vel = 0;
        flow.classList.add('is-dragging');
        try { flow.setPointerCapture(e.pointerId); } catch { /* already released */ }
      }
      const dt = Math.max(1, e.timeStamp - press.lastT);
      press.v = 0.7 * press.v + 0.3 * ((e.clientX - press.lastX) / dt);
      press.lastX = e.clientX;
      press.lastT = e.timeStamp;
      pos = press.pos0 - dx / spacing();
      kick();
    };
    const up = (e) => {
      if (e.pointerId !== press.id) return;
      flow.removeEventListener('pointermove', move);
      flow.removeEventListener('pointerup', up);
      flow.removeEventListener('pointercancel', up);
      if (!press.moved) return;
      drag = null;
      flow.classList.remove('is-dragging');
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 0);
      // Keep the throw: px/ms over the spacing, ~0.25 s of travel
      go(Math.round(pos - (press.v * 250) / spacing()));
    };
    flow.addEventListener('pointermove', move);
    flow.addEventListener('pointerup', up);
    flow.addEventListener('pointercancel', up);
  });

  /* Tap: the photo in front opens; one at the side comes to the front */
  cards.forEach((card, i) => card.addEventListener('click', () => {
    if (justDragged) return;
    takeOver();
    if (i === center && pos === target) openViewer(i);
    else bring(i);
  }));

  /* Playing by itself */
  let playing = !reducedMotion.matches;
  let visible = false;
  let hovering = false;
  let focused = false;
  let timer = 0;
  const active = () => playing && visible && !hovering && !focused && !drag && !document.hidden
    && !root.classList.contains('viewer-open') && !root.classList.contains('intro-on');

  function schedule() {
    clearTimeout(timer);
    gallery.classList.remove('is-playing');
    if (!active()) return;
    gallery.style.setProperty('--wait', `${WAIT}ms`);
    void gallery.offsetWidth;
    gallery.classList.add('is-playing');
    timer = setTimeout(() => { go(Math.round(target) + 1); schedule(); }, WAIT);
  }
  function setPlaying(on) {
    playing = on;
    playButton.setAttribute('aria-label', on ? 'Pause the photos' : 'Play the photos');
    playButton.querySelector('use').setAttribute('href', `/public/images/icons.svg#i-${on ? 'pause' : 'play'}`);
    schedule();
  }
  function takeOver() { if (playing) setPlaying(false); }

  playButton.addEventListener('click', () => setPlaying(!playing));
  gallery.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') { hovering = true; schedule(); } });
  gallery.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') { hovering = false; schedule(); } });
  gallery.addEventListener('focusin', (event) => {
    focused = event.target !== playButton && event.target.matches(':focus-visible');
    schedule();
  });
  gallery.addEventListener('focusout', (event) => {
    if (!gallery.contains(event.relatedTarget)) { focused = false; schedule(); }
  });
  document.addEventListener('visibilitychange', schedule);
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['class'] });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) setPlaying(false); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => { visible = entry.isIntersecting; schedule(); });
    }, { threshold: 0.4 }).observe(flow);
  } else {
    visible = true;
  }
  window.addEventListener('resize', kick);

  /* The viewer: the full photo; closing brings the last one seen to the front */
  const viewer = $('#viewer');
  const img = $('#viewer-img');
  const viewerCount = $('#viewer-count');
  let at = 0;

  function show(i) {
    at = wrap(i);
    img.src = cards[at].dataset.full;
    img.alt = cards[at].querySelector('img').alt;
    viewerCount.textContent = `${at + 1} / ${n}`;
  }
  function openViewer(i) {
    show(i);
    if (typeof viewer.showModal === 'function') viewer.showModal();
    else viewer.setAttribute('open', '');
    root.classList.add('viewer-open');
  }
  function closeViewer() {
    if (viewer.open && typeof viewer.close === 'function') viewer.close();
    else viewer.removeAttribute('open');
  }
  viewer.addEventListener('close', () => {
    root.classList.remove('viewer-open');
    bring(at);
    flow.focus({ preventScroll: true });
  });
  $('#viewer-close').addEventListener('click', closeViewer);
  $('#viewer-prev').addEventListener('click', () => show(at - 1));
  $('#viewer-next').addEventListener('click', () => show(at + 1));
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(at - 1);
    if (event.key === 'ArrowRight') show(at + 1);
  });
  viewer.addEventListener('click', (event) => { if (event.target === viewer) closeViewer(); });
  let press = null;
  viewer.addEventListener('pointerdown', (event) => { if (event.isPrimary) press = { x: event.clientX, y: event.clientY }; });
  viewer.addEventListener('pointerup', (event) => {
    if (!press) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    press = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) show(at + (dx < 0 ? 1 : -1));
  });

  layout();
  setPlaying(playing);
}


greetGuest();
setUpLanguage();
useGoogleCalendarOnAndroid();
setUpEnvelope(setUpCard(), setUpMusic());
setUpCountdown();
setUpSections();
setUpFlow();

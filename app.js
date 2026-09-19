// ============================================================
// Shared behavior for every page. Pages differ only in which
// elements exist in their HTML — every function here guards on
// that, so one file works everywhere.
// ============================================================

let curtain;
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function playCurtainReveal() {
    if (typeof gsap === 'undefined' || !curtain) return;
    gsap.set(curtain, { y: '0%' });
    gsap.to(curtain, { duration: REDUCE_MOTION ? 0.05 : 0.6, y: '-100%', ease: 'power3.inOut', delay: REDUCE_MOTION ? 0 : 0.15 });
}

// Any internal link marked data-transition gets the curtain-down
// animation before the browser navigates to the real URL. A plain
// click (or a crawler that ignores JS entirely) still just follows
// the href normally.
function wireTransitionLinks() {
    document.querySelectorAll('a[data-transition]').forEach(link => {
        link.addEventListener('click', function (e) {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // let modified clicks behave natively (open in new tab, etc.)
            const href = this.getAttribute('href');
            if (!href) return;
            if (typeof gsap === 'undefined' || !curtain) { window.location.href = href; return; }
            e.preventDefault();
            gsap.to(curtain, {
                duration: REDUCE_MOTION ? 0.05 : 0.5, y: '0%', ease: 'power3.inOut',
                onComplete: () => { window.location.href = href; }
            });
        });
    });
}

window.scrollToSection = function (sectionId) {
    const target = document.getElementById(sectionId);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.filterProjects = function (event, category) {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => { btn.classList.remove('filter-active'); btn.classList.add('filter-inactive'); });
    const activeBtn = event.currentTarget;
    activeBtn.classList.remove('filter-inactive');
    activeBtn.classList.add('filter-active');

    document.querySelectorAll('.project-card').forEach(card => {
        if (category === 'all' || card.getAttribute('data-category') === category) {
            card.style.display = 'block';
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(card, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
            }
        } else {
            card.style.display = 'none';
        }
    });
};

window.openResearchFull = function () {
    const preview = document.getElementById('research-preview');
    const full = document.getElementById('research-full');
    if (!preview || !full || typeof gsap === 'undefined' || !curtain) return;
    gsap.to(curtain, {
        duration: REDUCE_MOTION ? 0.05 : 0.4, y: '0%', ease: 'power3.inOut', onComplete: () => {
            preview.style.display = 'none';
            full.style.display = 'flex';
            gsap.to(curtain, { duration: REDUCE_MOTION ? 0.05 : 0.4, y: '-100%', ease: 'power3.inOut' });
        }
    });
};

function startGreetingCarousel() {
    const words = document.querySelectorAll('.greeting-word');
    if (!words.length) return;
    let currentIndex = 0;
    words.forEach(w => w.classList.remove('active'));
    words[0].classList.add('active');
    window.carouselInterval = setInterval(() => {
        words[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % words.length;
        words[currentIndex].classList.add('active');
    }, 2000);
}

// ---------------- Logo ripple effect (home page only) ----------------
// Real frosted-glass circles (actual backdrop-filter blur of whatever page
// content sits behind them), not canvas-drawn outlines — canvas has no way
// to blur what's behind it, only a real DOM element does.
function initLogoRipple() {
    const brandingLogo = document.querySelector('.branding-logo');
    if (!brandingLogo || REDUCE_MOTION || typeof gsap === 'undefined') return;

    window.triggerLogoEffect = function () {
        const logoImg = brandingLogo.querySelector('img');
        const rect = logoImg.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        // Diameter needs to be ~2x the viewport diagonal to fully reach the
        // farthest corner when the ripple originates near a corner (like the
        // logo does) rather than dead-center.
        const maxSize = 2 * Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);

        let spawned = 0;
        const interval = setInterval(() => {
            spawnGlassRipple(centerX, centerY, maxSize);
            spawned++;
            if (spawned >= 4) clearInterval(interval);
        }, 300);
    };
}

function spawnGlassRipple(x, y, maxSize) {
    const el = document.createElement('div');
    el.className = 'glass-ripple';
    document.body.appendChild(el);
    gsap.set(el, { x, y, xPercent: -50, yPercent: -50, width: 0, height: 0, opacity: 0 });

    const tl = gsap.timeline({ onComplete: () => el.remove() });
    // Strong, fast start (quick pop to near-full opacity + a burst of initial
    // growth), then the expansion visibly decelerates as it spreads across
    // the page, calming down into a slow fade rather than an abrupt cut-off.
    tl.to(el, { opacity: 1, width: maxSize * 0.12, height: maxSize * 0.12, duration: 0.2, ease: 'power2.out' })
      .to(el, { width: maxSize, height: maxSize, duration: 2.6, ease: 'power3.out' }, '<')
      .to(el, { opacity: 0, duration: 1.4, ease: 'power1.in' }, '-=1.4');
}

// ---------------- Diecast Dash mini-game (About/Hi page only) ----------------
function initCarGame() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('gameOverlay');
    let gameRunning = false, score = 0, speed = 5, obstacles = [], animationId, groundY = 0;
    let car = { x: 50, y: 0, width: 40, height: 20, dy: 0, jumpPower: -10, gravity: 0.6, grounded: true };

    function resizeGame() {
        const parent = canvas.parentElement;
        if (parent) { canvas.width = parent.clientWidth; canvas.height = parent.clientHeight; groundY = canvas.height - 30; if (car.grounded) car.y = groundY - 25; }
    }
    window.addEventListener('resize', resizeGame);
    resizeGame();

    function drawRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.floor(x), Math.floor(y), w, h); }
    function drawPixelCar(x, y) {
        drawRect(x, y, 40, 20, '#000'); drawRect(x + 10, y - 10, 20, 10, '#000'); drawRect(x + 12, y - 8, 8, 6, '#fff'); drawRect(x + 22, y - 8, 6, 6, '#fff'); drawRect(x + 5, y + 15, 10, 10, '#555'); drawRect(x + 25, y + 15, 10, 10, '#555');
    }

    function spawnObstacle() {
        if (!gameRunning) return;
        const minGap = 300; const randomGap = Math.random() * 400;
        if (obstacles.length === 0 || (canvas.width - obstacles[obstacles.length - 1].x > minGap + randomGap)) { obstacles.push({ x: canvas.width, y: groundY - 25, width: 20, height: 20 }); }
    }

    function update() {
        if (!gameRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawRect(0, groundY, canvas.width, 2, '#000');
        if (!car.grounded) { car.dy += car.gravity; car.y += car.dy; }
        if (car.y >= groundY - 25) { car.y = groundY - 25; car.dy = 0; car.grounded = true; } else { car.grounded = false; }
        drawPixelCar(car.x, car.y);
        if (Math.random() < 0.015) spawnObstacle();
        for (let i = 0; i < obstacles.length; i++) {
            let obs = obstacles[i]; obs.x -= speed; const obsY = groundY - obs.height;
            drawRect(obs.x, obsY, obs.width, obs.height, '#ff4400'); drawRect(obs.x + 2, obsY + 8, obs.width - 4, 4, '#fff');
            if (car.x < obs.x + obs.width && car.x + car.width > obs.x && car.y < obsY + obs.height && car.y + car.height > obsY) { resetGame(); return; }
            if (obs.x + obs.width < 0) { obstacles.splice(i, 1); i--; score++; }
        }
        ctx.font = '24px "VT323"'; ctx.fillStyle = '#000'; ctx.fillText(`SCORE: ${score}`, 20, 40);
        animationId = requestAnimationFrame(update);
    }

    function jump() { if (car.grounded) { car.dy = car.jumpPower; car.grounded = false; } }

    function startGame(e) {
        if (e && e.type === 'keydown') e.preventDefault();
        if (!gameRunning) {
            gameRunning = true; score = 0; obstacles = []; car.y = groundY - 25; car.dy = 0; car.grounded = true; overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none'; update();
        } else { jump(); }
    }

    function resetGame() {
        gameRunning = false; cancelAnimationFrame(animationId); overlay.style.opacity = '1'; overlay.style.pointerEvents = 'auto';
        overlay.innerHTML = `<div class="text-center"><p class="font-pixel text-4xl text-red-600 mb-2">GAME OVER</p><p class="font-pixel text-xl text-black">SCORE: ${score}</p><p class="font-sans text-xs text-gray-500 mt-2">Click to Restart</p></div>`;
    }

    const gameContainer = document.getElementById('gameContainer');
    gameContainer.addEventListener('mousedown', startGame);
    gameContainer.addEventListener('touchstart', (e) => { e.preventDefault(); startGame(e); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Space') startGame(e); });
}

// ---------------- Custom cursor: glass dot, three tiers ----------------
// - data-cursor-icon + data-cursor-text on any <a>/<button> → rich glass pill
//   with that icon and label (e.g. the eye icon + "VIEW CASE STUDY" on
//   project cards, the mail icon + "COPY EMAIL" on email links).
// - data-cursor-quiet on any <a>/<button> → the cursor recedes (dimmer,
//   no pill) instead of announcing itself — used for navigation/utility
//   controls (main menu, back button, filters, section jump links).
// - Neither attribute → falls back to the eye icon + "VIEW".
// - data-copy="value" on top of the above → clicking copies that value to
//   the clipboard instead of following the link, with a "COPIED" flash.
//
// To label something new: add data-cursor-icon="eye|mail|check" and
// data-cursor-text="YOUR LABEL" to any link or button. To mark something as
// navigation/secondary instead: add data-cursor-quiet (no value needed).
const CURSOR_ICONS = {
    eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>',
    mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

function initCustomCursor() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof gsap === 'undefined') return;

    const isDark = !!document.querySelector('.content-header.dark-mode');

    const dot = document.createElement('div');
    dot.id = 'cursor-dot';

    const glass = document.createElement('div');
    glass.id = 'cursor-glass';
    glass.innerHTML = '<span id="cursor-glass-icon"></span><span id="cursor-glass-label"></span>';

    [dot, glass].forEach(el => {
        if (isDark) el.classList.add('cursor-on-dark');
        document.body.appendChild(el);
    });
    const iconEl = glass.querySelector('#cursor-glass-icon');
    const labelEl = glass.querySelector('#cursor-glass-label');

    gsap.set([dot, glass], { xPercent: -50, yPercent: -50, scale: 0 });

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const glassX = gsap.quickTo(glass, 'x', { duration: 0.3, ease: 'power3' });
    const glassY = gsap.quickTo(glass, 'y', { duration: 0.3, ease: 'power3' });

    function onMouseMove(e) {
        dotX(e.clientX);
        dotY(e.clientY);
        glassX(e.clientX);
        glassY(e.clientY);
    }

    function onEnterTarget(e) {
        const el = e.currentTarget;
        if (el.hasAttribute('data-cursor-quiet')) {
            // Receding state: no pill, just a dimmer, slightly larger dot.
            glass.classList.remove('has-label');
            gsap.to(dot, { scale: 1.8, opacity: 0.35, duration: 0.2 });
            gsap.to(glass, { scale: 0, opacity: 0, duration: 0.15 });
            return;
        }
        const icon = el.getAttribute('data-cursor-icon') || 'eye';
        const text = el.getAttribute('data-cursor-text') || 'VIEW';
        iconEl.innerHTML = CURSOR_ICONS[icon] || CURSOR_ICONS.eye;
        labelEl.textContent = text;
        glass.classList.add('has-label');
        gsap.to(dot, { scale: 0, opacity: 0, duration: 0.2 });
        gsap.to(glass, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.7)' });
    }
    function onLeaveTarget() {
        gsap.to(dot, { scale: 1, opacity: 1, duration: 0.2 });
        gsap.to(glass, { scale: 0, opacity: 0, duration: 0.2 });
    }

    function onClickCopy(e) {
        const value = e.currentTarget.getAttribute('data-copy');
        if (!value || !navigator.clipboard) return; // fall through to normal link behavior
        e.preventDefault();
        navigator.clipboard.writeText(value).then(() => {
            iconEl.innerHTML = CURSOR_ICONS.check;
            labelEl.textContent = 'COPIED';
            setTimeout(() => {
                iconEl.innerHTML = CURSOR_ICONS[e.currentTarget.getAttribute('data-cursor-icon') || 'eye'];
                labelEl.textContent = e.currentTarget.getAttribute('data-cursor-text') || 'VIEW';
            }, 1200);
        });
    }

    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseenter', onEnterTarget);
        el.addEventListener('mouseleave', onLeaveTarget);
        if (el.hasAttribute('data-copy')) el.addEventListener('click', onClickCopy);
    });

    function show() { gsap.to(dot, { scale: 1, opacity: 1, duration: 0.2 }); }
    function hide() { gsap.to([dot, glass], { scale: 0, opacity: 0, duration: 0.2 }); }

    window.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseenter', show);
    document.body.addEventListener('mouseleave', hide);
}

// ---------------- "Journey So Far" stat counters (Projects page) ----------------
function initStatCounters() {
    const counters = document.querySelectorAll('.stat-count');
    if (!counters.length) return;

    counters.forEach(el => {
        const target = parseFloat(el.getAttribute('data-count-to'));
        const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
        const suffix = el.getAttribute('data-suffix') || '';

        if (REDUCE_MOTION || typeof gsap === 'undefined') {
            el.textContent = target.toFixed(decimals) + suffix;
            return;
        }

        const proxy = { value: 0 };
        gsap.to(proxy, {
            value: target,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => { el.textContent = proxy.value.toFixed(decimals) + suffix; },
        });
    });
}

// ---------------- Logo carousel: continuous auto-scroll, pausable + draggable ----------------
// Driven by one shared "offset" via requestAnimationFrame rather than CSS
// @keyframes, because native drag-scrolling and a CSS animation running at
// the same time would fight each other. The chip list is duplicated in the
// HTML so wrapping the offset creates a seamless loop.
function initLogoCarousel() {
    const carousel = document.getElementById('logo-carousel');
    const track = document.getElementById('logo-carousel-track');
    if (!carousel || !track) return;

    let offset = 0;
    let isDown = false, startX = 0, startOffset = 0, paused = false;
    const speed = REDUCE_MOTION ? 0 : 0.5; // px per frame

    function loopWidth() { return track.scrollWidth / 2; }
    function wrap() {
        const lw = loopWidth();
        if (lw <= 0) return;
        if (offset <= -lw) offset += lw;
        if (offset > 0) offset -= lw;
    }
    function apply() { track.style.transform = `translateX(${offset}px)`; }

    function tick() {
        if (!isDown && !paused) { offset -= speed; wrap(); apply(); }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    carousel.addEventListener('mouseenter', () => { paused = true; });
    carousel.addEventListener('mouseleave', () => { paused = false; });

    function dragStart(x) { isDown = true; carousel.classList.add('dragging'); startX = x; startOffset = offset; }
    function dragMove(x) { if (!isDown) return; offset = startOffset + (x - startX); wrap(); apply(); }
    function dragEnd() { isDown = false; carousel.classList.remove('dragging'); }

    carousel.addEventListener('mousedown', (e) => dragStart(e.pageX));
    window.addEventListener('mousemove', (e) => { if (isDown) { e.preventDefault(); dragMove(e.pageX); } });
    window.addEventListener('mouseup', dragEnd);

    carousel.addEventListener('touchstart', (e) => dragStart(e.touches[0].pageX), { passive: true });
    carousel.addEventListener('touchmove', (e) => dragMove(e.touches[0].pageX), { passive: true });
    carousel.addEventListener('touchend', dragEnd);
}

// ---------------- Pull-to-refresh: gear banner, every page ----------------
// A black banner unrolls from the very top of the viewport as you pull, with
// a small "glimpsed mechanism" of gears at different sizes turning inside —
// release past the threshold and it spins up and reloads. Three separate
// input paths feed the same shared pull state: touch (phone/tablet), a
// plain mouse click-and-drag, and a trackpad two-finger swipe (wheel
// events) — each is a genuinely different gesture, so none of them collide
// with each other or with Safari's own native trackpad behavior.
function initPullToRefresh() {
    if (REDUCE_MOTION || typeof gsap === 'undefined') return;

    const GEAR_LARGE = 'M 85.0,50.0 L 91.52,56.35 L 89.13,65.26 L 80.31,67.5 L 80.31,67.5 L 82.78,76.26 L 76.26,82.78 L 67.5,80.31 L 67.5,80.31 L 65.26,89.13 L 56.35,91.52 L 50.0,85.0 L 50.0,85.0 L 43.65,91.52 L 34.74,89.13 L 32.5,80.31 L 32.5,80.31 L 23.74,82.78 L 17.22,76.26 L 19.69,67.5 L 19.69,67.5 L 10.87,65.26 L 8.48,56.35 L 15.0,50.0 L 15.0,50.0 L 8.48,43.65 L 10.87,34.74 L 19.69,32.5 L 19.69,32.5 L 17.22,23.74 L 23.74,17.22 L 32.5,19.69 L 32.5,19.69 L 34.74,10.87 L 43.65,8.48 L 50.0,15.0 L 50.0,15.0 L 56.35,8.48 L 65.26,10.87 L 67.5,19.69 L 67.5,19.69 L 76.26,17.22 L 82.78,23.74 L 80.31,32.5 L 80.31,32.5 L 89.13,34.74 L 91.52,43.65 L 85.0,50.0 Z M 61,50 A 11,11 0 1 0 39,50 A 11,11 0 1 0 61,50 Z';
    const GEAR_MEDIUM = 'M 75.0,50.0 L 79.5,55.44 L 77.06,62.94 L 70.23,64.69 L 70.23,64.69 L 70.67,71.74 L 64.29,76.38 L 57.73,73.78 L 57.73,73.78 L 53.95,79.74 L 46.05,79.74 L 42.27,73.78 L 42.27,73.78 L 35.71,76.38 L 29.33,71.74 L 29.77,64.69 L 29.77,64.69 L 22.94,62.94 L 20.5,55.44 L 25.0,50.0 L 25.0,50.0 L 20.5,44.56 L 22.94,37.06 L 29.77,35.31 L 29.77,35.31 L 29.33,28.26 L 35.71,23.62 L 42.27,26.22 L 42.27,26.22 L 46.05,20.26 L 53.95,20.26 L 57.73,26.22 L 57.73,26.22 L 64.29,23.62 L 70.67,28.26 L 70.23,35.31 L 70.23,35.31 L 77.06,37.06 L 79.5,44.56 L 75.0,50.0 Z M 58,50 A 8,8 0 1 0 42,50 A 8,8 0 1 0 58,50 Z';
    const GEAR_SMALL = 'M 65.5,50.0 L 68.36,54.89 L 65.27,61.31 L 59.66,62.12 L 59.66,62.12 L 57.62,67.4 L 50.68,68.99 L 46.55,65.11 L 46.55,65.11 L 41.15,66.81 L 35.58,62.37 L 36.03,56.73 L 36.03,56.73 L 31.34,53.56 L 31.34,46.44 L 36.03,43.27 L 36.03,43.27 L 35.58,37.63 L 41.15,33.19 L 46.55,34.89 L 46.55,34.89 L 50.68,31.01 L 57.62,32.6 L 59.66,37.88 L 59.66,37.88 L 65.27,38.69 L 68.36,45.11 L 65.5,50.0 Z M 55,50 A 5,5 0 1 0 45,50 A 5,5 0 1 0 55,50 Z';
    const GEAR_TINY = 'M 61.5,50.0 L 63.64,53.16 L 61.88,57.41 L 58.13,58.13 L 58.13,58.13 L 57.41,61.88 L 53.16,63.64 L 50.0,61.5 L 50.0,61.5 L 46.84,63.64 L 42.59,61.88 L 41.87,58.13 L 41.87,58.13 L 38.12,57.41 L 36.36,53.16 L 38.5,50.0 L 38.5,50.0 L 36.36,46.84 L 38.12,42.59 L 41.87,41.87 L 41.87,41.87 L 42.59,38.12 L 46.84,36.36 L 50.0,38.5 L 50.0,38.5 L 53.16,36.36 L 57.41,38.12 L 58.13,41.87 L 58.13,41.87 L 61.88,42.59 L 63.64,46.84 L 61.5,50.0 Z M 53.5,50 A 3.5,3.5 0 1 0 46.5,50 A 3.5,3.5 0 1 0 53.5,50 Z';

    const wrap = document.createElement('div');
    wrap.id = 'ptr-indicator';
    wrap.innerHTML = `
        <svg id="ptr-gears" viewBox="0 0 500 160" preserveAspectRatio="xMidYMid slice">
            <g id="ptr-g-bg1" class="ptr-g-bg" transform="translate(20,-25) scale(1.4)"><path d="${GEAR_LARGE}"></path></g>
            <g id="ptr-g-bg2" class="ptr-g-bg" transform="translate(430,140) scale(1.3)"><path d="${GEAR_LARGE}"></path></g>
            <g id="ptr-g-bg3" class="ptr-g-bg" transform="translate(345,15) scale(0.55)"><path d="${GEAR_TINY}"></path></g>
            <g id="ptr-g-hero" transform="translate(220,72) scale(1.15)"><path d="${GEAR_MEDIUM}"></path></g>
            <g id="ptr-g-mesh" transform="translate(270,54) scale(0.68)"><path d="${GEAR_SMALL}"></path></g>
        </svg>`;
    document.body.appendChild(wrap);

    const GEARS = {
        bg1: { el: document.getElementById('ptr-g-bg1'), pullMult: 80, spin: '+=220' },
        bg2: { el: document.getElementById('ptr-g-bg2'), pullMult: -90, spin: '-=240' },
        bg3: { el: document.getElementById('ptr-g-bg3'), pullMult: 320, spin: '+=900' },
        hero: { el: document.getElementById('ptr-g-hero'), pullMult: 200, spin: '+=560' },
        mesh: { el: document.getElementById('ptr-g-mesh'), pullMult: -260, spin: '-=730' },
    };
    Object.values(GEARS).forEach(g => gsap.set(g.el, { transformOrigin: '50% 50%' }));
    gsap.set(wrap, { height: 0 });

    const THRESHOLD = 90;
    const MAX_PULL = 150;
    const SETTLED_HEIGHT = 110;
    const DEAD_ZONE = 10;
    const DAMPING = 0.5;
    const START_BAND = 160; // gesture must start within this many px of the top

    let pull = 0, triggered = false;

    function atTop() {
        const cv = document.getElementById('content-view');
        return cv ? cv.scrollTop <= 0 : true; // home page has no scroll container
    }

    function setPull(p) {
        pull = p;
        const progress = pull / MAX_PULL;
        gsap.set(wrap, { height: pull });
        Object.values(GEARS).forEach(g => gsap.set(g.el, { rotation: progress * g.pullMult }));
    }

    function snapBack() {
        gsap.to(wrap, { height: 0, duration: 0.35, ease: 'power2.out' });
        pull = 0;
    }

    function fireRefresh() {
        triggered = true;
        gsap.to(wrap, { height: SETTLED_HEIGHT, duration: 0.25, ease: 'power2.out' });
        Object.values(GEARS).forEach(g => gsap.to(g.el, { rotation: g.spin, duration: 0.7, ease: 'none', repeat: -1 }));
        setTimeout(() => window.location.reload(), 750);
    }

    // ---- Touch (phone/tablet) ----
    let tStartX = 0, tStartY = 0, tTracking = false, tIsPull = null;
    window.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        if (triggered || t.clientY > START_BAND || !atTop()) { tTracking = false; return; }
        tTracking = true; tIsPull = null; pull = 0;
        tStartX = t.clientX; tStartY = t.clientY;
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (!tTracking || triggered) return;
        const t = e.touches[0];
        const dx = t.clientX - tStartX, dy = t.clientY - tStartY;
        if (tIsPull === null) {
            if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;
            tIsPull = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.4;
            if (!tIsPull) { tTracking = false; return; }
        }
        if (!tIsPull) return;
        e.preventDefault();
        setPull(Math.max(0, Math.min(dy * DAMPING, MAX_PULL)));
    }, { passive: false });
    window.addEventListener('touchend', () => {
        if (!tTracking || !tIsPull || triggered) { tTracking = false; return; }
        tTracking = false;
        if (pull >= THRESHOLD) fireRefresh(); else snapBack();
    });

    // ---- Mouse click-and-drag (desktop) ----
    let mStartX = 0, mStartY = 0, mDown = false, mIsPull = null;
    window.addEventListener('mousedown', (e) => {
        if (triggered || e.clientY > START_BAND || !atTop()) { mDown = false; return; }
        mDown = true; mIsPull = null; pull = 0;
        mStartX = e.clientX; mStartY = e.clientY;
        // Prevent the browser's default text-selection drag from starting at
        // all — without this, dragging down also highlights the page text.
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!mDown || triggered) return;
        const dx = e.clientX - mStartX, dy = e.clientY - mStartY;
        if (mIsPull === null) {
            if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;
            mIsPull = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.4;
            if (!mIsPull) { mDown = false; return; }
        }
        if (!mIsPull) return;
        e.preventDefault();
        setPull(Math.max(0, Math.min(dy * DAMPING, MAX_PULL)));
    });
    window.addEventListener('mouseup', () => {
        if (!mDown || !mIsPull || triggered) { mDown = false; return; }
        mDown = false;
        if (pull >= THRESHOLD) fireRefresh(); else snapBack();
    });

    // ---- Trackpad two-finger swipe down (wheel events) ----
    const WHEEL_DEAD_ZONE = 15;
    let wheelRaw = 0, wheelTimeout = null;
    window.addEventListener('wheel', (e) => {
        if (triggered) return;
        if (e.deltaY >= 0 || !atTop()) { wheelRaw = 0; return; } // only an upward/pull-style swipe while at the top
        wheelRaw += -e.deltaY;
        if (wheelRaw < WHEEL_DEAD_ZONE) return; // ignore tiny incidental scroll-past-top blips
        e.preventDefault();
        setPull(Math.max(0, Math.min((wheelRaw - WHEEL_DEAD_ZONE) * 0.5, MAX_PULL)));
        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
            if (pull >= THRESHOLD) fireRefresh(); else snapBack();
            wheelRaw = 0;
        }, 180); // no new wheel ticks for this long = treat the swipe as finished
    }, { passive: false });
}

// ---------------- Boot ----------------
window.addEventListener('DOMContentLoaded', () => {
    curtain = document.getElementById('transition-curtain');
    wireTransitionLinks();
    initLogoRipple();
    initCarGame();
    startGreetingCarousel();
    initCustomCursor();
    initStatCounters();
    initLogoCarousel();
    initPullToRefresh();
});

window.onload = function () {
    if (typeof gsap === 'undefined') {
        console.error('GSAP failed to load.');
        if (curtain) curtain.style.display = 'none';
        return;
    }
    playCurtainReveal();
};

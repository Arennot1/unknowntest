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
        const categories = (card.getAttribute('data-categories') || '').split(' ');
        if (category === 'all' || categories.includes(category)) {
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
// Real-time WebGL2 fragment shader — a lit, travelling wave height-field —
// replacing the earlier DOM/backdrop-filter circles for a sharper, more
// dimensional result. Same trigger as before (logo click, 4 staggered
// pulses); only the rendering technique changed. Falls back to doing
// nothing if WebGL2 isn't available or prefers-reduced-motion is set,
// same as every other motion effect on this site.
function initLogoRipple() {
    const brandingLogo = document.querySelector('.branding-logo');
    if (!brandingLogo || REDUCE_MOTION) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'ripple-canvas';
    document.body.appendChild(canvas);
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!gl) return;

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const VERT = `#version 300 es
    layout(location=0) in vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

    // Each ripple is a travelling ring in a height field. Lighting comes
    // from the *slope* of that field (a real normal, via finite
    // differences), which is what turns a plain sine wave into a sharp,
    // faceted look. Colour is near-white, with a low-saturation hue tied to
    // the wave's own height/facing direction riding along each ring's
    // edge — genuine thin-film iridescence rather than a fixed tint.
    const FRAG = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec3 uRipples[10]; // xy = origin (aspect-corrected uv), z = spawn time
    uniform int uRippleCount;

    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    float ringHeight(vec2 p, vec2 origin, float age) {
      if (age < 0.0) return 0.0;
      float r = length(p - origin);
      float speed = 0.62;
      float freq = 38.0;
      float frontR = age * speed;
      float d = frontR - r;
      float bandFront = 0.035;
      float bandBack = 0.14;
      float band = smoothstep(0.0, bandFront, d) * (1.0 - smoothstep(bandBack*0.6, bandBack, d));
      float decayT = exp(-age * 0.45);
      float decayR = exp(-r * 0.55);
      float birth = smoothstep(0.0, 0.5, age); // fades in from zero, no abrupt pop on click
      return sin(r*freq - age*11.0) * band * decayT * decayR * birth;
    }

    float sceneHeight(vec2 p) {
      float h = 0.0;
      for (int i = 0; i < 10; i++) {
        if (i >= uRippleCount) break;
        h += ringHeight(p, uRipples[i].xy, uTime - uRipples[i].z);
      }
      return h;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      float aspect = uResolution.x / uResolution.y;
      vec2 p = uv;
      p.x *= aspect;

      float eps = 1.4 / uResolution.y;
      float hC = sceneHeight(p);
      float hL = sceneHeight(p - vec2(eps, 0.0));
      float hR = sceneHeight(p + vec2(eps, 0.0));
      float hD = sceneHeight(p - vec2(0.0, eps));
      float hU = sceneHeight(p + vec2(0.0, eps));
      vec3 normal = normalize(vec3((hL - hR) / (2.0*eps), (hD - hU) / (2.0*eps), 1.35));

      vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.75));
      vec3 viewDir  = vec3(0.0, 0.0, 1.0);
      vec3 halfV    = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfV), 0.0), 60.0);
      float slope = length(normal.xy);

      float hue = fract(hC*1.5 + normal.x*0.35 + normal.y*0.35 + uTime*0.015);
      vec3 iridescent = hsv2rgb(vec3(hue, 0.24, 1.0));

      float tint = clamp(slope*1.3, 0.0, 1.0) * 0.26 + spec*0.12;
      vec3 col = mix(vec3(1.0), iridescent, clamp(tint, 0.0, 0.4));
      col += spec * 0.15;

      // Alpha follows the wave's own presence: calm, undisturbed areas are
      // fully transparent so the page shows through untouched, and only
      // the travelling ring itself is visible, composited over the site.
      float alpha = clamp(abs(hC) * 6.0 + tint, 0.0, 1.0);
      fragColor = vec4(col, alpha);
    }
    `;

    function compile(type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
        return sh;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(prog, 'uResolution');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uRipples = gl.getUniformLocation(prog, 'uRipples');
    const uRippleCount = gl.getUniformLocation(prog, 'uRippleCount');

    const MAX_RIPPLES = 10;
    let ripples = [];
    let looping = false;
    const startTime = performance.now();
    function now() { return (performance.now() - startTime) / 1000; }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    function render() {
        const t = now();
        ripples = ripples.filter(r => t - r.t0 < 5.0);

        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, t);
        gl.uniform1i(uRippleCount, ripples.length);
        if (ripples.length) {
            const data = new Float32Array(MAX_RIPPLES * 3);
            ripples.forEach((r, i) => { data[i*3] = r.x; data[i*3+1] = r.y; data[i*3+2] = r.t0; });
            gl.uniform3fv(uRipples, data);
        }
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Stop the render loop entirely once nothing is left on screen,
        // rather than looping forever like the interactive demo did — this
        // is a decorative, click-triggered accent, so it shouldn't cost
        // anything while idle.
        if (ripples.length > 0) {
            requestAnimationFrame(render);
        } else {
            looping = false;
        }
    }
    function ensureLoop() {
        if (!looping) { looping = true; render(); }
    }

    window.triggerLogoEffect = function () {
        const logoImg = brandingLogo.querySelector('img');
        const rect = logoImg.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const aspect = window.innerWidth / window.innerHeight;
        const originX = (cx / window.innerWidth) * aspect;
        const originY = 1.0 - (cy / window.innerHeight);

        let spawned = 0;
        const interval = setInterval(() => {
            if (ripples.length >= MAX_RIPPLES) ripples.shift();
            ripples.push({ x: originX, y: originY, t0: now() });
            ensureLoop();
            spawned++;
            if (spawned >= 4) clearInterval(interval);
        }, 300);
    };
}


// ---------------- Diecast Dash (About/Hi page only) ----------------
// A full 3D driving game (Three.js), built and handed off as its own
// self-contained bundle at assets/diecast-dash/ — deliberately embedded
// via <iframe> rather than inlined into this page. Two real reasons, not
// just convenience: the game attaches its OWN global keydown/wheel
// listeners for driving/zoom, and an iframe gives it its own window so
// those can never collide with this page's cursor tracking or
// pull-to-refresh listeners (and the reverse: this page's listeners can
// never accidentally steal a keystroke meant for the car). The iframe's
// src is only set the moment someone actually clicks to play, so the
// ~600KB of three.js plus the game's own asset fetches never load just
// from visiting the About page.
function initDiecastDash() {
    const trigger = document.getElementById('diecastTrigger');
    const overlay = document.getElementById('diecastOverlay');
    const closeBtn = document.getElementById('diecastClose');
    const frame = document.getElementById('diecastFrame');
    if (!trigger || !overlay || !closeBtn || !frame) return;

    function openGame() {
        // Always point the iframe at a fresh URL, rather than checking
        // "if (!frame.src)" to decide whether this is a first load. After
        // closeGame() clears it, reading frame.src back can resolve to the
        // page's OWN url (not empty), which made that check silently skip
        // reloading the game on a second open — the black-screen-on-reopen
        // bug. The timestamp also busts any browser caching of the iframe
        // document itself, so every open is a genuinely clean load.
        frame.src = 'assets/diecast-dash/index.html?t=' + Date.now();
        overlay.classList.remove('hidden-view');
        document.body.style.overflow = 'hidden';
        autoStartWhenReady();
    }

    // The game has its own "Loading assets…" → "Start the engine" button
    // (now a minimal loading state, not a duplicate hero) — rather than
    // making someone click it a second time after they've already clicked
    // the site's own banner, poll for the moment it becomes enabled and
    // click it automatically, so one click on the site is all it takes.
    function autoStartWhenReady() {
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            try {
                const doc = frame.contentDocument;
                const btn = doc && doc.getElementById('startBtn');
                if (btn && !btn.disabled) {
                    btn.click();
                    clearInterval(poll);
                }
            } catch (e) { /* frame not ready yet; keep polling */ }
            if (attempts > 200) clearInterval(poll); // ~30s safety cap
        }, 150);
    }

    function closeGame() {
        overlay.classList.add('hidden-view');
        document.body.style.overflow = '';
        frame.src = ''; // tear down the WebGL context rather than leave it running hidden
    }

    trigger.addEventListener('click', openGame);
    closeBtn.addEventListener('click', closeGame);
}

// ---------------- Off-Canvas gallery ----------------
function initOffCanvasTracks() {
    const gallery = document.getElementById('offcanvas-content');
    if (!gallery) return;

    gallery.querySelectorAll('.off-canvas-track').forEach(track => {
        const sourceCard = track.querySelector('[data-off-canvas-card]');
        if (!sourceCard) return;

        // Repeat the supplied image as a layout preview until each collection
        // receives its own additional photographs.
        for (let index = 0; index < 3; index += 1) {
            track.appendChild(sourceCard.cloneNode(true));
        }

        let dragging = false;
        let moved = false;
        let startX = 0;
        let startScrollLeft = 0;

        track.addEventListener('pointerdown', event => {
            if (event.pointerType !== 'mouse') return;
            dragging = true;
            moved = false;
            startX = event.clientX;
            startScrollLeft = track.scrollLeft;
            track.classList.add('is-dragging');
            track.setPointerCapture(event.pointerId);
        });

        track.addEventListener('pointermove', event => {
            if (!dragging) return;
            const distance = event.clientX - startX;
            if (Math.abs(distance) > 6) moved = true;
            track.scrollLeft = startScrollLeft - distance;
        });

        const stopDragging = event => {
            if (!dragging) return;
            dragging = false;
            track.classList.remove('is-dragging');
            if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
        };
        track.addEventListener('pointerup', stopDragging);
        track.addEventListener('pointercancel', stopDragging);
        track.addEventListener('click', event => {
            if (!moved) return;
            event.preventDefault();
            event.stopPropagation();
            moved = false;
        }, true);
    });
}

function initResearchTracks() {
    document.querySelectorAll('.research-track').forEach(track => {
        let dragging = false;
        let startX = 0;
        let startScrollLeft = 0;
        track.addEventListener('pointerdown', event => {
            if (event.pointerType !== 'mouse') return;
            dragging = true;
            startX = event.clientX;
            startScrollLeft = track.scrollLeft;
            track.classList.add('is-dragging');
            track.setPointerCapture(event.pointerId);
        });
        track.addEventListener('pointermove', event => {
            if (!dragging) return;
            track.scrollLeft = startScrollLeft - (event.clientX - startX);
        });
        const stopDragging = event => {
            if (!dragging) return;
            dragging = false;
            track.classList.remove('is-dragging');
            if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
        };
        track.addEventListener('pointerup', stopDragging);
        track.addEventListener('pointercancel', stopDragging);
    });
}

// ---------------- Off-Canvas image lightbox ----------------
function initOffCanvas() {
    const lightbox = document.getElementById('offCanvasLightbox');
    const closeBtn = document.getElementById('offCanvasClose');
    const image = document.getElementById('offCanvasLightboxImage');
    const title = document.getElementById('offCanvasLightboxTitle');
    const description = document.getElementById('offCanvasLightboxDescription');
    const cards = document.querySelectorAll('[data-off-canvas-card]');
    if (!lightbox || !closeBtn || !image || !title || !description || !cards.length) return;

    let lastTrigger = null;
    function closeLightbox() {
        lightbox.classList.remove('is-open');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastTrigger) lastTrigger.focus();
    }
    function openLightbox(card) {
        lastTrigger = card;
        image.src = card.dataset.image;
        image.alt = card.dataset.alt;
        title.textContent = card.dataset.title;
        description.textContent = card.dataset.description;
        lightbox.classList.add('is-open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
    }

    cards.forEach(card => card.addEventListener('click', () => openLightbox(card)));
    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox(); });
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

// ---------------- Pull-to-refresh: WebGL2 dissolve banner, every page ----------------
// A pixelated, Perlin-noise-displaced black plane grows down from the top of
// the viewport in sync with pull distance (same rendering technique as the
// logo ripple above), and dissolves back to nothing on release or reload.
// Three separate input paths feed the same shared pull state: touch
// (phone/tablet), a plain mouse click-and-drag, and a trackpad two-finger
// swipe (wheel events) — each is a genuinely different gesture, so none of
// them collide with each other or with Safari's own native trackpad
// behavior.
function initPullToRefresh() {
    if (REDUCE_MOTION || typeof gsap === 'undefined') return;

    const canvas = document.createElement('canvas');
    canvas.id = 'ptr-canvas';
    document.body.appendChild(canvas);
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!gl) return;

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const VERT = `#version 300 es
    layout(location=0) in vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

    // Same pixelated, Perlin-noise-displaced dissolve boundary as the
    // gear-loader demo (gears removed per that review). One thing is
    // different from the demo on purpose: 'travel' here uses vUv.y
    // directly (not 1.0 - vUv.y), because this banner needs to grow
    // DOWN from the top as you pull, not reveal top-first — it's the
    // demo's sweep run in reverse, so uTransition=1 is "no banner" and
    // decreasing it grows the covered region starting at the top edge.
    const FRAG = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uTransition;

    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    float cnoise(vec3 P) {
      vec3 Pi0 = floor(P);
      vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod(Pi0, 289.0);
      Pi1 = mod(Pi1, 289.0);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;

      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);

      vec4 gx0 = ixy0 / 7.0;
      vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);

      vec4 gx1 = ixy1 / 7.0;
      vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);

      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

      vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g100,g100), dot(g010,g010), dot(g110,g110)));
      g000 *= norm0.x; g100 *= norm0.y; g010 *= norm0.z; g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g101,g101), dot(g011,g011), dot(g111,g111)));
      g001 *= norm1.x; g101 *= norm1.y; g011 *= norm1.z; g111 *= norm1.w;

      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);

      vec3 fade_xyz = fade(Pf0);
      float n_z  = mix(mix(n000,n100,fade_xyz.x), mix(n010,n110,fade_xyz.x), fade_xyz.y);
      float n_dz = mix(mix(n001,n101,fade_xyz.x), mix(n011,n111,fade_xyz.x), fade_xyz.y);
      return 2.2 * mix(n_z, n_dz, fade_xyz.z);
    }

    void main() {
      vec2 vUv = gl_FragCoord.xy / uResolution.xy;

      float pixelSize = 8.0;
      vec2 grid = uResolution / pixelSize;
      vec2 pixelatedUv = floor(vUv * grid) / grid;

      float aspect = uResolution.x / uResolution.y;
      vec2 correctedUv = (pixelatedUv - 0.5) * vec2(aspect, 1.0) + 0.5;

      float travel = pixelatedUv.y; // 1 at top, 0 at bottom — banner grows from the top

      vec2 displacedUv = correctedUv + cnoise(vec3(correctedUv * 5.0, uTime * 0.1));
      float strengthNoise = cnoise(vec3(displacedUv * 5.0, uTime * 0.2));

      float travelGradient = travel * 12.5 + (1.0 - uTransition) * 2.0 - 15.0 * uTransition;
      float rawStrength = strengthNoise + travelGradient;
      float strength = clamp(rawStrength, 0.0, 1.0);

      float edge = smoothstep(0.0, 0.7, rawStrength) * smoothstep(2.5, 0.7, rawStrength);
      edge *= min((1.0 - uTransition) * 5.0, 1.0);

      vec3 blackPlane = vec3(0.03);
      vec3 rimColor = vec3(0.8);
      vec3 planeColor = mix(blackPlane, rimColor, edge * 0.45);

      fragColor = vec4(planeColor, strength);
    }
    `;

    function compile(type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
        return sh;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(prog, 'uResolution');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uTransition = gl.getUniformLocation(prog, 'uTransition');

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    const THRESHOLD = 50;
    const MAX_PULL = 60;
    const DEAD_ZONE = 10;
    const DAMPING = 0.5;
    const START_BAND = 160; // gesture must start within this many px of the top
    // How much of the screen the shader covers at pull === MAX_PULL, as a
    // fraction (0-1). Kept deliberately small — this needs to work as a
    // thin band on every page, including inner pages with real content
    // (stats, logos) sitting close to the top, not a takeover.
    const PULL_COVER_MAX = 0.28;

    let pull = 0, triggered = false, looping = false;
    const tweenState = { pull: 0 };

    function atTop() {
        const cv = document.getElementById('content-view');
        return cv ? cv.scrollTop <= 0 : true; // home page has no scroll container
    }

    let shaderTime = 0;
    let lastFrameTs = null;

    function ensureLoop() {
        if (!looping) { looping = true; lastFrameTs = null; requestAnimationFrame(render); }
    }

    function render(now) {
        now = now || performance.now();
        if (lastFrameTs === null) lastFrameTs = now;
        const dt = (now - lastFrameTs) / 1000;
        lastFrameTs = now;
        // Once committed, the noise's own drift is the ONLY motion left —
        // the boundary itself stops growing within a couple hundred ms of
        // release. At the drift's normal (idle/drag) speed that reads as
        // frozen, which is exactly backwards for a "refreshing, hang on"
        // moment — so speed the shader's internal clock up sharply the
        // instant it's triggered, making the churn unmistakably active
        // right when that signal matters most.
        shaderTime += dt * (triggered ? 5.0 : 1.0);

        const uT = 1.0 - (pull / MAX_PULL) * PULL_COVER_MAX;
        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, shaderTime);
        gl.uniform1f(uTransition, uT);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (looping) requestAnimationFrame(render);
    }

    function setPull(p) {
        pull = p;
        ensureLoop();
    }

    function snapBack() {
        gsap.to(tweenState, {
            pull: 0, duration: 0.35, ease: 'power2.out',
            onUpdate: () => { pull = tweenState.pull; },
            onComplete: () => { looping = false; },
        });
        tweenState.pull = pull;
    }

    function fireRefresh() {
        triggered = true;
        tweenState.pull = pull;
        // Only a small confirming nudge past wherever the drag was released
        // (never much past MAX_PULL) — the whole point is that this stays
        // a thin band right up to the moment it refreshes, not something
        // that grows larger once you let go.
        gsap.to(tweenState, {
            pull: Math.min(pull * 1.15, MAX_PULL * 1.25), duration: 0.15, ease: 'power2.out',
            onUpdate: () => { pull = tweenState.pull; },
        });
        // Short on purpose: the sped-up shimmer above only needs a couple
        // of visible frames to read as "working," not a held pause — the
        // browser's own page-load time adds real, unavoidable delay on
        // top of whatever's here, so padding this further only compounds
        // that into something that reads as sluggish.
        setTimeout(() => window.location.reload(), 260);
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
    // Requires the cursor to be hovering near the top nav band, same as the
    // touch/mouse paths already require the gesture to start there. Without
    // this, ordinary momentum-scrolling up to the top of a long page (very
    // common) could accidentally trigger a reload with the cursor anywhere
    // on screen — this is what actually causes that.
    const WHEEL_DEAD_ZONE = 15;
    let wheelRaw = 0, wheelTimeout = null;
    window.addEventListener('wheel', (e) => {
        if (triggered) return;
        if (e.deltaY >= 0 || e.clientY > START_BAND || !atTop()) { wheelRaw = 0; return; }
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
    initDiecastDash();
    initOffCanvasTracks();
    initResearchTracks();
    initOffCanvas();
    startGreetingCarousel();
    initCustomCursor();
    initStatCounters();
    initLogoCarousel();
    initPullToRefresh();
    initCaseStudyScrollStatus();
});

window.onload = function () {
    if (typeof gsap === 'undefined') {
        console.error('GSAP failed to load.');
        if (curtain) curtain.style.display = 'none';
        return;
    }
    playCurtainReveal();
};
// ---------- case study sidebar scroll status ----------

function initCaseStudyScrollStatus() {
    const sidebarButtons = Array.from(document.querySelectorAll('button[onclick^="scrollToSection"]'));

    if (!sidebarButtons.length) return;

    const sectionLinks = sidebarButtons
        .map((button) => {
            const onclickValue = button.getAttribute('onclick') || '';
            const match = onclickValue.match(/scrollToSection\('([^']+)'\)/);

            if (!match) return null;

            const sectionId = match[1];
            const section = document.getElementById(sectionId);

            if (!section) return null;

            button.classList.add('case-nav-status-link');
            button.dataset.scrollTarget = sectionId;
            button.setAttribute('aria-current', 'false');

            return { button, section, sectionId };
        })
        .filter(Boolean);

    if (!sectionLinks.length) return;

    const sidebar = sidebarButtons[0].parentElement;

    if (sidebar) {
        sidebar.classList.add('case-study-scroll-nav');
    }

    let ticking = false;

    function setActiveSection(activeItem) {
        sectionLinks.forEach(({ button }) => {
            const isActive = button === activeItem.button;

            button.dataset.scrollActive = isActive ? 'true' : 'false';
            button.setAttribute('aria-current', isActive ? 'true' : 'false');
        });
    }

    function getActiveSection() {
        const viewportAnchor = window.innerHeight * 0.32;

        let activeItem = sectionLinks[0];
        let smallestDistance = Infinity;

        sectionLinks.forEach((item) => {
            const rect = item.section.getBoundingClientRect();

            const sectionHasEntered = rect.top <= viewportAnchor;
            const sectionHasNotPassed = rect.bottom >= viewportAnchor;

            if (sectionHasEntered && sectionHasNotPassed) {
                activeItem = item;
                smallestDistance = 0;
                return;
            }

            const distance = Math.abs(rect.top - viewportAnchor);

            if (distance < smallestDistance && rect.top < window.innerHeight) {
                smallestDistance = distance;
                activeItem = item;
            }
        });

        return activeItem;
    }

    function updateActiveSection() {
        const activeItem = getActiveSection();
        setActiveSection(activeItem);
        ticking = false;
    }

    function requestUpdate() {
        if (ticking) return;

        ticking = true;
        window.requestAnimationFrame(updateActiveSection);
    }

    updateActiveSection();

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
}

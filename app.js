// ============================================================
// Shared behavior for every page.
// ============================================================

let curtain;

const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function playCurtainReveal() {
    if (typeof gsap === 'undefined' || !curtain) return;

    gsap.set(curtain, { y: '0%' });

    gsap.to(curtain, {
        duration: REDUCE_MOTION ? 0.05 : 0.6,
        y: '-100%',
        ease: 'power3.inOut',
        delay: REDUCE_MOTION ? 0 : 0.15
    });
}

function wireTransitionLinks() {
    document.querySelectorAll('a[data-transition]').forEach(link => {
        link.addEventListener('click', function (e) {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

            const href = this.getAttribute('href');

            if (!href) return;

            if (typeof gsap === 'undefined' || !curtain) {
                window.location.href = href;
                return;
            }

            e.preventDefault();

            gsap.to(curtain, {
                duration: REDUCE_MOTION ? 0.05 : 0.5,
                y: '0%',
                ease: 'power3.inOut',
                onComplete: () => {
                    window.location.href = href;
                }
            });
        });
    });
}

window.scrollToSection = function (sectionId) {
    const target = document.getElementById(sectionId);

    if (target) {
        target.scrollIntoView({
            behavior: REDUCE_MOTION ? 'auto' : 'smooth',
            block: 'start'
        });
    }
};

window.filterProjects = function (event, category) {
    const buttons = document.querySelectorAll('.filter-btn');

    buttons.forEach(btn => {
        btn.classList.remove('filter-active');
        btn.classList.add('filter-inactive');
    });

    const activeBtn = event.currentTarget;

    activeBtn.classList.remove('filter-inactive');
    activeBtn.classList.add('filter-active');

    document.querySelectorAll('.project-card').forEach(card => {
        if (category === 'all' || card.getAttribute('data-category') === category) {
            card.style.display = 'block';

            if (typeof gsap !== 'undefined') {
                gsap.fromTo(
                    card,
                    { opacity: 0, y: 15 },
                    { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
                );
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
        duration: REDUCE_MOTION ? 0.05 : 0.4,
        y: '0%',
        ease: 'power3.inOut',
        onComplete: () => {
            preview.style.display = 'none';
            full.style.display = 'flex';

            gsap.to(curtain, {
                duration: REDUCE_MOTION ? 0.05 : 0.4,
                y: '-100%',
                ease: 'power3.inOut'
            });
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

// ---------------- Logo ripple effect ----------------

function initLogoRipple() {
    const brandingLogo = document.querySelector('.branding-logo');

    if (!brandingLogo || REDUCE_MOTION || typeof gsap === 'undefined') return;

    window.triggerLogoEffect = function () {
        const logoImg = brandingLogo.querySelector('img');
        const rect = logoImg.getBoundingClientRect();

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
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

    gsap.set(el, {
        x,
        y,
        xPercent: -50,
        yPercent: -50,
        width: 0,
        height: 0,
        opacity: 0
    });

    const tl = gsap.timeline({
        onComplete: () => el.remove()
    });

    tl.to(el, {
        opacity: 1,
        width: maxSize * 0.12,
        height: maxSize * 0.12,
        duration: 0.2,
        ease: 'power2.out'
    })
        .to(el, {
            width: maxSize,
            height: maxSize,
            duration: 2.6,
            ease: 'power3.out'
        }, '<')
        .to(el, {
            opacity: 0,
            duration: 1.4,
            ease: 'power1.in'
        }, '-=1.4');
}

// ---------------- Diecast Dash mini-game ----------------

function initCarGame() {
    const canvas = document.getElementById('gameCanvas');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('gameOverlay');
    const gameContainer = document.getElementById('gameContainer');

    if (!ctx || !overlay || !gameContainer) return;

    let gameRunning = false;
    let score = 0;
    let speed = 5;
    let obstacles = [];
    let animationId;
    let groundY = 0;

    const car = {
        x: 50,
        y: 0,
        width: 40,
        height: 20,
        dy: 0,
        jumpPower: -10,
        gravity: 0.6,
        grounded: true
    };

    function resizeGame() {
        const parent = canvas.parentElement;

        if (!parent) return;

        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        groundY = canvas.height - 30;

        if (car.grounded) {
            car.y = groundY - 25;
        }
    }

    function drawRect(x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    }

    function drawPixelCar(x, y) {
        drawRect(x, y, 40, 20, '#000');
        drawRect(x + 10, y - 10, 20, 10, '#000');
        drawRect(x + 12, y - 8, 8, 6, '#fff');
        drawRect(x + 22, y - 8, 6, 6, '#fff');
        drawRect(x + 5, y + 15, 10, 10, '#555');
        drawRect(x + 25, y + 15, 10, 10, '#555');
    }

    function spawnObstacle() {
        if (!gameRunning) return;

        const minGap = 300;
        const randomGap = Math.random() * 400;

        if (
            obstacles.length === 0 ||
            canvas.width - obstacles[obstacles.length - 1].x > minGap + randomGap
        ) {
            obstacles.push({
                x: canvas.width,
                y: groundY - 25,
                width: 20,
                height: 20
            });
        }
    }

    function resetGame() {
        gameRunning = false;
        cancelAnimationFrame(animationId);

        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        overlay.innerHTML = `
            <div class="text-center">
                <p class="font-pixel text-4xl text-red-600 mb-2">GAME OVER</p>
                <p class="font-pixel text-xl text-black">SCORE: ${score}</p>
                <p class="font-sans text-xs text-gray-500 mt-2">Click to Restart</p>
            </div>
        `;
    }

    function update() {
        if (!gameRunning) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawRect(0, groundY, canvas.width, 2, '#000');

        if (!car.grounded) {
            car.dy += car.gravity;
            car.y += car.dy;
        }

        if (car.y >= groundY - 25) {
            car.y = groundY - 25;
            car.dy = 0;
            car.grounded = true;
        } else {
            car.grounded = false;
        }

        drawPixelCar(car.x, car.y);

        if (Math.random() < 0.015) {
            spawnObstacle();
        }

        for (let i = 0; i < obstacles.length; i++) {
            const obs = obstacles[i];
            const obsY = groundY - obs.height;

            obs.x -= speed;

            drawRect(obs.x, obsY, obs.width, obs.height, '#ff4400');
            drawRect(obs.x + 2, obsY + 8, obs.width - 4, 4, '#fff');

            const hit =
                car.x < obs.x + obs.width &&
                car.x + car.width > obs.x &&
                car.y < obsY + obs.height &&
                car.y + car.height > obsY;

            if (hit) {
                resetGame();
                return;
            }

            if (obs.x + obs.width < 0) {
                obstacles.splice(i, 1);
                i--;
                score++;
            }
        }

        ctx.font = '24px "VT323"';
        ctx.fillStyle = '#000';
        ctx.fillText(`SCORE: ${score}`, 20, 40);

        animationId = requestAnimationFrame(update);
    }

    function jump() {
        if (!car.grounded) return;

        car.dy = car.jumpPower;
        car.grounded = false;
    }

    function startGame(e) {
        if (e && e.type === 'keydown') {
            e.preventDefault();
        }

        if (!gameRunning) {
            gameRunning = true;
            score = 0;
            obstacles = [];

            car.y = groundY - 25;
            car.dy = 0;
            car.grounded = true;

            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';

            update();
        } else {
            jump();
        }
    }

    window.addEventListener('resize', resizeGame);
    resizeGame();

    gameContainer.addEventListener('mousedown', startGame);

    gameContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startGame(e);
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') startGame(e);
    });
}

// ---------------- Custom cursor ----------------

const CURSOR_ICONS = {
    eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>',
    mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
};

function initCustomCursor() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (REDUCE_MOTION) return;
    if (typeof gsap === 'undefined') return;

    const isDark = !!document.querySelector('.content-header.dark-mode');

    const dot = document.createElement('div');
    const glass = document.createElement('div');

    dot.id = 'cursor-dot';
    glass.id = 'cursor-glass';
    glass.innerHTML = '<span id="cursor-glass-icon"></span><span id="cursor-glass-label"></span>';

    [dot, glass].forEach(el => {
        if (isDark) el.classList.add('cursor-on-dark');
        document.body.appendChild(el);
    });

    const iconEl = glass.querySelector('#cursor-glass-icon');
    const labelEl = glass.querySelector('#cursor-glass-label');

    gsap.set([dot, glass], {
        xPercent: -50,
        yPercent: -50,
        scale: 0
    });

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
            glass.classList.remove('has-label');

            gsap.to(dot, {
                scale: 1.8,
                opacity: 0.35,
                duration: 0.2
            });

            gsap.to(glass, {
                scale: 0,
                opacity: 0,
                duration: 0.15
            });

            return;
        }

        const icon = el.getAttribute('data-cursor-icon') || 'eye';
        const text = el.getAttribute('data-cursor-text') || 'VIEW';

        iconEl.innerHTML = CURSOR_ICONS[icon] || CURSOR_ICONS.eye;
        labelEl.textContent = text;

        glass.classList.add('has-label');

        gsap.to(dot, {
            scale: 0,
            opacity: 0,
            duration: 0.2
        });

        gsap.to(glass, {
            scale: 1,
            opacity: 1,
            duration: 0.35,
            ease: 'back.out(1.7)'
        });
    }

    function onLeaveTarget() {
        gsap.to(dot, {
            scale: 1,
            opacity: 1,
            duration: 0.2
        });

        gsap.to(glass, {
            scale: 0,
            opacity: 0,
            duration: 0.2
        });
    }

    function onClickCopy(e) {
        const value = e.currentTarget.getAttribute('data-copy');

        if (!value || !navigator.clipboard) return;

        e.preventDefault();

        navigator.clipboard.writeText(value).then(() => {
            iconEl.innerHTML = CURSOR_ICONS.check;
            labelEl.textContent = 'COPIED';

            setTimeout(() => {
                const icon = e.currentTarget.getAttribute('data-cursor-icon') || 'eye';

                iconEl.innerHTML = CURSOR_ICONS[icon] || CURSOR_ICONS.eye;
                labelEl.textContent = e.currentTarget.getAttribute('data-cursor-text') || 'VIEW';
            }, 1200);
        });
    }

    document.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('mouseenter', onEnterTarget);
        el.addEventListener('mouseleave', onLeaveTarget);

        if (el.hasAttribute('data-copy')) {
            el.addEventListener('click', onClickCopy);
        }
    });

    function show() {
        gsap.to(dot, {
            scale: 1,
            opacity: 1,
            duration: 0.2
        });
    }

    function hide() {
        gsap.to([dot, glass], {
            scale: 0,
            opacity: 0,
            duration: 0.2
        });
    }

    window.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseenter', show);
    document.body.addEventListener('mouseleave', hide);
}

// ---------------- Project stats ----------------

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
            onUpdate: () => {
                el.textContent = proxy.value.toFixed(decimals) + suffix;
            }
        });
    });
}

// ---------------- Logo carousel ----------------

function initLogoCarousel() {
    const carousel = document.getElementById('logo-carousel');
    const track = document.getElementById('logo-carousel-track');

    if (!carousel || !track) return;

    let offset = 0;
    let isDown = false;
    let startX = 0;
    let startOffset = 0;
    let paused = false;

    const speed = REDUCE_MOTION ? 0 : 0.5;

    function loopWidth() {
        return track.scrollWidth / 2;
    }

    function wrap() {
        const lw = loopWidth();

        if (lw <= 0) return;

        if (offset <= -lw) offset += lw;
        if (offset > 0) offset -= lw;
    }

    function apply() {
        track.style.transform = `translateX(${offset}px)`;
    }

    function tick() {
        if (!isDown && !paused) {
            offset -= speed;
            wrap();
            apply();
        }

        requestAnimationFrame(tick);
    }

    function dragStart(x) {
        isDown = true;
        carousel.classList.add('dragging');
        startX = x;
        startOffset = offset;
    }

    function dragMove(x) {
        if (!isDown) return;

        offset = startOffset + (x - startX);

        wrap();
        apply();
    }

    function dragEnd() {
        isDown = false;
        carousel.classList.remove('dragging');
    }

    requestAnimationFrame(tick);

    carousel.addEventListener('mouseenter', () => {
        paused = true;
    });

    carousel.addEventListener('mouseleave', () => {
        paused = false;
    });

    carousel.addEventListener('mousedown', (e) => dragStart(e.pageX));

    window.addEventListener('mousemove', (e) => {
        if (!isDown) return;

        e.preventDefault();
        dragMove(e.pageX);
    });

    window.addEventListener('mouseup', dragEnd);

    carousel.addEventListener('touchstart', (e) => {
        dragStart(e.touches[0].pageX);
    }, { passive: true });

    carousel.addEventListener('touchmove', (e) => {
        dragMove(e.touches[0].pageX);
    }, { passive: true });

    carousel.addEventListener('touchend', dragEnd);
}

// ---------------- Pull to refresh ----------------

function initPullToRefresh() {
    if (REDUCE_MOTION || typeof gsap === 'undefined') return;

    const indicator = document.createElement('div');

    indicator.id = 'ptr-indicator';
    indicator.innerHTML = `
        <div class="ptr-rod ptr-rod-left"></div>
        <div class="ptr-rod ptr-rod-right"></div>
        <div id="ptr-scene">
            <svg id="ptr-gears" viewBox="0 0 500 160" preserveAspectRatio="none">
                <circle class="ptr-g-bg ptr-face" cx="110" cy="82" r="32"></circle>
                <circle class="ptr-g-bg ptr-face" cx="210" cy="92" r="44"></circle>
                <circle class="ptr-g-hero ptr-face" cx="320" cy="84" r="54"></circle>
                <circle class="ptr-g-bg ptr-face" cx="420" cy="95" r="30"></circle>
            </svg>
        </div>
    `;

    document.body.appendChild(indicator);

    gsap.set(indicator, { height: 0 });

    const THRESHOLD = 90;
    const MAX_PULL = 150;
    const SETTLED_HEIGHT = 110;
    const DEAD_ZONE = 10;
    const DAMPING = 0.5;
    const START_BAND = 160;
    const WHEEL_DEAD_ZONE = 15;

    let pull = 0;
    let triggered = false;
    let wheelRaw = 0;
    let wheelTimeout = null;

    function atTop() {
        const contentView = document.getElementById('content-view');

        if (contentView) {
            return contentView.scrollTop <= 0;
        }

        return window.scrollY <= 0;
    }

    function setPull(value) {
        pull = value;

        gsap.set(indicator, { height: pull });
        gsap.set('#ptr-gears', { rotation: pull * 0.2, transformOrigin: '50% 50%' });
    }

    function snapBack() {
        gsap.to(indicator, {
            height: 0,
            duration: 0.35,
            ease: 'power2.out'
        });

        pull = 0;
    }

    function fireRefresh() {
        triggered = true;

        gsap.to(indicator, {
            height: SETTLED_HEIGHT,
            duration: 0.25,
            ease: 'power2.out'
        });

        gsap.to('#ptr-gears', {
            rotation: '+=360',
            duration: 0.7,
            ease: 'none',
            repeat: -1
        });

        setTimeout(() => window.location.reload(), 750);
    }

    let tStartX = 0;
    let tStartY = 0;
    let tTracking = false;
    let tIsPull = null;

    window.addEventListener('touchstart', (e) => {
        const t = e.touches[0];

        if (triggered || t.clientY > START_BAND || !atTop()) {
            tTracking = false;
            return;
        }

        tTracking = true;
        tIsPull = null;
        pull = 0;
        tStartX = t.clientX;
        tStartY = t.clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!tTracking || triggered) return;

        const t = e.touches[0];
        const dx = t.clientX - tStartX;
        const dy = t.clientY - tStartY;

        if (tIsPull === null) {
            if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;

            tIsPull = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.4;

            if (!tIsPull) {
                tTracking = false;
                return;
            }
        }

        e.preventDefault();
        setPull(Math.max(0, Math.min(dy * DAMPING, MAX_PULL)));
    }, { passive: false });

    window.addEventListener('touchend', () => {
        if (!tTracking || !tIsPull || triggered) {
            tTracking = false;
            return;
        }

        tTracking = false;

        if (pull >= THRESHOLD) fireRefresh();
        else snapBack();
    });

    let mStartX = 0;
    let mStartY = 0;
    let mDown = false;
    let mIsPull = null;

    window.addEventListener('mousedown', (e) => {
        if (triggered || e.clientY > START_BAND || !atTop()) {
            mDown = false;
            return;
        }

        mDown = true;
        mIsPull = null;
        pull = 0;
        mStartX = e.clientX;
        mStartY = e.clientY;

        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!mDown || triggered) return;

        const dx = e.clientX - mStartX;
        const dy = e.clientY - mStartY;

        if (mIsPull === null) {
            if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return;

            mIsPull = dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.4;

            if (!mIsPull) {
                mDown = false;
                return;
            }
        }

        e.preventDefault();
        setPull(Math.max(0, Math.min(dy * DAMPING, MAX_PULL)));
    });

    window.addEventListener('mouseup', () => {
        if (!mDown || !mIsPull || triggered) {
            mDown = false;
            return;
        }

        mDown = false;

        if (pull >= THRESHOLD) fireRefresh();
        else snapBack();
    });

    window.addEventListener('wheel', (e) => {
        if (triggered) return;

        if (e.deltaY >= 0 || e.clientY > START_BAND || !atTop()) {
            wheelRaw = 0;
            return;
        }

        wheelRaw += -e.deltaY;

        if (wheelRaw < WHEEL_DEAD_ZONE) return;

        e.preventDefault();

        setPull(Math.max(0, Math.min((wheelRaw - WHEEL_DEAD_ZONE) * 0.5, MAX_PULL)));

        clearTimeout(wheelTimeout);

        wheelTimeout = setTimeout(() => {
            if (pull >= THRESHOLD) fireRefresh();
            else snapBack();

            wheelRaw = 0;
        }, 180);
    }, { passive: false });
}

// ---------------- Case study sidebar scroll status ----------------

function initCaseStudyScrollStatus() {
    const nav = document.querySelector('.sticky.top-32');
    const buttons = Array.from(document.querySelectorAll('button[onclick^="scrollToSection"]'));

    if (!nav || !buttons.length) return;

    nav.classList.add('case-study-scroll-nav');

    const items = buttons
        .map((button) => {
            const onclickValue = button.getAttribute('onclick') || '';
            const match = onclickValue.match(/scrollToSection\('([^']+)'\)/);

            if (!match) return null;

            const id = match[1];
            const section = document.getElementById(id);

            if (!section) return null;

            button.classList.add('case-nav-status-link');
            button.dataset.scrollTarget = id;
            button.dataset.scrollActive = 'false';
            button.setAttribute('aria-current', 'false');

            button.addEventListener('click', () => {
                setActive(id);
                window.setTimeout(updateActiveSection, 450);
            });

            return {
                id,
                section,
                button
            };
        })
        .filter(Boolean);

    if (!items.length) return;

    function setActive(activeId) {
        items.forEach(({ id, button }) => {
            const isActive = id === activeId;

            button.dataset.scrollActive = isActive ? 'true' : 'false';
            button.setAttribute('aria-current', isActive ? 'true' : 'false');
        });
    }

    function updateActiveSection() {
        const anchor = window.innerHeight * 0.38;

        let active = items[0];
        let closest = Number.POSITIVE_INFINITY;

        items.forEach((item) => {
            const rect = item.section.getBoundingClientRect();
            const distance = Math.abs(rect.top - anchor);

            const hasEnteredReadingZone = rect.top <= anchor;
            const hasNotPassedReadingZone = rect.bottom >= anchor;

            if (hasEnteredReadingZone && hasNotPassedReadingZone) {
                active = item;
                closest = -1;
                return;
            }

            if (
                closest !== -1 &&
                rect.top <= window.innerHeight * 0.82 &&
                distance < closest
            ) {
                closest = distance;
                active = item;
            }
        });

        setActive(active.id);
    }

    let ticking = false;

    function requestUpdate() {
        if (ticking) return;

        ticking = true;

        window.requestAnimationFrame(() => {
            updateActiveSection();
            ticking = false;
        });
    }

    updateActiveSection();

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    const contentView = document.getElementById('content-view');

    if (contentView) {
        contentView.addEventListener('scroll', requestUpdate, { passive: true });
    }
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
    initCaseStudyScrollStatus();
    initPullToRefresh();
});

window.onload = function () {
    if (typeof gsap === 'undefined') {
        console.error('GSAP failed to load.');

        if (curtain) {
            curtain.style.display = 'none';
        }

        return;
    }

    playCurtainReveal();
};

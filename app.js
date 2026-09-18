// ============================================================
// Shared behavior for every page. Pages differ only in which
// elements exist in their HTML — every function here guards on
// that, so one file works everywhere.
// ============================================================

let curtain;

function playCurtainReveal() {
    if (typeof gsap === 'undefined' || !curtain) return;
    gsap.set(curtain, { y: '0%' });
    gsap.to(curtain, { duration: 0.6, y: '-100%', ease: 'power3.inOut', delay: 0.15 });
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
                duration: 0.5, y: '0%', ease: 'power3.inOut',
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
        duration: 0.4, y: '0%', ease: 'power3.inOut', onComplete: () => {
            preview.style.display = 'none';
            full.style.display = 'flex';
            gsap.to(curtain, { duration: 0.4, y: '-100%', ease: 'power3.inOut' });
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
function initLogoRipple() {
    const canvas = document.getElementById('logo-canvas');
    const brandingLogo = document.querySelector('.branding-logo');
    if (!canvas || !brandingLogo) return;
    const ctx = canvas.getContext('2d');
    let ripples = [];

    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Ripple {
        constructor(x, y) {
            this.x = x; this.y = y; this.radius = 0;
            const dx = canvas.width - this.x; const dy = canvas.height - this.y;
            this.maxRadius = Math.sqrt(dx * dx + dy * dy) + 100;
            this.speed = 5 + Math.random() * 5; this.opacity = 1; this.lineWidth = 2 + Math.random() * 3;
        }
        update() { this.radius += this.speed; this.opacity = 1 - (this.radius / this.maxRadius); if (this.opacity < 0) this.opacity = 0; }
        draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacity})`; ctx.lineWidth = this.lineWidth; ctx.stroke(); }
    }

    function animateRipples() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < ripples.length; i++) {
            ripples[i].update(); ripples[i].draw();
            if (ripples[i].opacity <= 0 || ripples[i].radius >= ripples[i].maxRadius) { ripples.splice(i, 1); i--; }
        }
        if (ripples.length > 0) requestAnimationFrame(animateRipples);
    }

    window.triggerLogoEffect = function () {
        const logoImg = brandingLogo.querySelector('img');
        const rect = logoImg.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; let spawned = 0;
        const interval = setInterval(() => {
            ripples.push(new Ripple(centerX, centerY)); spawned++;
            if (spawned === 1 && ripples.length === 1) animateRipples();
            if (spawned >= 5) clearInterval(interval);
        }, 150);
    };
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

// ---------------- Custom cursor (fine-pointer devices only, i.e. not touch) ----------------
function initCustomCursor() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (typeof gsap === 'undefined') return;

    const cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    // The Contact page has a dark background (see .content-header.dark-mode) —
    // use a light-colored cursor there instead of the default dark one.
    if (document.querySelector('.content-header.dark-mode')) {
        cursor.classList.add('cursor-on-dark');
    }
    document.body.appendChild(cursor);

    // quickTo gives the same springy, trailing follow as the original
    // useSpring version, without needing React or Framer Motion.
    const moveX = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
    const moveY = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });

    function onMouseMove(e) {
        moveX(e.clientX - 16); // 16 = half the 32px cursor size, centers it on the pointer
        moveY(e.clientY - 16);
    }
    function show() { gsap.to(cursor, { opacity: 1, duration: 0.2 }); }
    function hide() { gsap.to(cursor, { opacity: 0, duration: 0.2 }); }

    window.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseenter', show);
    document.body.addEventListener('mouseleave', hide);
}

// ---------------- Boot ----------------
window.addEventListener('DOMContentLoaded', () => {
    curtain = document.getElementById('transition-curtain');
    wireTransitionLinks();
    initLogoRipple();
    initCarGame();
    startGreetingCarousel();
    initCustomCursor();
});

window.onload = function () {
    if (typeof gsap === 'undefined') {
        console.error('GSAP failed to load.');
        if (curtain) curtain.style.display = 'none';
        return;
    }
    playCurtainReveal();
};

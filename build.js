// ============================================================
// build.js — generates the whole site as real, independent HTML
// pages (one per section, one per project) into ./dist.
//
// Run: node build.js
// (The GitHub Action in .github/workflows/deploy.yml runs this
// automatically on every push — you shouldn't need to run it
// yourself unless you're previewing locally.)
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

// EDIT THIS if you move to a custom domain or Vercel — used only
// for sitemap.xml (absolute URLs are required there).
const SITE_URL = 'https://arennot1.github.io/unknowntest';

const SECTION_ORDER = [
    ['solution', 'Solution'],
    ['flows', 'Core Flows'],
    ['research', 'Research'],
    ['formFactors', 'Exploring Form Factors'],
    ['prototyping', 'Prototyping and Testing'],
    ['decisions', 'Design Decisions'],
    ['hardware', 'Designing for Hardware Constraints'],
    ['reflection', 'Reflection'],
];

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function readFragment(name) { return read(path.join('fragments', name)).trim(); }

const projects = JSON.parse(read('data/projects.json'));
const fragments = {
    mainMenu: readFragment('main-menu.html'),
    hi: readFragment('hi.html'),
    resume: readFragment('resume.html'),
    contact: readFragment('contact.html'),
    research: readFragment('research.html'),
};

const BASE_BY_DEPTH = ['./', '../', '../../'];

// ---------- shared page shell ----------
function renderShell({ depth, title, description, body: bodyHTML, extraHead = '' }) {
    const base = BASE_BY_DEPTH[depth];
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="${base}">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=Permanent+Marker&family=VT323&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
    ${extraHead}
</head>
<body>
    <div id="transition-curtain"></div>
${bodyHTML}
    <script src="app.js"></script>
</body>
</html>
`;
}

const NAV_ITEMS = [
    ['Hi', 'about/'],
    ['Projects', 'projects/'],
    ['Research', 'research/'],
    ['Resume', 'resume/'],
    ['Contact', 'contact/'],
];

function renderHeader({ backHref, darkMode, active }) {
    const navHTML = NAV_ITEMS.map(([label, href]) => {
        const isActive = label === active;
        return `<a href="${href}" data-transition data-cursor-quiet class="content-nav-link${isActive ? ' active' : ''}">${label}</a>`;
    }).join('\n                ');
    return `        <header class="content-header${darkMode ? ' dark-mode' : ''}" id="global-header">
            <div class="content-logo"><a href="" data-cursor-quiet><img src="assets/logo.png" alt="Areen Pednekar logo" class="h-14 md:h-16 w-auto"></a></div>
            <nav class="content-nav hidden md:flex">
                ${navHTML}
            </nav>
            <a href="${backHref}" data-transition data-cursor-quiet class="back-btn">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            </a>
        </header>`;
}

const FOOTER = `        <footer class="content-footer bg-white border-t border-gray-200 py-12 px-6 md:px-12 lg:px-16 flex flex-col md:flex-row justify-between items-start md:items-center font-mono text-xs md:text-sm tracking-[0.1em] uppercase z-50">
            <div class="flex flex-col md:flex-row gap-12 lg:gap-24 w-full md:w-auto">
                <div class="flex flex-col gap-3">
                    <span class="text-gray-400 font-medium">Areen Pednekar</span>
                    <span class="text-black font-semibold">Product & Industrial</span>
                </div>
                <div class="flex flex-col gap-3">
                    <span class="text-gray-400 font-medium">Contact</span>
                    <a href="mailto:areenpednekarbusiness@gmail.com" class="text-black font-semibold hover:opacity-60 transition-opacity" data-cursor-icon="mail" data-cursor-text="COPY EMAIL" data-copy="areenpednekarbusiness@gmail.com">areenpednekarbusiness@gmail.com</a>
                </div>
            </div>
            <div class="flex flex-col gap-3 md:text-right mt-12 md:mt-0 justify-end h-full">
                <span class="text-black font-semibold mb-[-2px] hidden md:block">&nbsp;</span>
                <span class="text-black font-semibold">© 2026</span>
            </div>
        </footer>`;

function renderMedia(media, altText = '') {
    if (media.image) return `<img src="${media.image}" alt="${altText}" class="w-full h-full object-cover">`;
    return media.placeholderHTML || '';
}

const GRID_SIZES = {
    wide: { span: 'grid-col-7', aspect: 'aspect-[4/3]' },
    standard: { span: 'grid-col-6', aspect: 'aspect-[4/3]' },
    narrow: { span: 'grid-col-5', aspect: 'aspect-[4/3]' },
};

function renderProjectGridHTML() {
    return projects.map(p => {
        const size = GRID_SIZES[p.gridSize] || GRID_SIZES.standard;
        return `                    <a href="projects/${p.id}/" data-transition data-cursor-icon="eye" data-cursor-text="VIEW CASE STUDY" class="project-card cursor-pointer group ${size.span}" data-category="${p.category}">
                        <div class="w-full ${size.aspect} ${p.thumbnail.bgClass} overflow-hidden relative mb-4 flex items-center justify-center">${renderMedia(p.thumbnail, p.title + ' thumbnail')}</div>
                        <div class="flex flex-col xl:flex-row xl:justify-between xl:items-baseline">
                            <h4 class="text-xl font-bold text-black">${p.tagLine}</h4><span class="text-[10px] text-gray-500 font-mono uppercase tracking-[0.15em] mt-1 xl:mt-0">${p.tagMeta}</span>
                        </div>
                    </a>`;
    }).join('\n');
}

function renderSectionHTML(project, key, label) {
    const s = project.sections[key];
    const id = `${project.id}-${key}`;
    if (s.type === 'video') {
        const body = s.image ? `<img src="${s.image}" class="w-full h-full object-cover">` : `<span class="text-gray-400 font-mono text-sm">${s.content}</span>`;
        return `<div id="${id}" class="scroll-mt-32"><h2 class="text-2xl font-bold uppercase tracking-tight mb-8 border-b border-gray-200 pb-4">${label}</h2><div class="w-full aspect-video bg-gray-200 flex items-center justify-center rounded-xl overflow-hidden mb-12">${body}</div></div>`;
    }
    if (s.type === 'images') {
        const body = s.image ? `<img src="${s.image}" class="w-full h-full object-cover rounded-lg">` : `<span class="text-gray-400 font-mono text-xs">${s.content}</span>`;
        return `<div id="${id}" class="scroll-mt-32"><h2 class="text-2xl font-bold uppercase tracking-tight mb-8 border-b border-gray-200 pb-4">${label}</h2><div class="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg">${body}</div></div>`;
    }
    return `<div id="${id}" class="scroll-mt-32"><h2 class="text-2xl font-bold uppercase tracking-tight mb-8 border-b border-gray-200 pb-4">${label}</h2><p class="text-lg text-gray-600 font-light">${s.content}</p></div>`;
}

function renderCaseStudyBody(p) {
    const metaHTML = p.meta.map(([label, value]) =>
        `<div><span class="block text-black font-bold mb-2 font-sans tracking-tight">${label}</span>${value}</div>`
    ).join('');
    const sidebarHTML = [['overview', 'Overview'], ...SECTION_ORDER].map(([key, label]) =>
        `<button onclick="scrollToSection('${p.id}-${key}')" data-cursor-quiet class="text-left hover:text-black transition-colors">${label}</button>`
    ).join('\n');
    const sectionsHTML = SECTION_ORDER.map(([key, label]) => renderSectionHTML(p, key, label)).join('\n');

    return `        <div class="bg-white w-full min-h-screen text-black pb-32">
            <div id="${p.id}-overview" class="w-full scroll-mt-32">
                <div class="w-full h-[60vh] pt-20 md:pt-0 ${p.hero.bgClass} flex items-center justify-center">${renderMedia(p.hero, p.title + ' hero image')}</div>
                <div class="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16 pt-16 pb-12">
                    <h1 class="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">${p.title}</h1>
                    <p class="text-xl md:text-2xl text-gray-500 font-light max-w-3xl">${p.subtitle}</p>
                </div>
            </div>
            <div class="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16 py-12 border-t border-b border-gray-200 mb-16">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-8 font-mono text-sm text-gray-500 uppercase">${metaHTML}</div>
            </div>
            <div class="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16 flex flex-col md:flex-row gap-12 lg:gap-24 relative">
                <div class="hidden md:block w-1/4 shrink-0">
                    <div class="sticky top-32 flex flex-col space-y-4 text-[15px] text-gray-400 font-sans tracking-wide">${sidebarHTML}</div>
                </div>
                <div class="w-full md:w-3/4 flex flex-col space-y-32">${sectionsHTML}</div>
            </div>
        </div>`;
}

// ---------- route table ----------
const routes = [];

routes.push({
    outPath: 'index.html', depth: 0,
    title: 'Areen Pednekar | Product & Industrial Designer',
    description: 'Areen Pednekar is a Product & Industrial Designer working across UI/UX, interior, and industrial design — portfolio, research, and resume.',
    body: `    <div id="main-view">\n${fragments.mainMenu}\n    </div>`,
});

routes.push({
    outPath: 'about/index.html', depth: 1,
    title: 'About — Areen Pednekar',
    description: 'About Areen Pednekar, Product & Industrial Designer — background, roots, and how to get in touch.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', active: 'Hi' })}\n        <div id="hi-content">\n${fragments.hi}\n        </div>\n${FOOTER}\n    </div>`,
});

routes.push({
    outPath: 'projects/index.html', depth: 1,
    title: 'Projects — Areen Pednekar',
    description: 'Portfolio of UI/UX, industrial, and interior design projects by Areen Pednekar.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', active: 'Projects' })}\n        <div id="projects-content" class="w-full min-h-screen bg-white text-black pt-40 pb-32">
            <div class="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
                <div class="journey-block">
                    <div class="journey-grid">
                        <div class="journey-intro">
                            <span class="journey-eyebrow">The Journey So Far</span>
                            <p>Hello to the folks new here. This space is more than just a gallery of final deliverables&mdash;it's a living record of my journey. From deep-dive research to physical form, these are the challenges, skills, and strategies that keep shaping me as a designer.</p>
                        </div>
                        <div class="journey-stats">
                            <div class="stat">
                                <span class="stat-count" data-count-to="2.5" data-decimals="1">0</span>
                                <span class="stat-label">Years Experience</span>
                            </div>
                            <div class="stat">
                                <span class="stat-count" data-count-to="10" data-suffix="+">0</span>
                                <span class="stat-label">Domains Explored</span>
                            </div>
                            <div class="stat">
                                <span class="stat-count" data-count-to="30" data-suffix="+">0</span>
                                <span class="stat-label">Client Partnerships</span>
                            </div>
                        </div>
                    </div>
                    <div class="journey-trusted">
                        <span class="trusted-label">Trusted by teams at</span>
                        <!-- Placeholder chips — swap these for real client names/logos whenever you have them. -->
                        <div class="logo-carousel" id="logo-carousel">
                            <div class="logo-carousel-track">
                                <div class="logo-chip">Nimbus Labs</div>
                                <div class="logo-chip">Orbit &amp; Co.</div>
                                <div class="logo-chip">Forma Studio</div>
                                <div class="logo-chip">Kestrel Group</div>
                                <div class="logo-chip">Northline</div>
                                <div class="logo-chip">Verdant</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-4 mb-12 border-b border-gray-100 pb-8">
                    <button onclick="filterProjects(event, 'all')" data-cursor-quiet class="filter-btn filter-active text-xs md:text-sm font-bold uppercase tracking-widest border px-5 py-2.5 rounded-full transition-colors">All</button>
                    <button onclick="filterProjects(event, 'uiux')" data-cursor-quiet class="filter-btn filter-inactive text-xs md:text-sm font-bold uppercase tracking-widest border px-5 py-2.5 rounded-full transition-colors hover:border-black hover:text-black">UI/UX</button>
                    <button onclick="filterProjects(event, 'industrial')" data-cursor-quiet class="filter-btn filter-inactive text-xs md:text-sm font-bold uppercase tracking-widest border px-5 py-2.5 rounded-full transition-colors hover:border-black hover:text-black">Industrial</button>
                    <button onclick="filterProjects(event, 'interior')" data-cursor-quiet class="filter-btn filter-inactive text-xs md:text-sm font-bold uppercase tracking-widest border px-5 py-2.5 rounded-full transition-colors hover:border-black hover:text-black">Interior</button>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-x-4 lg:gap-x-6 gap-y-10 lg:gap-y-12" id="projects-grid">
${renderProjectGridHTML()}
                </div>
            </div>
        </div>\n${FOOTER}\n    </div>`,
});

routes.push({
    outPath: 'research/index.html', depth: 1,
    title: 'Research — Areen Pednekar',
    description: 'The Tactile Dissonance: a comparative analysis of ergonomic feedback in gaming, by Areen Pednekar.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', active: 'Research' })}\n        <div id="research-content">\n${fragments.research}\n        </div>\n${FOOTER}\n    </div>`,
});

routes.push({
    outPath: 'resume/index.html', depth: 1,
    title: 'Resume — Areen Pednekar',
    description: 'Resume and professional background of Areen Pednekar, Product & Industrial Designer.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', active: 'Resume' })}\n        <div id="resume-content">\n${fragments.resume}\n        </div>\n${FOOTER}\n    </div>`,
});

routes.push({
    outPath: 'contact/index.html', depth: 1,
    title: 'Contact — Areen Pednekar',
    description: "Get in touch with Areen Pednekar to discuss a product, industrial, or UI/UX design project.",
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', darkMode: true, active: 'Contact' })}\n        <div id="contact-content">\n${fragments.contact}\n        </div>\n    </div>`,
});

for (const p of projects) {
    routes.push({
        outPath: `projects/${p.id}/index.html`, depth: 2,
        title: `${p.title} — Areen Pednekar`,
        description: p.subtitle,
        body: `    <div id="content-view">\n${renderHeader({ backHref: 'projects/', active: 'Projects' })}\n${renderCaseStudyBody(p)}\n${FOOTER}\n    </div>`,
    });
}

// ---------- write output ----------
function ensureDir(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); }

fs.rmSync(OUT, { recursive: true, force: true });
for (const r of routes) {
    const html = renderShell(r);
    const outFile = path.join(OUT, r.outPath);
    ensureDir(outFile);
    fs.writeFileSync(outFile, html);
}

// copy static assets verbatim
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(s, d);
        else if (entry.name !== '.gitkeep') fs.copyFileSync(s, d);
    }
}
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
fs.copyFileSync(path.join(ROOT, 'styles.css'), path.join(OUT, 'styles.css'));
fs.copyFileSync(path.join(ROOT, 'app.js'), path.join(OUT, 'app.js'));
if (fs.existsSync(path.join(ROOT, 'robots.txt'))) {
    fs.copyFileSync(path.join(ROOT, 'robots.txt'), path.join(OUT, 'robots.txt'));
}

// sitemap.xml — real, crawlable URLs for every route
const urls = routes.map(r => {
    const urlPath = r.outPath === 'index.html' ? '' : r.outPath.replace(/index\.html$/, '');
    return `  <url><loc>${SITE_URL}/${urlPath}</loc></url>`;
}).join('\n');
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

console.log(`Built ${routes.length} pages into ${OUT}`);

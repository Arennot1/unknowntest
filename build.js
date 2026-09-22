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
    <link rel="icon" type="image/png" href="assets/logo.png">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500..900&family=Sora:wght@100..800&family=Permanent+Marker&family=VT323&display=swap" rel="stylesheet">
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

const FOOTER = `        <footer class="content-footer bg-white border-t border-gray-200 py-12 px-6 md:px-12 lg:px-16 flex flex-col md:flex-row justify-between items-start md:items-center font-meta text-xs md:text-sm tracking-[0.1em] uppercase z-50">
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

const CARD_ASPECT = 'aspect-[4/3]';
const CARD_ASPECT_RATIO = 4 / 3;

function renderCard(p) {
    const filterCategories = p.filterCategories || [p.category];
    return `<a href="projects/${p.id}/" data-transition data-cursor-icon="eye" data-cursor-text="VIEW CASE STUDY" class="project-card cursor-pointer group mb-6 lg:mb-8 block" data-categories="${filterCategories.join(' ')}">
                        <div class="w-full ${CARD_ASPECT} ${p.thumbnail.bgClass} overflow-hidden relative mb-4 flex items-center justify-center">${renderMedia(p.thumbnail, p.title + ' thumbnail')}</div>
                        <div class="flex flex-col xl:flex-row xl:justify-between xl:items-baseline">
                            <h4 class="text-xl font-bold text-black">${p.tagLine}</h4><div class="flex flex-wrap items-center gap-2 mt-1 xl:mt-0"><span class="text-[10px] text-gray-500 font-meta uppercase tracking-[0.15em]">${p.tagMeta}</span>${p.badge ? `<span class="rounded-full border border-black px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-black">${p.badge}</span>` : ''}</div>
                        </div>
                    </a>`;
}

const CLIENT_LOGOS = [
    { name: 'Dr. Reddy\'s', image: 'assets/clients/dr-reddys.png' },
    { name: 'EaZy Byts', image: 'assets/clients/eazy-byts.png' },
    { name: 'Freudenberg', image: 'assets/clients/freudenberg.png' },
    { name: 'Gala', image: 'assets/clients/gala.png' },
    { name: 'Prototyze', image: 'assets/clients/prototyze.png' },
    { name: 'Screen Root', image: 'assets/clients/screenroot.png' },
    { name: 'Deck Sherpa', image: 'assets/clients/deck-sherpa.png' },
    { name: 'SIT', image: 'assets/clients/sit.png' },
    { name: 'Future Factory', image: 'assets/clients/future-factory.png' },
];

function renderLogoChip(client, hidden) {
    return `<div class="logo-chip"${hidden ? ' aria-hidden="true"' : ''}><img src="${client.image}" alt="${client.name} logo"></div>`;
}

function renderProjectGridMobile() {
    return projects.map(renderCard).join('\n');
}

const COLUMN_WEIGHTS = [7, 5];
const CAPTION_HEIGHT_ESTIMATE = 1.6;

function distributeIntoColumns(items) {
    const columns = COLUMN_WEIGHTS.map(() => ({ items: [], height: 0 }));
    for (const item of items) {
        let target = 0;
        for (let i = 1; i < columns.length; i++) if (columns[i].height < columns[target].height) target = i;
        const imageHeight = COLUMN_WEIGHTS[target] / CARD_ASPECT_RATIO;
        columns[target].items.push(item);
        columns[target].height += imageHeight + CAPTION_HEIGHT_ESTIMATE;
    }
    return columns;
}

function renderProjectGridDesktop() {
    const columns = distributeIntoColumns(projects);
    const widthClasses = ['lg:w-7/12', 'lg:w-5/12'];
    return columns.map((col, i) =>
        `<div class="w-full ${widthClasses[i]}">\n${col.items.map(renderCard).join('\n')}\n                    </div>`
    ).join('\n');
}

function normalizeCaseHeadings(content) {
    return content.replace(/<div class="case-subhead">([\s\S]*?)<\/div>/g, '<h3 class="case-subhead">$1</h3>');
}

function renderSectionHTML(project, key, label) {
    const s = project.sections[key];
    const id = `${project.id}-${key}`;
    const content = normalizeCaseHeadings(s.content || '');

    if (s.type === 'rich') {
        return `<section id="${id}" class="scroll-mt-32"><h2 class="text-2xl font-bold uppercase tracking-tight mb-8 border-b border-gray-200 pb-4">${label}</h2><div class="case-study-rich">${content}</div></section>`;
    }

    if (s.type === 'video') {
        const body = s.image ? `<img src="${s.image}" class="w-full h-full object-cover">` : `<span class="text-gray-400 font-meta text-sm">${s.content}</span>`;
        return `<div id="${id}" class="scroll-mt-32"><h2 class="text-2xl font-bold uppercase tracking-tight mb-8 border-b border-gray-200 pb-4">${label}</h2><div class="w-full aspect-video bg-gray-200 flex items-center justify-center rounded-xl overflow-hidden mb-12">${body}</div></div>`;
    }

    if (s.type === 'images') {
        const body = s.image ? `<img src="${s.image}" class="w-full h-full object-cover rounded-lg">` : `<span class="text-gray-400 font-meta text-xs">${s.content}</span>`;
        return `<div id="${id}" class="scroll-mt-32"><h2 class="text-2xl font-bold uppercase tracking-tight mb-8 border-b border-gray-200 pb-4">${label}</h2><div class="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg">${body}</div></div>`;
    }

    return `<div id="${id}" class="scroll-mt-32"><h2 class="text-2xl font-bold uppercase tracking-tight mb-8 border-b border-gray-200 pb-4">${label}</h2><p class="text-lg text-gray-600 font-light">${content}</p></div>`;
}

function renderCustomSectionHTML(project, section) {
    return `<section id="${project.id}-${section.id}" class="scroll-mt-32"><div class="case-study-rich"><div class="case-eyebrow">${section.label}</div>${normalizeCaseHeadings(section.content)}</div></section>`;
}

function renderCaseStudyStatusScript(projectId) {
    return `<script>
(function () {
    function initCaseStudyStatus() {
        var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-case-nav]'));
        if (!buttons.length) return;

        var items = buttons.map(function (button) {
            var id = button.getAttribute('data-target');
            var section = document.getElementById(id);
            if (!section) return null;
            return { id: id, button: button, section: section };
        }).filter(Boolean);

        if (!items.length) return;

        function setActive(activeId) {
            items.forEach(function (item) {
                var active = item.id === activeId;
                item.button.setAttribute('data-scroll-active', active ? 'true' : 'false');
                item.button.setAttribute('aria-current', active ? 'true' : 'false');
            });
        }

        function update() {
            var anchor = window.innerHeight * 0.38;
            var activeItem = items[0];
            var closest = Number.POSITIVE_INFINITY;

            items.forEach(function (item) {
                var rect = item.section.getBoundingClientRect();
                var entered = rect.top <= anchor;
                var notPassed = rect.bottom >= anchor;

                if (entered && notPassed) {
                    activeItem = item;
                    closest = -1;
                    return;
                }

                var distance = Math.abs(rect.top - anchor);
                if (closest !== -1 && rect.top <= window.innerHeight * 0.82 && distance < closest) {
                    closest = distance;
                    activeItem = item;
                }
            });

            setActive(activeItem.id);
        }

        var ticking = false;
        function requestUpdate() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(function () {
                update();
                ticking = false;
            });
        }

        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                setActive(button.getAttribute('data-target'));
                window.setTimeout(update, 500);
            });
        });

        update();
        window.addEventListener('resize', requestUpdate);

        var contentView = document.getElementById('content-view');
        if (contentView) contentView.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('scroll', requestUpdate, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCaseStudyStatus);
    } else {
        initCaseStudyStatus();
    }
})();
</script>`;
}

function renderCaseStudyBody(p) {
    const metaHTML = p.meta.map(([label, value]) =>
        `<div><span class="block text-black font-bold mb-2 font-heading-sans tracking-tight">${label}</span>${value}</div>`
    ).join('');

    const customSections = p.presentationSections || p.caseSections;
    const projectSections = customSections
        ? customSections.map(section => [section.id, section.label])
        : SECTION_ORDER;

    const sidebarItems = customSections ? projectSections : [['overview', 'Overview'], ...projectSections];
    const sidebarHTML = sidebarItems.map(([key, label], index) => {
        const target = key === 'overview' ? `${p.id}-overview` : `${p.id}-${key}`;
        return `<button onclick="scrollToSection('${target}')" data-case-nav data-target="${target}" data-scroll-active="${index === 0 ? 'true' : 'false'}" aria-current="${index === 0 ? 'true' : 'false'}" data-cursor-quiet class="case-nav-status-link text-left hover:text-black transition-colors">${label}</button>`;
    }).join('\n');

    const sectionsHTML = customSections
        ? customSections.map(section => renderCustomSectionHTML(p, section)).join('\n')
        : SECTION_ORDER.map(([key, label]) => renderSectionHTML(p, key, label)).join('\n');

    return `        <div class="bg-white w-full min-h-screen text-black pb-32">
            <div id="${p.id}-${customSections ? 'hero' : 'overview'}" class="w-full scroll-mt-32">
                <div class="w-full h-[60vh] pt-20 md:pt-0 ${p.hero.bgClass} flex items-center justify-center">${renderMedia(p.hero, p.title + ' hero image')}</div>
                <div class="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16 pt-16 pb-12">
                    ${p.projectLabel ? `<div class="flex flex-wrap items-center gap-3 mb-5"><p class="font-meta text-xs uppercase tracking-[0.18em] text-gray-500">${p.projectLabel}</p>${p.badge ? `<span class="rounded-full border border-black px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-black">${p.badge}</span>` : ''}</div>` : ''}
                    <h1 class="text-5xl md:text-7xl font-black tracking-tighter mb-6">${p.heroTitle || p.title}</h1>
                    <p class="text-xl md:text-2xl text-gray-500 font-light max-w-3xl">${p.subtitle}</p>
                </div>
            </div>
            <div class="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16 py-12 border-t border-b border-gray-200 mb-16">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-8 font-meta text-sm text-gray-500 uppercase">${metaHTML}</div>
            </div>
            <div class="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16 flex flex-col md:flex-row gap-12 lg:gap-24 relative">
                <div class="hidden md:block w-1/4 shrink-0">
                    <div class="case-study-scroll-nav sticky top-32 flex flex-col space-y-4 text-[15px] text-gray-400 font-meta tracking-wide">${sidebarHTML}</div>
                </div>
                <div class="w-full md:w-3/4 flex flex-col space-y-32">${sectionsHTML}</div>
            </div>
${renderCaseStudyStatusScript(p.id)}
        </div>`;
}

// ---------- route table ----------
const routes = [];
const RESEARCH_COLLECTIONS = [
    { slug: 'strategic-hot-takes', title: 'Strategic Hot Takes & Articles', description: 'Short-form essays on systems design, session-based continuity, and generative discovery.', items: ['Why products need session-based continuity', 'Designing for generative engines', 'When terminology gets in the way of usability'] },
    { slug: 'methodology', title: 'Methodology Deep Dives', description: 'Evidence-led studies on specialist design methods, cognitive ergonomics, and inclusive interfaces.', items: ['Designing complex financial interfaces for older adults', 'The Tactile Dissonance', 'Making cognitive load visible in service systems'] },
    { slug: 'field-notes', title: 'Unpublished Field Notes', description: 'Working observations from fabrication, manufacturing floors, and artisan workshops.', items: ['What full-scale metalwork taught us about domestic comfort', 'Cognitive load on the manufacturing floor', 'Designing for the reality of an artisan workshop'] },
];

function renderResearchCollection(collection) {
    return `<main class="research-catalog" aria-labelledby="catalog-title"><header><p class="research-catalog-kicker">Research collection</p><h1 id="catalog-title">${collection.title}</h1><p>${collection.description}</p></header><section aria-labelledby="catalog-entries-title"><h2 id="catalog-entries-title">All entries</h2><div class="research-catalog-grid">${collection.items.map((item, index) => `<article class="research-entry${index === 1 ? ' research-entry-dark' : ''}"><p class="research-entry-meta">Research note · In development</p><h3>${item}</h3><p>Full notes, sources, and working observations for this research stream.</p></article>`).join('')}</div></section></main>`;
}

routes.push({
    outPath: 'index.html', depth: 0,
    title: 'Areen Pednekar | Product & Industrial Designer',
    description: 'Areen Pednekar is a Product & Industrial Designer working across UI/UX, interior, and industrial design. Explore selected projects, research, and resume.',
    body: `    <div id="main-view">\n${fragments.mainMenu}\n    </div>`,
});

routes.push({
    outPath: 'about/index.html', depth: 1,
    title: 'About | Areen Pednekar',
    description: 'Learn about Areen Pednekar, Product & Industrial Designer: background, roots, and how to get in touch.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', active: 'Hi' })}\n        <div id="hi-content">\n${fragments.hi.replace('<h1>Off-Canvas</h1>', '<h2>Off-Canvas</h2>')}\n        </div>\n${FOOTER}\n    </div>`,
});

routes.push({
    outPath: 'off-canvas/index.html', depth: 1,
    title: 'Off-Canvas | Areen Pednekar',
    description: 'A personal collection of creative practices by Areen Pednekar.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: 'about/', active: '' })}\n        <div id="offcanvas-content">\n${fragments.hi.replace('<h1 class="font-black text-4xl md:text-5xl mb-6 tracking-tighter text-center md:text-left">About Me</h1>', '<h2 class="font-black text-4xl md:text-5xl mb-6 tracking-tighter text-center md:text-left">About Me</h2>')}\n        </div>\n${FOOTER}\n    </div>`,
});

routes.push({
    outPath: 'projects/index.html', depth: 1,
    title: 'Projects | Areen Pednekar',
    description: 'Portfolio of UI/UX, industrial, and interior design projects by Areen Pednekar.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', active: 'Projects' })}\n        <div id="projects-content" class="w-full min-h-screen bg-white text-black pt-40 pb-32">
            <div class="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-10">
                <div class="journey-block">
                    <div class="journey-grid">
                        <div class="journey-intro">
                            <h1 class="font-black text-4xl md:text-5xl mb-4 tracking-tighter">The Journey So Far</h1>
                            <p>This space is more than a gallery of finished work. Each project follows the same arc, from early research to physical form, shaped by the constraints and decisions specific to that problem. Together, they trace how I <em>think</em>.</p>
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
                                <span class="stat-count" data-count-to="12" data-suffix="+">0</span>
                                <span class="stat-label">Ecosystems Designed</span>
                            </div>
                        </div>
                    </div>
                    <div class="journey-trusted">
                        <h2 class="font-black text-4xl md:text-5xl mb-4 tracking-tighter">Trusted by teams at</h2>
                        <div class="logo-carousel" id="logo-carousel">
                            <div class="logo-carousel-track" id="logo-carousel-track">
                                ${CLIENT_LOGOS.map(c => renderLogoChip(c, false)).join('\n                                ')}
                                ${CLIENT_LOGOS.map(c => renderLogoChip(c, true)).join('\n                                ')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-4 mb-12 border-b border-gray-100 pb-8">
                    <button onclick="filterProjects(event, 'all')" data-cursor-quiet class="filter-btn filter-active text-xs md:text-sm font-bold uppercase tracking-widest border px-5 py-2.5 rounded-full transition-colors">All</button>
                    <button onclick="filterProjects(event, 'uiux')" data-cursor-quiet class="filter-btn filter-inactive text-xs md:text-sm font-bold uppercase tracking-widest border px-5 py-2.5 rounded-full transition-colors hover:border-black hover:text-black">UI/UX Strategy</button>
                    <button onclick="filterProjects(event, 'research')" data-cursor-quiet class="filter-btn filter-inactive text-xs md:text-sm font-bold uppercase tracking-widest border px-5 py-2.5 rounded-full transition-colors hover:border-black hover:text-black">Research &amp; Behavior</button>
                    <button onclick="filterProjects(event, 'industrial')" data-cursor-quiet class="filter-btn filter-inactive text-xs md:text-sm font-bold uppercase tracking-widest border px-5 py-2.5 rounded-full transition-colors hover:border-black hover:text-black">Industrial</button>
                </div>
                <div class="lg:hidden" id="projects-grid-mobile">
${renderProjectGridMobile()}
                </div>
                <div class="hidden lg:flex gap-x-5" id="projects-grid">
${renderProjectGridDesktop()}
                </div>
            </div>
        </div>\n${FOOTER}\n    </div>`,
});

routes.push({
    outPath: 'research/index.html', depth: 1,
    title: 'Research | Areen Pednekar',
    description: 'The Tactile Dissonance: a comparative analysis of ergonomic feedback in gaming, by Areen Pednekar.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', active: 'Research' })}\n        <div id="research-content">\n${fragments.research}\n        </div>\n${FOOTER}\n    </div>`,
});

for (const collection of RESEARCH_COLLECTIONS) {
    const canonical = `${SITE_URL}/research/${collection.slug}/`;
    const structuredData = JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: collection.title, description: collection.description, url: canonical });
    routes.push({
        outPath: `research/${collection.slug}/index.html`, depth: 2,
        title: `${collection.title} | Areen Pednekar`,
        description: collection.description,
        extraHead: `<link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${collection.title} | Areen Pednekar"><meta property="og:description" content="${collection.description}"><script type="application/ld+json">${structuredData}</script>`,
        body: `    <div id="content-view">\n${renderHeader({ backHref: 'research/', active: 'Research' })}\n        <div id="research-content">\n${renderResearchCollection(collection)}\n        </div>\n${FOOTER}\n    </div>`,
    });
}

routes.push({
    outPath: 'resume/index.html', depth: 1,
    title: 'Resume | Areen Pednekar',
    description: 'Resume and professional background of Areen Pednekar, Product & Industrial Designer.',
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', active: 'Resume' })}\n        <div id="resume-content">\n${fragments.resume}\n        </div>\n${FOOTER}\n    </div>`,
});

routes.push({
    outPath: 'contact/index.html', depth: 1,
    title: 'Contact | Areen Pednekar',
    description: "Get in touch with Areen Pednekar to discuss a product, industrial, or UI/UX design project.",
    body: `    <div id="content-view">\n${renderHeader({ backHref: '', darkMode: true, active: 'Contact' })}\n        <div id="contact-content">\n${fragments.contact}\n        </div>\n    </div>`,
});

for (const p of projects) {
    routes.push({
        outPath: `projects/${p.id}/index.html`, depth: 2,
        title: p.pageTitle || `${p.title} | Areen Pednekar`,
        description: p.metaDescription || p.subtitle,
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

const urls = routes.map(r => {
    const urlPath = r.outPath === 'index.html' ? '' : r.outPath.replace(/index\.html$/, '');
    return `  <url><loc>${SITE_URL}/${urlPath}</loc></url>`;
}).join('\n');

fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

console.log(`Built ${routes.length} pages into ${OUT}`);

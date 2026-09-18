# Areen Pednekar — Portfolio Site

Product & Industrial Designer portfolio. Source-driven static site: content
lives in plain data and HTML fragment files, and a build script generates the
deployed pages.

## Architecture

The site is generated, not hand-written per page. Source files —
`fragments/*.html`, `data/projects.json`, `styles.css`, `app.js` — are
compiled by `build.js` into 13 independent static HTML pages in `dist/`:

- `/` — animated landing menu
- `/about/`, `/projects/`, `/research/`, `/resume/`, `/contact/` — one page
  per section
- `/projects/<id>/` — one page per project, generated from `data/projects.json`

Each generated page contains its actual content directly in the HTML at
build time (not loaded afterward via JavaScript), with its own `<title>` and
`<meta name="description">`. This makes every page independently readable by
search engines, AI crawlers, and anyone opening the link directly, rather
than requiring interaction with the animated menu first.

`dist/` is build output. It is not committed to this repository — it's
generated fresh on every deploy.

## Editing content

**Add, edit, or remove a project** — edit `data/projects.json`. Each entry
defines a project's title, category, grid thumbnail, hero image, metadata
table, and the eight case-study sections (Solution, Core Flows, Research,
Exploring Form Factors, Prototyping and Testing, Design Decisions, Designing
for Hardware Constraints, Reflection). Adding an object creates a new project
page automatically; removing one deletes its page on the next build.

**Edit the About, Resume, Research, or Contact page text** — edit the
matching file in `fragments/` (`hi.html`, `resume.html`, `research.html`,
`contact.html`).

`build.js` is the generator itself and isn't normally edited when adding
content.

## Images

Referenced by path from `data/projects.json` and the fragment files:

- `assets/logo.png`, `assets/profile.jpg`, `assets/resume-1.jpg`,
  `assets/resume-2.jpg` — fixed site images
- `assets/projects/<id>/` — per-project images. Set a project's `image`
  field in `data/projects.json` (e.g. `"hero": { "image":
  "assets/projects/surfing/hero.jpg" }`) to use a real photo in place of the
  placeholder block.

## Deployment

**GitHub Pages:** `.github/workflows/` contains a GitHub Actions workflow
that runs `node build.js` and publishes `dist/` on every push to `main`.
Requires the repository's Pages source (Settings → Pages → Build and
deployment) to be set to "GitHub Actions."

**Vercel:** `vercel.json` configures the same build command
(`node build.js`) and output directory (`dist`) automatically.

## Local preview

```
node build.js
npx serve dist
```

Requires Node.js. Not required for normal editing — the CI workflow builds
and deploys automatically on push.

## File reference

| Path | Purpose |
|---|---|
| `build.js` | Static site generator |
| `data/projects.json` | Project content (source of truth for `/projects/`) |
| `fragments/*.html` | Content for About, Resume, Research, Contact, and the main menu |
| `styles.css` | Shared stylesheet |
| `app.js` | Shared client-side behavior (transitions, animations, interactive elements) |
| `assets/` | Images |
| `robots.txt`, `sitemap.xml` | Crawler configuration (`sitemap.xml` is generated into `dist/` on build) |
| `.github/workflows/` | GitHub Actions deployment |
| `vercel.json`, `package.json` | Vercel build configuration |

# What this is now

Your site went from one HTML file to a small **static site generator**: source
files here (`fragments/`, `data/projects.json`, `styles.css`, `app.js`,
`build.js`) get turned into 13 real, independent HTML pages — one per section,
one per project — by `build.js`. Those generated pages are what actually gets
deployed. You never edit or upload the generated pages directly.

**Why:** every page now has its own real URL with its actual content sitting
in the raw HTML (not injected by JavaScript after the page loads). That's the
fix for the crawlability gap flagged earlier — AI and search crawlers can now
read `/projects/surfing/`, `/resume/`, `/about/` etc. as real pages, each with
its own title and description, instead of everything living behind clicks on
one single URL.

Every animation is untouched — the curtain transitions, the ripple logo
effect, the diecast-dash game, the greeting carousel. Moving between sections
now does a real page navigation instead of a same-document swap, with the
same curtain animation covering the transition on both ends, so it should
feel almost identical to use.

## The one-time setup change this requires

Because pages are now *generated* rather than *uploaded as-is*, GitHub needs
to run `build.js` for you on every push. That means switching how GitHub
Pages deploys:

1. Go to your repo → **Settings → Pages**
2. Under **Build and deployment → Source**, change it from **"Deploy from a
   branch"** to **"GitHub Actions"**

The workflow file already included (`.github/workflows/deploy.yml`) then
takes over: every push to `main` runs `node build.js` and publishes the
result automatically. You don't run anything yourself.

If you deploy to Vercel at some point, no extra step needed there —
`vercel.json` already tells it to run the same build.

## Uploading this to replace what's there now

Your repo root currently has the single old `index.html` and `data/` folder
from before. Delete those, then upload everything in this package to the
repo root (same drag-the-contents-not-the-folder rule as last time):

`fragments/`, `data/`, `styles.css`, `app.js`, `build.js`, `package.json`,
`vercel.json`, `robots.txt`, `.github/` (yes, upload the `.github` folder too
— GitHub's upload UI does accept dot-folders), and `assets/` if you haven't
already got your real images uploaded there.

After uploading, do the Settings → Pages step above, then check the Actions
tab in your repo — you should see a build running. Once it finishes (~30
seconds), your site is live at the real, multi-page structure.

## Your daily workflow now

Exactly what you'd expect from a "Projects and Portfolio" panel:

- **Add/edit/remove a project** → edit `data/projects.json`, push. A new page
  at `/projects/<id>/` appears automatically, with its own title and
  description already set from the project's `title`/`subtitle` fields.
- **Edit About Me, Resume, Research, or Contact text** → edit the matching
  file in `fragments/` (`hi.html`, `resume.html`, `research.html`,
  `contact.html`), push.
- You never touch `build.js` day-to-day — it's the machine, not a place you
  write content.

## Local preview (optional)

If you ever want to check something before pushing:

```
node build.js
npx serve dist
```

Requires Node.js installed locally. Not required for normal use — GitHub
builds it for you.

## What changed in this pass

- 13 real pages instead of 1: `/`, `/about/`, `/projects/`, `/projects/<id>/`
  (×7), `/research/`, `/resume/`, `/contact/`
- Every page has its own `<title>` and `<meta name="description">` — project
  pages use that project's subtitle automatically
- Added `sitemap.xml` (generated automatically, lists every real URL) and
  `robots.txt`
- Menu items and project cards are now real `<a href>` links (crawlable,
  open-in-new-tab-able) instead of `onclick`-only divs, with the curtain
  animation layered on top via JavaScript for browsers that support it
- Shared `styles.css` and `app.js` instead of one repeated inline block per
  page

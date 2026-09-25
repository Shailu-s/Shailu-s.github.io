# Shailendra Singh, portfolio

Live at https://shailu-s.github.io. Astro 7, plain CSS, no client framework.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview
```

## Where things live

| What | File |
|---|---|
| Name, tagline, metrics, experience, repos, stack | `src/data/profile.ts` |
| Case studies (one per project) | `src/content/work/*.md` |
| Notes | `src/content/notes/*.md` |
| Resume PDF | `public/resume/` |
| Colours and type | `src/styles/global.css` (`:root` variables) |

Add a case study by dropping a new `.md` into `src/content/work/` with the same frontmatter;
`order` controls its position.

## Deploy

Every push to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.

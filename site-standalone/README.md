# site-standalone

A static export of the public site at `/site`, for hosting the marketing page
on its own — with no Next server, no SQLite, and no operator console behind it.

It is a **shell, not a copy**: `app/page.tsx` re-exports the real page from
`../app/site/page.tsx`, and every component and library it pulls in resolves
through the `@/*` alias back to the repo root. The site is authored in exactly
one place; this directory only supplies the build target.

```bash
cd site-standalone
npm install
NEXT_PUBLIC_CONSOLE_URL=https://github.com/buddybuses-dev/FounderOS-DEMO npm run build
# → site-standalone/out/  (index.html + _next/static assets)
```

`NEXT_PUBLIC_CONSOLE_URL` is what keeps the console links honest: with no
console deployed alongside the page, every "open the console" link points at
wherever the console actually lives instead of a route that would 404. Unset,
the links stay as in-app routes (which is what the full app wants).

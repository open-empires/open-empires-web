## Open Empires

I'm trying something ambitious: vibe-coding an Age Of Empires style RTS that lives in the web browser, rendered on canvas.

Long-term the backend will be written in spacetime DB. The goal is to have live matchmaking for 100 simultaneous players in a FFA and have clean open APIs for designing scenarios, mods, etc, and maybe support 100 such lobbies at a time. There'll be a subscription fee.

## Deployment

- Static export is generated with Bun: `bun run build`
- Export output folder: `dist/`
- GitHub Actions workflow at `.github/workflows/deploy-gh-pages.yml` builds and publishes `dist/` to the `gh-pages` branch on pushes to `main`/`master` (and via manual dispatch).

# بوت بحث تيليجرام

بوت تيليجرام للبحث عن القنوات والمجموعات والبوتات على تيليجرام، مشابه لموقع lyzem.com.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + Telegram bot (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `TELEGRAM_BOT_TOKEN` — Telegram bot token from BotFather

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Bot: Telegraf 4
- Search: lyzem.com scraping (node-html-parser)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/api-server/src/bot/index.ts` — bot logic, commands, handlers
- `artifacts/api-server/src/bot/search.ts` — lyzem.com search scraper
- `artifacts/api-server/src/index.ts` — server entry, launches bot on start

## Architecture decisions

- Bot runs inside the same Express server process — no separate process needed.
- Search results are scraped from lyzem.com using node-html-parser.
- Uses Telegraf long-polling mode (not webhooks) for simplicity.
- MarkdownV2 formatting used for rich message output with clickable links.

## Product

- `/start` — welcome message + keyboard shortcuts
- `/search [query]` — search Telegram channels/groups
- `/help` — usage instructions
- Sending any text triggers a search automatically
- Inline pagination button to load more results

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always restart the API Server workflow after code changes.
- lyzem.com HTML structure may change; update selectors in `search.ts` if results stop working.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

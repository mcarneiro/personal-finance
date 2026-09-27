# Planoo

A household card-spending planner. Planoo plans card spending as fixed charges and spending buckets, tracks weekly card check-ins and per-bucket remaining estimates, projects the month result live, and tracks income and bills. All data lives in your own Google Sheet.

See `prd.md` for the product spec, `CONTEXT.md` for the domain glossary, and `docs/adr/` for the hard decisions.

## Tech stack

React 19 · Vite · Redux Toolkit · react-router-dom · react-i18next (pt-BR primary, en-US) · Tailwind CSS 4 · Vitest + Testing Library.

## Development

```bash
npm install
npm run dev        # start the dev server
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # run the test suite once
npm run test:watch # watch mode
```

### Environment

Google Sheets integration reads `VITE_GOOGLE_CLIENT_ID` from `.env`. Copy `.env.example` to `.env` and paste your OAuth client ID; the first launch walks you through signing in, pasting a Sheet URL, and creating any missing tabs. Never commit `.env` or any OAuth secret.

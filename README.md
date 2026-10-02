# Planyoo

A household card-spending planner. Planyoo plans card spending as spending buckets, tracks weekly card check-ins and per-bucket remaining estimates, projects the month result live, and tracks income and outflows — including who pays each outflow, from which bank, whether each amount is final, a by-payer summary that can swap to the amount still to pay per payer and bank, a payer/bank filter on the outflow list that spells out the active filters, and one-tap replication of last month's outflows — and tracks savings pots (emergency, retirement, …) with a hand-updated monthly balance each and a Total Saved headline. The Outflows screen's filter and by-payer summary state are remembered on the device, and the income total links straight to that month's Income screen. The Savings tab keeps pots browsable month by month, carrying each balance forward until you update it. The Dashboard at `/` is the current-month home: income vs outflows bars with the account net, the Spending Plan's progress as a pace-coloured bar with an over-plan callout, and the open outflows you can mark paid right there. All data lives in your own Google Sheet.

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

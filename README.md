# LedgerSync AI

AI-powered bank reconciliation agent for SMBs. Upload bank and accounting CSVs, normalize, rule-match, apply fuzzy (LLM-ready) matching, review exceptions, and export results.

## Features
- Multi-tenant architecture with SQLite + NextAuth
- Google OAuth one-click sign-in
- CSV normalization (date, amount, description, reference)
- Rule-based exact/date-window matching
- Fuzzy matching with confidence and explanations
- Exceptions for unmatched, low-confidence, missing invoice, duplicates
- AI reasoning panel for unmatched items with on-demand explanations
- Human review table
- Export reconciliation summary to CSV/PDF
- CSV-only reconciliation (no external ledger integrations)

## Quick start
1. Install dependencies
   ```bash
   npm install
   ```
2. Configure environment variables
   ```bash
   cp .env.example .env
   ```
3. Run the app
   ```bash
   npm run dev
   ```

## Environment variables
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Notes
- LLM matching uses OpenAI Responses API by default. Configure the model and API key in `.env`.

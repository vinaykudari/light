# Light

Clinical trial intelligence from evidence and public patient-experience signals.

Light is a hackathon demo for clinician-reviewed referral preparation. It uses synthetic/de-identified patient profiles only and does not provide medical advice, determine final trial eligibility, or recommend treatment.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Integrations

- ClinicalTrials.gov public API with seeded fallback
- PubMed/NCBI public API with seeded fallback
- X public search when credentials are configured, with sanitized seeded fallback
- Nia, Tensorlake, Hyperspell, and LLM adapter interfaces with graceful fallback
- Convex schema/functions are included for realtime state integration

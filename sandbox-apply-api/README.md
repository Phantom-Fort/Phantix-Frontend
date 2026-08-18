# Sandbox apply API

Simple Node/Express service for **landing-page sandbox applications** (cap 20 orgs).

## Run

```bash
cd sandbox-apply-api
cp .env.example .env   # set STAFF_API_KEY
npm install
npm run dev            # http://localhost:8787
```

## Public

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/api/sandbox/status` | Seat counter for landing |
| `POST` | `/api/sandbox/apply` | Submit application |

## Staff (header `X-Sandbox-Staff-Key`)

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/api/sandbox/applications` | List (+ `?status=pending`) |
| `PATCH` | `/api/sandbox/applications/:id` | `{ status, staff_notes }` |
| `DELETE` | `/api/sandbox/applications/:id` | Remove |

Statuses: `pending` · `approved` · `rejected` · `waitlist`  
Seats held by **pending + approved** only (max 20).

Data file: `data/store.json` (gitignored).

Wire landing: `VITE_SANDBOX_APPLY_API=http://localhost:8787`  
Wire staff portal: same + `VITE_SANDBOX_STAFF_KEY=<STAFF_API_KEY>`

# Deployment Guide (Railway)

This guide provides the exact manual steps to deploy the application on Railway as a long-running Node service with managed PostgreSQL (decision D-003).

---

## Prerequisites

1. An account on [railway.app](https://railway.app/).
2. GitHub account connected to Railway with access to this repository.

---

## Step 1: Create a Project

1. Log in to [Railway Dashboard](https://railway.app/dashboard).
2. Click **New Project**.
3. Select **Empty Project**.

---

## Step 2: Add Postgres Database

1. Inside your new project canvas, click **Create** or **+ New**.
2. Select **Database** -> **Add PostgreSQL**.
3. Railway provisions a managed Postgres instance with automated volume storage.

---

## Step 3: Connect GitHub Repository

1. In the project canvas, click **+ New**.
2. Select **GitHub Repo**.
3. Choose this repository from the list.
4. Railway will create a web service card linked to the repository.

---

## Step 4: Configure Environment Variables

1. Click on the web service card in the canvas and open the **Variables** tab.
2. Add the following environment variable names:

| Variable Name | Value / Description |
|---|---|
| `DATABASE_URL` | Set to `${{Postgres.DATABASE_URL}}` (uses Railway variable reference) or paste the Postgres connection string |
| `LLM_BASE_URL` | OpenAI-compatible endpoint URL (e.g. `https://api.openai.com/v1` or OpenRouter URL) |
| `LLM_API_KEY` | Your secret LLM provider API key |
| `LLM_MODEL` | The selected candidate model ID (e.g. `gpt-4o-mini`) |
| `NODE_ENV` | `production` |

> **Note**: `PORT` is automatically provided by Railway at runtime; do not hardcode it.

---

## Step 5: Configure Build and Deploy Settings

1. In the web service card, navigate to the **Settings** tab.
2. Under **Build**:
   - **Build Command**: `npm run build`
3. Under **Deploy**:
   - **Start Command**: `npm run deploy` (or `npm run db:migrate && npm start`)
   This ensures database migrations (`src/server/db/migrations`) run automatically on each deploy before the server accepts traffic.

---

## Step 6: Generate a Public Domain

1. In the web service card, go to the **Settings** tab.
2. Scroll to the **Networking** section.
3. Under **Public Networking**, click **Generate Domain**.
4. Railway will assign a public HTTPS URL (e.g., `https://contract-analyser-production.up.railway.app`).

---

## Step 7: Verify Health and Database Connectivity

1. Open a browser or run curl against the generated domain:
   ```bash
   curl -i https://<your-railway-domain>/api/health
   ```
2. Verify the HTTP response:
   - HTTP Status Code: `200 OK`
   - Response Body:
     ```json
     {"status":"ok","db":"ok"}
     ```
3. If the database is unreachable or misconfigured, the endpoint returns:
   - HTTP Status Code: `503 Service Unavailable`
   - Response Body:
     ```json
     {"status":"error","db":"error"}
     ```

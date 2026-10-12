# Deployment Guide (Render)

This guide provides the exact manual steps to deploy the application on [Render](https://render.com/) as a long-running Node Web Service with managed PostgreSQL (decision D-003).

---

## Prerequisites

1. An account on [render.com](https://render.com/).
2. A GitHub account connected to Render with access to this repository.

---

## Step 1: Create a PostgreSQL Database on Render

1. Log in to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** (top right) and select **PostgreSQL**.
3. Configure the database details:
   - **Name**: `contract-analyser-db`
   - **Database**: `contract_analyser`
   - **User**: `postgres` (or default generated user)
   - **Region**: Select the region closest to you (e.g., Oregon, Frankfurt, Singapore).
   - **Plan**: Free or Starter.
4. Click **Create Database**.
5. Once provisioned, find the **Connections** panel:
   - Copy the **Internal Database URL** from the connection details. This is used by Render Web Services in the same region for fast, private connectivity without egress fees.

---

## Step 2: Create a Web Service on Render

1. From the Render Dashboard, click **New +** and select **Web Service**.
2. Under **Connect a repository**, select your GitHub repository (`Citation-assignment`).
3. Configure the service settings:
   - **Name**: `contract-analyser` (or your preferred service name)
   - **Region**: Select the **same region** chosen for the PostgreSQL database in Step 1.
   - **Branch**: `main` (Render deploys automatically on every push to `main`).
   - **Runtime**: **Node**.

---

## Step 3: Configure Build and Start Commands

Under the **Build & Deploy** section of the Web Service settings:

- **Build Command**:
  ```bash
  npm run build
  ```
- **Start Command**:
  ```bash
  npm run deploy
  ```

> **Why `npm run deploy`**: This executes `npm run db:migrate && next start -p ${PORT:-3000}`. Pending migrations from `src/server/db/migrations` run automatically against Postgres before the application server begins accepting traffic.

---

## Step 4: Configure Environment Variables

Navigate to the **Environment** tab of the Web Service and add the following environment variable names:

| Variable Name | Recommended Value / Description |
|---|---|
| `DATABASE_URL` | Paste the **Internal Database URL** copied from the Render PostgreSQL service in Step 1 |
| `LLM_BASE_URL` | OpenAI-compatible endpoint URL (e.g. `https://api.openai.com/v1` or OpenRouter endpoint) |
| `LLM_API_KEY` | Your secret LLM provider API key |
| `LLM_MODEL` | The candidate model identifier (e.g. `gpt-4o-mini`) |
| `NODE_ENV` | `production` |

> **Note on PORT**: Render automatically injects `PORT` (defaults to `10000`) into the environment. Our start script dynamically binds to `${PORT:-3000}`.

---

## Step 5: Deploy the Service

1. Click **Create Web Service** (or click **Manual Deploy** -> **Deploy latest commit**).
2. Render will clone the repository, run `npm run build`, execute `npm run db:migrate`, and launch `next start`.
3. Monitor the deployment logs in the dashboard to ensure the build completes and migrations apply cleanly.

---

## Step 6: Verify Health and Database Connectivity

1. In the Web Service header, copy the generated public HTTPS URL (e.g., `https://contract-analyser.onrender.com`).
2. Test the `/api/health` endpoint via browser or curl:
   ```bash
   curl -i https://<your-service-name>.onrender.com/api/health
   ```
3. Expected successful response:
   - **HTTP Status**: `200 OK`
   - **Response Body**:
     ```json
     {"status":"ok","db":"ok"}
     ```
4. If database connection fails:
   - **HTTP Status**: `503 Service Unavailable`
   - **Response Body**:
     ```json
     {"status":"error","db":"error"}
     ```

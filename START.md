# Quickstart Guide: Running the Contract Analyser

Welcome to **Contract Analyser**! Follow this step-by-step guide to run the application, explore pre-seeded contracts, execute test suites, and run the evaluation benchmark.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js**: v20 or higher (v24 recommended).
- **Docker Desktop**: Running locally (used for the PostgreSQL database).
- **LLM API Key**: An API key from [OpenRouter](https://openrouter.ai/) or [OpenAI](https://platform.openai.com/).

---

## 2. Step-by-Step Setup

### Step 1: Install Dependencies
Open your terminal in the project directory:
```bash
npm install
```

---

### Step 2: Configure Environment Variables (`.env`)
Ensure a `.env` file exists in the project root with the following configuration:

```env
# Database connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/contract_analyser # gitleaks:allow

# LLM Gateway (OpenRouter or OpenAI)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your_actual_api_key_here
LLM_MODEL=openai/gpt-4o
LLM_FAST_MODEL=google/gemini-2.5-flash

# Operational Parameters
LLM_CONTEXT_BUDGET=60000
MAX_AGENT_ROUNDS=6
MAX_AGENT_TOOL_CALLS=12
PORT=3000
```

> [!NOTE]
> The database runs on port **`5434`** locally via Docker to avoid port collisions with any native host PostgreSQL services on `5432`.

---

### Step 3: Start the Database & Run Migrations
Launch the local PostgreSQL container using Docker Compose:
```bash
docker compose up -d
```

Run database schema migrations to initialize all tables:
```bash
npm run db:migrate
```

---

### Step 4: Start the Application

Start the Next.js development server:
```bash
npm run dev
```

If port 3000 is already in use by another application on your system, you can specify an alternate port:
```bash
npx next dev -p 3002
```

Open your browser and navigate to:
👉 **`http://localhost:3000`** *(or `http://localhost:3002`)*

---

## 3. How to Use the App (30-Second Tour)

1. **Seed Sample Contracts**:
   - On the top header, click **"Seed Sample Contracts"**.
   - This instantly populates the database with 4 ready-to-test contracts:
     - `Master_Services_Agreement_2024.pdf` (Services agreement with fees and termination clauses).
     - `Mutual_NDA_Standard.pdf` (Non-disclosure agreement).
     - `Amendment_No_1_Services_Agreement.pdf` (Planted changes to fees and notice periods).
     - `Global_Enterprise_Framework_125p.pdf` (125-page agreement for large-doc scaling tests).

2. **Single Contract Chat & Quote Verification**:
   - Click `Master_Services_Agreement_2024.pdf` to open the chat drawer.
   - Ask: *"What is the notice period required to terminate for convenience?"*
   - See the answer stream in with an inline green **Verified** citation badge.

3. **Real PDF Canvas Highlighting**:
   - Click the citation badge or the quote card in the sidebar.
   - The PDF viewer opens, navigates to the exact page, auto-scrolls, and renders a yellow highlight directly over the words on the PDF canvas.

4. **Absence Honesty**:
   - Ask: *"Is there a 50% penalty on late delivery of milestones?"*
   - The system honestly states that no such provision exists in the contract rather than inventing terms.

5. **Multi-Document Comparison**:
   - In the library, check both `Master_Services_Agreement_2024.pdf` and `Mutual_NDA_Standard.pdf`.
   - Ask: *"Compare the confidentiality obligations between both agreements."*
   - The response structures answers side-by-side by topic with `[D1]` and `[D2]` tags.

6. **Contract Diff & Version Comparison**:
   - Click the **"Comparison"** tab in the main navigation.
   - Select `Master_Services_Agreement_2024.pdf` as Base and `Amendment_No_1_Services_Agreement.pdf` as Target.
   - View clause-by-clause diffs categorized by **High** significance (fee changes from AED 250k to 350k) vs **Cosmetic** edits.

7. **Autonomous Agent Research Mode (Part C)**:
   - In the chat composer, toggle **"Deep Research"**.
   - Ask: *"Research the exact cure period for material breach using tools."*
   - Watch the agent execute autonomous tool steps (`search_document`, `get_section`) with live progress logs.

---

## 4. Running Tests & Evaluations

### Run All 10 Test Suites (82 Automated Tests)
```bash
npm test
```
*Executes unit and acceptance tests for stream parsing, quote verification, document ingestion, chat persistence, large document chunking, canvas highlighting, multi-doc comparison, version diffs, agent loops, and system rate limiting.*

---

### Run the Evaluation Benchmark Harness
```bash
npm run eval
```
*Runs 12 legal benchmark questions through the full pipeline against your configured model and writes the detailed metrics report to [`evals/report.md`](file:///c:/projects/Citation-assignment/evals/report.md).*

---

### Verify Production Build
```bash
npm run build
```
*Compiles the production Next.js 16 (Turbopack) application and verifies TypeScript types and page optimization.*

---

## 5. Troubleshooting & FAQs

### Q: `docker compose up -d` fails or Docker is not running?
Ensure Docker Desktop is open and running on your system. You can verify container status with:
```bash
docker ps
```
The container `contract-analyser-postgres` should be listed with status `Up`.

### Q: Database connection error (`ECONNREFUSED 127.0.0.1:5434`)?
Make sure `DATABASE_URL` in your `.env` specifies port `5434`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/contract_analyser # gitleaks:allow
```

### Q: Model responses are failing or returning fallback simulation text?
Verify that `LLM_API_KEY` is populated in your `.env` with a valid key and that `LLM_BASE_URL` is set to `https://openrouter.ai/api/v1` (or your chosen OpenAI-compatible gateway). You can verify connectivity with:
```bash
npm run llm:check
```

### Q: Port 3000 is occupied by another local project?
Next.js will automatically detect occupied ports and offer an alternative, or you can run:
```bash
npx next dev -p 3002
```

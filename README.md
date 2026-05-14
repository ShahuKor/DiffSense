# ReviewBot

A self-hostable GitHub App that automatically reviews Pull Requests using Claude AI. It reads your actual codebase, fetches relevant context, and posts structured inline comments — and it learns from your team's feedback over time.

---

## How it works

When a PR is opened or updated, ReviewBot runs a multi-step agentic review:

```
GitHub PR event
      │
      ▼
Express webhook server
(validates HMAC signature)
      │
      ▼
BullMQ job queue (Redis)
      │
      ▼
Worker picks up job
      │
      ▼
Agent loop (Claude API)
 ├─ Pass 1: Triage
 │   reads file list + diff stats
 │   searches past review history (RAG)
 │   selects top files for deep review
 │
 └─ Pass 2: Deep review
     reads file contents + diffs
     posts inline comments per file
     posts top-level summary with verdict
      │
      ▼
PostgreSQL (pgvector)
stores comments + embeddings
learns from resolved/dismissed threads
```

### Agent tools

The agent cannot call GitHub or the database directly — it works through a set of defined tools:

| Tool | What it does |
|---|---|
| `get_pr_metadata` | Fetches PR title, description, author, base branch, labels |
| `get_diff` | Returns structured diff for a file (hunks, additions, deletions) |
| `read_file` | Fetches full file content at the PR's head commit |
| `get_file_history` | Returns last N commits that touched a file (churn/blame context) |
| `search_reviews` | Vector similarity search over past review comments for this repo |
| `post_comment` | Posts an inline review comment at a specific file + line |
| `post_summary` | Posts a top-level review with verdict (APPROVE / REQUEST_CHANGES / COMMENT) |

### Comment severity levels

Every inline comment is tagged with a severity:

- **CRITICAL** — bugs, security issues, data loss risk. Must fix before merge.
- **SUGGESTION** — logic or quality improvements. Should fix.
- **NITPICK** — style, naming, minor readability. Optional.

Low-confidence comments are suppressed entirely rather than posted as noise.

### Learning over time

Every comment posted by the bot is embedded (OpenAI `text-embedding-3-small`) and stored in PostgreSQL with pgvector. When developers interact with those comments on GitHub:

- **Resolving a thread** → `feedback: accepted`, weight increases (+0.1)
- **Unresolving a thread** → `feedback: dismissed`, weight decreases (-0.15)

On subsequent PRs, `search_reviews` ranks past comments by cosine similarity weighted by `feedback_weight` — so patterns the team acted on surface higher, and patterns the team ignored sink lower. Review quality improves measurably over 20–30 PRs.

---

## Stack

- **Runtime:** Node.js 20, TypeScript (strict)
- **Web server:** Express
- **Job queue:** BullMQ + Redis
- **AI:** Claude API (`claude-sonnet-4-5`) via Anthropic SDK
- **Embeddings:** OpenAI `text-embedding-3-small`
- **Database:** PostgreSQL + pgvector
- **ORM:** Prisma
- **GitHub:** Octokit + GitHub App auth

---

## Self-hosting guide

### Prerequisites

- Node.js 20+
- pnpm
- Docker + Docker Compose
- A GitHub account to create a GitHub App
- Anthropic API key
- OpenAI API key

### 1. Clone and install

```bash
git clone https://github.com/your-username/reviewbot
cd reviewbot
pnpm install
```

### 2. Create a GitHub App

Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App** and fill in:

| Field | Value |
|---|---|
| App name | `ReviewBot` (must be globally unique) |
| Homepage URL | Your server URL (or `http://localhost:3000` for local dev) |
| Webhook URL | `https://your-domain.com/webhook` |
| Webhook secret | Any random string — save it |

**Repository permissions:**

| Permission | Access |
|---|---|
| Contents | Read |
| Pull requests | Read & write |
| Metadata | Read |

**Subscribe to events:**
- Pull request
- Pull request review comment
- Pull request review thread

After creating the app:
1. Note the **App ID**
2. Generate a **private key** (downloads as a `.pem` file)
3. Install the app on the repositories you want it to review

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...paste your .pem file contents here...
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

DATABASE_URL=postgresql://reviewbot:reviewbot@localhost:5433/reviewbot
REDIS_URL=redis://localhost:6379

PORT=3000
NODE_ENV=development
```

### 4. Start the database and Redis

```bash
docker-compose up -d postgres redis
```

### 5. Run database migrations

```bash
pnpm db:migrate
```

### 6. Start the server and worker

In two separate terminals:

```bash
# Terminal 1 — webhook server
pnpm dev:server

# Terminal 2 — job worker
pnpm dev:worker
```

Open a Pull Request on a repository where the app is installed. The bot will post inline comments and a summary review within ~30 seconds.

---

## Local webhook forwarding

GitHub needs a public URL to send webhook events to your machine. Use ngrok:

```bash
ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL and set it as your GitHub App's webhook URL. Note: the free ngrok plan generates a new URL on each restart — update the webhook URL in your GitHub App settings each time.

Alternatively, [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) gives a stable URL for free:

```bash
cloudflared tunnel --url http://localhost:3000
```

---

## Running with Docker

To run the full stack (app + worker + postgres + redis) in containers:

```bash
docker-compose up --build
```

The `docker-compose.yml` wires up all services automatically.

---

## Environment variables

| Variable | Description |
|---|---|
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | GitHub App private key (full PEM contents) |
| `GITHUB_WEBHOOK_SECRET` | HMAC secret for validating webhook payloads |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key (used for embeddings) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `PORT` | Server port (default: `3000`) |
| `NODE_ENV` | `development` or `production` |

---

## Project structure

```
src/
  server/        Express webhook server + HMAC validation
  worker/        BullMQ job consumer
  agent/         Agentic loop orchestrator (Claude API)
  mcp-server/    Tool definitions and implementations
    tools/       Individual tool handlers
  github/        Octokit wrapper (GitHub API adapter)
  rag/           Embedding, storage, and vector search
  db/            Prisma client singleton
  shared/        Types, constants, logger
prisma/          Schema + migrations
```

---

## License

MIT

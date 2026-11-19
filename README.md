# FluentDay

> Small steps. Fluent English.

A free English-learning platform: seven new words a day from three admin-uploaded vocabulary books,
two daily listening lessons, pronunciation practice, quizzes, spaced revision and a private notebook.

## Project structure

```
fluentday/
├── frontend/          React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + Lucide
│   ├── src/
│   │   ├── components/ui/      shadcn-style primitives (button, card, badge, progress, accordion, sheet)
│   │   ├── components/common/  shared building blocks (EmptyState, PageHeader, StatCard, …)
│   │   ├── components/brand/   logo
│   │   ├── config/             navigation, site constants
│   │   ├── features/           feature-specific code (landing sections, dashboard logic)
│   │   ├── layouts/            PublicLayout, AppLayout (sidebar)
│   │   ├── pages/              route-level pages (public + /app)
│   │   ├── lib/                utilities
│   │   └── types/              domain types
│   └── scripts/browser-check.mjs   end-to-end check in headless Chrome
└── backend/           Python FastAPI + MongoDB
    ├── app/
    │   ├── routers/            auth, profile, admin (books, vocabulary, users)
    │   ├── services/           pdf_extraction (PyMuPDF), book_processing, users
    │   ├── schemas/            request/response models (Pydantic)
    │   ├── security.py         bcrypt passwords, signed session cookie, rate limiting
    │   └── main.py             app factory, startup checks, indexes
    ├── scripts/                sample_pdfs.py (test data), set_role.py
    └── tests/                  pytest (uses an in-memory MongoDB stand-in)
```

> **Database:** the project uses **MongoDB** (chosen instead of Supabase). The backend replaces Supabase's
> pieces: its own sign-in with hashed passwords and an httpOnly session cookie, private PDF storage in
> MongoDB GridFS, and per-user/admin access checks on every endpoint.

## Running the backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env        # then fill in MONGODB_URI and ADMIN_EMAILS
.venv/bin/fastapi dev app/main.py     # http://localhost:8000  (API docs at /docs)
.venv/bin/pytest            # backend tests (no database needed)
```

- **No database yet?** In development, if `MONGODB_URI` is empty the API starts with a temporary in-memory
  database (everything is lost when it stops). Good for trying the app; use a real MongoDB for anything else.
- **First admin:** put your email in `ADMIN_EMAILS` before registering, or run
  `.venv/bin/python -m scripts.set_role you@example.com admin`.
- **Emails in development:** with `SMTP_HOST` empty, verification and reset emails are printed in the
  backend terminal. Open the link from there.
- **Daily lessons:** a learner's lesson is created the first time they open the app each day (in their
  timezone). To prepare everyone's lesson in advance, run `.venv/bin/python -m scripts.generate_daily_lessons`
  (safe to run repeatedly; the scheduler below also does this).
- **Listening videos:** in Admin → Listening videos, press "Import latest videos" for each channel (it reads the
  channel's public YouTube RSS feed, no API key needed) or paste a single YouTube link. Each learner gets one
  video per channel per day: a video scheduled for that date first, otherwise the newest one they haven't seen.
- **Revision schedule:** `REVISION_GAPS=1,2,3,8` means a learned word comes back on days 2, 4, 7 and 15.
  "Easy" skips a step, "Difficult" and "Forgot" bring it back tomorrow; after four steps it is mastered.
- **Pronunciation Lab:** uses the browser's own speech features (best in Chrome or Edge). Recordings stay on the
  learner's device; only the recognised text is saved. It shows what was heard, not a per-sound score;
  `app/services/pronunciation.py` (`assess`) is where a dedicated speech-assessment service would plug in.
- **Quizzes:** unlock once a learner has learned 4 words, and only test learned or mastered words.
- **Reminders (scheduler):** run `.venv/bin/python -m scripts.run_scheduler --loop` next to the API (or run it
  without `--loop` from cron every 5 minutes). At each learner's reminder time it prepares their lesson and sends one
  reminder on each channel they switched on: in-app, email and/or browser push. Nothing is sent without consent,
  learners who already studied that day are skipped, and failed deliveries are retried up to 3 times. Reminder
  emails include a one-click unsubscribe link.
- **Browser push (optional):** run `.venv/bin/python -m scripts.generate_vapid_keys` and put the two values in
  `backend/.env`. Without them the push switch in Settings is disabled and says why. Push needs HTTPS in
  production (localhost is fine for development).
- **Sample data:** `.venv/bin/python -m scripts.sample_pdfs` writes two small dictionary-style PDFs to
  `backend/sample-data/` that you can upload in the admin dashboard.
- **Starter vocabulary:** `backend/data/starter_vocabulary.json` holds 2,739 everyday words: the
  [New General Service List](https://www.newgeneralservicelist.com/) (CC BY-SA 4.0), with definitions,
  examples, synonyms and pronunciations from [Open English WordNet](https://en-word.net/) (CC BY 4.0).
  Admins load it with **Load starter vocabulary** on the Vocabulary page; the words arrive approved, with
  levels by usefulness (top 1,000 beginner, next 1,000 intermediate, the rest advanced). Loading again
  is safe, and book words are never overwritten. To rebuild the file from fresh downloads:
  `python3 -m scripts.build_starter_vocabulary english-wordnet-2024.xml.gz NGSL_12_stats.csv`.
  The site footer credits both sources, as their licences require.

## Running the frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

| Command                 | What it does                                                     |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev`           | Start the dev server                                             |
| `npm test`              | Unit + routing tests (Vitest)                                    |
| `npm run typecheck`     | TypeScript check                                                 |
| `npm run lint`          | oxlint                                                           |
| `npm run build`         | Production build                                                 |
| `npm run browser-check` | Every page at 375/768/1280px: overflow, axe a11y, console errors, key flows. Signed-in pages use fake API data from `scripts/fixtures.mjs` (needs Chrome and a running dev server) |

**Note:** `vite` is pinned to `8.3.5` because the internal npm mirror doesn't yet have the `rolldown`
version required by newer Vite releases.

## Deploying

Everything runs on free plans: **MongoDB Atlas** (database), **Render** (backend, `render.yaml`),
**Vercel** (frontend, `vercel.json`) and **GitHub Actions** (reminders, `.github/workflows/scheduler.yml`).

1. **Atlas:** Network Access → allow `0.0.0.0/0` (Render's free plan has no fixed IP). Copy the connection string.
2. **Gmail app password** (for sign-up, reset and reminder emails): turn on 2-Step Verification, then create an
   app password at myaccount.google.com/apppasswords.
3. **Render:** New → Blueprint → this repo. Fill in `MONGODB_URI`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
   and `FRONTEND_URL` (your Vercel address). The service must be called `fluentday-api`, because
   `vercel.json` sends `/api` requests to `https://fluentday-api.onrender.com`.
4. **Vercel:** import this repo, leave **Root Directory** as `./` (`vercel.json` builds the `frontend` folder), no environment variables. Then put the
   Vercel address in Render's `FRONTEND_URL`.
5. **GitHub:** Settings → Secrets and variables → Actions → new secret `SCHEDULER_TOKEN`, with the value Render
   generated (Render → fluentday-api → Environment). Run the "Reminders" workflow once from the Actions tab.
6. **Content:** sign up with the admin email (`ADMIN_EMAILS`), then Admin → Vocabulary → **Load starter vocabulary**.

Notes:
- The free Render server sleeps after 15 minutes without requests; the scheduler job every 10 minutes keeps it
  awake. GitHub pauses scheduled jobs in repositories with no activity for 60 days; re-enable it in the Actions tab.
- Vercel limits the size of requests it forwards, so very large PDF uploads may fail through it.

## Roadmap

- [x] **Phase 1**: project setup, design system, landing page, responsive subscriber dashboard, navigation
- [ ] **Phase 2** (in progress: code written, backend not yet run or tested): MongoDB, authentication, admin dashboard, PDF upload and extraction
- [ ] **Phase 3** (in progress: code written, backend not yet run or tested): vocabulary database, daily seven-word generation, daily lesson UI
- [ ] **Phase 4** (in progress: code written, backend not yet run or tested): listening room, notebook, spaced revision
- [ ] **Phase 5** (in progress: code written, backend not yet run or tested): pronunciation, quizzes, analytics
- [ ] **Phase 6** (in progress: code written, backend not yet run or tested): reminders, security review (FluentDay is free: no payments)

## Security

Before going live:

- Set `ENVIRONMENT=production`, a long random `JWT_SECRET`, an HTTPS `FRONTEND_URL` and SMTP settings. The API refuses
  to start with an HTTPS `FRONTEND_URL` in development mode, and API docs (`/docs`) are off in production.
- Behind a reverse proxy, run uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy IP>` so rate limits see
  real client addresses, and cap request bodies at the proxy too.
- Learner data is always filtered by the logged-in user; admin routes require the admin role; vocabulary PDFs are
  only downloadable by admins. Confirming an email needs the sign-up password, and "Log out of all devices" in
  Settings ends every session.

## Data rules

The app never shows invented user data. Until daily lessons exist (Phase 3), the dashboard shows the
learner's real name with the true state of a brand-new account (zeros and empty states). `frontend/src/features/dashboard/useDashboardSummary.ts` is
the single place the dashboard API will be wired in.

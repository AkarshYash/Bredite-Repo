# 🚀 Team Profile Hub — Free Deployment Guide

Everything runs **100% free** using:
| Service | What it does | Free tier |
|---------|-------------|-----------|
| **Supabase** | PostgreSQL database + REST | 500 MB, unlimited API calls |
| **Vercel** | Host frontend + backend API | Unlimited static, 100 GB bandwidth |
| **GitHub** | Source control + CI/CD trigger | Free for public/private repos |

---

## STEP 1 — Set up Supabase (database)

1. Go to **https://supabase.com** → click **Start for free** → sign in with GitHub
2. Click **New project** → choose a name (e.g. `team-profile-hub`) → set a DB password → **Create project** (takes ~2 min)
3. Once ready, go to **SQL Editor** (left sidebar)
4. Click **New query** → paste the entire contents of `supabase_schema.sql` → click **Run**
   - This creates the `members` table + RLS policies + seeds all 6 members
5. Go to **Project Settings → API**
6. Copy:
   - **Project URL** → looks like `https://abcdefghij.supabase.co`
   - **anon / public key** → long JWT string starting with `eyJ...`
   - Keep these for Step 3

---

## STEP 2 — Push code to GitHub

1. Install Git if needed: https://git-scm.com/downloads
2. Open a terminal in your project root (`New folder`) and run:

```bash
git init
git add .
git commit -m "Initial commit – Team Profile Hub"
```

3. Go to **https://github.com/new** → create a new repository (private is fine) → copy the repo URL
4. Run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/team-profile-hub.git
git branch -M main
git push -u origin main
```

---

## STEP 3 — Deploy to Vercel (frontend + backend)

1. Go to **https://vercel.com** → sign in with GitHub (free)
2. Click **Add New → Project** → import your GitHub repo
3. Vercel auto-detects the `vercel.json` — leave all settings as-is
4. Under **Environment Variables**, add these 3 variables:

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | Your Project URL from Step 1 |
   | `SUPABASE_ANON_KEY` | Your anon key from Step 1 |
   | `FRONTEND_URL` | `https://YOUR-APP-NAME.vercel.app` (you'll update this after first deploy) |

5. Click **Deploy** → wait ~60 seconds
6. Vercel gives you a URL like `https://team-profile-hub-abc123.vercel.app`
7. Go back to Vercel → **Settings → Environment Variables** → update `FRONTEND_URL` to your real URL → **Redeploy**

---

## STEP 4 — Test it

Open your Vercel URL. You should see:
- ✅ The app loads with 6 pre-seeded members
- ✅ Footer shows **"Live – Supabase"** (green dot)
- ✅ Add, Edit, Delete all work and persist across page refreshes

---

## Local Development

### Backend
```bash
cd backend
cp .env.example .env          # fill in your Supabase creds
npm install
npm run dev                   # starts on http://localhost:3001
```

### Frontend
Just open `frontend/index.html` in your browser.  
The frontend auto-detects `localhost` and points to `http://localhost:3001/api`.

---

## Project Structure

```
New folder/
├── frontend/
│   ├── index.html        ← Full UI
│   ├── style.css         ← All styles (light + dark)
│   └── app.js            ← API calls, CRUD, render logic
│
├── backend/
│   ├── server.js         ← Express app entry point
│   ├── supabase.js       ← Supabase client
│   ├── defaultData.js    ← Seed data (used without DB)
│   ├── routes/
│   │   └── members.js    ← GET/POST/PUT/DELETE /api/members
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
├── supabase_schema.sql   ← Run once in Supabase SQL Editor
├── vercel.json           ← Vercel deployment config
├── package.json          ← Root scripts
├── .gitignore
└── DEPLOY.md             ← This file
```

---

## Adding Google Drive Links (Resume & DL)

For each member, you can store shareable Google Drive links:

1. Upload the file to Google Drive
2. Right-click → **Share** → **Anyone with the link** → **Copy link**
3. In the app, open the member → click **Edit** → paste the link into:
   - **Master Resume – Google Drive Link**
   - **Driver's License – Google Drive Link**
4. Click **Save Member**

The card and profile panel will show clickable **Resume** and **DL Scan** buttons.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Footer shows "Offline – cached" | Check Supabase URL/key in Vercel env vars, redeploy |
| CORS error in browser console | Make sure `FRONTEND_URL` env var matches your exact Vercel URL |
| `/api/health` returns 404 | Verify `vercel.json` is in the project root and was committed |
| Supabase "permission denied" | Re-run the schema SQL to recreate the RLS policy |

# ⚡ Quick Start - Enable Google Sign-In

## 3 Simple Steps (10 minutes total)

### 1️⃣ Create Supabase Account (3 min)
1. Go to: https://supabase.com
2. Sign in with GitHub
3. Create new project → Wait 2 minutes
4. SQL Editor → Paste `supabase_schema.sql` → Run
5. Copy **Project URL** and **anon key** from Settings → API

### 2️⃣ Setup Google OAuth (5 min)
1. Go to: https://console.cloud.google.com/
2. New Project → "Team Profile Hub"
3. APIs & Services → OAuth consent screen → External → Fill basic info
4. Credentials → Create OAuth Client ID → Web application
5. Add redirect URI: `https://YOUR_SUPABASE_URL.supabase.co/auth/v1/callback`
6. Copy **Client ID** and **Client Secret**
7. Go to Supabase → Authentication → Providers → Enable Google
8. Paste Client ID and Secret → Save

### 3️⃣ Update Your App (2 min)
1. Open `frontend/config.js`
2. Replace with your Supabase URL and anon key:
```javascript
window.SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGci...';
```
3. Commit and push:
```bash
git add .
git commit -m "feat: Enable Google OAuth"
git push
```
4. Update Vercel environment variables (Settings → Environment Variables):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FRONTEND_URL`
5. Redeploy

---

## ✅ Done!

Visit your live site → Click "Continue with Google" → It works! 🎉

**First login?** Make yourself ADMIN:
1. Supabase → Table Editor → profiles table
2. Find your email → Change role to `ADMIN` → Save
3. Refresh app → You're now admin!

---

**Full detailed guide:** See `GOOGLE_OAUTH_SETUP.md`

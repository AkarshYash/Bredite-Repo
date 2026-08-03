# Quick Start Guide - Authentication System

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Configure Supabase (Optional - for Google OAuth)

**Without Supabase**: The system works with email/password in demo mode.

**With Supabase** (for real Google OAuth):

1. Go to https://supabase.com and create a free account
2. Create a new project (takes ~2 minutes)
3. Get your credentials from **Project Settings → API**:
   - Project URL
   - Anon public key

4. Update `frontend/config.js`:
   ```javascript
   window.SUPABASE_URL = 'https://your-project.supabase.co';
   window.SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```

5. Update `backend/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   PORT=3001
   ```

6. Run SQL schema in Supabase **SQL Editor**:
   - Copy contents of `supabase_schema.sql`
   - Paste in Supabase Dashboard → SQL Editor
   - Click "Run"

7. Enable Google OAuth in Supabase:
   - Go to **Authentication → Providers → Google**
   - Enable Google provider
   - Add redirect URL: `http://localhost:3001/auth-callback`

### Step 3: Start the Server
```bash
npm start
```

Server runs on: http://localhost:3001

### Step 4: Test the System

Open your browser to: **http://localhost:3001/auth.html**

#### Test Login (Email/Password):
- Click "Create Account"
- Enter:
  - Name: Your Name
  - Email: test@example.com
  - Password: Test@1234
  - Check "I agree to Terms"
- Click "Create Account"
- You'll be redirected to dashboard

#### Test Google OAuth (if configured):
- Click "Continue with Google"
- Select your Google account
- You'll be redirected to the dashboard

#### Test Admin Account:
- Email: `chaturvediakarsh51@gmail.com`
- Password: `Jaipur@777`
- This account has ADMIN role

### Step 5: Explore Features

After logging in, visit:
- **Dashboard**: http://localhost:3001/
- **Profile Settings**: http://localhost:3001/profile.html

In Profile Settings, you can:
- ✅ Upload and crop profile image
- ✅ Edit name, phone, bio
- ✅ Verify email with OTP
- ✅ Verify phone with OTP (needs Twilio)
- ✅ Change password
- ✅ Enable 2FA (scan QR with Google Authenticator)
- ✅ View login history
- ✅ Manage active sessions
- ✅ Switch between 7 beautiful themes

---

## 🎨 Theme Switcher

Click on any colored circle on the auth page to switch themes:
- 🟣 **Barney** (default) - Purple gradient
- ⚫ **Slate** - Dark gray
- 🌸 **Candy** - Pink/Orange
- 🔥 **Firewatch** - Orange/Red
- 🍋 **Citrus** - Green/Lime
- 🌊 **Marsh** - Teal/Cyan
- ❄️ **Frost** - Blue/Purple

---

## 🔧 Optional: Enable Phone OTP (Twilio)

1. Sign up at https://www.twilio.com (free trial)
2. Get your credentials
3. Add to `backend/.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

---

## 🐛 Troubleshooting

### Google OAuth not working?
- Check that `frontend/config.js` has correct Supabase credentials
- Verify redirect URL in Supabase: Authentication → URL Configuration
- Make sure Google provider is enabled in Supabase

### "Cannot connect to database"?
- Make sure you ran `supabase_schema.sql` in Supabase SQL Editor
- Check that backend `.env` has correct SUPABASE_URL and keys

### Port 3001 already in use?
- Change PORT in `backend/.env` to different number (e.g., 3002)
- Or kill the process using port 3001

---

## 📝 What Works WITHOUT Supabase

Without configuring Supabase, you still get:
- ✅ Beautiful UI with 7 themes
- ✅ Email/password signup/login (demo mode)
- ✅ Profile management
- ✅ Image cropping and upload
- ✅ Form validation
- ✅ Password strength indicator
- ❌ Google OAuth (requires Supabase)
- ❌ OTP verification (requires SMTP/Twilio)
- ❌ 2FA (requires database)

---

## 🎯 Next Steps

1. **Deploy to Production**:
   - Deploy backend to Vercel/Railway/Render
   - Update `FRONTEND_URL` in .env
   - Update redirect URLs in Supabase

2. **Customize**:
   - Change theme colors in `frontend/auth.css`
   - Add your logo to `<div class="form-logo">`
   - Customize email templates

3. **Add More Features**:
   - Social login (GitHub, Apple)
   - Password reset flow
   - Email templates
   - Account deletion

---

## 📚 Documentation

See `AUTHENTICATION_SYSTEM.md` for:
- Complete feature list
- API endpoints reference
- Database schema
- Full testing checklist
- Deployment guide

---

**Need Help?** Check the console for detailed error messages.

**Status**: ✅ System is ready to use!

# 🔐 Google Sign-In Setup Guide

## Complete Step-by-Step Instructions

This guide will help you enable **real Google OAuth login** for your Team Profile Hub so users can sign in with their Google accounts from any device.

---

## 📋 What You'll Get After Setup

✅ **"Continue with Google" button works on all devices**  
✅ Users can sign up/login with their real Google account  
✅ User data is saved in Supabase database  
✅ Admin can approve new users and manage roles  
✅ Normal users can propose edits (requires admin approval)  
✅ Admins can approve/reject changes instantly  

---

## ⏱️ Total Time: ~10-15 minutes

You'll need:
- A Google account
- A Supabase account (free)
- Access to your Vercel deployment

---

## PART 1: Create Supabase Project (5 minutes)

### Step 1.1: Sign up for Supabase

1. Go to: **https://supabase.com**
2. Click **"Start your project"** (top right)
3. Sign in with **GitHub** (recommended) or email
4. You'll see your Dashboard

### Step 1.2: Create a New Project

1. Click **"New Project"** (green button)
2. Choose your organization (or create one)
3. Fill in the project details:
   - **Name:** `team-profile-hub` (or any name)
   - **Database Password:** Create a strong password (save it!)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free (2 projects free forever)
4. Click **"Create new project"**
5. Wait 2-3 minutes for project initialization

### Step 1.3: Run Database Migration

1. Once project is ready, click **"SQL Editor"** in left sidebar
2. Click **"New query"** button
3. Open your `supabase_schema.sql` file from this project
4. Copy the ENTIRE file content
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Ctrl/Cmd + Enter)
7. You should see: ✅ **"Success. No rows returned"**

### Step 1.4: Get Your Supabase Credentials

1. Click **"Project Settings"** (gear icon in left sidebar)
2. Click **"API"** in the settings menu
3. You'll see two important values:

   📋 **Copy these:**
   - **Project URL** → e.g., `https://xyzabcdefg.supabase.co`
   - **anon / public** key → Long string starting with `eyJhbG...`

4. Keep this tab open - you'll need these values later!

---

## PART 2: Configure Google OAuth (7 minutes)

### Step 2.1: Create Google Cloud Project

1. Open new tab: **https://console.cloud.google.com/**
2. Sign in with your Google account
3. Click **"Select a project"** dropdown (top left)
4. Click **"New Project"** (top right of popup)
5. Fill in:
   - **Project name:** `Team Profile Hub`
   - **Location:** No organization (leave as is)
6. Click **"Create"**
7. Wait 30 seconds for project creation
8. Click **"SELECT PROJECT"** when it appears

### Step 2.2: Configure OAuth Consent Screen

1. In left menu, click **"APIs & Services"**
2. Click **"OAuth consent screen"**
3. Choose **"External"** (so anyone can sign in)
4. Click **"Create"**
5. Fill in **App information:**
   - **App name:** `Team Profile Hub`
   - **User support email:** Select your email from dropdown
   - **App logo:** (optional, skip for now)
6. Scroll down to **Developer contact information:**
   - **Email addresses:** Enter your email
7. Click **"Save and Continue"**
8. **Scopes page:** Just click **"Save and Continue"** (no changes needed)
9. **Test users page:** Click **"Save and Continue"** (no changes needed)
10. **Summary page:** Click **"Back to Dashboard"**

### Step 2.3: Create OAuth Credentials

1. In left menu, click **"Credentials"**
2. Click **"+ Create Credentials"** (top)
3. Choose **"OAuth client ID"**
4. Select **"Web application"**
5. Fill in:
   - **Name:** `Supabase Auth`
6. Under **"Authorized JavaScript origins"**, click **"+ Add URI"**:
   - Add: `https://YOUR_PROJECT_ID.supabase.co`
   - ⚠️ **Replace `YOUR_PROJECT_ID` with your actual Supabase URL** (from Step 1.4)
   - Example: `https://xyzabcdefg.supabase.co`
7. Under **"Authorized redirect URIs"**, click **"+ Add URI"**:
   - Add: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
   - ⚠️ **Again, use your actual Supabase URL**
   - Example: `https://xyzabcdefg.supabase.co/auth/v1/callback`
8. Click **"Create"**

### Step 2.4: Save OAuth Credentials

You'll see a popup with:
- **Your Client ID** → `123456789-abc123.apps.googleusercontent.com`
- **Your Client Secret** → `GOCSPX-aBc123DeF456`

📋 **Copy both values!** Keep this window open.

### Step 2.5: Enable Google Provider in Supabase

1. Go back to your **Supabase Dashboard**
2. Click **"Authentication"** in left sidebar
3. Click **"Providers"** tab
4. Find **"Google"** in the list
5. Click the toggle to **enable it** (turns green)
6. You'll see two fields:
   - **Client ID (OAuth):** Paste your Google Client ID here
   - **Client Secret (OAuth):** Paste your Google Client Secret here
7. Scroll down, click **"Save"**

---

## PART 3: Configure Your Frontend (2 minutes)

### Step 3.1: Update config.js

1. Open `frontend/config.js` in your code editor
2. Replace the placeholder values:

```javascript
// Replace with YOUR actual values from Supabase (Step 1.4)
window.SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...';
```

3. **Save the file**

### Step 3.2: Update Vercel Environment Variables

1. Go to: **https://vercel.com/dashboard**
2. Select your project: **us-data-store-grid**
3. Click **"Settings"** tab (top)
4. Click **"Environment Variables"** (left sidebar)
5. Add these variables:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | Your Project URL (e.g., `https://xyz.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your anon key (the long JWT string) |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Get this from Supabase → Project Settings → API → `service_role` key |
| `FRONTEND_URL` | Your Vercel URL (e.g., `https://us-data-store-grid.vercel.app`) |

6. After adding all variables, click **"Redeploy"** (Deployments tab)

---

## PART 4: Test Google Sign-In (2 minutes)

### Step 4.1: Commit and Push Changes

```bash
git add .
git commit -m "feat: Configure Google OAuth with Supabase"
git push origin main
```

Vercel will auto-deploy (wait 30-60 seconds).

### Step 4.2: Test on Your Live Site

1. Go to: **https://us-data-store-grid.vercel.app/**
2. Click **"Sign In / Register"** button
3. Click **"Continue with Google"** button
4. You should see Google's account picker
5. Choose your Google account
6. Grant permissions
7. You'll be redirected back and logged in! 🎉

---

## 🎯 What Happens After Login?

### For New Users:
1. User clicks "Continue with Google"
2. Google authentication completes
3. Account is created with **PENDING** status
4. User sees banner: "Account Registration Pending Admin Approval"
5. User **cannot see member data** until approved

### For Admin (First-Time Setup):
1. You need to manually promote yourself to ADMIN first
2. Go to your **Supabase Dashboard**
3. Click **"Table Editor"** → **"profiles"** table
4. Find your email
5. Click on the **role** field → Change from `PENDING` to `ADMIN`
6. Click ✓ to save
7. Refresh the app - you're now ADMIN!

### Admin Can Now:
✅ View "User Roles & Approvals" tab  
✅ See all pending user registrations  
✅ Click "Approve as MEMBER" or "Approve as ADMIN"  
✅ Users can then access member data  

### Normal Users (MEMBER Role):
✅ Can view all consultant profiles  
✅ Can propose adding new members  
✅ Can propose editing existing members  
✅ Can propose deleting members  
❌ Changes don't go live until admin approves  

### Approval Workflow:
1. Member makes a change → Clicks "Submit for Approval"
2. Request goes to "Pending Approvals" tab
3. Admin sees the request with before/after diff
4. Admin clicks "Approve & Apply" → Change goes live
5. Or Admin clicks "Reject" → No change, member is notified

---

## 🔍 Troubleshooting

### "Google Auth Failed" Error

**Problem:** OAuth credentials not configured correctly

**Fix:**
1. Check Google Cloud Console → Credentials
2. Verify **Authorized redirect URIs** includes:
   - `https://YOUR_SUPABASE_URL.supabase.co/auth/v1/callback`
3. Make sure URI is **exact** (no trailing slash)

### "Sign-In with Google" Opens Mock Popup

**Problem:** Frontend can't find Supabase credentials

**Fix:**
1. Check `frontend/config.js` has correct values
2. Verify you committed and pushed changes
3. Check Vercel deployment includes updated config.js
4. Clear browser cache and reload

### Users Stay in PENDING Forever

**Problem:** No admin account exists

**Fix:**
1. Go to Supabase → Table Editor → profiles
2. Find your email
3. Change role to `ADMIN`
4. Save
5. Refresh app

### Database Errors / "Permission Denied"

**Problem:** SQL migration not run

**Fix:**
1. Go to Supabase → SQL Editor
2. Copy entire `supabase_schema.sql`
3. Paste and Run
4. Check for any error messages

---

## 📱 Testing on Different Devices

Once configured, Google Sign-In will work on:
- ✅ Desktop browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Android Chrome)
- ✅ Tablets
- ✅ Any device with internet connection

**To test:**
1. Open the live URL on any device
2. Click "Continue with Google"
3. Sign in with any Google account
4. Account will be created and await admin approval

---

## 🎉 Success Checklist

After completing this guide, you should have:

- ✅ Supabase project created with database tables
- ✅ Google OAuth credentials configured
- ✅ Google provider enabled in Supabase
- ✅ Frontend config.js updated with Supabase credentials
- ✅ Vercel environment variables set
- ✅ Changes committed and deployed
- ✅ Google Sign-In button working on live site
- ✅ At least one ADMIN account created
- ✅ User approval workflow functional
- ✅ Proposal approval workflow functional

---

## 🆘 Need Help?

If you're stuck, check:

1. **Supabase Dashboard → Logs** - See authentication attempts
2. **Browser Console (F12)** - Check for JavaScript errors
3. **Vercel Deployment Logs** - See backend errors
4. **Google Cloud Console → Credentials** - Verify redirect URIs

Common issues are always related to:
- Wrong redirect URI in Google credentials
- Missing environment variables in Vercel
- Config.js not updated with real credentials
- No admin account created in database

---

## 📚 Additional Resources

- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Google OAuth Setup: https://console.cloud.google.com/
- Vercel Deployment: https://vercel.com/docs

---

**You're all set! Your Team Profile Hub now has full Google OAuth authentication working on all devices! 🚀**

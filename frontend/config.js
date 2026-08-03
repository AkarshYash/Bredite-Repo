/**
 * Supabase Configuration for Google OAuth
 * 
 * TO ENABLE GOOGLE SIGN-IN:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Go to Project Settings → API
 * 3. Copy your Project URL and anon/public key
 * 4. Replace the values below with your actual credentials
 * 5. Enable Google provider in Supabase Dashboard → Authentication → Providers
 */

// ⚠️ IMPORTANT: Replace these with your actual Supabase credentials
window.SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';  // e.g., 'https://abcdefgh.supabase.co'
window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Long JWT starting with 'eyJ...'

// For testing/demo mode, leave them as is - the app will use fallback auth

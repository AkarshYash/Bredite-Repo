const { createClient } = require('@supabase/supabase-js');

const url        = process.env.SUPABASE_URL;
const key        = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || key;

if (!url || !key) {
  console.warn('[WARN] SUPABASE_URL or SUPABASE_ANON_KEY not set – running in demo mode with in-memory data.');
}

const supabase = url && key ? createClient(url, key) : null;
const supabaseAdmin = url && serviceKey ? createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
}) : supabase;

module.exports = {
  supabase,
  supabaseAdmin
};

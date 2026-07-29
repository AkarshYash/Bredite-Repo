const { createClient } = require('@supabase/supabase-js');

const url  = process.env.SUPABASE_URL;
const key  = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('[WARN] SUPABASE_URL or SUPABASE_ANON_KEY not set – running in demo mode with in-memory data.');
}

const supabase = url && key ? createClient(url, key) : null;

module.exports = supabase;

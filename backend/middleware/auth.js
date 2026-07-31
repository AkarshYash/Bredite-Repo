const { supabase } = require('../supabase');
const store = require('../store');

async function extractUserAndProfile(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  // 1. Mock token check for testing / demo mode
  if (token === 'mock-admin-token') {
    const adminProf = store.getMemProfiles().find(p => p.role === 'ADMIN') || {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@teamprofilehub.com',
      name: 'System Admin',
      role: 'ADMIN'
    };
    return { user: { id: adminProf.id, email: adminProf.email }, profile: adminProf };
  }
  if (token === 'mock-member-token') {
    const memberProf = store.getMemProfiles().find(p => p.role === 'MEMBER') || {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'member@teamprofilehub.com',
      name: 'Demo Member',
      role: 'MEMBER'
    };
    return { user: { id: memberProf.id, email: memberProf.email }, profile: memberProf };
  }

  // 2. Supabase Auth JWT verification
  if (supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return null;

      // Fetch profile from database
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const userProfile = profile || {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split('@')[0],
        role: 'MEMBER'
      };

      return { user, profile: userProfile };
    } catch (e) {
      console.warn('[AUTH] Error verifying token:', e.message);
      return null;
    }
  }

  // 3. Fallback mock token decoder if Supabase is offline
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (decoded && decoded.email) {
      const existing = store.getMemProfiles().find(p => p.email === decoded.email);
      const prof = existing || {
        id: decoded.id || 'mock-id-' + Date.now(),
        email: decoded.email,
        name: decoded.name || decoded.email.split('@')[0],
        role: decoded.role || 'MEMBER'
      };
      return { user: { id: prof.id, email: prof.email }, profile: prof };
    }
  } catch (_) {}

  return null;
}

async function optionalAuth(req, res, next) {
  try {
    const authData = await extractUserAndProfile(req);
    if (authData) {
      req.user = authData.user;
      req.profile = authData.profile;
    } else {
      req.user = null;
      req.profile = { role: 'GUEST', email: '', name: 'Guest' };
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAuth(req, res, next) {
  try {
    const authData = await extractUserAndProfile(req);
    if (!authData || !authData.user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.user = authData.user;
    req.profile = authData.profile;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAdmin(req, res, next) {
  try {
    const authData = await extractUserAndProfile(req);
    if (!authData || !authData.user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    if (authData.profile?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    req.user = authData.user;
    req.profile = authData.profile;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  extractUserAndProfile,
  optionalAuth,
  requireAuth,
  requireAdmin
};

const express = require('express');
const router  = express.Router();
const rateLimit = require('express-rate-limit');
const { supabase, supabaseAdmin } = require('../supabase');
const { requireAuth } = require('../middleware/auth');
const store = require('../store');

// ── Strict Rate Limiting on Auth Endpoints ────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

router.use('/signup', authLimiter);
router.use('/login', authLimiter);
router.use('/google', authLimiter);

// Helper to determine initial role (pre-approved vs pending)
function getInitialRole(email) {
  const clean = (email || '').toLowerCase();
  if (clean === 'admin@teamprofilehub.com') return 'ADMIN';
  if (clean === 'member@teamprofilehub.com') return 'MEMBER';
  if (clean === 'chaturvediakarsh51@gmail.com') return 'ADMIN'; // Pre-approved admin account
  return 'PENDING'; // New user registrations start as PENDING for Admin approval
}

// ── POST /api/auth/signup ─────────────────────────────────────────────
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName  = (name || '').trim() || cleanEmail.split('@')[0];
    const initialRole = getInitialRole(cleanEmail);

    // Supabase Auth Signup
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: cleanName }
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const user = data.user;
      if (!user) {
        return res.status(400).json({ error: 'User registration failed.' });
      }

      // Ensure profile exists in database with initialRole
      let profile = null;
      if (supabaseAdmin) {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profData) {
          const { data: newProf } = await supabaseAdmin
            .from('profiles')
            .insert([{ id: user.id, email: cleanEmail, name: cleanName, role: initialRole }])
            .select()
            .single();
          profile = newProf;
        } else {
          profile = profData;
        }

        // Write audit log
        await supabaseAdmin.from('audit_log').insert([{
          action_type: 'user_signup',
          actor: cleanEmail,
          target_record: user.id,
          after_value: { email: cleanEmail, name: cleanName, role: profile?.role || initialRole }
        }]);
      }

      return res.status(201).json({
        message: initialRole === 'PENDING'
          ? 'Registration received! Your account is pending Admin approval.'
          : 'Registration successful!',
        session: data.session,
        user,
        profile: profile || { id: user.id, email: cleanEmail, name: cleanName, role: initialRole }
      });
    }

    // Offline / Fallback signup mode
    const existing = store.getMemProfiles().find(p => p.email === cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const userId = 'user-' + Date.now();
    const mockProfile = {
      id: userId,
      email: cleanEmail,
      name: cleanName,
      role: initialRole,
      created_at: new Date().toISOString()
    };
    store.getMemProfiles().push(mockProfile);

    const mockToken = Buffer.from(JSON.stringify(mockProfile)).toString('base64');
    store.logAuditInMemory('user_signup', cleanEmail, userId, null, { email: cleanEmail, role: initialRole });

    return res.status(201).json({
      message: initialRole === 'PENDING'
        ? 'Registration received! Your account is pending Admin approval.'
        : 'Registration successful!',
      session: { access_token: mockToken, token_type: 'bearer' },
      user: { id: userId, email: cleanEmail },
      profile: mockProfile
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Supabase Auth Login
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const user = data.user;
      let profile = null;

      if (supabaseAdmin) {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        profile = profData;

        // Write audit log
        await supabaseAdmin.from('audit_log').insert([{
          action_type: 'user_login',
          actor: cleanEmail,
          target_record: user.id
        }]);
      }

      return res.json({
        message: 'Login successful!',
        session: data.session,
        user,
        profile: profile || { id: user.id, email: user.email, role: getInitialRole(cleanEmail) }
      });
    }

    // Offline / Fallback login mode
    const profile = store.getMemProfiles().find(p => p.email === cleanEmail);
    if (!profile) {
      return res.status(401).json({ error: 'Invalid email or password (user not found).' });
    }

    const mockToken = Buffer.from(JSON.stringify(profile)).toString('base64');
    store.logAuditInMemory('user_login', cleanEmail, profile.id);

    return res.json({
      message: 'Login successful!',
      session: { access_token: mockToken, token_type: 'bearer' },
      user: { id: profile.id, email: profile.email },
      profile
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/google ─────────────────────────────────────────────
router.post('/google', async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Google email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName  = (name || '').trim() || cleanEmail.split('@')[0];

    // Check if profile exists
    let profile = store.getMemProfiles().find(p => p.email === cleanEmail);
    if (!profile) {
      const initialRole = getInitialRole(cleanEmail);
      const userId = 'google-user-' + Date.now();
      profile = {
        id: userId,
        email: cleanEmail,
        name: cleanName,
        role: initialRole,
        created_at: new Date().toISOString()
      };
      store.getMemProfiles().push(profile);
      store.logAuditInMemory('user_google_signup', cleanEmail, userId, null, { email: cleanEmail, role: initialRole });
    } else {
      store.logAuditInMemory('user_google_login', cleanEmail, profile.id);
    }

    const mockToken = Buffer.from(JSON.stringify(profile)).toString('base64');

    return res.json({
      message: profile.role === 'PENDING'
        ? 'Google sign-in received! Account is pending Admin approval.'
        : 'Google sign-in successful!',
      session: { access_token: mockToken, token_type: 'bearer' },
      user: { id: profile.id, email: cleanEmail },
      profile
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: req.user,
    profile: req.profile
  });
});

module.exports = router;

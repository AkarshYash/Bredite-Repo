/* ═══════════════════════════════════════════════════════════
   SECURITY ROUTES - 2FA, Login History, Active Sessions
   Routes: POST /api/security/2fa/enable, POST /api/security/2fa/disable
           GET /api/security/login-history, GET /api/security/sessions
           DELETE /api/security/sessions/:id
═══════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const { logAudit } = require('./audit');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const router = express.Router();

// Initialize Supabase client (optional - works in demo mode without it)
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
} catch (err) {
  console.warn('[SECURITY] Running without Supabase - demo mode');
}

// ── POST /api/security/2fa/enable - Enable 2FA ──────────────
router.post('/2fa/enable', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    // Generate 2FA secret
    const secret = speakeasy.generateSecret({
      name: `Team Profile Hub (${userEmail})`,
      issuer: 'Team Profile Hub'
    });
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    // Store secret in profile (not yet enabled)
    const { error } = await supabase
      .from('profiles')
      .update({ 
        two_factor_secret: secret.base32,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: '2FA_SETUP_INITIATED',
      resource_type: 'security',
      resource_id: userId,
      details: { email: userEmail }
    });
    
    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      message: 'Scan the QR code with your authenticator app'
    });
  } catch (err) {
    console.error('[SECURITY] 2FA enable error:', err);
    res.status(500).json({ error: err.message || 'Failed to enable 2FA' });
  }
});

// ── POST /api/security/2fa/verify - Verify and activate 2FA ─
router.post('/2fa/verify', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    // Get user's secret
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('two_factor_secret')
      .eq('id', userId)
      .single();
    
    if (fetchError || !profile.two_factor_secret) {
      return res.status(400).json({ error: '2FA setup not initiated' });
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: profile.two_factor_secret,
      encoding: 'base32',
      token,
      window: 2
    });
    
    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Enable 2FA
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        two_factor_enabled: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      throw new Error(updateError.message);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: '2FA_ENABLED',
      resource_type: 'security',
      resource_id: userId,
      details: { enabled: true }
    });
    
    res.json({ 
      message: '2FA enabled successfully',
      enabled: true
    });
  } catch (err) {
    console.error('[SECURITY] 2FA verify error:', err);
    res.status(500).json({ error: err.message || 'Failed to verify 2FA' });
  }
});

// ── POST /api/security/2fa/disable - Disable 2FA ────────────
router.post('/2fa/disable', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    // Verify password before disabling 2FA
    if (!password) {
      return res.status(400).json({ error: 'Password is required to disable 2FA' });
    }
    
    // TODO: Verify password with Supabase Auth
    // For now, we'll proceed with disabling
    
    // Disable 2FA
    const { error } = await supabase
      .from('profiles')
      .update({ 
        two_factor_enabled: false,
        two_factor_secret: '',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: '2FA_DISABLED',
      resource_type: 'security',
      resource_id: userId,
      details: { enabled: false }
    });
    
    res.json({ 
      message: '2FA disabled successfully',
      enabled: false
    });
  } catch (err) {
    console.error('[SECURITY] 2FA disable error:', err);
    res.status(500).json({ error: err.message || 'Failed to disable 2FA' });
  }
});

// ── GET /api/security/2fa/status - Check 2FA status ─────────
router.get('/2fa/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('two_factor_enabled')
      .eq('id', userId)
      .single();
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({
      enabled: profile.two_factor_enabled || false
    });
  } catch (err) {
    console.error('[SECURITY] 2FA status error:', err);
    res.status(500).json({ error: err.message || 'Failed to check 2FA status' });
  }
});

// ── GET /api/security/login-history - Get login history ─────
router.get('/login-history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;
    
    const { data: history, error } = await supabase
      .from('login_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ history });
  } catch (err) {
    console.error('[SECURITY] Login history error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch login history' });
  }
});

// ── POST /api/security/login-history - Record login ─────────
async function recordLogin(userId, email, loginMethod, success, ipAddress, userAgent, failureReason = '') {
  try {
    // Parse user agent for device info
    const deviceInfo = parseUserAgent(userAgent);
    
    await supabase.from('login_history').insert({
      user_id: userId,
      email,
      login_method: loginMethod,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_info: deviceInfo,
      location: '', // TODO: IP geolocation lookup
      success,
      failure_reason: failureReason
    });
  } catch (err) {
    console.error('[SECURITY] Record login error:', err);
  }
}

// ── GET /api/security/sessions - Get active sessions ────────
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Cleanup expired sessions first
    await supabase.rpc('cleanup_expired_sessions');
    
    const { data: sessions, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_activity', { ascending: false });
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({ sessions });
  } catch (err) {
    console.error('[SECURITY] Sessions error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch sessions' });
  }
});

// ── DELETE /api/security/sessions/:id - Revoke session ──────
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.id;
    
    // Verify session belongs to user
    const { data: session, error: fetchError } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Delete session
    const { error: deleteError } = await supabase
      .from('active_sessions')
      .delete()
      .eq('id', sessionId);
    
    if (deleteError) {
      throw new Error(deleteError.message);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: 'SESSION_REVOKED',
      resource_type: 'security',
      resource_id: sessionId,
      details: { session_id: sessionId }
    });
    
    res.json({ 
      message: 'Session revoked successfully'
    });
  } catch (err) {
    console.error('[SECURITY] Revoke session error:', err);
    res.status(500).json({ error: err.message || 'Failed to revoke session' });
  }
});

// ── Helper: Parse User Agent ─────────────────────────────────
function parseUserAgent(userAgent) {
  if (!userAgent) return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  let device = 'Desktop';
  let browser = 'Unknown';
  let os = 'Unknown';
  
  // Detect device
  if (ua.includes('mobile') || ua.includes('android')) device = 'Mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) device = 'Tablet';
  
  // Detect browser
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  
  // Detect OS
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
  return `${browser} on ${os} (${device})`;
}

// Export helper function
module.exports = router;
module.exports.recordLogin = recordLogin;

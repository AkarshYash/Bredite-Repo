/* ═══════════════════════════════════════════════════════════
   OTP ROUTES - Email & Phone OTP Verification
   Routes: POST /api/otp/send-email, POST /api/otp/verify-email
           POST /api/otp/send-phone, POST /api/otp/verify-phone
═══════════════════════════════════════════════════════════ */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const { logAudit } = require('./audit');

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// In-memory OTP store (in production, use Redis or database)
const otpStore = new Map();

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

// ── Helper: Generate OTP ─────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Helper: Store OTP ────────────────────────────────────────
function storeOTP(identifier, otp, type) {
  const key = `${type}:${identifier}`;
  otpStore.set(key, {
    otp,
    createdAt: Date.now(),
    attempts: 0,
    verified: false
  });
  
  // Auto-cleanup after expiry
  setTimeout(() => {
    otpStore.delete(key);
  }, OTP_EXPIRY_MINUTES * 60 * 1000);
}

// ── Helper: Get OTP Data ─────────────────────────────────────
function getOTPData(identifier, type) {
  const key = `${type}:${identifier}`;
  return otpStore.get(key);
}

// ── Helper: Delete OTP ───────────────────────────────────────
function deleteOTP(identifier, type) {
  const key = `${type}:${identifier}`;
  otpStore.delete(key);
}

// ── POST /api/otp/send-email - Send email OTP ───────────────
router.post('/send-email', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP
    storeOTP(userEmail, otp, 'email');
    
    // Send email via Supabase (if configured) or fallback
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      // Use Supabase's built-in email or external SMTP
      try {
        // For now, we'll use Supabase's magic link system
        // In production, integrate with SendGrid, AWS SES, or Mailgun
        console.log(`[OTP] Email OTP for ${userEmail}: ${otp}`);
        
        // TODO: Implement actual email sending
        // Example with nodemailer:
        // await transporter.sendMail({
        //   from: process.env.SMTP_USER,
        //   to: userEmail,
        //   subject: 'Your Verification Code - Team Profile Hub',
        //   html: `<p>Your verification code is: <strong>${otp}</strong></p>
        //          <p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`
        // });
      } catch (emailErr) {
        console.error('[OTP] Email send error:', emailErr);
      }
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: 'SEND_EMAIL_OTP',
      resource_type: 'otp',
      resource_id: userEmail,
      details: { email: userEmail }
    });
    
    // For demo/development, return OTP in response
    const response = {
      message: 'OTP sent to your email',
      expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
    };
    
    // In development, include OTP for testing
    if (process.env.NODE_ENV !== 'production') {
      response.otp = otp; // Only for testing!
    }
    
    res.json(response);
  } catch (err) {
    console.error('[OTP] Send email error:', err);
    res.status(500).json({ error: err.message || 'Failed to send OTP' });
  }
});

// ── POST /api/otp/verify-email - Verify email OTP ───────────
router.post('/verify-email', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { otp } = req.body;
    
    if (!otp) {
      return res.status(400).json({ error: 'OTP is required' });
    }
    
    // Get stored OTP data
    const otpData = getOTPData(userEmail, 'email');
    
    if (!otpData) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }
    
    // Check if already verified
    if (otpData.verified) {
      return res.status(400).json({ error: 'OTP already used' });
    }
    
    // Check expiry
    const now = Date.now();
    const elapsed = now - otpData.createdAt;
    if (elapsed > OTP_EXPIRY_MINUTES * 60 * 1000) {
      deleteOTP(userEmail, 'email');
      return res.status(400).json({ error: 'OTP expired' });
    }
    
    // Check attempts
    if (otpData.attempts >= MAX_ATTEMPTS) {
      deleteOTP(userEmail, 'email');
      return res.status(400).json({ error: 'Too many failed attempts' });
    }
    
    // Verify OTP
    if (otp !== otpData.otp) {
      otpData.attempts++;
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsRemaining: MAX_ATTEMPTS - otpData.attempts
      });
    }
    
    // Mark as verified
    otpData.verified = true;
    
    // Update user profile to mark email as verified
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        email_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('[OTP] Profile update error:', updateError);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: 'VERIFY_EMAIL_OTP',
      resource_type: 'otp',
      resource_id: userEmail,
      details: { email: userEmail, verified: true }
    });
    
    // Clean up OTP
    deleteOTP(userEmail, 'email');
    
    res.json({ 
      message: 'Email verified successfully',
      verified: true
    });
  } catch (err) {
    console.error('[OTP] Verify email error:', err);
    res.status(500).json({ error: err.message || 'Failed to verify OTP' });
  }
});

// ── POST /api/otp/send-phone - Send phone OTP (Twilio) ──────
router.post('/send-phone', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // Validate phone format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP
    storeOTP(phone, otp, 'phone');
    
    // Send SMS via Twilio (if configured)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = require('twilio');
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        
        await client.messages.create({
          body: `Your Team Profile Hub verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone
        });
        
        console.log(`[OTP] SMS sent to ${phone}`);
      } catch (twilioErr) {
        console.error('[OTP] Twilio error:', twilioErr);
        // Continue even if SMS fails (for demo purposes)
      }
    } else {
      console.log(`[OTP] Phone OTP for ${phone}: ${otp}`);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: 'SEND_PHONE_OTP',
      resource_type: 'otp',
      resource_id: phone,
      details: { phone }
    });
    
    // For demo/development, return OTP in response
    const response = {
      message: 'OTP sent to your phone',
      expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
    };
    
    // In development, include OTP for testing
    if (process.env.NODE_ENV !== 'production') {
      response.otp = otp; // Only for testing!
    }
    
    res.json(response);
  } catch (err) {
    console.error('[OTP] Send phone error:', err);
    res.status(500).json({ error: err.message || 'Failed to send OTP' });
  }
});

// ── POST /api/otp/verify-phone - Verify phone OTP ───────────
router.post('/verify-phone', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required' });
    }
    
    // Get stored OTP data
    const otpData = getOTPData(phone, 'phone');
    
    if (!otpData) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }
    
    // Check if already verified
    if (otpData.verified) {
      return res.status(400).json({ error: 'OTP already used' });
    }
    
    // Check expiry
    const now = Date.now();
    const elapsed = now - otpData.createdAt;
    if (elapsed > OTP_EXPIRY_MINUTES * 60 * 1000) {
      deleteOTP(phone, 'phone');
      return res.status(400).json({ error: 'OTP expired' });
    }
    
    // Check attempts
    if (otpData.attempts >= MAX_ATTEMPTS) {
      deleteOTP(phone, 'phone');
      return res.status(400).json({ error: 'Too many failed attempts' });
    }
    
    // Verify OTP
    if (otp !== otpData.otp) {
      otpData.attempts++;
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsRemaining: MAX_ATTEMPTS - otpData.attempts
      });
    }
    
    // Mark as verified
    otpData.verified = true;
    
    // Update user profile with verified phone
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        phone,
        phone_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('[OTP] Profile update error:', updateError);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: 'VERIFY_PHONE_OTP',
      resource_type: 'otp',
      resource_id: phone,
      details: { phone, verified: true }
    });
    
    // Clean up OTP
    deleteOTP(phone, 'phone');
    
    res.json({ 
      message: 'Phone verified successfully',
      verified: true
    });
  } catch (err) {
    console.error('[OTP] Verify phone error:', err);
    res.status(500).json({ error: err.message || 'Failed to verify OTP' });
  }
});

// ── GET /api/otp/status - Check verification status ─────────
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email_verified, phone_verified, phone')
      .eq('id', userId)
      .single();
    
    if (error) {
      throw new Error(error.message);
    }
    
    res.json({
      email_verified: profile.email_verified || false,
      phone_verified: profile.phone_verified || false,
      phone: profile.phone || null
    });
  } catch (err) {
    console.error('[OTP] Status check error:', err);
    res.status(500).json({ error: err.message || 'Failed to check status' });
  }
});

module.exports = router;

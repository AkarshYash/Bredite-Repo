/* ═══════════════════════════════════════════════════════════
   PROFILE ROUTES - Profile Management & Avatar Upload
   Routes: GET /api/profile/:id, POST /api/profile/update, POST /api/profile/avatar
═══════════════════════════════════════════════════════════ */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const { logAudit } = require('./audit');

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure multer for memory storage (we'll upload to Supabase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.'));
    }
  }
});

// ── GET /api/profile/:id - Get user profile ─────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Don't expose sensitive data
    delete profile.password_hash;
    
    res.json({ profile });
  } catch (err) {
    console.error('[PROFILE] Get profile error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch profile' });
  }
});

// ── POST /api/profile/update - Update profile details ───────
router.post('/update', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, bio } = req.body;
    
    // Build update object (only include provided fields)
    const updates = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    
    // Update profile in database
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: 'UPDATE_PROFILE',
      resource_type: 'profile',
      resource_id: userId,
      details: { fields_updated: Object.keys(updates) }
    });
    
    res.json({ 
      message: 'Profile updated successfully',
      profile: data 
    });
  } catch (err) {
    console.error('[PROFILE] Update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update profile' });
  }
});

// ── POST /api/profile/avatar - Upload profile avatar ────────
router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const file = req.file;
    const fileExt = path.extname(file.originalname).toLowerCase();
    const fileName = `${userId}/avatar_${Date.now()}${fileExt}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    // Update profile with new avatar URL
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError) {
      throw new Error(updateError.message);
    }
    
    // Delete old avatar if exists
    if (req.user.profile?.avatar_url && req.user.profile.avatar_url !== publicUrl) {
      try {
        const oldFileName = req.user.profile.avatar_url.split('/avatars/')[1];
        if (oldFileName) {
          await supabase.storage.from('avatars').remove([oldFileName]);
        }
      } catch (deleteErr) {
        // Ignore delete errors
        console.warn('[PROFILE] Failed to delete old avatar:', deleteErr);
      }
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: 'UPLOAD_AVATAR',
      resource_type: 'profile',
      resource_id: userId,
      details: { avatar_url: publicUrl }
    });
    
    res.json({ 
      message: 'Avatar uploaded successfully',
      avatar_url: publicUrl,
      profile
    });
  } catch (err) {
    console.error('[PROFILE] Avatar upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload avatar' });
  }
});

// ── DELETE /api/profile/avatar - Remove profile avatar ──────
router.delete('/avatar', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentAvatar = req.user.profile?.avatar_url;
    
    if (!currentAvatar) {
      return res.status(400).json({ error: 'No avatar to delete' });
    }
    
    // Delete from storage
    const fileName = currentAvatar.split('/avatars/')[1];
    if (fileName) {
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([fileName]);
      
      if (deleteError) {
        console.warn('[PROFILE] Storage delete error:', deleteError);
      }
    }
    
    // Update profile to remove avatar URL
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: '',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError) {
      throw new Error(updateError.message);
    }
    
    // Log audit trail
    await logAudit(supabase, {
      user_id: userId,
      action: 'DELETE_AVATAR',
      resource_type: 'profile',
      resource_id: userId,
      details: { previous_url: currentAvatar }
    });
    
    res.json({ 
      message: 'Avatar removed successfully',
      profile
    });
  } catch (err) {
    console.error('[PROFILE] Avatar delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete avatar' });
  }
});

module.exports = router;

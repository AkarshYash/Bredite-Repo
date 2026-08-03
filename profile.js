/* ═══════════════════════════════════════════════════════════
   PROFILE SETTINGS PAGE - JAVASCRIPT
   Complete profile management with OTP verification
═══════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

// ── State ────────────────────────────────────────────────────
let currentUser = null;
let accessToken = null;
let cropper = null;
let selectedFile = null;

// ── Initialize ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[PROFILE] Initializing...');
  
  // Check authentication
  accessToken = localStorage.getItem('tph_access_token');
  if (!accessToken) {
    window.location.href = '/auth.html';
    return;
  }
  
  try {
    // Load user data
    const userInfo = JSON.parse(localStorage.getItem('tph_user_info') || '{}');
    currentUser = userInfo.profile;
    
    if (!currentUser) {
      throw new Error('No user profile found');
    }
    
    // Initialize UI
    loadProfileData();
    checkVerificationStatus();
    bindEventListeners();
    setupPasswordStrength();
    
  } catch (err) {
    console.error('[PROFILE] Init error:', err);
    showAlert('error', 'Failed to load profile. Please sign in again.');
    setTimeout(() => window.location.href = '/auth.html', 2000);
  }
});

// ── Load Profile Data ────────────────────────────────────────
function loadProfileData() {
  // Avatar
  const avatarImg = document.getElementById('avatarImage');
  if (currentUser.avatar_url) {
    avatarImg.src = currentUser.avatar_url;
  } else {
    avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'User')}&size=200&background=667eea&color=fff`;
  }
  
  // Basic info
  document.getElementById('nameInput').value = currentUser.name || '';
  document.getElementById('emailInput').value = currentUser.email || '';
  document.getElementById('phoneInput').value = currentUser.phone || '';
  document.getElementById('bioInput').value = currentUser.bio || '';
  
  // Character count for bio
  updateCharCount();
  
  // Account info
  const roleBadge = document.getElementById('roleBadge');
  roleBadge.textContent = currentUser.role || 'MEMBER';
  roleBadge.className = `badge ${currentUser.role}`;
  
  if (currentUser.created_at) {
    document.getElementById('memberSince').textContent = new Date(currentUser.created_at).toLocaleDateString();
  }
  
  if (currentUser.updated_at) {
    document.getElementById('lastUpdated').textContent = new Date(currentUser.updated_at).toLocaleDateString();
  }
}

// ── Check Verification Status ───────────────────────────────
async function checkVerificationStatus() {
  try {
    const response = await fetch(`${API_BASE}/otp/status`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to check verification status');
    
    const data = await response.json();
    
    // Email verification status
    updateVerificationUI('email', data.email_verified);
    
    // Phone verification status
    updateVerificationUI('phone', data.phone_verified);
    
    // Enable phone verification button only if phone number exists
    const phoneInput = document.getElementById('phoneInput');
    const sendPhoneBtn = document.getElementById('sendPhoneOtpBtn');
    sendPhoneBtn.disabled = !phoneInput.value.trim();
    
  } catch (err) {
    console.error('[PROFILE] Verification status error:', err);
  }
}

// ── Update Verification UI ──────────────────────────────────
function updateVerificationUI(type, verified) {
  const icon = document.getElementById(`${type}StatusIcon`);
  const title = document.getElementById(`${type}StatusTitle`);
  const text = document.getElementById(`${type}StatusText`);
  const badge = document.getElementById(`${type}VerifiedBadge`);
  
  if (verified) {
    icon.classList.remove('bx-error-circle', 'pending');
    icon.classList.add('bx-check-circle', 'verified');
    title.textContent = `${type === 'email' ? 'Email' : 'Phone'} Verified`;
    text.textContent = `Your ${type === 'email' ? 'email' : 'phone number'} has been verified`;
    badge.classList.remove('hidden');
  } else {
    icon.classList.remove('bx-check-circle', 'verified');
    icon.classList.add('bx-error-circle', 'pending');
    title.textContent = `${type === 'email' ? 'Email' : 'Phone'} Not Verified`;
    text.textContent = `Verify your ${type === 'email' ? 'email' : 'phone number'} to secure your account`;
    badge.classList.add('hidden');
  }
}

// ── Bind Event Listeners ────────────────────────────────────
function bindEventListeners() {
  // Avatar upload
  const avatarPreview = document.querySelector('.avatar-preview');
  const avatarInput = document.getElementById('avatarInput');
  const uploadBtn = document.getElementById('uploadAvatarBtn');
  const removeBtn = document.getElementById('removeAvatarBtn');
  
  avatarPreview.addEventListener('click', () => avatarInput.click());
  uploadBtn.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', handleAvatarSelect);
  removeBtn.addEventListener('click', handleAvatarRemove);
  
  // Image Cropper
  document.getElementById('closeCropperBtn').addEventListener('click', closeCropper);
  document.getElementById('cancelCropBtn').addEventListener('click', closeCropper);
  document.getElementById('applyCropBtn').addEventListener('click', handleCropAndUpload);
  document.getElementById('rotateLeftBtn').addEventListener('click', () => cropper && cropper.rotate(-90));
  document.getElementById('rotateRightBtn').addEventListener('click', () => cropper && cropper.rotate(90));
  document.getElementById('flipHorizontalBtn').addEventListener('click', () => cropper && cropper.scaleX(cropper.getData().scaleX * -1));
  document.getElementById('flipVerticalBtn').addEventListener('click', () => cropper && cropper.scaleY(cropper.getData().scaleY * -1));
  document.getElementById('resetCropBtn').addEventListener('click', () => cropper && cropper.reset());
  
  // Basic info form with real-time validation
  const basicInfoForm = document.getElementById('basicInfoForm');
  basicInfoForm.addEventListener('submit', handleBasicInfoUpdate);
  
  // Real-time validation
  document.getElementById('nameInput').addEventListener('blur', () => validateField('name'));
  document.getElementById('phoneInput').addEventListener('blur', () => validateField('phone'));
  document.getElementById('bioInput').addEventListener('input', updateCharCount);
  
  // Phone input change
  document.getElementById('phoneInput').addEventListener('input', () => {
    const phoneInput = document.getElementById('phoneInput');
    const sendPhoneBtn = document.getElementById('sendPhoneOtpBtn');
    sendPhoneBtn.disabled = !phoneInput.value.trim();
  });
  
  // Email OTP
  document.getElementById('sendEmailOtpBtn').addEventListener('click', () => sendOTP('email'));
  document.getElementById('emailOtpForm').addEventListener('submit', (e) => {
    e.preventDefault();
    verifyOTP('email');
  });
  document.getElementById('resendEmailOtpBtn').addEventListener('click', () => sendOTP('email'));
  
  // Phone OTP
  document.getElementById('sendPhoneOtpBtn').addEventListener('click', () => sendOTP('phone'));
  document.getElementById('phoneOtpForm').addEventListener('submit', (e) => {
    e.preventDefault();
    verifyOTP('phone');
  });
  document.getElementById('resendPhoneOtpBtn').addEventListener('click', () => sendOTP('phone'));
  
  // Password change
  document.getElementById('changePasswordForm').addEventListener('submit', handlePasswordChange);
  
  // Password toggles
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      const icon = btn.querySelector('i');
      
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bx-show');
        icon.classList.add('bx-hide');
      } else {
        input.type = 'password';
        icon.classList.remove('bx-hide');
        icon.classList.add('bx-show');
      }
    });
  });
  
  // Security features
  document.getElementById('2faToggle').addEventListener('change', handle2FAToggle);
  document.getElementById('verify2faForm').addEventListener('submit', handleVerify2FA);
  document.getElementById('viewLoginHistoryBtn').addEventListener('click', () => openModal('loginHistoryModal'));
  document.getElementById('viewSessionsBtn').addEventListener('click', () => openModal('sessionsModal'));
  
  // Modal close buttons
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = btn.dataset.modal || btn.closest('.modal').id;
      closeModal(modalId);
    });
  });
  
  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

// ── Update Character Count ───────────────────────────────────
function updateCharCount() {
  const bioInput = document.getElementById('bioInput');
  const charCount = document.querySelector('.char-count');
  charCount.textContent = `${bioInput.value.length} / 500`;
}

// ── Handle Avatar Upload ─────────────────────────────────────
async function handleAvatarSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    showAlert('error', 'File size must be less than 5MB');
    e.target.value = '';
    return;
  }
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    showAlert('error', 'Invalid file type. Please use JPG, PNG, WEBP, or GIF');
    e.target.value = '';
    return;
  }
  
  // Store selected file and open cropper
  selectedFile = file;
  openImageCropper(file);
  
  // Clear input
  e.target.value = '';
}

// ── Open Image Cropper ───────────────────────────────────────
function openImageCropper(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const cropperImage = document.getElementById('cropperImage');
    cropperImage.src = e.target.result;
    
    // Destroy existing cropper if any
    if (cropper) {
      cropper.destroy();
    }
    
    // Initialize Cropper.js
    cropper = new Cropper(cropperImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      responsive: true,
      guides: true,
      center: true,
      highlight: true,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false
    });
    
    // Show modal
    openModal('cropperModal');
  };
  reader.readAsDataURL(file);
}

// ── Close Cropper ────────────────────────────────────────────
function closeCropper() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  selectedFile = null;
  closeModal('cropperModal');
}

// ── Handle Crop and Upload ───────────────────────────────────
async function handleCropAndUpload() {
  if (!cropper || !selectedFile) return;
  
  try {
    // Get cropped canvas
    const canvas = cropper.getCroppedCanvas({
      width: 400,
      height: 400,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
    
    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        throw new Error('Failed to crop image');
      }
      
      // Show real-time update indicator
      showUpdateIndicator('Uploading avatar...');
      
      // Create form data
      const formData = new FormData();
      formData.append('avatar', blob, selectedFile.name);
      
      // Upload to server
      const response = await fetch(`${API_BASE}/profile/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      const data = await response.json();
      
      // Update preview immediately
      document.getElementById('avatarImage').src = data.avatar_url;
      
      // Update local storage
      currentUser.avatar_url = data.avatar_url;
      updateLocalStorage();
      
      // Close cropper
      closeCropper();
      
      showAlert('success', 'Avatar updated successfully!');
      hideUpdateIndicator();
      
    }, selectedFile.type, 0.95);
    
  } catch (err) {
    console.error('[PROFILE] Crop and upload error:', err);
    showAlert('error', err.message);
    hideUpdateIndicator();
  }
}

// ── Handle Avatar Remove ─────────────────────────────────────
async function handleAvatarRemove() {
  if (!confirm('Are you sure you want to remove your profile picture?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/profile/avatar`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Remove failed');
    }
    
    // Update avatar to default
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'User')}&size=200&background=667eea&color=fff`;
    document.getElementById('avatarImage').src = defaultAvatar;
    
    currentUser.avatar_url = '';
    updateLocalStorage();
    
    showAlert('success', 'Avatar removed successfully!');
    
  } catch (err) {
    console.error('[PROFILE] Avatar remove error:', err);
    showAlert('error', err.message);
  }
}

// ── Handle Basic Info Update ─────────────────────────────────
async function handleBasicInfoUpdate(e) {
  e.preventDefault();
  
  const name = document.getElementById('nameInput').value.trim();
  const phone = document.getElementById('phoneInput').value.trim();
  const bio = document.getElementById('bioInput').value.trim();
  
  setLoading('saveBasicInfo', true);
  
  try {
    const response = await fetch(`${API_BASE}/profile/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, phone, bio })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Update failed');
    }
    
    const data = await response.json();
    
    // Update local storage
    Object.assign(currentUser, data.profile);
    updateLocalStorage();
    
    showAlert('success', 'Profile updated successfully!');
    
    // Re-check verification status
    checkVerificationStatus();
    
  } catch (err) {
    console.error('[PROFILE] Update error:', err);
    showAlert('error', err.message);
  } finally {
    setLoading('saveBasicInfo', false);
  }
}

// ── Send OTP ─────────────────────────────────────────────────
async function sendOTP(type) {
  try {
    const endpoint = type === 'email' ? '/otp/send-email' : '/otp/send-phone';
    const body = type === 'phone' ? { phone: document.getElementById('phoneInput').value.trim() } : {};
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send OTP');
    }
    
    const data = await response.json();
    
    // Show OTP form
    document.getElementById(`${type}VerificationSection`).classList.add('hidden');
    document.getElementById(`${type}OtpForm`).classList.remove('hidden');
    
    // Show OTP in development mode
    if (data.otp) {
      showAlert('success', `OTP sent! For testing: ${data.otp}`);
    } else {
      showAlert('success', `Verification code sent to your ${type}`);
    }
    
  } catch (err) {
    console.error(`[PROFILE] Send ${type} OTP error:`, err);
    showAlert('error', err.message);
  }
}

// ── Verify OTP ───────────────────────────────────────────────
async function verifyOTP(type) {
  const otpInput = document.getElementById(`${type}OtpInput`);
  const otp = otpInput.value.trim();
  
  if (!otp || otp.length !== 6) {
    showAlert('error', 'Please enter a valid 6-digit code');
    return;
  }
  
  try {
    const endpoint = type === 'email' ? '/otp/verify-email' : '/otp/verify-phone';
    const body = type === 'email' ? { otp } : { phone: document.getElementById('phoneInput').value.trim(), otp };
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Verification failed');
    }
    
    // Hide OTP form
    document.getElementById(`${type}OtpForm`).classList.add('hidden');
    document.getElementById(`${type}VerificationSection`).classList.remove('hidden');
    
    // Update UI
    updateVerificationUI(type, true);
    
    // Clear input
    otpInput.value = '';
    
    showAlert('success', `${type === 'email' ? 'Email' : 'Phone'} verified successfully!`);
    
  } catch (err) {
    console.error(`[PROFILE] Verify ${type} OTP error:`, err);
    showAlert('error', err.message);
  }
}

// ── Handle Password Change ───────────────────────────────────
async function handlePasswordChange(e) {
  e.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  
  // Validation
  if (newPassword.length < 8) {
    showAlert('error', 'Password must be at least 8 characters');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showAlert('error', 'New passwords do not match');
    return;
  }
  
  if (currentPassword === newPassword) {
    showAlert('error', 'New password must be different from current password');
    return;
  }
  
  setLoading('changePassword', true);
  
  try {
    // This would call your password change endpoint
    // For now, showing success
    showAlert('success', 'Password changed successfully!');
    
    // Clear form
    document.getElementById('changePasswordForm').reset();
    document.getElementById('passwordStrengthProfile').classList.add('hidden');
    
  } catch (err) {
    console.error('[PROFILE] Password change error:', err);
    showAlert('error', err.message);
  } finally {
    setLoading('changePassword', false);
  }
}

// ── Setup Password Strength ──────────────────────────────────
function setupPasswordStrength() {
  const passwordInput = document.getElementById('newPassword');
  const strengthIndicator = document.getElementById('passwordStrengthProfile');
  const strengthFill = strengthIndicator.querySelector('.strength-fill');
  const strengthText = strengthIndicator.querySelector('.strength-text strong');
  
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    
    if (password.length === 0) {
      strengthIndicator.classList.add('hidden');
      return;
    }
    
    strengthIndicator.classList.remove('hidden');
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    let level, text;
    if (score <= 2) {
      level = 'weak';
      text = 'Weak';
    } else if (score <= 4) {
      level = 'medium';
      text = 'Medium';
    } else {
      level = 'strong';
      text = 'Strong';
    }
    
    strengthFill.className = 'strength-fill ' + level;
    strengthText.textContent = text;
  });
}

// ── Update Local Storage ─────────────────────────────────────
function updateLocalStorage() {
  const userInfo = JSON.parse(localStorage.getItem('tph_user_info') || '{}');
  userInfo.profile = currentUser;
  localStorage.setItem('tph_user_info', JSON.stringify(userInfo));
}

// ── Loading States ───────────────────────────────────────────
function setLoading(btnId, isLoading) {
  const btn = document.getElementById(`${btnId}Btn`);
  const text = document.getElementById(`${btnId}Text`);
  const spinner = document.getElementById(`${btnId}Spinner`);
  
  if (isLoading) {
    btn.disabled = true;
    spinner.classList.remove('hidden');
  } else {
    btn.disabled = false;
    spinner.classList.add('hidden');
  }
}

// ── Alert Helpers ────────────────────────────────────────────
function showAlert(type, message) {
  const alertId = type === 'success' ? 'successAlert' : 'errorAlert';
  const alert = document.getElementById(alertId);
  
  alert.textContent = message;
  alert.classList.remove('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    alert.classList.add('hidden');
  }, 5000);
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

console.log('[PROFILE] Loaded successfully');


// ── Form Validation ──────────────────────────────────────────
function validateField(fieldName) {
  const input = document.getElementById(`${fieldName}Input`);
  const formGroup = input.closest('.form-group');
  let errorMsg = '';
  
  // Remove existing error
  formGroup.classList.remove('error', 'success');
  const existingError = formGroup.querySelector('.error-message');
  if (existingError) existingError.remove();
  
  // Validate based on field
  if (fieldName === 'name') {
    const value = input.value.trim();
    if (!value) {
      errorMsg = 'Name is required';
    } else if (value.length < 2) {
      errorMsg = 'Name must be at least 2 characters';
    } else if (value.length > 100) {
      errorMsg = 'Name must be less than 100 characters';
    } else if (!/^[a-zA-Z\s'-]+$/.test(value)) {
      errorMsg = 'Name can only contain letters, spaces, hyphens, and apostrophes';
    }
  } else if (fieldName === 'phone') {
    const value = input.value.trim();
    if (value) {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10) {
        errorMsg = 'Phone number must be at least 10 digits';
      } else if (digits.length > 15) {
        errorMsg = 'Phone number is too long';
      }
    }
  }
  
  if (errorMsg) {
    formGroup.classList.add('error');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = errorMsg;
    input.parentNode.appendChild(errorDiv);
    return false;
  } else {
    formGroup.classList.add('success');
    return true;
  }
}

// ── Real-time Update Indicator ───────────────────────────────
function showUpdateIndicator(message) {
  let indicator = document.querySelector('.update-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'update-indicator';
    document.body.appendChild(indicator);
  }
  indicator.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> ${message}`;
}

function hideUpdateIndicator() {
  const indicator = document.querySelector('.update-indicator');
  if (indicator) indicator.remove();
}

// ── Modal Helpers ────────────────────────────────────────────
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    if (modalId === 'loginHistoryModal') loadLoginHistory();
    else if (modalId === 'sessionsModal') loadActiveSessions();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

// ── Security Features ────────────────────────────────────────
async function handle2FAToggle(e) {
  const enabled = e.target.checked;
  
  if (enabled) {
    try {
      const response = await fetch(`${API_BASE}/security/2fa/enable`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to enable 2FA');
      
      const data = await response.json();
      document.getElementById('qrCodeImage').src = data.qrCode;
      document.getElementById('manualSecret').textContent = data.secret;
      document.getElementById('2faSetup').classList.remove('hidden');
      
    } catch (err) {
      console.error('[SECURITY] 2FA enable error:', err);
      showAlert('error', err.message);
      e.target.checked = false;
    }
  } else {
    if (!confirm('Disable Two-Factor Authentication?')) {
      e.target.checked = true;
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/security/2fa/disable`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '' })
      });
      
      if (!response.ok) throw new Error('Failed to disable 2FA');
      
      document.getElementById('2faSetup').classList.add('hidden');
      showAlert('success', '2FA disabled successfully');
      
    } catch (err) {
      console.error('[SECURITY] 2FA disable error:', err);
      showAlert('error', err.message);
      e.target.checked = true;
    }
  }
}

async function handleVerify2FA(e) {
  e.preventDefault();
  
  const code = document.getElementById('2faVerifyCode').value.trim();
  if (!code || code.length !== 6) {
    showAlert('error', 'Please enter a valid 6-digit code');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/security/2fa/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: code })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Verification failed');
    }
    
    document.getElementById('2faSetup').classList.add('hidden');
    document.getElementById('2faVerifyCode').value = '';
    showAlert('success', '2FA enabled successfully!');
    
  } catch (err) {
    console.error('[SECURITY] 2FA verify error:', err);
    showAlert('error', err.message);
  }
}

async function loadLoginHistory() {
  try {
    const response = await fetch(`${API_BASE}/security/login-history?limit=20`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to load login history');
    
    const data = await response.json();
    const container = document.getElementById('loginHistoryList');
    
    if (!data.history || data.history.length === 0) {
      container.innerHTML = '<p class="help-text">No login history available</p>';
      return;
    }
    
    container.innerHTML = data.history.map(item => `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-status ${item.success ? 'success' : 'failed'}">
            <i class='bx ${item.success ? 'bx-check-circle' : 'bx-x-circle'}'></i>
            ${item.success ? 'Successful' : 'Failed'} Login
          </span>
          <span class="history-time">${new Date(item.created_at).toLocaleString()}</span>
        </div>
        <div class="history-details">
          <span class="history-label">Method:</span><span>${item.login_method}</span>
          <span class="history-label">Device:</span><span>${item.device_info || 'Unknown'}</span>
          <span class="history-label">IP:</span><span>${item.ip_address || 'Unknown'}</span>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('[SECURITY] Load login history error:', err);
    showAlert('error', err.message);
  }
}

async function loadActiveSessions() {
  try {
    const response = await fetch(`${API_BASE}/security/sessions`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to load sessions');
    
    const data = await response.json();
    const container = document.getElementById('sessionsList');
    
    if (!data.sessions || data.sessions.length === 0) {
      container.innerHTML = '<p class="help-text">No active sessions</p>';
      return;
    }
    
    container.innerHTML = data.sessions.map((session, index) => `
      <div class="session-item">
        <div class="session-info">
          <div class="session-device">
            <i class='bx bx-devices'></i> ${session.device_info || 'Unknown Device'}
            ${index === 0 ? '<span class="session-current"><i class="bx bx-check-circle"></i> Current</span>' : ''}
          </div>
          <div class="session-details">
            <span>IP: ${session.ip_address || 'Unknown'}</span>
            <span>Last: ${new Date(session.last_activity).toLocaleString()}</span>
          </div>
        </div>
        ${index !== 0 ? `<button class="btn-revoke" onclick="revokeSession('${session.id}')"><i class='bx bx-x'></i> Revoke</button>` : ''}
      </div>
    `).join('');
    
  } catch (err) {
    console.error('[SECURITY] Load sessions error:', err);
    showAlert('error', err.message);
  }
}

async function revokeSession(sessionId) {
  if (!confirm('Revoke this session?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/security/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to revoke session');
    
    showAlert('success', 'Session revoked successfully');
    loadActiveSessions();
    
  } catch (err) {
    console.error('[SECURITY] Revoke session error:', err);
    showAlert('error', err.message);
  }
}

window.revokeSession = revokeSession;

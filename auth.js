/* ═══════════════════════════════════════════════════════════
   TEAM PROFILE HUB - AUTH PAGE JAVASCRIPT
   Complete Authentication Flow with OAuth & Form Validation
═══════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

// ── State ────────────────────────────────────────────────────
let currentTheme = 'barney';
let supabaseClient = null;

// ── Initialize ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  console.log('[AUTH] Initializing...');
  
  // Initialize Supabase if configured (optional)
  try {
    if (typeof window.supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_ANON_KEY && 
        window.SUPABASE_URL !== '' && window.SUPABASE_ANON_KEY !== '' &&
        !window.SUPABASE_URL.includes('YOUR_SUPABASE')) {
      supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      console.log('[AUTH] Supabase initialized');
    } else {
      console.log('[AUTH] Running in demo mode without Supabase');
    }
  } catch (err) {
    console.warn('[AUTH] Could not initialize Supabase:', err);
  }
  
  initThemeSwitcher();
  bindFormEvents();
  bindPasswordToggles();
  setupPasswordStrength();
  
  // Check if redirected from OAuth
  checkOAuthCallback();
});

// ── Theme Switcher ───────────────────────────────────────────
function initThemeSwitcher() {
  const themeBtns = document.querySelectorAll('.theme-picker li');
  
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      if (theme && theme !== currentTheme) {
        changeTheme(theme);
        
        // Update pressed state
        themeBtns.forEach(b => b.classList.remove('pressed'));
        btn.classList.add('pressed');
      }
    });
  });
}

function changeTheme(theme) {
  const form = document.querySelector('.auth-form:not(.hidden)');
  const body = document.body;
  
  // Add rotation animation
  if (form) {
    form.classList.add('rotate');
    setTimeout(() => form.classList.remove('rotate'), 1200);
  }
  
  // Change theme after half rotation
  setTimeout(() => {
    body.classList.remove(currentTheme);
    body.classList.add(theme);
    currentTheme = theme;
  }, 600);
}

// ── Form Events ──────────────────────────────────────────────
function bindFormEvents() {
  // Login Form
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', handleLogin);
  
  // Signup Form
  const signupForm = document.getElementById('signupForm');
  signupForm.addEventListener('submit', handleSignup);
  
  // Forgot Password Form
  const forgotForm = document.getElementById('forgotPasswordForm');
  forgotForm.addEventListener('submit', handleForgotPassword);
  
  // Form Switches
  document.getElementById('switchToSignup').addEventListener('click', (e) => {
    e.preventDefault();
    switchForm('signup');
  });
  
  document.getElementById('switchToLogin').addEventListener('click', (e) => {
    e.preventDefault();
    switchForm('login');
  });
  
  document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
    e.preventDefault();
    switchForm('forgot');
  });
  
  document.getElementById('backToLogin').addEventListener('click', (e) => {
    e.preventDefault();
    switchForm('login');
  });
  
  // OAuth Buttons
  document.getElementById('googleBtn').addEventListener('click', handleGoogleAuth);
  document.getElementById('googleSignupBtn').addEventListener('click', handleGoogleAuth);
}

// ── Switch Forms ─────────────────────────────────────────────
function switchForm(formType) {
  const forms = document.querySelectorAll('.auth-form');
  forms.forEach(f => f.classList.add('hidden'));
  
  // Clear all alerts
  hideAlert('authError');
  hideAlert('authSuccess');
  hideAlert('signupError');
  hideAlert('signupSuccess');
  hideAlert('forgotError');
  hideAlert('forgotSuccess');
  
  if (formType === 'login') {
    document.getElementById('loginForm').classList.remove('hidden');
  } else if (formType === 'signup') {
    document.getElementById('signupForm').classList.remove('hidden');
  } else if (formType === 'forgot') {
    document.getElementById('forgotPasswordForm').classList.remove('hidden');
  }
}

// ── Password Toggles ─────────────────────────────────────────
function bindPasswordToggles() {
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
}

// ── Password Strength ────────────────────────────────────────
function setupPasswordStrength() {
  const passwordInput = document.getElementById('signupPassword');
  const strengthIndicator = document.getElementById('passwordStrength');
  const strengthFill = strengthIndicator.querySelector('.strength-fill');
  const strengthText = strengthIndicator.querySelector('.strength-text strong');
  
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    
    if (password.length === 0) {
      strengthIndicator.classList.add('hidden');
      return;
    }
    
    strengthIndicator.classList.remove('hidden');
    
    const strength = calculatePasswordStrength(password);
    strengthFill.className = 'strength-fill ' + strength.level;
    strengthText.textContent = strength.text;
  });
}

function calculatePasswordStrength(password) {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 2) return { level: 'weak', text: 'Weak' };
  if (score <= 4) return { level: 'medium', text: 'Medium' };
  return { level: 'strong', text: 'Strong' };
}

// ── Handle Login ─────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  
  if (!email || !password) {
    showAlert('authError', 'Please enter both email and password');
    return;
  }
  
  setLoading('login', true);
  hideAlert('authError');
  
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    // Save session
    if (data.session && data.session.access_token) {
      localStorage.setItem('tph_access_token', data.session.access_token);
      localStorage.setItem('tph_user_info', JSON.stringify({
        user: data.user,
        profile: data.profile
      }));
      
      if (rememberMe) {
        localStorage.setItem('tph_saved_credentials', JSON.stringify({ email, password, remember: true }));
      }
    }
    
    showAlert('authSuccess', 'Login successful! Redirecting...', 'success');
    
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
    
  } catch (err) {
    showAlert('authError', err.message);
  } finally {
    setLoading('login', false);
  }
}

// ── Handle Signup ────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupPasswordConfirm').value;
  const agreeTerms = document.getElementById('agreeTerms').checked;
  
  // Validation
  if (!name || !email || !password) {
    showAlert('signupError', 'Please fill in all required fields');
    return;
  }
  
  if (!agreeTerms) {
    showAlert('signupError', 'You must agree to the Terms of Service');
    return;
  }
  
  if (password.length < 8) {
    showAlert('signupError', 'Password must be at least 8 characters');
    return;
  }
  
  if (password !== confirmPassword) {
    showAlert('signupError', 'Passwords do not match');
    return;
  }
  
  setLoading('signup', true);
  hideAlert('signupError');
  
  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }
    
    // Save session
    if (data.session && data.session.access_token) {
      localStorage.setItem('tph_access_token', data.session.access_token);
      localStorage.setItem('tph_user_info', JSON.stringify({
        user: data.user,
        profile: data.profile
      }));
    }
    
    if (data.profile?.role === 'PENDING') {
      showAlert('signupSuccess', 'Account created! Waiting for admin approval...', 'success');
    } else {
      showAlert('signupSuccess', 'Account created successfully! Redirecting...', 'success');
    }
    
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    
  } catch (err) {
    showAlert('signupError', err.message);
  } finally {
    setLoading('signup', false);
  }
}

// ── Handle Forgot Password ───────────────────────────────────
async function handleForgotPassword(e) {
  e.preventDefault();
  
  const email = document.getElementById('forgotEmail').value.trim();
  
  if (!email) {
    showAlert('forgotError', 'Please enter your email');
    return;
  }
  
  setLoading('forgot', true);
  hideAlert('forgotError');
  
  try {
    // Call password reset API
    if (supabaseClient) {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
    }
    
    showAlert('forgotSuccess', 'Password reset link sent to your email!', 'success');
    
    setTimeout(() => {
      switchForm('login');
    }, 3000);
    
  } catch (err) {
    showAlert('forgotError', err.message || 'Failed to send reset link');
  } finally {
    setLoading('forgot', false);
  }
}

// ── Handle Google OAuth ──────────────────────────────────────
async function handleGoogleAuth() {
  try {
    if (supabaseClient) {
      // Real Supabase OAuth
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`
        }
      });
      
      if (error) throw error;
      
      // User will be redirected to Google
    } else {
      // Fallback: Show custom email input
      const email = prompt('Enter your Google email for demo mode:');
      if (!email) return;
      
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          name: email.split('@')[0] 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Google auth failed');
      }
      
      // Save session
      if (data.session && data.session.access_token) {
        localStorage.setItem('tph_access_token', data.session.access_token);
        localStorage.setItem('tph_user_info', JSON.stringify({
          user: data.user,
          profile: data.profile
        }));
      }
      
      window.location.href = '/';
    }
  } catch (err) {
    const currentForm = document.querySelector('.auth-form:not(.hidden)');
    const errorId = currentForm.id === 'loginForm' ? 'authError' : 'signupError';
    showAlert(errorId, err.message || 'Google authentication failed');
  }
}

// ── Check OAuth Callback ─────────────────────────────────────
async function checkOAuthCallback() {
  // Check if we're on the callback page
  if (window.location.pathname.includes('auth-callback')) {
    if (supabaseClient) {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      
      if (session) {
        // Save session
        localStorage.setItem('tph_access_token', session.access_token);
        
        // Get profile from backend
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        const userData = await response.json();
        
        localStorage.setItem('tph_user_info', JSON.stringify({
          user: userData.user,
          profile: userData.profile
        }));
        
        // Redirect to main app
        window.location.href = '/';
      }
    }
  }
}

// ── Loading States ───────────────────────────────────────────
function setLoading(formType, isLoading) {
  const btn = document.getElementById(`${formType}Btn`);
  const text = document.getElementById(`${formType}BtnText`);
  const spinner = document.getElementById(`${formType}Spinner`);
  const icon = btn.querySelector('i:not(.spinner)');
  
  if (isLoading) {
    btn.disabled = true;
    text.textContent = 'Please wait...';
    spinner.classList.remove('hidden');
    if (icon) icon.style.display = 'none';
  } else {
    btn.disabled = false;
    const defaultTexts = {
      login: 'Sign In',
      signup: 'Create Account',
      forgot: 'Send Reset Link'
    };
    text.textContent = defaultTexts[formType];
    spinner.classList.add('hidden');
    if (icon) icon.style.display = 'block';
  }
}

// ── Alert Helpers ────────────────────────────────────────────
function showAlert(alertId, message, type = 'error') {
  const alert = document.getElementById(alertId);
  if (!alert) return;
  
  alert.textContent = message;
  alert.classList.remove('hidden');
  alert.classList.remove('alert-error', 'alert-success');
  alert.classList.add(type === 'success' ? 'alert-success' : 'alert-error');
  
  // Auto-hide after 5 seconds for errors
  if (type === 'error') {
    setTimeout(() => hideAlert(alertId), 5000);
  }
}

function hideAlert(alertId) {
  const alert = document.getElementById(alertId);
  if (alert) {
    alert.classList.add('hidden');
  }
}

// ── Utility Functions ────────────────────────────────────────
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

console.log('[AUTH] Loaded successfully');

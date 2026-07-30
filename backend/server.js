const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
require('dotenv').config();

const membersRouter = require('./routes/members');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security ─────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Rate limiting ─────────────────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
}));

// ── Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Serve frontend static files ───────────────────────────────────────
const frontendPath = path.join(__dirname, '..', 'frontend');

// Force the browser to always revalidate HTML, JS, and CSS — prevents stale cache issues
app.use(express.static(frontendPath, {
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.html', '.js', '.css'].includes(ext)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// ── API Routes ────────────────────────────────────────────────────────
app.use('/api/members', membersRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SPA catch-all: serve index.html for any non-API route ─────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀  Team Profile Hub running on http://localhost:${PORT}`);
});

module.exports = app;

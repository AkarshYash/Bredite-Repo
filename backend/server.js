const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
require('dotenv').config();

const authRouter    = require('./routes/auth');
const membersRouter = require('./routes/members');
const pendingRouter = require('./routes/pending');
const auditRouter   = require('./routes/audit');
const usersRouter   = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "*"]
    }
  }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Rate limiting ─────────────────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
}));

// ── Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Serve frontend static files ───────────────────────────────────────
const rootPath = path.join(__dirname, '..');
const frontendPath = path.join(__dirname, '..', 'frontend');

const staticOptions = {
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.html', '.js', '.css'].includes(ext)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
};

app.use(express.static(rootPath, staticOptions));
if (require('fs').existsSync(frontendPath)) {
  app.use(express.static(frontendPath, staticOptions));
}

// ── API Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/members', membersRouter);
app.use('/api/pending-changes', pendingRouter);
app.use('/api/audit-log', auditRouter);
app.use('/api/users', usersRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SPA catch-all: serve index.html for any non-API route ─────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const rootIndex = path.join(__dirname, '..', 'index.html');
  if (require('fs').existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  const frontendIndex = path.join(__dirname, '..', 'frontend', 'index.html');
  if (require('fs').existsSync(frontendIndex)) {
    return res.sendFile(frontendIndex);
  }
  next();
});

// ── Global error handler ──────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀  Team Profile Hub running on http://localhost:${PORT}`);
  });
}

module.exports = app;

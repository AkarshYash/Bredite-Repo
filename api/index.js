const app = require('../backend/server');

// Vercel serverless handler
module.exports = app;

// Also export as default for Vercel
module.exports.default = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const dirs = [
  'public/uploads/originals',
  'public/uploads/display',
  'public/uploads/thumbnails',
  'data'
];
dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  const gitkeep = path.join(fullPath, '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '');
  }
});

// Initialize database
initDatabase();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many uploads, please try again later.' }
});

// Static files - optimized with cache headers
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.includes('/thumbnails/')) {
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (filePath.includes('/display/')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// Routes
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);

// Admin panel redirect
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 100}MB.` });
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`\n🎨 Pyrolux Gallery Backend running on port ${PORT}`);
  console.log(`📁 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🔗 API: http://localhost:${PORT}/api\n`);
});

module.exports = app;

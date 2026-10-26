const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./database');
const seed = require('./seed');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const courseRoutes = require('./routes/courses');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    name: 'Future Sprint Technologies Interview Dashboard API'
  });
});

// Single Page Application fallback - sends index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal error occurred on the server.'
  });
});

const { startReminderScheduler } = require('./services/reminderService');

// Auto seed on boot and start server
seed().then(() => {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 Future Sprint Technologies Portal is LIVE!`);
    console.log(`📍 Location: Allwyn X Roads, Hema Durga Plaza, Flat No: 207, Miyapur`);
    console.log(`🌐 Web Portal URL: http://localhost:${PORT}`);
    console.log('====================================================');

    // Start 2-hour interview office attendance reminder scheduler
    startReminderScheduler(60000);
  });
}).catch(err => {
  console.error('Failed to initialize and seed database:', err);
  process.exit(1);
});

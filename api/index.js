const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'Wishlist Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      test: '/test',
      auth: '/auth/verify'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Backend works!' });
});

// ✅ AUTH endpoint (ДОБАВЬ ЭТО)
app.post('/auth/verify', (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ error: 'initData is required' });
    }

    // Для теста просто возвращаем успешный ответ
    const user = {
      id: Math.random(),
      name: 'Test User',
      username: 'testuser'
    };

    const token = 'test-token-' + Math.random();

    res.json({
      success: true,
      user,
      token
    });
  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ✅ Конфигурация окружения
const PORT = process.env.PORT || 3001;
const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

if (!isProduction) {
  // Локально запускаем сервер
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Frontend URL: ${process.env.FRONTEND_URL || 'not set'}`);
    console.log(`💾 Database: ${process.env.SUPABASE_URL || 'not set'}`);
  });
} else {
  // На Vercel просто экспортируем (сервер не запускается)
  console.log('✅ Running on Vercel (serverless mode)');
}

module.exports = app;

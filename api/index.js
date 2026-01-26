const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

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

// ✅ ВАРИАНТ 2: Явно указываем окружение
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

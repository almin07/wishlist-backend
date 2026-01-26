const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Переменные для бота
const BOT_TOKEN = process.env.BOT_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ✅ Функция инициализации бота
async function setupBot() {
  try {
    if (!BOT_TOKEN) {
      console.warn('⚠️ BOT_TOKEN не установлен');
      return;
    }
    console.log('✅ Бот готов к работе');
  } catch (error) {
    console.error('❌ Ошибка инициализации бота:', error.message);
  }
}

setupBot();

// ✅ Корневой маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'Wishlist Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      test: '/test',
      auth: '/auth/verify',
      bot: '/bot/send-message',
      webhook: '/webhook'
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

// AUTH endpoint
app.post('/auth/verify', (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ error: 'initData is required' });
    }

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

// ✅ Эндпоинт для отправки сообщения
app.post('/bot/send-message', async (req, res) => {
  try {
    const { chatId, message } = req.body;

    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId and message are required' });
    }

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    res.json({ success: true, message: 'Message sent' });
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ✅ Webhook для обработки команд бота
app.post('/webhook', (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.json({ ok: true });
    }

    const { chat, text } = message;
    const chatId = chat.id;

    if (text === '/start') {
      axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `👋 Добро пожаловать в Wishlist Mini App!\n\nНажми кнопку ниже, чтобы открыть приложение.`,
        reply_markup: {
          inline_keyboard: [[{
            text: '📱 Открыть Wishlist',
            web_app: { url: FRONTEND_URL }
          }]]
        }
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Ошибка обработки webhook:', error.message);
    res.json({ ok: true });
  }
});

// ✅ Конфигурация окружения
const PORT = process.env.PORT || 3001;
const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

if (!isProduction) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Frontend URL: ${FRONTEND_URL || 'not set'}`);
  });
} else {
  console.log('✅ Running on Vercel (serverless mode)');
}

module.exports = app;

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const {
  createOrUpdateUser,
  getUser,
  createWish,
  getUserWishes,
  updateWish,
  deleteWish,
  addFriend,
  acceptFriendRequest,
  getUserFriends,
  getPendingFriendRequests,
  markWishAsGifted,
  unmarkWishAsGifted,
  getWishGifters,
  createNotification,
  getUserNotifications
} = require('../services/supabase');

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

// ============================================
// MIDDLEWARE
// ============================================

// Middleware для получения userId из запроса
function getUserIdFromRequest(req) {
  return req.body.userId || req.query.userId || req.headers['x-user-id'];
}

// ============================================
// HEALTH & INFO
// ============================================

app.get('/', (req, res) => {
  res.json({
    message: 'Wishlist Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      test: '/test',
      auth: '/auth/verify',
      users: '/users/:userId',
      wishes: {
        create: 'POST /wishes',
        list: 'GET /wishes/:userId',
        update: 'PUT /wishes/:wishId',
        delete: 'DELETE /wishes/:wishId'
      },
      friends: {
        add: 'POST /friends/add',
        accept: 'POST /friends/accept',
        list: 'GET /friends/:userId',
        pending: 'GET /friends/:userId/pending'
      },
      gifts: {
        mark: 'POST /gifts/mark',
        unmark: 'DELETE /gifts/unmark',
        gifters: 'GET /gifts/:wishId/gifters'
      },
      notifications: {
        list: 'GET /notifications/:userId'
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Backend works!' });
});

// ============================================
// AUTH
// ============================================

app.post('/auth/verify', async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ error: 'initData is required' });
    }

    // Парсим initData (в production нужно проверить подпись)
    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get('user'));

    if (!user || !user.id) {
      return res.status(401).json({ error: 'Invalid user data' });
    }

    // Создаём или обновляем пользователя
    const result = await createOrUpdateUser(user);

    const token = 'token-' + user.id + '-' + Date.now();

    res.json({
      success: true,
      user: result.user,
      token
    });
  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ============================================
// USERS
// ============================================

app.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await getUser(parseInt(userId));
    res.json(result);
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============================================
// WISHES
// ============================================

// Создать желание
app.post('/wishes', async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { title, description, photo_url, link, price } = req.body;

    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and title are required' });
    }

    const result = await createWish(userId, {
      title,
      description,
      photo_url,
      link,
      price
    });

    // Создаём уведомление для друзей
    await createNotification(userId, userId, 'wish_created', result.wish.id);

    res.json(result);
  } catch (error) {
    console.error('❌ Create wish error:', error);
    res.status(500).json({ error: 'Failed to create wish' });
  }
});

// Получить желания пользователя
app.get('/wishes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await getUserWishes(parseInt(userId));
    res.json(result);
  } catch (error) {
    console.error('❌ Get wishes error:', error);
    res.status(500).json({ error: 'Failed to get wishes' });
  }
});

// Обновить желание
app.put('/wishes/:wishId', async (req, res) => {
  try {
    const { wishId } = req.params;
    const userId = getUserIdFromRequest(req);
    const { title, description, photo_url, link, price, status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'userId is required' });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (photo_url) updateData.photo_url = photo_url;
    if (link) updateData.link = link;
    if (price) updateData.price = parseFloat(price);
    if (status) updateData.status = status;

    const result = await updateWish(parseInt(wishId), userId, updateData);
    res.json(result);
  } catch (error) {
    console.error('❌ Update wish error:', error);
    res.status(500).json({ error: error.message || 'Failed to update wish' });
  }
});

// Удалить желание
app.delete('/wishes/:wishId', async (req, res) => {
  try {
    const { wishId } = req.params;
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'userId is required' });
    }

    const result = await deleteWish(parseInt(wishId), userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Delete wish error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete wish' });
  }
});

// ============================================
// FRIENDS
// ============================================

// Пригласить в друзья
app.post('/friends/add', async (req, res) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required' });
    }

    const result = await addFriend(userId, friendId);

    // Создаём уведомление для приглашённого
    await createNotification(friendId, userId, 'friend_request', null);

    res.json(result);
  } catch (error) {
    console.error('❌ Add friend error:', error);
    res.status(500).json({ error: error.message || 'Failed to add friend' });
  }
});

// Принять приглашение в друзья
app.post('/friends/accept', async (req, res) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required' });
    }

    const result = await acceptFriendRequest(userId, friendId);

    // Создаём уведомление для пригласившего
    await createNotification(friendId, userId, 'friend_accepted', null);

    res.json(result);
  } catch (error) {
    console.error('❌ Accept friend error:', error);
    res.status(500).json({ error: error.message || 'Failed to accept friend' });
  }
});

// Получить друзей пользователя
app.get('/friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await getUserFriends(parseInt(userId));
    res.json(result);
  } catch (error) {
    console.error('❌ Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

// Получить входящие приглашения
app.get('/friends/:userId/pending', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await getPendingFriendRequests(parseInt(userId));
    res.json(result);
  } catch (error) {
    console.error('❌ Get pending requests error:', error);
    res.status(500).json({ error: 'Failed to get pending requests' });
  }
});

// ============================================
// GIFTS
// ============================================

// Отметить желание как подарок
app.post('/gifts/mark', async (req, res) => {
  try {
    const { wishId, giverId } = req.body;

    if (!wishId || !giverId) {
      return res.status(400).json({ error: 'wishId and giverId are required' });
    }

    const result = await markWishAsGifted(parseInt(wishId), giverId);

    // Создаём уведомление владельцу желания
    // Нужно получить user_id желания из БД
    res.json(result);
  } catch (error) {
    console.error('❌ Mark gift error:', error);
    res.status(500).json({ error: error.message || 'Failed to mark gift' });
  }
});

// Отменить отметку подарка
app.delete('/gifts/unmark', async (req, res) => {
  try {
    const { wishId, giverId } = req.body;

    if (!wishId || !giverId) {
      return res.status(400).json({ error: 'wishId and giverId are required' });
    }

    const result = await unmarkWishAsGifted(parseInt(wishId), giverId);
    res.json(result);
  } catch (error) {
    console.error('❌ Unmark gift error:', error);
    res.status(500).json({ error: error.message || 'Failed to unmark gift' });
  }
});

// Получить дарителей для желания
app.get('/gifts/:wishId/gifters', async (req, res) => {
  try {
    const { wishId } = req.params;

    const result = await getWishGifters(parseInt(wishId));
    res.json(result);
  } catch (error) {
    console.error('❌ Get gifters error:', error);
    res.status(500).json({ error: 'Failed to get gifters' });
  }
});

// ============================================
// NOTIFICATIONS
// ============================================

app.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const result = await getUserNotifications(parseInt(userId), parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// ============================================
// TELEGRAM BOT
// ============================================

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
    console.error('❌ Send message error:', error.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

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
    console.error('❌ Webhook error:', error.message);
    res.json({ ok: true });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================
// SERVER START
// ============================================

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
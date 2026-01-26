const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('❌ SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY не установлены в .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// USERS
// ============================================

async function createOrUpdateUser(telegramUser) {
  try {
    const { id, username, first_name, last_name, photo_url } = telegramUser;

    const { data, error } = await supabase
      .from('users')
      .upsert({
        id,
        username,
        first_name,
        last_name: last_name || null,
        photo_url: photo_url || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    console.error('❌ createOrUpdateUser error:', error);
    throw error;
  }
}

async function getUser(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    console.error('❌ getUser error:', error);
    throw error;
  }
}

// ============================================
// WISHES
// ============================================

async function createWish(userId, wishData) {
  try {
    const { title, description, photo_url, link, price } = wishData;

    const { data, error } = await supabase
      .from('wishes')
      .insert({
        user_id: userId,
        title,
        description: description || null,
        photo_url: photo_url || null,
        link: link || null,
        price: price ? parseFloat(price) : null,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, wish: data };
  } catch (error) {
    console.error('❌ createWish error:', error);
    throw error;
  }
}

async function getUserWishes(userId) {
  try {
    const { data, error } = await supabase
      .from('wishes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, wishes: data || [] };
  } catch (error) {
    console.error('❌ getUserWishes error:', error);
    throw error;
  }
}

async function updateWish(wishId, userId, updateData) {
  try {
    // Проверка прав доступа
    const { data: wish, error: fetchError } = await supabase
      .from('wishes')
      .select('user_id')
      .eq('id', wishId)
      .single();

    if (fetchError) throw fetchError;
    if (wish.user_id !== userId) {
      throw new Error('❌ Недостаточно прав для изменения этого желания');
    }

    const { data, error } = await supabase
      .from('wishes')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', wishId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, wish: data };
  } catch (error) {
    console.error('❌ updateWish error:', error);
    throw error;
  }
}

async function deleteWish(wishId, userId) {
  try {
    // Проверка прав доступа
    const { data: wish, error: fetchError } = await supabase
      .from('wishes')
      .select('user_id')
      .eq('id', wishId)
      .single();

    if (fetchError) throw fetchError;
    if (wish.user_id !== userId) {
      throw new Error('❌ Недостаточно прав для удаления этого желания');
    }

    const { error } = await supabase
      .from('wishes')
      .delete()
      .eq('id', wishId);

    if (error) throw error;
    return { success: true, message: 'Желание удалено' };
  } catch (error) {
    console.error('❌ deleteWish error:', error);
    throw error;
  }
}

// ============================================
// FRIENDS
// ============================================

async function addFriend(userId, friendId) {
  try {
    if (userId === friendId) {
      throw new Error('❌ Нельзя добавить самого себя в друзья');
    }

    const { data, error } = await supabase
      .from('friends')
      .insert({
        user_id: userId,
        friend_id: friendId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, friendship: data };
  } catch (error) {
    console.error('❌ addFriend error:', error);
    throw error;
  }
}

async function acceptFriendRequest(userId, friendId) {
  try {
    const { data, error } = await supabase
      .from('friends')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('user_id', friendId)
      .eq('friend_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, friendship: data };
  } catch (error) {
    console.error('❌ acceptFriendRequest error:', error);
    throw error;
  }
}

async function getUserFriends(userId) {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        id,
        friend_id,
        status,
        accepted_at,
        users:friend_id (id, username, first_name, last_name, photo_url)
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (error) throw error;
    return { success: true, friends: data || [] };
  } catch (error) {
    console.error('❌ getUserFriends error:', error);
    throw error;
  }
}

async function getPendingFriendRequests(userId) {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        id,
        user_id,
        status,
        invited_at,
        users:user_id (id, username, first_name, last_name, photo_url)
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return { success: true, requests: data || [] };
  } catch (error) {
    console.error('❌ getPendingFriendRequests error:', error);
    throw error;
  }
}

// ============================================
// GIFTS
// ============================================

async function markWishAsGifted(wishId, giverId) {
  try {
    const { data, error } = await supabase
      .from('gifts')
      .insert({
        wish_id: wishId,
        giver_id: giverId
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, gift: data };
  } catch (error) {
    console.error('❌ markWishAsGifted error:', error);
    throw error;
  }
}

async function unmarkWishAsGifted(wishId, giverId) {
  try {
    const { error } = await supabase
      .from('gifts')
      .delete()
      .eq('wish_id', wishId)
      .eq('giver_id', giverId);

    if (error) throw error;
    return { success: true, message: 'Подарок отмечен как неподтвержённый' };
  } catch (error) {
    console.error('❌ unmarkWishAsGifted error:', error);
    throw error;
  }
}

async function getWishGifters(wishId) {
  try {
    const { data, error } = await supabase
      .from('gifts')
      .select(`
        id,
        giver_id,
        marked_at,
        users:giver_id (id, username, first_name, last_name, photo_url)
      `)
      .eq('wish_id', wishId);

    if (error) throw error;
    return { success: true, gifters: data || [] };
  } catch (error) {
    console.error('❌ getWishGifters error:', error);
    throw error;
  }
}

// ============================================
// NOTIFICATIONS
// ============================================

async function createNotification(userId, actorId, type, objectId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        actor_id: actorId,
        type,
        object_id: objectId || null
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, notification: data };
  } catch (error) {
    console.error('❌ createNotification error:', error);
    throw error;
  }
}

async function getUserNotifications(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        object_id,
        sent_at,
        users:actor_id (id, username, first_name, last_name, photo_url)
      `)
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, notifications: data || [] };
  } catch (error) {
    console.error('❌ getUserNotifications error:', error);
    throw error;
  }
}

module.exports = {
  supabase,
  // Users
  createOrUpdateUser,
  getUser,
  // Wishes
  createWish,
  getUserWishes,
  updateWish,
  deleteWish,
  // Friends
  addFriend,
  acceptFriendRequest,
  getUserFriends,
  getPendingFriendRequests,
  // Gifts
  markWishAsGifted,
  unmarkWishAsGifted,
  getWishGifters,
  // Notifications
  createNotification,
  getUserNotifications
};

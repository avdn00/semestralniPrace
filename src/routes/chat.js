//routy pro práci s chaty a zprávami.

import express from 'express';
import db from '../../db.js'; // připojení k databázi
import { isAuthenticated } from '../middleware/auth.js'; 

const router = express.Router(); 

// GET požadavek na hlavní stránku chatů
router.get('/', isAuthenticated, async (req, res) => {
  const userId = req.session.userId; //  id přihlášeného uživatele ze session
  try {
    const user = await db('users').where({ id: userId }).first(); // Načítá uživatele z databáze
    const chats = await db('chats')
      .join('chat_members', 'chats.id', 'chat_members.chat_id')
      .where('chat_members.user_id', userId)
      .select('chats.id', 'chats.name'); // Načítá chaty, kterých je uživatel členem

    res.render('chat', { 
      userId: userId, 
      username: user.username, 
      chats: chats 
    }); // Zobrazuje stránku s chaty 
  } catch (err) {
    console.error("Error loading chats:", err); 
    res.status(500).send("An error occurred while loading the chats."); 
  }
});

// POST požadavek pro vytvoření privátního chatu
router.post('/chats/private', isAuthenticated, async (req, res) => {
  const { userId, otherUserId } = req.body; 

  try {
    const existingChat = await db('chat_members as cm1')
      .join('chat_members as cm2', 'cm1.chat_id', 'cm2.chat_id')
      .where('cm1.user_id', userId)
      .andWhere('cm2.user_id', otherUserId)
      .select('cm1.chat_id')
      .first(); 
      
  // kontrola zda již existuje chat mezi těmito uživateli
    if (existingChat) {
      return res.json({ chatId: existingChat.chat_id }); // pokud chat existuje, vrací se jeho ID
    }

    const user = await db('users').where({ id: userId }).first(); // Načítá uživatele z databáze
    const otherUser = await db('users').where({ id: otherUserId }).first(); // Načítá druhého uživatele z chatu
    const chatName = `Chat between ${user.username} and ${otherUser.username}`; // Generuje název chatu

    const [insertedChat] = await db('chats').insert({ name: chatName }).returning('*'); // Vkládá nový chat do databáze
    const chatId = insertedChat.id; // Získává ID nového chatu

    await db('chat_members').insert([
      { chat_id: chatId, user_id: userId },
      { chat_id: chatId, user_id: otherUserId }
    ]); // Přidává členy do chatu

    const io = req.app.get('io'); //  instance Socket.IO
    
    // Odesílá událost vytvoření nového chatu oběma uživatelům
    io.to(`${userId}`).emit('newChat', { chatId, chatName, otherUserId, otherUserName: otherUser.username });
    io.to(`${otherUserId}`).emit('newChat', { chatId, chatName, otherUserId: userId, otherUserName: user.username });

    res.json({ chatId }); // Vrací id nově vytvořeného chatu
  } catch (err) {
    console.error("Error creating or retrieving chat:", err); 
    res.status(500).json({ error: 'An error occurred while creating or retrieving chat.' }); 
  }
});

// GET požadavek pro získání zpráv z chatu
router.get('/chats/:chatId/messages', isAuthenticated, async (req, res) => {
  try {
    const messages = await db('messages').where({ chat_id: req.params.chatId }).select(); // Načítá zprávy z databáze
    const messagesWithUsernames = await Promise.all(messages.map(async (message) => {
      const user = await db('users').where({ id: message.user_id }).first(); // Načítá uživatele pro každou zprávu
      return {
        ...message,
        username: user.username
      }; // Přidává uživatelské jméno k zprávám
    }));
    res.json(messagesWithUsernames); // Vrací zprávy s uživatelskými jmény
  } catch (err) {
    console.error("Error fetching messages:", err); // Loguje chybu
    res.status(500).json({ error: 'An error occurred while fetching messages.' }); // Vrací chybovou odpověď
  }
});

// GET požadavek pro získání chatů aktuálního uživatele
router.get('/my-chats', isAuthenticated, async (req, res) => {
  const userId = req.session.userId;

  try {
    const chats = await db('chats')
      .join('chat_members', 'chats.id', 'chat_members.chat_id')
      .where('chat_members.user_id', userId)
      .select('chats.id', 'chats.name'); // Načítá chaty aktuálního uživatele

    const chatDetails = await Promise.all(chats.map(async (chat) => {
      const chatMembers = await db('chat_members').where('chat_id', chat.id).select('user_id'); // Načítá členy chatu
      const otherUser = chatMembers.find(member => member.user_id !== userId); // Najde druhého uživatele v chatu
      const otherUserInfo = await db('users').where('id', otherUser.user_id).first(); // Načítá informace o druhém uživateli
      return {
        chat_id: chat.id,
        otherUserName: otherUserInfo.username
      }; 
    }));

    res.json(chatDetails); 
  } catch (err) {
    console.error("Error fetching user's chats:", err); 
    res.status(500).json({ error: 'An error occurred while fetching chats.' }); 
  }
});

// PUT požadavek pro úpravu zprávy
router.put('/messages/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.session.userId;

  try {
    const message = await db('messages').where({ id, user_id: userId }).first(); // Načítá zprávu z databáze

    if (!message) {
      return res.status(404).json({ error: 'Message not found or not owned by user' }); // Vrací chybu, pokud zpráva neexistuje nebo nepatří uživateli
    }

    await db('messages').where({ id }).update({ content, is_edited: true }); // Aktualizuje zprávu

    const io = req.app.get('io');
    io.to(message.chat_id).emit('messageUpdated', { id, content, chatId: message.chat_id }); // Odesílá událost aktualizace zprávy

    res.json({ success: true }); 
  } catch (err) {
    console.error('Error updating message:', err); 
    res.status(500).json({ error: 'An error occurred while updating the message' }); 
  }
});

// DELETE požadavek pro odstranění zprávy
router.delete('/messages/:id', isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  try {
    const message = await db('messages').where({ id, user_id: userId }).first(); 

    if (!message) {
      return res.status(404).json({ error: 'Message not found or not owned by user' }); 
    }

    await db('messages').where({ id }).delete();
    const io = req.app.get('io');
    io.to(message.chat_id).emit('messageDeleted', { id, chatId: message.chat_id }); // Odesílá událost odstranění zprávy

    res.json({ success: true }); 
  } catch (err) {
    console.error('Error deleting message:', err); 
    res.status(500).json({ error: 'An error occurred while deleting the message' }); 
  }
});

// DELETE požadavek pro odstranění chatu
router.delete('/chats/:chatId', isAuthenticated, async (req, res) => {
  const { chatId } = req.params;
  const userId = req.session.userId;

  try {
    const isMember = await db('chat_members')
      .where({ chat_id: chatId, user_id: userId })
      .first(); 
      
      // kontrola zda je uživatel členem chatu
    if (!isMember) {
      console.warn(`User ${userId} does not have permission to delete chat ${chatId}`);
      return res.status(403).json({ success: false, error: 'You do not have permission to delete this chat.' }); 
    }

    await db('messages')
      .where({ chat_id: chatId })
      .delete()
      .catch(err => {
        console.error('Error deleting messages:', err);
        throw new Error('Error deleting messages');
      }); // Odstraní zprávy z chatu

    await db('chat_members')
      .where({ chat_id: chatId })
      .delete()
      .catch(err => {
        console.error('Error deleting chat members:', err);
        throw new Error('Error deleting chat members');
      }); // Odstraní členy chatu

    await db('chats')
      .where({ id: chatId })
      .delete()
      .catch(err => {
        console.error('Error deleting chat:', err);
        throw new Error('Error deleting chat');
      }); // Odstraní samotný chat

    const io = req.app.get('io');
    io.emit('chatDeleted', { chatId }); // Odesílá událost odstranění chatu

    res.json({ success: true, message: 'Chat successfully deleted.' }); 
  } catch (err) {
    console.error('Error deleting chat:', err); 
    res.status(500).json({ success: false, error: 'An error occurred while deleting the chat.' }); 
  }
});

export default router; 

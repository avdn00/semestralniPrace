import db from './db.js';

// Funkce pro nastavení Socket.IO na serveru
export function setupSocketIo(io) {
  // Při navázání nového připojení
  io.on('connection', (socket) => {
    console.log('New user has connected'); // Výpis do konzole při připojení nového uživatele

    // Obsluha události, kdy uživatel vstoupí do chatu
    socket.on('joinChat', (chatId) => {
      socket.join(chatId); // Přidání uživatele do konkrétního chatu (místnosti)
      console.log(`User joined chat: ${chatId}`); // výpis do konzole 
    });

    // Obsluha události pro odeslání zprávy
    socket.on('sendMessage', async (message) => {
      try {
        // Destrukturalizace zprávy
        const { chatId, content, userId, fileUrl } = message;
        console.log(`Message received: chatId=${chatId}, content=${content}, userId=${userId}`);

        // kontrola_ zda se jedná o textovou zprávu (bez přílohy)
        if (!fileUrl) {
          // načtení uživatele z databáze podle id
          const user = await db('users').where({ id: userId }).first();
          // Vložení nové zprávy do databáze a získání vložené zprávy
          const [insertedMessage] = await db('messages')
            .insert({ chat_id: chatId, user_id: userId, content })
            .returning('*');

          const messageId = insertedMessage.id;

          // Kontrola, zda se podařilo získat id zprávy
          if (!messageId) {
            throw new Error('Message ID is not returned from the database.'); // Vyhození chyby, pokud není ID zprávy získáno
          }

          // Načtení nové zprávy z databáze
          const newMessage = await db('messages').where({ id: messageId }).first();
          newMessage.username = user.username; // Přidání uživatelského jména k nové zprávě

          // Odeslání nové zprávy všem uživatelům v chatu
          io.to(chatId).emit('newMessage', newMessage);
        }
      } catch (err) {
        console.error("Error sending message:", err); 
      }
    });

    // Obsluha události odpojení uživatele
    socket.on('disconnect', () => {
      console.log('User disconnected'); 
    });
  });
}

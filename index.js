// strana serveru

import express from 'express'; // Express pro tvorbu webového serveru
import session from 'express-session'; // Správa uživatelských session
import bodyParser from 'body-parser'; // Zpracování dat z formulářů
import db from './db.js'; 
import http from 'http'; // Vytvoření HTTP serveru
import { Server } from 'socket.io'; // Socket.IO pro komunikaci v reálném čase
import multer from 'multer'; // Nahrávání souborů
import { isAuthenticated } from './src/middleware/auth.js'; 
import authRoutes from './src/routes/auth.js'; // Route pro autentizaci
import chatRoutes from './src/routes/chat.js'; // Route pro chat
import userRoutes from './src/routes/user.js'; // Route pro uživatele
import { setupSocketIo } from './socket.js'; // Nastavení Socket.IO

// Vytvoření instance Express aplikace
const app = express();
// Vytvoření HTTP serveru s využitím Express aplikace
const server = http.createServer(app);
// Inicializace Socket.IO serveru
const io = new Server(server);

// Uložení instance Socket.IO do aplikace pro pozdější použití
app.set('io', io);

// Nastavení šablonovacího enginu na EJS
app.set('view engine', 'ejs');


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); 

// Konfigurace session
app.use(session({
  secret: 'your_secret_key', // Tajný klíč pro šifrování session
  resave: false, // Nepřepisovat session pokud nedošlo ke změnám
  saveUninitialized: false // Neukládat nové session, které nejsou modifikované
}));

app.use(authRoutes); 
app.use(chatRoutes); 
app.use(userRoutes); 

// Konfigurace pro ukládání nahraných souborů
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Adresář pro ukládání nahraných souborů
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`); // Pojmenování souboru s přidáním časové značky
  }
});

const upload = multer({ storage: storage }); // Vytvoření instance multeru pro nahrávání souborů

// Middleware pro obsluhu statických souborů
app.use('/public', express.static('public')); 
app.use('/uploads', express.static('uploads')); 

// Route pro nahrávání souborů
app.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    const { chatId, userId } = req.body; // Získání ID chatu a uživatele z těla požadavku
    const fileUrl = `/uploads/${req.file.filename}`; // URL nahraného souboru
    const user = await db('users').where({ id: userId }).first(); // Načtení uživatele z databáze

    const messageContent = `<a href="${fileUrl}" target="_blank">${req.file.originalname}</a>`; // Obsah zprávy s odkazem na soubor

    // Vložení nové zprávy do databáze a vrácení vložené zprávy
    const [insertedMessage] = await db('messages').insert({
      chat_id: chatId,
      user_id: userId,
      content: messageContent,
      file_url: fileUrl
    }).returning('*');

    insertedMessage.username = user.username; // Přidání uživatelského jména k nové zprávě

    const io = req.app.get('io'); // Získání instance Socket.IO
    // Emitování nové zprávy všem účastníkům chatu
    io.to(chatId).emit('newMessage', {
      id: insertedMessage.id,
      chat_id: chatId,
      user_id: userId,
      content: messageContent,
      file_url: fileUrl,
      username: user.username
    });

    res.json({ success: true, message: insertedMessage, user }); // Odeslání odpovědi s úspěchem a daty zprávy
  } catch (err) {
    console.error("Error uploading file:", err); // Výpis chyby při nahrávání souboru
    res.status(500).json({ success: false, error: 'Failed to upload file.' }); // Odeslání odpovědi s chybou
  }
});

// Nastavení Socket.IO
setupSocketIo(io);

export default app; // Export aplikace pro použití v jiných částech aplikace

// Spuštění serveru na portu 3000, pokud není aplikace spuštěna v testovacím módu
if (process.env.NODE_ENV !== 'test') {
  server.listen(3000, () => {
    console.log('Server running at http://localhost:3000/'); // Výpis informace o spuštění serveru
  });
}

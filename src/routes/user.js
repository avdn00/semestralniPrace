import express from 'express';
import db from '../../db.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// vrátí seznam uživatelů na základě zadaného uživatelského jména
router.get('/users', isAuthenticated, async (req, res) => {
  // Získáme parametr username z dotazu
  const { username } = req.query;
  // získáme ID aktuálně přihlášeného uživatele ze session
  const currentUserId = req.session.userId;

  // Pokud není poskytnut parametr username, vrátíme chybu  
  if (!username) {
    return res.status(400).json({ error: 'Username query parameter is required.' });
  }

  try {
    // vyhledáme uživatele v databázi, kteří mají uživatelské jméno podobné zadanému username a nejsou aktuálně přihlášeným uživatelem
    const users = await db('users')
      .where('username', 'like', `%${username}%`)
      .andWhere('id', '!=', currentUserId)
      .select('id', 'username');

    
    res.json(users);
  } catch (err) {
    console.error("Error searching for users:", err);
    res.status(500).json({ error: 'An error occurred while searching for users.' });
  }
});

// export routeru, aby mohl být použit v jiných částech aplikace
export default router;

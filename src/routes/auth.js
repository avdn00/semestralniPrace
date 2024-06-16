import express from 'express'; //knihovna pro psani serveru
import bcrypt from 'bcrypt'; // hashovani
import db from '../../db.js';

const router = express.Router(); //pro vytváření modulárních cest (rout).  funguje jako malá instance aplikace Express, která může mít své vlastní cesty a middleware 

// vykreslí registrační stránku
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// vykreslí přihlašovací stránku
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// zničí session a přesměruje na přihlašovací stránku
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Error during session destruction:", err);
      return res.redirect('/'); // presměrování na domovskou stránku při chybě
    }
    res.redirect('/login'); // přesměrování na přihlašovací stránku
  });
});

// zpracování registrace uživatele
router.post('/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render('register', { error: 'Passwords do not match.' });
  }

  try {
    const existingUser = await db('users').where({ username }).first();
    if (existingUser) {
      return res.render('register', { error: 'Username already exists.' });
    }

    const hash = await bcrypt.hash(password, 10); // Hashování hesla
    await db('users').insert({ username, password: hash });
    res.redirect('/login'); // Přesměrování na přihlašovací stránku po úspěšné registraci
  } catch (err) {
    console.error("Error during registration:", err);
    res.render('register', { error: 'An error occurred during registration.' });
  }
});

//  zpracování přihlášení uživatele
router.post('/login', async (req, res) => {
  try {
    const user = await db('users').where({ username: req.body.username }).first();
    if (user && await bcrypt.compare(req.body.password, user.password)) {
      req.session.userId = user.id; // Uložení userId do session
      res.redirect('/'); // Přesměrování na domovskou stránku po úspěšném přihlášení
    } else {
      res.render('login', { error: 'Invalid username or password.' });
    }
  } catch (err) {
    console.error("Error during login:", err);
    res.render('login', { error: 'An error occurred during login.' });
  }
});

export default router;

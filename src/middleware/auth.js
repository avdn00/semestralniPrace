// Funkce pro kontrolu, zda je uživatel autentizován
export function isAuthenticated(req, res, next) {
  // pokud je v session uložen userId, uživatel je autentizován
  if (req.session.userId) {
      return next(); 
  } else {
      // okud není userId v session, přesměruje se na přihlašovací stránku
      res.redirect('/login');
  }
}

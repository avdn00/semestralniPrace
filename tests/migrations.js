import db from '../db.js';

// Vrací databázové změny na základní stav a poté použije všechny dostupné migrace
export async function setupMigrations() {
  await db.migrate.rollback();
  await db.migrate.latest();
}

// Používá se k vrácení všech migrací zpět na základní stav
export async function rollbackMigrations() {
  await db.migrate.rollback();
}

// Funkce pro uzavření připojení k databázi
export async function closeDbConnection() {
  await db.destroy();
}

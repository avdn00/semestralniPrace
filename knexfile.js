export default { // Konfigurace pro vývojové prostředí
  development: {
    client: 'sqlite3', // Používám SQLite jako databázový klient
    connection: {
      filename: './mydb.sqlite',
    },
    useNullAsDefault: false,
  },
  test: { // Konfigurace pro testovací prostředí
    client: 'sqlite3',
    connection: {
      filename: ':memory:', // Databáze je vytvořena v paměti
    },
    useNullAsDefault: false,
  },
}
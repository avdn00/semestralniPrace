/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable('chats', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.boolean('is_group').defaultTo(false);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('messages', (table) => {
    table.increments('id').primary();
    table.integer('chat_id').unsigned().notNullable().references('id').inTable('chats').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('content').notNullable();
    table.string('file_url').nullable();
    table.boolean('is_edited').defaultTo(false); // Добавлено поле для флага редактирования
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTable('messages');
  await knex.schema.dropTable('chats');
};

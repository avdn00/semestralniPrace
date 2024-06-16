
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
    await knex.schema.createTable('chat_members', (table) => {
        table.increments('id').primary();
        table.integer('chat_id').unsigned().notNullable().references('id').inTable('chats').onDelete('CASCADE');
        table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.timestamps(true, true);
      });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
    await knex.schema.dropTableIfExists('chat_members');
};

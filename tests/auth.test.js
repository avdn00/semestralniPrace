import test from 'ava';
import supertest from 'supertest';
import app from '../index.js';
import { setupMigrations, rollbackMigrations, closeDbConnection } from './migrations.js';

const request = supertest(app);

test.serial.beforeEach(async t => {
  await setupMigrations();
});

test.serial.afterEach.always(async t => {
  await rollbackMigrations();
});

test.serial.after.always(async t => {
  await closeDbConnection();
});

// Test registrace uživatele
test.serial('Register user', async t => {
  const response = await request.post('/register').send({
    username: 'testuser',
    password: 'password',
    confirmPassword: 'password'
  });

  t.is(response.status, 302);
  t.is(response.headers.location, '/login');
});

// Test přihlášení uživatele
test.serial('Login user', async t => {
  await request.post('/register').send({
    username: 'testuser',
    password: 'password',
    confirmPassword: 'password'
  });

  const response = await request.post('/login').send({
    username: 'testuser',
    password: 'password'
  });

  t.is(response.status, 302);
  t.is(response.headers.location, '/');
});

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

test.serial('Create chat', async t => {
  await request.post('/register').send({
    username: 'user1',
    password: 'password',
    confirmPassword: 'password'
  });

  await request.post('/register').send({
    username: 'user2',
    password: 'password',
    confirmPassword: 'password'
  });

  let response = await request.post('/login').send({
    username: 'user1',
    password: 'password'
  });

  const cookies = response.headers['set-cookie'];
  response = await request.post('/chats/private')
    .set('Cookie', cookies)
    .send({
      userId: 1,
      otherUserId: 2
    });

  t.is(response.status, 200);
  t.true(response.body.chatId > 0);
});


test.serial('Delete chat', async t => {
    await request.post('/register').send({
      username: 'user1',
      password: 'password',
      confirmPassword: 'password'
    });
  
    await request.post('/register').send({
      username: 'user2',
      password: 'password',
      confirmPassword: 'password'
    });
  
    const response = await request.post('/login').send({
      username: 'user1',
      password: 'password'
    });
  
    const cookies = response.headers['set-cookie'];
  
    const chatResponse = await request.post('/chats/private')
      .set('Cookie', cookies)
      .send({
        userId: 1,
        otherUserId: 2
      });
  
    const chatId = chatResponse.body.chatId;
  
    const deleteResponse = await request.delete(`/chats/${chatId}`)
      .set('Cookie', cookies);
  
    t.is(deleteResponse.status, 200);
    t.is(deleteResponse.body.success, true);
  });
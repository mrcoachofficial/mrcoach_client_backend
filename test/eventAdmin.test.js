const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { admin, protect } = require('../src/middleware/authMiddleware');
const { isAllowedEventBanner } = require('../src/middleware/eventBannerUpload');
const eventRoutes = require('../src/routes/eventRoutes');
const { loginUser, registerUser } = require('../src/controllers/authController');
const Event = require('../src/models/Event');
const {
  cancelEvent,
  getAdminEvents,
  getEventParticipants,
  getUploadedEventBanner,
  updateEvent
} = require('../src/controllers/eventController');

test('new users default to the non-privileged user role', () => {
  const user = new User({ email: 'runner@example.com' });
  assert.equal(user.role, 'user');
  assert.equal(user.validateSync(), undefined);
});

test('public registration ignores a requested admin role and login returns the saved role', async () => {
  const originalFindOne = User.findOne;
  const originalSave = User.prototype.save;
  const originalJwtSecret = process.env.JWT_SECRET;
  let registeredUser;
  let registrationResponse;
  let loginResponse;

  User.findOne = async () => null;
  User.prototype.save = async function () {
    registeredUser = this;
  };
  process.env.JWT_SECRET = 'unit-test-secret';

  const response = {
    status() { return this; },
    json(body) { registrationResponse = body; }
  };

  try {
    await registerUser({
      body: {
        name: 'Runner',
        email: 'runner@example.com',
        password: 'password',
        role: 'admin'
      },
      ip: '127.0.0.1',
      headers: {},
      connection: { remoteAddress: '127.0.0.1' }
    }, response);
    assert.equal(registeredUser.role, 'user');
    assert.equal(registrationResponse.role, 'user');

    User.findOne = async () => ({
      _id: 'saved-user-id',
      name: 'Runner',
      email: 'runner@example.com',
      phoneNumber: null,
      role: 'admin',
      matchPassword: async () => true
    });
    await loginUser({
      body: { email: 'runner@example.com', password: 'password' }
    }, {
      json(body) { loginResponse = body; },
      status(status) {
        return { json: body => { loginResponse = { status, ...body }; } };
      }
    });
    assert.equal(loginResponse.role, 'admin');
    assert.equal(jwt.decode(loginResponse.token).role, 'admin');
  } finally {
    User.findOne = originalFindOne;
    User.prototype.save = originalSave;
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  }
});

test('admin middleware only allows users with the admin role', () => {
  let nextCalled = false;
  admin(
    { auth: { role: 'admin' }, user: { role: 'admin' } },
    { status: () => { throw new Error('unexpected rejection'); } },
    () => { nextCalled = true; }
  );
  assert.equal(nextCalled, true);

  let rejectedStatus;
  admin(
    { auth: { role: 'user' }, user: { role: 'admin' } },
    {
      status(status) {
        rejectedStatus = status;
        return { json: () => {} };
      }
    },
    () => { throw new Error('non-admin user was allowed'); }
  );
  assert.equal(rejectedStatus, 403);
});

test('protect verifies the JWT role and loads the current user', async () => {
  const originalFindById = User.findById;
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'unit-test-secret';
  User.findById = id => ({
    select: async () => ({ _id: id, role: 'admin' })
  });

  let nextCalled = false;
  const req = {
    headers: {
      authorization: `Bearer ${jwt.sign(
        { id: 'admin-id', role: 'admin' },
        process.env.JWT_SECRET
      )}`
    }
  };
  try {
    await protect(req, {
      status: () => { throw new Error('unexpected rejection'); }
    }, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.auth.role, 'admin');
    assert.equal(req.user.role, 'admin');
  } finally {
    User.findById = originalFindById;
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  }
});

test('admin event endpoints require authentication and admin role while public endpoints remain', () => {
  const protectedRoutes = [
    ['/', 'post'],
    ['/:id', 'put'],
    ['/:id', 'delete'],
    ['/:id/cancel', 'patch'],
    ['/admin/mine', 'get'],
    ['/:id/participants', 'get'],
    ['/upload-banner', 'post']
  ];

  for (const [path, method] of protectedRoutes) {
    const layer = eventRoutes.stack.find(item =>
      item.route?.path === path && item.route.methods[method]
    );
    assert.ok(layer, `${method.toUpperCase()} ${path} route exists`);
    const handlers = layer.route.stack.map(item => item.handle.name);
    const protectIndex = handlers.indexOf('protect');
    const adminIndex = handlers.indexOf('admin');
    assert.ok(protectIndex >= 0 && adminIndex > protectIndex);
    if (path === '/upload-banner') {
      assert.ok(handlers.indexOf('uploadEventBanner') > adminIndex);
    }
  }

  for (const [path, method] of [['/', 'get'], ['/upcoming', 'get'], ['/completed', 'get']]) {
    const layer = eventRoutes.stack.find(item =>
      item.route?.path === path && item.route.methods[method]
    );
    assert.ok(layer, `public ${method.toUpperCase()} ${path} remains`);
    if (path === '/') {
      assert.equal(layer.route.stack[0].handle.name, 'getEvents');
    } else {
      assert.equal(layer.route.stack.some(item => item.handle.name === 'protect'), false);
    }
  }
});

test('admin events query includes owned and legacy events for the signed-in admin', async () => {
  const originalFind = Event.find;
  let filter;
  let responseBody;
  Event.find = query => {
    filter = query;
    return {
      sort: () => ({
        lean: async () => [{ _id: 'event-1', status: 'completed' }]
      })
    };
  };

  try {
    await getAdminEvents(
      { user: { _id: 'admin-id' } },
      { json: body => { responseBody = body; } }
    );
    assert.deepEqual(filter, {
      $or: [
        { createdBy: 'admin-id' },
        { createdBy: { $exists: false } },
        { createdBy: null }
      ]
    });
    assert.equal(responseBody[0].status, 'completed');
  } finally {
    Event.find = originalFind;
  }
});

test('participants endpoint returns populated participant data and validates event ids', async () => {
  const originalFindById = Event.findById;
  const participants = [{ userId: { name: 'Runner' }, status: 'joined' }];
  let responseBody;
  Event.findById = () => ({
    populate: async () => ({ participants })
  });

  try {
    await getEventParticipants(
      { params: { id: new mongoose.Types.ObjectId().toString() } },
      { json: body => { responseBody = body; } }
    );
    assert.deepEqual(responseBody, participants);

    let statusCode;
    await getEventParticipants(
      { params: { id: 'bad-id' } },
      {
        status(code) {
          statusCode = code;
          return { json: () => {} };
        }
      }
    );
    assert.equal(statusCode, 400);
  } finally {
    Event.findById = originalFindById;
  }
});

test('cancel endpoint changes an event to cancelled', async () => {
  const originalFindById = Event.findById;
  const event = {
    status: 'upcoming',
    async save() { return this; }
  };
  let responseBody;
  Event.findById = async () => event;

  try {
    await cancelEvent(
      { params: { id: new mongoose.Types.ObjectId().toString() } },
      { json: body => { responseBody = body; } }
    );
    assert.equal(responseBody.status, 'cancelled');
  } finally {
    Event.findById = originalFindById;
  }
});

test('event edits persist the fields supplied by the admin form', async () => {
  const originalFindById = Event.findById;
  const event = {
    name: 'Old title',
    title: 'Old title',
    save: async function () { return this; }
  };
  let responseBody;
  Event.findById = async () => event;

  try {
    await updateEvent({
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: {
        name: 'New title',
        title: 'New title',
        description: 'Updated description',
        sport: 'Cycle',
        format: 'Virtual',
        rules: 'Updated rules',
        rewards: 'Updated rewards',
        targetDistance: 12,
        maxParticipants: 75,
        startDate: '2026-12-01T08:00:00.000Z',
        endDate: '2026-12-01T10:00:00.000Z',
        bannerImage: '/uploads/event-banner.png',
        image: '/uploads/event-banner.png'
      }
    }, {
      json(body) { responseBody = body; }
    });

    assert.equal(responseBody.name, 'New title');
    assert.equal(responseBody.description, 'Updated description');
    assert.equal(responseBody.sport, 'Cycle');
    assert.equal(responseBody.format, 'Virtual');
    assert.equal(responseBody.rules, 'Updated rules');
    assert.equal(responseBody.participationRules, 'Updated rules');
    assert.equal(responseBody.rewards, 'Updated rewards');
    assert.equal(responseBody.winnerRewards, 'Updated rewards');
    assert.equal(responseBody.targetDistance, 12);
    assert.equal(responseBody.maxParticipants, 75);
    assert.equal(responseBody.bannerImage, '/uploads/event-banner.png');
    assert.equal(responseBody.startDate.toISOString(), '2026-12-01T08:00:00.000Z');
    assert.equal(responseBody.endDate.toISOString(), '2026-12-01T10:00:00.000Z');
  } finally {
    Event.findById = originalFindById;
  }
});

test('banner upload response includes a public uploads URL', () => {
  let statusCode;
  let responseBody;
  getUploadedEventBanner({
    file: { filename: 'event-banner.png' },
    protocol: 'https',
    get: () => 'api.example.test'
  }, {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) { responseBody = body; }
  });
  assert.equal(statusCode, 201);
  assert.equal(responseBody.imageUrl, 'https://api.example.test/uploads/event-banner.png');
});

test('event banner upload accepts supported images and rejects other files', () => {
  assert.equal(isAllowedEventBanner({
    originalname: 'banner.webp',
    mimetype: 'image/webp'
  }), true);
  assert.equal(isAllowedEventBanner({
    originalname: 'banner.exe',
    mimetype: 'image/png'
  }), false);
  assert.equal(isAllowedEventBanner({
    originalname: 'banner.png',
    mimetype: 'application/octet-stream'
  }), false);
});

test('event creation and updates require authentication and admin role before upload', () => {
  for (const [path, method] of [['/', 'post'], ['/:id', 'put'], ['/:id', 'delete']]) {
    const layer = eventRoutes.stack.find(item =>
      item.route?.path === path && item.route.methods[method]
    );
    assert.ok(layer, `${method.toUpperCase()} ${path} route exists`);
    const handlers = layer.route.stack.map(item => item.handle.name);
    const protectIndex = handlers.indexOf('protect');
    const adminIndex = handlers.indexOf('admin');
    assert.ok(protectIndex >= 0 && adminIndex > protectIndex);
    if (method !== 'delete') {
      const uploadIndex = handlers.indexOf('uploadEventBanner');
      assert.ok(uploadIndex > adminIndex);
    }
  }
});

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getStore, resetStore } = require('../../data/seed');
const { verifyJWT, verifyBearerOrApiKey, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

function safeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// GET /users/me — must be before /users/:id
router.get('/me', verifyJWT, (req, res, next) => {
  const store = getStore();
  const user = store.users.find((u) => u.id === req.user.id);
  if (!user) return next({ status: 404, message: 'User not found' });
  res.json(safeUser(user));
});

// GET /users
router.get('/', verifyBearerOrApiKey, (req, res, next) => {
  const store = getStore();
  let users = store.users;

  // Filters
  const { department, role, isActive } = req.query;
  if (department) {
    users = users.filter((u) => u.department.toLowerCase() === department.toLowerCase());
  }
  if (role) {
    users = users.filter((u) => u.role === role);
  }
  if (isActive !== undefined) {
    const active = isActive === 'true';
    users = users.filter((u) => u.isActive === active);
  }

  // Pagination
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const total = users.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paged = users.slice(start, start + limit);

  res.json({
    data: paged.map(safeUser),
    pagination: { page, limit, total, totalPages },
  });
});

// GET /users/:id
router.get('/:id', verifyBearerOrApiKey, (req, res, next) => {
  const store = getStore();
  const user = store.users.find((u) => u.id === req.params.id);
  if (!user) return next({ status: 404, message: 'User not found' });
  res.json(safeUser(user));
});

// POST /users
router.post('/', verifyJWT, requireRole('admin'), async (req, res, next) => {
  const { name, email, password, role, department } = req.body;
  const errors = [];
  if (!name) errors.push('name is required');
  if (!email) errors.push('email is required');
  if (!password) errors.push('password is required');
  if (!role) errors.push('role is required');
  if (!department) errors.push('department is required');
  if (errors.length) return next({ status: 422, message: 'Validation failed', details: errors });

  const store = getStore();
  if (store.users.find((u) => u.email === email)) {
    return next({ status: 409, message: 'Email already exists' });
  }

  const id = uuidv4();
  const hashed = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const newUser = {
    id,
    name,
    email,
    password: hashed,
    role,
    department,
    avatar: `https://i.pravatar.cc/150?u=${email}`,
    isActive: true,
    apiKey: `ak-${name.split(' ')[0].toLowerCase()}-${id.slice(0, 6)}`,
    createdAt: now,
    updatedAt: now,
  };
  store.users.push(newUser);
  res.status(201).json(safeUser(newUser));
});

// PUT /users/:id
router.put('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  const store = getStore();
  const idx = store.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return next({ status: 404, message: 'User not found' });

  const { name, email, password, role, department, isActive } = req.body;
  const existing = store.users[idx];
  const hashed = password ? await bcrypt.hash(password, 10) : existing.password;
  const now = new Date().toISOString();

  store.users[idx] = {
    ...existing,
    name: name ?? existing.name,
    email: email ?? existing.email,
    password: hashed,
    role: role ?? existing.role,
    department: department ?? existing.department,
    isActive: isActive !== undefined ? isActive : existing.isActive,
    updatedAt: now,
  };
  res.json(safeUser(store.users[idx]));
});

// PATCH /users/:id
router.patch('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  const store = getStore();
  const idx = store.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return next({ status: 404, message: 'User not found' });

  const updates = req.body;
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }
  store.users[idx] = { ...store.users[idx], ...updates, updatedAt: new Date().toISOString() };
  res.json(safeUser(store.users[idx]));
});

// DELETE /users/:id
router.delete('/:id', verifyJWT, requireRole('admin'), (req, res, next) => {
  const store = getStore();
  const idx = store.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return next({ status: 404, message: 'User not found' });
  store.users.splice(idx, 1);
  res.status(204).send();
});

// FORM-DATA (File Upload + Fields)
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.post( '/upload-profile', verifyJWT,upload.single('avatar'),(req, res, next) => {
    const name = req.body?.name;
    const errors = [];

    if (!name) errors.push('name is required');
    if (!req.file) errors.push('avatar file is required');

    if (errors.length) {
      return next({
        status: 422,
        message: 'Validation failed',
        details: errors
      });
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      name,
      file: req.file
    });
  }
);

// x-www-form-urlencoded
// POST /send-message
router.post('/send-message', (req, res, next) => {
  const { name, email, message } = req.body;

  const errors = [];
  if (!name) errors.push('name is required');
  if (!email) errors.push('email is required');
  if (!message) errors.push('message is required');

  if (errors.length) {
    return next({
      status: 422,
      message: 'Validation failed',
      details: errors
    });
  }

  res.json({
    message: 'Message sent successfully',
    data: { name, email, message }
  });
});

module.exports = router;

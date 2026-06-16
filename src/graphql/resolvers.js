const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getStore, resetStore } = require('../data/seed');
const { GraphQLError } = require('graphql');

const JWT_SECRET = process.env.JWT_SECRET || 'workshop-secret-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function safeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function requireAuth(context) {
  if (!context.user) {
    throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
  }
}

function requireAdmin(context) {
  requireAuth(context);
  if (context.user.role !== 'admin') {
    throw new GraphQLError('Insufficient permissions', { extensions: { code: 'FORBIDDEN' } });
  }
}

const resolvers = {
  Query: {
    users: (_, { department, role, page = 1, limit = 10 }) => {
      const store = getStore();
      let users = store.users;
      if (department) users = users.filter((u) => u.department.toLowerCase() === department.toLowerCase());
      if (role) users = users.filter((u) => u.role === role);
      const total = users.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const data = users.slice(start, start + limit).map(safeUser);
      return { data, total, page, totalPages };
    },

    user: (_, { id }) => {
      const store = getStore();
      const user = store.users.find((u) => u.id === id);
      return user ? safeUser(user) : null;
    },

    me: (_, __, context) => {
      requireAuth(context);
      const store = getStore();
      const user = store.users.find((u) => u.id === context.user.id);
      return user ? safeUser(user) : null;
    },
  },

  Mutation: {
    login: async (_, { email, password }) => {
      const store = getStore();
      const user = store.users.find((u) => u.email === email);
      if (!user) throw new GraphQLError('Invalid credentials', { extensions: { code: 'UNAUTHENTICATED' } });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new GraphQLError('Invalid credentials', { extensions: { code: 'UNAUTHENTICATED' } });
      const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
      const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
      return { accessToken, refreshToken, user: safeUser(user) };
    },

    createUser: async (_, { name, email, password, role, department }, context) => {
      requireAdmin(context);
      const store = getStore();
      if (store.users.find((u) => u.email === email)) {
        throw new GraphQLError('Email already exists', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const id = uuidv4();
      const hashed = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();
      const newUser = {
        id, name, email, password: hashed, role, department,
        avatar: `https://i.pravatar.cc/150?u=${email}`,
        isActive: true,
        apiKey: `ak-${name.split(' ')[0].toLowerCase()}-${id.slice(0, 6)}`,
        createdAt: now, updatedAt: now,
      };
      store.users.push(newUser);
      return safeUser(newUser);
    },

    updateUser: async (_, { id, ...updates }, context) => {
      requireAdmin(context);
      const store = getStore();
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
      store.users[idx] = { ...store.users[idx], ...updates, updatedAt: new Date().toISOString() };
      return safeUser(store.users[idx]);
    },

    deleteUser: (_, { id }, context) => {
      requireAdmin(context);
      const store = getStore();
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
      store.users.splice(idx, 1);
      return true;
    },

    resetData: async (_, __, context) => {
      requireAdmin(context);
      await resetStore();
      return true;
    },
  },
};

module.exports = { resolvers };

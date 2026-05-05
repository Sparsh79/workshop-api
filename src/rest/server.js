require('dotenv').config();
const express = require('express');
const { seedStore, resetStore, getStore } = require('../data/seed');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const oauthRoutes = require('./routes/oauth.routes');
const cookieRoutes = require('./routes/cookie.routes');
const cookieMiddleware = require('./middleware/cookie.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const { verifyJWT, requireRole } = require('./middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT_REST || 3000;

app.use(express.json());

// Health & Version
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/version', (req, res) => {
  res.json({ version: '1.0.0', environment: process.env.NODE_ENV || 'development', protocols: ['REST', 'GraphQL', 'gRPC'] });
});

// Reset
app.post('/reset', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    await resetStore();
    res.json({ message: 'Data reset to seed state', userCount: getStore().users.length });
  } catch (err) {
    next(err);
  }
});

// Apply middleware
cookieMiddleware.applyMiddleware(app);

// Routes
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/oauth', oauthRoutes);
app.use('/cookies', cookieRoutes);


// Error handler
app.use(errorMiddleware);

seedStore().then(() => {
  app.listen(PORT, () => console.log(`REST server running on http://localhost:${PORT}`));
});

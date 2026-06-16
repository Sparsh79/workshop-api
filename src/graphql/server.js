require('dotenv').config();
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const jwt = require('jsonwebtoken');
const { typeDefs } = require('./schema');
const { resolvers } = require('./resolvers');
const { seedStore } = require('../data/seed');

const JWT_SECRET = process.env.JWT_SECRET || 'workshop-secret-2024';
const PORT = parseInt(process.env.PORT_GRAPHQL) || 4000;

async function startServer() {
  await seedStore();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
    context: async ({ req }) => {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const user = jwt.verify(token, JWT_SECRET);
          return { user };
        } catch (_) {}
      }
      return { user: null };
    },
  });

  console.log(`GraphQL server running on ${url}graphql`);
}

startServer().catch(console.error);

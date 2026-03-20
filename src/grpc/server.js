require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { ReflectionService } = require('@grpc/reflection');
const path = require('path');
const fs = require('fs');
const { seedStore } = require('../data/seed');
const handlers = require('./handlers');

const PROTO_PATH = path.join(__dirname, 'user.proto');
const PORT = process.env.PORT_GRPC || 50051;
const TLS = process.env.GRPC_TLS === 'true';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDefinition).user;

const server = new grpc.Server();

server.addService(userProto.UserService.service, {
  GetUser: handlers.GetUser,
  ListUsers: handlers.ListUsers,
  CreateUsers: handlers.CreateUsers,
  Chat: handlers.Chat,
});

const reflection = new ReflectionService(packageDefinition);
reflection.addToServer(server);

seedStore().then(() => {
  let credentials;
  if (TLS) {
    credentials = grpc.ServerCredentials.createSsl(null, [
      {
        private_key: fs.readFileSync(path.join(process.cwd(), 'certs/server.key')),
        cert_chain: fs.readFileSync(path.join(process.cwd(), 'certs/server.crt')),
      },
    ], false);
  } else {
    credentials = grpc.ServerCredentials.createInsecure();
  }

  server.bindAsync(`0.0.0.0:${PORT}`, credentials, (err, port) => {
    if (err) {
      console.error('gRPC server failed to start:', err);
      return;
    }
    console.log(`gRPC server running on port ${port} (TLS: ${TLS})`);
  });
});

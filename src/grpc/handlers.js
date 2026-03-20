const grpc = require('@grpc/grpc-js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getStore } = require('../data/seed');

function toGrpcUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    is_active: user.isActive,
    avatar: user.avatar,
    created_at: user.createdAt,
  };
}

function GetUser(call, callback) {
  const store = getStore();
  const user = store.users.find((u) => u.id === call.request.id);
  if (!user) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'User not found' });
  }
  callback(null, toGrpcUser(user));
}

function ListUsers(call) {
  const store = getStore();
  let users = store.users;
  const { department, limit } = call.request;
  if (department) {
    users = users.filter((u) => u.department.toLowerCase() === department.toLowerCase());
  }
  const max = limit > 0 ? limit : 10;
  users = users.slice(0, max);

  let i = 0;
  function sendNext() {
    if (i >= users.length) {
      call.end();
      return;
    }
    call.write(toGrpcUser(users[i]));
    i++;
    setTimeout(sendNext, 200);
  }
  sendNext();
}

async function CreateUsers(call, callback) {
  const incoming = [];
  call.on('data', (req) => incoming.push(req));
  call.on('end', async () => {
    const store = getStore();
    const ids = [];
    for (const req of incoming) {
      const id = uuidv4();
      const hashed = await bcrypt.hash('Workshop@123', 10);
      const now = new Date().toISOString();
      store.users.push({
        id,
        name: req.name,
        email: req.email,
        password: hashed,
        role: req.role || 'user',
        department: req.department || 'Backend',
        avatar: `https://i.pravatar.cc/150?u=${req.email}`,
        isActive: true,
        apiKey: `ak-${(req.name || 'user').split(' ')[0].toLowerCase()}-${id.slice(0, 6)}`,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }
    callback(null, { created_count: ids.length, ids });
  });
}

function Chat(call) {
  call.on('data', (msg) => {
    call.write({
      sender: 'server',
      text: `Echo: ${msg.text}`,
      timestamp: new Date().toISOString(),
    });
  });
  call.on('end', () => call.end());
}

module.exports = { GetUser, ListUsers, CreateUsers, Chat };

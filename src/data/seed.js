const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 10;
const PLAIN_PASSWORD = 'Workshop@123';

const seedUsers = [
  { id: 'u-001', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin',     department: 'Backend',  apiKey: 'ak-alice-001' },
  { id: 'u-002', name: 'Bob Martinez',  email: 'bob@example.com',   role: 'user',      department: 'Frontend', apiKey: 'ak-bob-002'   },
  { id: 'u-003', name: 'Carol Smith',   email: 'carol@example.com', role: 'moderator', department: 'DevOps',   apiKey: 'ak-carol-003' },
  { id: 'u-004', name: 'David Lee',     email: 'david@example.com', role: 'user',      department: 'Backend',  apiKey: 'ak-david-004' },
  { id: 'u-005', name: 'Eva Williams',  email: 'eva@example.com',   role: 'user',      department: 'Frontend', apiKey: 'ak-eva-005'   },
  { id: 'u-006', name: 'Frank Brown',   email: 'frank@example.com', role: 'admin',     department: 'DevOps',   apiKey: 'ak-frank-006' },
  { id: 'u-007', name: 'Grace Kim',     email: 'grace@example.com', role: 'user',      department: 'QA',       apiKey: 'ak-grace-007' },
  { id: 'u-008', name: 'Henry Davis',   email: 'henry@example.com', role: 'user',      department: 'Backend',  apiKey: 'ak-henry-008' },
  { id: 'u-009', name: 'Irene Taylor',  email: 'irene@example.com', role: 'moderator', department: 'Frontend', apiKey: 'ak-irene-009' },
  { id: 'u-010', name: 'Jake Wilson',   email: 'jake@example.com',  role: 'user',      department: 'QA',       apiKey: 'ak-jake-010'  },
  { id: 'u-011', name: 'Karen Moore',   email: 'karen@example.com', role: 'user',      department: 'DevOps',   apiKey: 'ak-karen-011' },
  { id: 'u-012', name: 'Liam Chen',     email: 'liam@example.com',  role: 'admin',     department: 'Backend',  apiKey: 'ak-liam-012'  },
];

let store = { users: [] };

async function seedStore() {
  const hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, SALT_ROUNDS);
  const now = new Date().toISOString();
  store.users = seedUsers.map((u) => ({
    ...u,
    password: hashedPassword,
    avatar: `https://i.pravatar.cc/150?u=${u.email}`,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));
}

async function resetStore() {
  store = { users: [] };
  await seedStore();
}

function getStore() {
  return store;
}

module.exports = { getStore, resetStore, seedStore };

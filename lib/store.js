const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PERMISSIONS = ['Admin', 'Scheduler', 'Manage teams', 'Manage resources'];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

class Store {
  constructor(filename) {
    this.filename = filename;
    this.data = { users: [], teams: [], tasks: [], holidays: [], resources: [] };
    if (fs.existsSync(filename)) this.data = { ...this.data, ...JSON.parse(fs.readFileSync(filename, 'utf8')) };
  }
  save() {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    fs.writeFileSync(this.filename, JSON.stringify(this.data, null, 2));
  }
  publicUser(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return safe;
  }
  createUser({ username, password, displayName, email, source = 'local' }) {
    username = username.trim().toLowerCase();
    if (this.data.users.some((u) => u.username === username)) throw new Error('That username is already registered.');
    const first = this.data.users.length === 0;
    const user = { id: crypto.randomUUID(), username, displayName: displayName.trim(), email: (email || '').trim(), source,
      passwordHash: password ? hashPassword(password) : '', permissions: first ? [...PERMISSIONS] : [], createdAt: new Date().toISOString() };
    this.data.users.push(user); this.save(); return this.publicUser(user);
  }
  authenticate(username, password) {
    const user = this.data.users.find((u) => u.username === username.trim().toLowerCase());
    return user && user.passwordHash && verifyPassword(password, user.passwordHash) ? this.publicUser(user) : null;
  }
  user(id) { return this.data.users.find((u) => u.id === id); }
  updatePermissions(id, permissions) {
    const user = this.user(id); if (!user) throw new Error('User not found');
    user.permissions = PERMISSIONS.filter((p) => permissions.includes(p)); this.save(); return this.publicUser(user);
  }
  addTeam(team) {
    const value = { id: crypto.randomUUID(), name: team.name, description: team.description || '', members: team.members || [], createdAt: new Date().toISOString() };
    this.data.teams.push(value); this.save(); return value;
  }
  addTask(task) { const value = { id: crypto.randomUUID(), ...task, createdAt: new Date().toISOString() }; this.data.tasks.push(value); this.save(); return value; }
  addHoliday(holiday) { const value = { id: crypto.randomUUID(), ...holiday, createdAt: new Date().toISOString() }; this.data.holidays.push(value); this.save(); return value; }
}

module.exports = { Store, PERMISSIONS, hashPassword, verifyPassword };

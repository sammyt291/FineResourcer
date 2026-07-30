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
  updateUser(id, changes) {
    const user = this.user(id); if (!user) throw new Error('User not found');
    if (changes.displayName?.trim()) user.displayName = changes.displayName.trim();
    if (Object.hasOwn(changes, 'email')) user.email = (changes.email || '').trim();
    this.save(); return this.publicUser(user);
  }
  addTeam(team) {
    const value = { id: crypto.randomUUID(), name: team.name, description: team.description || '', members: team.members || [], createdAt: new Date().toISOString() };
    this.data.teams.push(value); this.save(); return value;
  }
  updateTeam(id, changes) {
    const team = this.data.teams.find((item) => item.id === id); if (!team) throw new Error('Team not found');
    if (changes.name?.trim()) team.name = changes.name.trim();
    if (Object.hasOwn(changes, 'description')) team.description = changes.description || '';
    if (Array.isArray(changes.members)) team.members = changes.members;
    this.save(); return team;
  }
  addTask(task) { const value = { id: crypto.randomUUID(), ...task, createdAt: new Date().toISOString() }; this.data.tasks.push(value); this.save(); return value; }
  updateTask(id, changes) {
    const task = this.data.tasks.find((item) => item.id === id); if (!task) throw new Error('Task not found');
    for (const key of ['userId', 'title', 'start', 'end', 'notes']) if (Object.hasOwn(changes, key)) task[key] = changes[key];
    this.save(); return task;
  }
  removeTask(id) { const index = this.data.tasks.findIndex((item) => item.id === id); if (index < 0) throw new Error('Task not found'); this.data.tasks.splice(index, 1); this.save(); }
  addHoliday(holiday) { const value = { id: crypto.randomUUID(), ...holiday, createdAt: new Date().toISOString() }; this.data.holidays.push(value); this.save(); return value; }
  updateHoliday(id, changes) {
    const holiday = this.data.holidays.find((item) => item.id === id); if (!holiday) throw new Error('Holiday not found');
    for (const key of ['userId', 'start', 'end', 'note']) if (Object.hasOwn(changes, key)) holiday[key] = changes[key];
    this.save(); return holiday;
  }
  removeHoliday(id) { const index = this.data.holidays.findIndex((item) => item.id === id); if (index < 0) throw new Error('Holiday not found'); this.data.holidays.splice(index, 1); this.save(); }
}

module.exports = { Store, PERMISSIONS, hashPassword, verifyPassword };

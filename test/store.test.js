const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { Store, PERMISSIONS, hashPassword, verifyPassword } = require('../lib/store');

test('passwords are salted and verified', () => { const hash = hashPassword('correct horse'); assert.notEqual(hash, 'correct horse'); assert.equal(verifyPassword('correct horse', hash), true); assert.equal(verifyPassword('wrong', hash), false); });
test('first user is administrator and subsequent users are not', () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resourcer-')); const store = new Store(path.join(dir, 'data.json')); const first = store.createUser({ username: 'Admin', password: 'password1', displayName: 'Admin User' }); const second = store.createUser({ username: 'person', password: 'password2', displayName: 'Team Person' }); assert.deepEqual(first.permissions, PERMISSIONS); assert.deepEqual(second.permissions, []); assert.equal(store.authenticate('admin', 'password1').id, first.id); });
test('teams, tasks and holidays persist', () => { const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'resourcer-')), 'data.json'); const store = new Store(file); store.addTeam({ name: 'Design', members: [] }); store.addTask({ title: 'Workshop', userId: '1' }); store.addHoliday({ note: 'Leave', userId: '1' }); const restored = new Store(file); assert.equal(restored.data.teams[0].name, 'Design'); assert.equal(restored.data.tasks[0].title, 'Workshop'); assert.equal(restored.data.holidays[0].note, 'Leave'); });

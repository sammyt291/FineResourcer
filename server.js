const path = require('node:path');
const express = require('express');
const session = require('express-session');
const ldap = require('ldapjs');
const { Store, PERMISSIONS } = require('./lib/store');

const app = express();
const store = new Store(process.env.DATA_FILE || path.join(__dirname, 'data', 'store.json'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: process.env.SESSION_SECRET || 'change-me-in-production', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 } }));

function loggedIn(req, res, next) { if (!req.session.userId) return res.status(401).json({ error: 'Please sign in.' }); next(); }
function permitted(permission) { return (req, res, next) => { const user = store.user(req.session.userId); if (!user?.permissions.includes(permission)) return res.status(403).json({ error: 'You do not have permission.' }); next(); }; }
function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }

app.get('/api/config', (_req, res) => res.json({ ldapEnabled: Boolean(process.env.LDAP_URL) }));
app.post('/api/register', (req, res) => {
  const { username, password, displayName, email } = req.body;
  if (!username || !displayName || !password || password.length < 8) return res.status(400).json({ error: 'Name, username and a password of at least 8 characters are required.' });
  try { const user = store.createUser({ username, password, displayName, email }); req.session.userId = user.id; res.status(201).json(user); }
  catch (error) { res.status(409).json({ error: error.message }); }
});
app.post('/api/login', asyncRoute(async (req, res) => {
  const { username, password, provider = 'local' } = req.body;
  let user;
  if (provider === 'ldap') {
    if (!process.env.LDAP_URL) return res.status(400).json({ error: 'Active Directory is not configured.' });
    const client = ldap.createClient({ url: process.env.LDAP_URL });
    const dn = (process.env.LDAP_BIND_TEMPLATE || '{username}').replace('{username}', username);
    await new Promise((resolve, reject) => client.bind(dn, password, (error) => error ? reject(error) : resolve())); client.unbind();
    user = store.data.users.find((u) => u.username === username.toLowerCase());
    if (!user) user = store.createUser({ username, displayName: username, source: 'ldap' });
  } else user = store.authenticate(username || '', password || '');
  if (!user) return res.status(401).json({ error: 'Incorrect username or password.' });
  req.session.userId = user.id; res.json(user);
}));
app.post('/api/logout', (req, res) => req.session.destroy(() => res.status(204).end()));
app.get('/api/me', loggedIn, (req, res) => res.json(store.publicUser(store.user(req.session.userId))));
app.get('/api/state', loggedIn, (req, res) => {
  const user = store.user(req.session.userId);
  res.json({ users: store.data.users.map((u) => store.publicUser(u)), teams: store.data.teams, tasks: store.data.tasks,
    holidays: store.data.holidays, resources: store.data.resources, permissions: PERMISSIONS, currentUser: store.publicUser(user) });
});
app.put('/api/users/:id/permissions', loggedIn, permitted('Admin'), (req, res) => res.json(store.updatePermissions(req.params.id, req.body.permissions || [])));
app.put('/api/users/:id', loggedIn, permitted('Manage resources'), (req, res) => res.json(store.updateUser(req.params.id, req.body)));
app.post('/api/teams', loggedIn, permitted('Manage teams'), (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ error: 'Team name is required.' });
  res.status(201).json(store.addTeam({ ...req.body, name: req.body.name.trim() }));
});
app.put('/api/teams/:id', loggedIn, permitted('Manage teams'), (req, res) => {
  if (!req.body.name?.trim()) return res.status(400).json({ error: 'Team name is required.' });
  res.json(store.updateTeam(req.params.id, req.body));
});
app.post('/api/tasks', loggedIn, permitted('Scheduler'), (req, res) => {
  if (!req.body.userId || !req.body.title || !req.body.start || !req.body.end) return res.status(400).json({ error: 'Person, title, start and end are required.' });
  res.status(201).json(store.addTask({ ...req.body, createdBy: req.session.userId }));
});
app.put('/api/tasks/:id', loggedIn, permitted('Scheduler'), (req, res) => {
  if (!req.body.userId || !req.body.title || !req.body.start || !req.body.end) return res.status(400).json({ error: 'Person, title, start and end are required.' });
  res.json(store.updateTask(req.params.id, req.body));
});
app.delete('/api/tasks/:id', loggedIn, permitted('Scheduler'), (req, res) => { store.removeTask(req.params.id); res.status(204).end(); });
app.post('/api/holidays', loggedIn, (req, res) => {
  const self = req.body.userId === req.session.userId;
  if (!self && !store.user(req.session.userId).permissions.includes('Scheduler')) return res.status(403).json({ error: 'Only schedulers may add leave for others.' });
  if (!req.body.userId || !req.body.start || !req.body.end) return res.status(400).json({ error: 'Person and dates are required.' });
  res.status(201).json(store.addHoliday({ ...req.body, createdBy: req.session.userId }));
});
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: error.name === 'InvalidCredentialsError' ? 'Active Directory sign-in failed.' : 'Something went wrong.' }); });

if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log(`FineResourcer running at http://localhost:${process.env.PORT || 3000}`));
module.exports = { app, store };

# FineResourcer

A modern Express application for team availability, calendar tasks, holidays and role-based administration.

## Run locally

```bash
npm install
SESSION_SECRET="replace-with-a-long-random-value" npm start
```

Open <http://localhost:3000>. The first locally registered user receives all administrator permissions.

## Optional Active Directory authentication

Set the following environment variables before starting the server:

```bash
LDAP_URL="ldaps://directory.example.com:636"
LDAP_BIND_TEMPLATE="{username}@example.com"
SESSION_SECRET="replace-with-a-long-random-value"
npm start
```

`LDAP_BIND_TEMPLATE` may use `{username}` anywhere in the bind identity. LDAP users are created locally on their first successful bind so permissions and schedules can be assigned. Use LDAPS in production.

Data is stored in `data/store.json` by default. Set `DATA_FILE` to use another path. Set `PORT` to change the listening port.

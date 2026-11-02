# LNMIIT Events — College Event Management Portal

A web portal where LNMIIT faculty and student organisers (fests, clubs) create and run events, and students browse, register, pay, attend and download certificates — replacing the current "Google Form by email" process.

**Live demo:** https://event-portal-gold.vercel.app
*(Hosted on free tiers: the first request after ~15 minutes of inactivity can take up to a minute while the server wakes up.)*

![Login page](docs/screenshots/login.png)

---

## Demo accounts

All demo accounts use the password **`Password@123`**.

| Role | Name | Email | What to try |
|---|---|---|---|
| Student | Riya | `riya@lnmiit.ac.in` | Browse events, register, pay (simulated), my registrations, download a certificate, give feedback |
| Student | Priya | `priya@lnmiit.ac.in ` | Team events (accept an invite), registrations |
| Club Coordinator (Music Club) | Aman | `aman@lnmiit.ac.in` | Create a club event, approve/reject registrations, mark attendance, issue certificates, add delegates |
| GSec (Plinth) | Kabir | `kabir@lnmiit.ac.in` | Fest-level and umbrella events (Plinth Tech Week) |
| Faculty | Dr. Anil Mehta | `anil.mehta@lnmiit.ac.in` | Faculty events (workshops, training) |
| Admin | Admin | `admin@lnmiit.ac.in ` | Users, fests & clubs, positions, departments, event types |

---

## Features

**For the admin**
- Users, departments, venues, event types, fests and clubs
- Assigns positions (Fest Head of a fest, GSec of a fest, Club Coordinator of a club) on students' pre-existing accounts

**For students**
- Browse events with filters and status badges (Registration open, Few seats, Registered, Clash, Not eligible, Part of an umbrella event)
- Register with automatic checks: eligibility (program/year/department), time clash with other registrations, seats left, conflict of interest
- Approval flow (auto-approve or organiser approval), simulated payment, status trail (Pending → Approved → Paid → Attended → Certificate)
- Team events: create a team, invite members, accept/decline invites, submit as a team
- Notification bell, announcements, feedback (1–5 stars + comments)
- Download certificates as PDF, each with a unique certificate code

**For organisers (faculty, Fest Head/GSec, Fest Event Creator, Club Coordinator)**
- Create events with scope (single-club, multi-club, fest, faculty), type rules, eligibility grid, capacity, fee, deadline, team settings, auto-approve
- Umbrella events (e.g. a tech week inside Plinth) containing child events
- Event control page: registrations (bulk approve/reject), per-session attendance, certificates, announcements, feedback summary, delegates, sessions
- Delegation: give a student specific permissions on one event (registrations, attendance, announcements & files, certificates); expires automatically

---

## Security features

| Area | What the portal does |
|---|---|
| **Passwords** | Stored only as **bcrypt** hashes (salted, slow by design); the plain password is never saved or logged |
| **Login sessions** | Signed **JWT** tokens with an expiry; every request re-reads the user from the database, so a **deactivated account is locked out immediately** |
| **Role-based access** | Every protected API route checks the role on the **server** (`authorize(...roles)`); hiding buttons in the UI is only for convenience |
| **Event-level permissions** | One function decides what each user may do on each event (owner, fest leaders, club coordinator, delegate). Delegates get only the permissions they were given, never "manage" (cancel/delete, delegates), and lose them automatically 15 days after the event |
| **Conflict of interest** | Organisers cannot register for events they manage; a delegate who is also registered cannot approve, mark attendance or issue merit certificates **for themselves** |
| **Hidden drafts** | Unpublished events return *404 Not Found* to anyone who cannot manage them, so their existence is not revealed |
| **SQL injection** | **Parameterised queries only** (`?` placeholders); SQL is never built by joining strings |
| **Input validation** | Every request body is validated with **express-validator**; only whitelisted fields are copied into the database (no mass assignment, e.g. a user cannot set their own role) |
| **Database integrity** | CHECK constraints, foreign keys and UNIQUE keys reject invalid data even if a bug slips through the code |
| **Race conditions** | Seat allocation and payments run in **transactions with row locks**, so the last seat cannot be given twice |
| **File uploads** | File type and size limits; private files are served only through an authenticated, permission-checked route; `X-Content-Type-Options: nosniff` on public files |
| **Errors** | Clients get short, generic messages with the right status code (400/401/403/404/409); details are logged on the server only |
| **Secrets** | Database password, JWT secret and mail credentials live in `.env` (never committed) or the hosting provider's settings |
| **Network** | **CORS allow-list** (only the portal's own frontend may call the API); HTTPS on the live site; **SSL with certificate verification** between backend and database |
| **Least privilege** | Locally the app connects with a MySQL account that can only read and write rows of `event_portal` (no CREATE/DROP) |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite), React-Bootstrap, React Router, axios |
| Backend | Node.js, Express 5, express-validator, JWT, bcrypt, multer, pdfkit, nodemailer |
| Database | MySQL 8.4 (mysql2 connection pool) |
| Hosting | Vercel (frontend), Render (backend), Aiven (MySQL) |

```
Browser ──HTTPS/JSON──► Express API ──SQL (pool, SSL)──► MySQL
(React SPA)             (auth, permissions, business rules)   (25 tables + 1 view)
```

---

## Key design decisions

- **Server-side authorisation on every route.** Middleware chain: `authenticate` (JWT) → `authorize(role)` / `requireEventPermission(permission)` → `validate(rules)` → controller. One function, `getEventPermissions(user, event)`, decides what a user may do on an event: admin/owner → fest leaders → fest event creator → club coordinator → delegate.
- **No overbooking.** Seat allocation runs in a MySQL transaction: the event row is locked with `SELECT … FOR UPDATE`, seats are counted with a locking read (`FOR SHARE`), then the registration is written and committed.
- **Lifecycle is computed, not stored.** The view `v_events` derives *registration open / closed / upcoming / ongoing / completed* from the current time with `CASE` + `NOW()`, so statuses are never stale and need no scheduled job.
- **Integrity in the database.** CHECK constraints, composite foreign keys (e.g. a club event must use the club's own fest) and generated columns with UNIQUE keys (e.g. one Fest Head per fest, at most one successful payment per registration).
- **Clash detection** uses the interval-overlap rule `a.start < b.end AND b.start < a.end` against the student's pending/approved/confirmed registrations.
- **Participant delegates cannot act on themselves.** A student registered for an event may still be made a delegate of it (for example, a volunteer who also participates). Their delegated permissions apply to every other participant, but the server refuses any action on **their own** registration: they cannot approve or reject themselves, mark their own attendance, or issue themselves a merit or appreciation certificate. Their own record stays under the control of the event's organisers.

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | Requirements, actors, rules, build tiers |
| [`docs/01-architecture.md`](docs/01-architecture.md) | Architecture and request flow |
| [`docs/02-folder-structure.md`](docs/02-folder-structure.md) | Folder structure |
| [`docs/03-database-schema.md`](docs/03-database-schema.md) | Tables, constraints, techniques |
| [`docs/04-api-list.md`](docs/04-api-list.md) | REST API endpoints |
| [`backend/db/schema.sql`](backend/db/schema.sql) | Full schema |

### Future scope

Planned extensions, not part of the current version:
- **QR check-in** for attendance and an event **photo gallery**.
- **Real payment gateway** (e.g. Razorpay; payment logic is already isolated in one module, so only that module changes) and **refunds** for cancelled paid registrations.

---

## Run it locally

**Prerequisites:** Node.js 20+, MySQL 8.x, Git.

1. **Database** (MySQL Workbench or the `mysql` command line, as root):
   - `backend/db/setup.sql` — creates the `event_portal` database and the app user (set a password first)
   - `backend/db/schema.sql` — tables and view
   - `backend/db/seed.sql` — users, fests, clubs, positions, master data
   - optional: `backend/db/cleanup-events.sql` then `backend/db/demo.sql` — fresh demo events dated relative to today
2. **Backend**
   ```
   cd backend
   copy .env.example .env      (then fill in DB_PASSWORD and JWT_SECRET)
   npm install
   npm run dev                 → http://localhost:5000/api/health
   ```
3. **Frontend**
   ```
   cd frontend
   copy .env.example .env      (VITE_API_URL=http://localhost:5000/api)
   npm install
   npm run dev                 → http://localhost:5173
   ```

---

## Testing

The project was built in **vertical slices**: each feature went table → API route → React page, and was tested at every layer before moving on to the next feature. All testing was manual (no automated test suite).

### 1. Database (MySQL Workbench)
- Ran `schema.sql` and `seed.sql`, then checked that the tables, the `v_events` view and the demo rows were created correctly.
- **Constraint tests:** deliberately inserted invalid rows to confirm that the database itself rejects them, for example:
  - a duplicate registration → error 1062 (UNIQUE);
  - a Music Club event filed under the wrong fest → error 1452 (composite foreign key);
  - an umbrella event with registration turned on → error 3819 (CHECK).
- **Least-privilege test:** logged in as the app account and confirmed that `CREATE`, `DROP` and `USE mysql` are refused (error 1044).
- **Race-condition test:** opened two Workbench connections and registered for the last seat from both at the same time. Without the row lock, a 3-seat event got 4 registrations; with `SELECT … FOR UPDATE`, the second transaction waited and was refused.
- **Lifecycle test:** queried `v_events` with events dated in the past, present and future to check every computed status.

### 2. Backend API (Postman)
Every route was called from **Postman** before any React page used it:
- one saved **JWT per role** (student, club coordinator, fest leader, faculty, admin) in the Authorization tab, to test each route as different users;
- **positive tests:** correct body → `200`/`201` with the expected JSON;
- **negative tests** for every rule, checking both the status code and the message:

| Status | Example test |
|---|---|
| `400` | missing or invalid fields; child event dated outside its umbrella; registering for an event with registration turned off |
| `401` | no token, or an expired or tampered token |
| `403` | a student trying an admin route (creating a department); a coordinator editing another club's event; a delegate approving their own registration |
| `404` | opening someone else's draft event |
| `409` | duplicate names; registering twice; time clash; no seats left |

### 3. Frontend (browser)
- Walked through each feature end to end in the browser, logged in as the relevant role.
- **Several users at once:** different browsers or Incognito windows (each has its own login), e.g. a student registers in one window while the organiser approves it in another and the student's notification bell updates.
- **Browser DevTools** (F12): the *Network* tab to inspect requests, status codes and JSON responses; the *Console* for errors.
- Scenario tests:
  - eligibility (program/year/department grid);
  - clash detection between overlapping events;
  - auto-approve vs manual approval;
  - simulated payment;
  - the team flow (invite → accept → submit → approve);
  - per-session attendance and the 75% certificate rule (demo attendance 3/3, 2/3 and 1/3 sessions: only the first two qualify);
  - delegate permissions and their self-action limits;
  - certificate PDF download.
- **Demo data** (`demo.sql`) creates events dated relative to the current day, so every lifecycle state (open, upcoming, ongoing, completed) can be tested at any time.

### 4. Deployment (live site)
- `GET /api/health` from the internet, to confirm that the backend reaches the cloud database over SSL and uses Indian time.
- **CORS:** the live frontend can call the API, and other sites cannot.
- Refreshing deep links (e.g. `/events/12`) to check the single-page-app rewrite on Vercel.
- The full student and organiser flows on the live site, from a laptop and from a phone on mobile data.

---

## Project structure

```
backend/
  config/        constants (roles, statuses, permissions)
  db/            pool.js, schema.sql, seed.sql, demo.sql, cleanup-events.sql
  middleware/    authenticate, authorize, validate, event permissions, errorHandler
  routes/        one router per feature
  controllers/   request handlers
  services/      business logic (permissions, registration, payment, certificates, email)
  server.js
frontend/
  src/
    api/         axios client
    context/     AuthContext (logged-in user)
    components/  NavBar, EventCard, MasterTable, PayButton, TeamPanel, …
    pages/       Login, Dashboard, BrowseEvents, EventDetail, MyRegistrations,
                 MyCertificates, organize/…, admin/…
docs/            design documents and screenshots
```

---

## Known limitations (free hosting)

- The backend sleeps after 15 minutes without traffic; the first request then takes up to a minute.
- Uploaded files (posters, logos) are not kept across server restarts on the free plan.
- Emails are not sent from the hosted version (outgoing mail ports are blocked on the free plan); in-app notifications work.

## References

**Official documentation used to build the project**

| Topic | Source |
|---|---|
| React (components, hooks, context) | [react.dev](https://react.dev) |
| Vite (dev server, build, environment variables) | [vite.dev](https://vite.dev) |
| React Router (pages and routes) | [reactrouter.com](https://reactrouter.com) |
| React-Bootstrap (UI components) | [react-bootstrap.github.io](https://react-bootstrap.github.io) |
| axios (HTTP client, interceptors) | [axios-http.com](https://axios-http.com) |
| Node.js | [nodejs.org/docs](https://nodejs.org/docs) |
| Express (routing, middleware, error handling) | [expressjs.com](https://expressjs.com) |
| express-validator (input validation) | [express-validator.github.io](https://express-validator.github.io) |
| mysql2 (connection pool, prepared statements) | [sidorares.github.io/node-mysql2](https://sidorares.github.io/node-mysql2/docs) |
| MySQL 8.4 Reference Manual (constraints, generated columns, views) | [dev.mysql.com/doc/refman/8.4](https://dev.mysql.com/doc/refman/8.4/en/) |
| InnoDB locking reads (`FOR UPDATE` / `FOR SHARE`) | [MySQL: Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) |
| JSON Web Tokens | [jwt.io/introduction](https://jwt.io/introduction), [node-jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) |
| bcrypt (password hashing) | [node.bcrypt.js](https://github.com/kelektiv/node.bcrypt.js) |
| multer (file uploads) | [expressjs/multer](https://github.com/expressjs/multer) |
| PDFKit (certificate PDFs) | [pdfkit.org](https://pdfkit.org) |
| Nodemailer (email) | [nodemailer.com](https://nodemailer.com) |
| HTTP status codes and CORS | [MDN: HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status), [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) |

**Security guidelines**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

**Tools**
- [Postman documentation](https://learning.postman.com/docs/): API testing
- [MySQL Workbench manual](https://dev.mysql.com/doc/workbench/en/): database design and testing
- [Git](https://git-scm.com/doc) and [GitHub](https://docs.github.com): version control

**Hosting**
- [Vercel docs](https://vercel.com/docs) (frontend), [Render docs](https://render.com/docs) (backend), [Aiven for MySQL docs](https://aiven.io/docs/products/mysql) (database)

**Design inspiration**
- Colours and typography inspired by the official [LNMIIT website](https://lnmiit.ac.in); fonts [Libre Baskerville](https://fonts.google.com/specimen/Libre+Baskerville) and [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3) from Google Fonts.

**Comparable platforms studied** (how event registration works elsewhere)
- [Unstop](https://unstop.com) and [Devfolio](https://devfolio.co): student competitions, hackathons and team registration
- [Eventbrite](https://www.eventbrite.com): event listing, ticketing and attendee management
- Google Forms: the current process at the college, which this portal replaces

## Acknowledgements

Developed by `Daksh Kapoor and PARTH ARORA` for `MINI PROJECT`, LNMIIT.


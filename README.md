# Truffles Cafe & Restaurant - Backend API

Production-grade, modular RESTful API built with **Express 5 (latest)** and **TypeScript** for **Truffles Cafe & Restaurant**.

## 🚀 Features

- **Express 5.3.0 (Latest)** with native async error handling
- **Zero Vulnerabilities** (`npm audit` verified clean)
- **TypeScript 5/7** with strict type safety & modern NodeNext modules
- **Modular Domain Architecture** (Auth, Menu, Reservations, Orders, Contact, Newsletter, Reviews, Events)
- **Input Validation** via Zod schemas for all request payloads
- **Security Middleware Suite**:
  - `helmet` for HTTP security headers
  - `cors` with granular origin whitelisting
  - `express-rate-limit` for DDoS and brute-force protection
- **Authentication & RBAC**:
  - JWT (JSON Web Tokens) with HTTP-only cookies & Bearer tokens
  - `bcryptjs` password hashing
  - Multi-tier roles (`super_admin`, `admin`, `manager`, `staff`)
- **Structured Error Handling** with custom `ApiError` hierarchy and global error handler
- **Standardized API Responses** via `ApiResponse` utility
- **Graceful Shutdown** on `SIGINT` / `SIGTERM` signals

---

## 📁 Architecture & Folder Structure

```
backend/
├── src/
│   ├── app.ts                         # Express app setup, middleware & router mounting
│   ├── server.ts                      # Server entry point & graceful shutdown
│   ├── config/                        # Environment & config loaders
│   │   └── env.ts                     # Zod-validated environment variables
│   ├── constants/                     # Shared constants, enums, status codes
│   │   └── index.ts                   # HTTP status, roles, statuses, categories
│   ├── types/                         # Express & domain type declarations
│   │   └── index.ts                   # AuthenticatedRequest, ApiResponsePayload
│   ├── utils/                         # Reusable core utilities
│   │   ├── apiError.ts                # Custom ApiError hierarchy
│   │   ├── apiResponse.ts             # Uniform JSON response helper
│   │   └── logger.ts                  # Structured logging utility
│   ├── middlewares/                   # Request pipeline middlewares
│   │   ├── auth.ts                    # JWT verification & role authorization
│   │   ├── errorHandler.ts            # Central error handling
│   │   ├── notFoundHandler.ts         # 404 handler
│   │   ├── rateLimiter.ts             # Global & auth rate limiters
│   │   └── validate.ts                # Zod request validator
│   ├── data/                          # Data store & seeds
│   │   └── mockDb.ts                  # In-memory database with restaurant seed data
│   ├── routes/                        # Central route aggregator
│   │   └── index.ts                   # Health check & module router mounting
│   └── modules/                       # Domain modules (clean architecture)
│       ├── auth/                      # Staff/Admin authentication
│       │   ├── auth.schema.ts
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   └── auth.routes.ts
│       ├── menu/                      # Menu items & categories
│       │   ├── menu.schema.ts
│       │   ├── menu.service.ts
│       │   ├── menu.controller.ts
│       │   └── menu.routes.ts
│       ├── reservations/              # Table reservations
│       │   ├── reservation.schema.ts
│       │   ├── reservation.service.ts
│       │   ├── reservation.controller.ts
│       │   └── reservation.routes.ts
│       ├── orders/                    # Dine-in & takeout orders
│       │   ├── order.schema.ts
│       │   ├── order.service.ts
│       │   ├── order.controller.ts
│       │   └── order.routes.ts
│       ├── contact/                   # Customer inquiries
│       │   ├── contact.schema.ts
│       │   ├── contact.service.ts
│       │   ├── contact.controller.ts
│       │   └── contact.routes.ts
│       ├── newsletter/                # Newsletter subscribers
│       │   ├── newsletter.schema.ts
│       │   ├── newsletter.service.ts
│       │   ├── newsletter.controller.ts
│       │   └── newsletter.routes.ts
│       ├── reviews/                   # Guest testimonials & ratings
│       │   ├── review.schema.ts
│       │   ├── review.service.ts
│       │   ├── review.controller.ts
│       │   └── review.routes.ts
│       └── events/                    # Restaurant events & tastings
│           ├── event.schema.ts
│           ├── event.service.ts
│           ├── event.controller.ts
│           └── event.routes.ts
├── .env.example                       # Sample environment config
├── .env                               # Local environment variables
├── .gitignore                         # Git ignore rules
├── package.json                       # Dependencies & scripts
└── tsconfig.json                      # Strict TypeScript compiler options
```

---

## 🛠️ Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start development server with live reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build (`node dist/server.js`) |
| `npm run clean` | Clean up `dist/` directory |
| `npm audit` | Check dependencies security (0 vulnerabilities) |
| `npm run test:dashboard` | Start the compiled API with demo data and test the staff dashboard routes (`npm run build` first) |

---

## 📡 API Endpoints Overview

All endpoints are prefixed with `/api/v1`.

### 1. Health
- `GET /api/v1/health` - Health check & server status

### 2. Menu
- `GET /api/v1/menu` - Retrieve all menu items (filter by `category`, `search`, `availableOnly`)
- `GET /api/v1/menu/:id` - Retrieve single menu item
- `POST /api/v1/menu` - Create menu item *(Admin/Manager)*
- `PUT /api/v1/menu/:id` - Update menu item *(Admin/Manager)*
- `DELETE /api/v1/menu/:id` - Delete menu item *(Admin)*

### 3. Reservations
- `POST /api/v1/reservations` - Book a table (Guest)
- `PATCH /api/v1/reservations/:id/cancel` - Cancel reservation (Guest)
- `GET /api/v1/reservations` - View all reservations *(Staff/Admin)*
- `GET /api/v1/reservations/:id` - View reservation detail *(Staff/Admin)*
- `PATCH /api/v1/reservations/:id/status` - Update status *(Staff/Admin)*

### 4. Orders
- `POST /api/v1/orders` - Place dine-in / takeout order
- `GET /api/v1/orders/:id` - View order status
- `GET /api/v1/orders` - View all orders *(Staff/Admin)*
- `PATCH /api/v1/orders/:id/status` - Update order status *(Staff/Admin)*

### 5. Contact Inquiries
- `POST /api/v1/contact` - Send message (Guest)
- `GET /api/v1/contact` - View inquiries *(Staff/Admin)*
- `PATCH /api/v1/contact/:id/read` - Mark as read *(Staff/Admin)*

### 6. Newsletter
- `POST /api/v1/newsletter/subscribe` - Subscribe email
- `POST /api/v1/newsletter/unsubscribe` - Unsubscribe email
- `GET /api/v1/newsletter/subscribers` - View subscriber list *(Admin)*

### 7. Reviews & Testimonials
- `GET /api/v1/reviews` - View approved guest reviews
- `POST /api/v1/reviews` - Submit review
- `GET /api/v1/reviews/admin/all` - View all reviews *(Admin)*
- `PATCH /api/v1/reviews/:id/approval` - Approve/reject review *(Admin)*

### 8. Events
- `GET /api/v1/events` - View upcoming events & tastings
- `GET /api/v1/events/:id` - View single event
- `POST /api/v1/events` - Create event *(Admin/Manager)*
- `DELETE /api/v1/events/:id` - Delete event *(Admin)*

### 9. Staff & Admin Authentication
- `POST /api/v1/auth/login` - Staff login
  - There are **no built-in accounts or default passwords**. Create the first admin with
    `npm run hash-password` and set `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` in `.env`
    (in development, a random one-time admin password is printed at startup).
- `POST /api/v1/auth/logout` - Logout & clear token
- `GET /api/v1/auth/me` - Authenticated user profile
- `POST /api/v1/auth/register-staff` - Register staff account *(Admin only)*

### 10. Staff Dashboard (`src/modules/dashboard/`)
All routes need a staff login (same cookie/token as above). They read the same MySQL `reservations` table the public
booking form writes to. New dashboard sections go in sibling folders next to `reservations/`.
- `GET /api/v1/dashboard/reservations` - List with `status`, `q` (name/email/phone), `date`, `from`, `to`, `sort` (`newest|date_asc|date_desc`), `page`, `limit` (max 100)
- `GET /api/v1/dashboard/reservations/stats` - Counts: today, next 7 days, per status
- `GET /api/v1/dashboard/reservations/:id` - One reservation
- `GET /api/v1/dashboard/reservations/:id/history` - Who changed the status, and when
- `PATCH /api/v1/dashboard/reservations/:id/status` - Confirm / cancel / complete / back to pending *(manager and above)*

### 11. Blog & Pictures
- `GET /api/v1/blog/posts` and `GET /api/v1/blog/posts/:slug` - Published posts for the website *(public, cacheable for a minute)*
- `GET /api/v1/media/:id` - A picture uploaded from the dashboard *(public, cacheable for a year)*
- `POST /api/v1/dashboard/media` - Upload a picture: send the image itself as the request body with its `image/jpeg|png|webp|gif`
  type (3 MB max; the type is checked from the file's own bytes; SVG is refused). The same file twice is stored once.
- `GET|POST /api/v1/dashboard/blog/posts`, `GET|PUT|DELETE /api/v1/dashboard/blog/posts/:id`,
  `PATCH /api/v1/dashboard/blog/posts/:id/status` - Manage posts *(write: manager and above; delete: admin and above)*.
  A post's content is a list of blocks (paragraph, heading, list, quote, note, picture, gallery, YouTube video, button)
  with strict limits; pictures must be `/images/...` or `/media/<id>`, and links `/page` or `https://...`.

### 12. Maintenance mode
- `GET /api/v1/site/status` - Is the website in maintenance mode? *(public; the website checks it every few seconds, so it has its own generous rate limit)*. Returns only `{ maintenance: { enabled: false } }` while open, or the title, message and expected time while on.
- `GET /api/v1/dashboard/maintenance` and `/history` - Current settings and the last 10 switches *(all staff)*
- `PUT /api/v1/dashboard/maintenance` - Switch on/off and set the visitor message *(admins only)*; every change is logged with who made it

**Database** (MySQL, created automatically on start by `src/db/schema.ts`; add new steps at the end, never edit old ones):
`reservations`, `staff_users` (login accounts), `reservation_status_history`, `media` (uploaded pictures), `blog_posts`, `site_maintenance` (one row) and `site_maintenance_log`.
The history, media and blog tables have foreign keys to the staff table / reservations:
deleting a reservation deletes its history (`CASCADE`); removing a staff account keeps the history and clears the
name (`SET NULL`). Reservation indexes follow the dashboard's queries: `(status, reservation_date)`,
`(status, created_at)`, `(reservation_date, status)` and `(created_at)`.



---

## Security

See [`../SECURITY.md`](../SECURITY.md) for everything that is protected, the production checklist and
the things still to do before launch.

```bash
npm run security:check     # attacks a running server and reports what is open (see the file for options)
npm run hash-password      # creates ADMIN_PASSWORD_HASH without writing the password anywhere
npm run audit              # known-vulnerability scan of dependencies
```

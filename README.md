# Aturservicett Backend

Backend API for **Aturservicett** — "Skilled professional at your service in TnT" —
built to match the Figma flow: client/tradesman onboarding, browsing tradesmen by
category, reviews, ad inquiries, and the admin dashboard (Dashboard Overview,
User list, Advertisement, Settings).

Stack: Node.js, Express, MongoDB (Mongoose), JWT auth, bcrypt, Cloudinary
(image uploads), Resend (OTP emails).

## 1. Install

```bash
npm install
```

## 2. Configure environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

- `MONGO_DB_URL` — a MongoDB connection string (local `mongodb://127.0.0.1:27017/aturservicett`
  or a MongoDB Atlas URL).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — any long random strings.
- `RESEND_EMAIL_API_KEY` / `RESEND_EMAIL_FROM` — optional. If left blank, OTP emails are skipped
  and the OTP is simply returned in the API response body (`data.otp`) so you
  can test signup/login/reset flows without setting up Resend.
- `CLOUDINARY_*` — optional. Only needed if you upload profile photos or work
  photos.

## 3. Run

```bash
npm run dev      # nodemon, auto-restarts on change
# or
npm start
```

The API listens on `http://localhost:5000` (or your `PORT`), mounted at
`/api/v1`.

## 4. Create or promote the initial super-admin

```bash
npm run seed:admin
```

Creates the initial super-admin, or promotes the existing administrator matching
`ADMIN_EMAIL`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running this in a
production environment. Run it once after deploying the admin-management update
so the designated owner can open **Admin Management** and manage future admin
accounts without database access.

---

## API Reference

All responses follow this shape:

```json
{ "success": true, "message": "...", "data": { ... }, "meta": { ... } }
```

Errors:

```json
{ "success": false, "message": "...", "errorSources": [{ "path": "", "message": "..." }] }
```

Protected routes require `Authorization: Bearer <accessToken>`.

### Auth — `/api/v1/auth`

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/register` | firstName, lastName, email, password, confirmPassword, phoneNumber, role (`client`\|`tradesman`), area? | "Welcome. Let's get you sorted" + "Sign up" screens |
| POST | `/resend-otp` | email | |
| POST | `/verify-email` | email, otp | returns tokens on success |
| POST | `/login` | email, password | |
| POST | `/forgot-password` | email | "Forgot Password" screen |
| POST | `/verify-reset-otp` | email, otp | "Verify Email" screen |
| POST | `/reset-password` | email, otp, newPassword, confirmPassword | "Reset Password" screen |
| POST | `/refresh-token` | refreshToken | |
| POST | `/logout` | — (auth required) | "Are you sure to log out?" |

### User — `/api/v1/user` (auth required)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/me` | — | "Profile" screen |
| PATCH | `/me` | firstName?, lastName?, area?, phoneNumber?, file: `profileImage`? | "Edit Profile" screen |
| PATCH | `/change-password` | currentPassword, newPassword, confirmPassword | Settings → Change Password |
| DELETE | `/me` | — | Account Management → Delete Account |

### Tradesman — `/api/v1/tradesman`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/categories` | public | Home screen grid, e.g. "Plumber — 73 Listed" |
| GET | `/?skill=&search=&area=&sort=rating\|newest\|priceLow\|priceHigh&page=&limit=` | public | "Plumbers — 12 plumber Near You / sorted by Rating" |
| GET | `/:id` | public | Tradesman detail page (about + reviews) |
| GET | `/me/profile` | tradesman | Own profile |
| POST | `/onboarding/skills` | tradesman | `{ mainSkill, extraSkills: [] }` — Step 1 "What can you do?" |
| POST | `/onboarding/work-area` | tradesman | `{ homeArea, travelRange }` — Step 2 "What can you work?" |
| POST | `/onboarding/pitch` | tradesman | `{ pitch, rateAmount, rateUnit }` + files `workPhotos[]` — Step 3 |
| POST | `/onboarding/go-live` | tradesman | "You're live!" screen |

### Review — `/api/v1/review`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/:tradesmanId` | public | |
| POST | `/:tradesmanId` | client | `{ rating, ratingLabel, reviewText }` — "How was Devon?" |

### Ad Inquiry — `/api/v1/inquiry`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | public | `{ businessName, whatsappPhone, tradesToAdvertiseTo }` — "Tell us about your business" |
| GET | `/` | admin | list all inquiries |

### Options — `/api/v1/options`

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Returns `{ skills, travelRanges, rateUnits }` for onboarding dropdowns |

### Admin — `/api/v1/admin` (admin auth required, except where noted)

Regular administrators receive explicit `dashboard`, `users`, and/or
`advertisements` permissions. Administrator-management routes are restricted to
the `super-admin` role. Public registration continues to allow only `client` and
`tradesman` roles.

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | Totals + weekly occupancy + yearly registration chart data |
| GET | `/users?type=all\|client\|tradesman\|vip&page=&limit=` | "User list" tabs |
| PATCH | `/users/:userId/toggle-block` | green/red dot action |
| DELETE | `/users/:userId` | trash icon action |
| POST | `/users/vip` | "Add VIP Member" modal |
| GET | `/advertisements` | admin list |
| GET | `/advertisements/active` | **public** — active ads only, for sponsored slots in the app |
| POST | `/advertisements` | `{ title, description }` — "Create New Advertisement" |
| PATCH | `/advertisements/:id` | edit |
| DELETE | `/advertisements/:id` | delete |
| GET | `/administrators` | super-admin only; list administrator accounts |
| POST | `/administrators` | super-admin only; create an admin with role and permissions |
| PATCH | `/administrators/:adminId` | super-admin only; edit permissions/role or revoke/restore access |

---

## Notes on assumptions

The uploaded `backendkennygee.zip` was a different project (a restaurant/shop
finder backend — `Shop`, `Menu`, `Event` models etc.) rather than the
tradesman-marketplace app shown in the Figma export. This backend is a fresh
build for the Figma app, but it deliberately reuses the same conventions from
that codebase (`AppError`, `catchAsync`, `sendResponse`, JWT access/refresh
tokens, OTP-based email verification, Cloudinary via multer memory storage) so
the code should feel familiar.

A few product decisions were inferred from the screens and may need
adjusting to match your exact intent:
- "VIP" is modeled as a flag on a tradesman's profile (`isVip`), surfaced via
  the User list's VIP tab and set through "Add VIP Member".
- The dashboard's occupancy/registration charts are computed from real
  signup data rather than hard-coded, since there's no separate "booking"
  entity in the flow shown.
- Static screens (About App, Privacy Policy, Terms & Conditions) don't need
  an API — they're just content you can hardcode in the app.

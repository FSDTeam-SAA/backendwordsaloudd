# Aturservicett Backend

Backend API for **Aturservicett** — "Skilled professional at your service in TnT" —
built to match the Figma flow: client/tradesman onboarding, browsing tradesmen by
category, reviews, ad inquiries, and the admin dashboard (Dashboard Overview,
User list, Advertisement, Settings).

Stack: Node.js, Express, MongoDB (Mongoose), JWT auth, bcrypt, Cloudinary
(image uploads), Resend (OTP emails).

## 1. Install Required Software

Install these before running the backend.

### Install VS Code

1. Go to https://code.visualstudio.com/
2. Download VS Code for your computer.
3. Install it.
4. Open VS Code after installation.

### Install Node.js

1. Go to https://nodejs.org/
2. Download the LTS version.
3. Install it.
4. Open a terminal and check that Node.js is installed:

```bash
node -v
npm -v
```

If both commands show version numbers, Node.js is installed correctly.

### Install Git

1. Go to https://git-scm.com/downloads
2. Download Git for your computer.
3. Install it.
4. Check that Git is installed:

```bash
git --version
```

## 2. Download The Backend Project

Open a terminal in the folder where you want to keep the project.

Run:

```bash
git clone YOUR_GITHUB_BACKEND_LINK_HERE
```

Replace `YOUR_GITHUB_BACKEND_LINK_HERE` with the real GitHub link.

Then open the project in VS Code:

```bash
cd backendwordsaloudd
code .
```

If `code .` does not work, open VS Code manually, choose **File > Open Folder**, and select the `backendwordsaloudd` folder.

## 3. Install Backend Packages

In the VS Code terminal, make sure you are inside the `backendwordsaloudd` folder.

Then run:

```bash
npm i
```

This command downloads all backend packages needed by the project.

## 4. Create The `.env` File

The backend needs a `.env` file. This file contains private settings like the database link, JWT secrets, email settings, and Cloudinary settings.

Inside the `backendwordsaloudd` folder, create a new file named:

```text
.env
```

Copy the `.env` values from the link shared by the project owner and paste them into this `.env` file.

The project also has an example file named:

```bash
.env.example
```

Use `.env.example` only as a reference. Do not rename it. Create a separate `.env` file.

- `MONGO_DB_URL` — a MongoDB connection string (local `mongodb://127.0.0.1:27017/aturservicett`
  or a MongoDB Atlas URL).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — any long random strings.
- `RESEND_EMAIL_API_KEY` / `RESEND_EMAIL_FROM` — optional. If left blank, OTP emails are skipped
  and the OTP is simply returned in the API response body (`data.otp`) so you
  can test signup/login/reset flows without setting up Resend.
- `CLOUDINARY_*` — optional. Only needed if you upload profile photos or work
  photos.
- `CORS_ORIGINS` — comma-separated exact admin dashboard origins. Required in
  production for browser write actions.
- `ADMIN_DASHBOARD_URL` — public dashboard URL used by CORS and administrator
  invitation links.
- `ADMIN_INVITE_EXPIRES_HOURS` — invitation lifetime in hours (defaults to 24,
  capped at 168).

## 5. Run The Backend

```bash
npm run dev
```

If everything is correct, the backend will start.

By default, the backend runs on:

```text
http://localhost:5000
```

The API base URL is:

```text
http://localhost:5000/api/v1
```

To check the backend in a browser, open:

```text
http://localhost:5000
```

You should see a message saying the API is running.

Keep this terminal open while using the mobile app. If you close the terminal, the backend will stop.

For production-style running, you can also use:

```bash
npm start
```

## 6. Create Or Promote The Initial Super Admin

```bash
npm run seed:admin
```

Creates the initial super-admin, or promotes the existing administrator matching
`ADMIN_EMAIL`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running this in a
production environment. Run it once after deploying the admin-management update
so the designated owner can open **Admin Management** and manage future admin
accounts without database access.

## 7. Run The One-Time Data Migrations

After deploying the verification/category update, run:

```bash
npm run migrate:verification
npm run migrate:categories
npm run migrate:category-badges
npm run migrate:vip-skill
```

The first command creates pending profiles for existing tradesmen, repairs
missing verification data, and removes orphan profiles/reviews. The second normalizes category ordering and
replaces legacy invalid icon values with configured category emoji where
possible. The third extends recently-created category NEW badges to 30 days.
The fourth assigns each legacy VIP profile to its existing main-skill category.
All four scripts are safe to rerun.

## 8. Useful Backend Commands

Run these commands inside the `backendwordsaloudd` folder.

```bash
npm i
npm run dev
npm start
npm test
npm run seed:admin
```

## 9. Common Backend Problems

### MongoDB Connection Error

Check the `MONGO_DB_URL` value inside `.env`.

Make sure the database link is correct and the database service is running.

### Port Already In Use

Another app may already be using port `5000`.

Close the other app, or change the `PORT` value inside the `.env` file.

### `.env` File Not Found

Make sure the file is named exactly:

```text
.env
```

It must be inside the `backendwordsaloudd` folder.

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
| GET | `/categories` | public | Home grid; `tradesmanCount` is the total skill listing count and new categories expose a 30-day `isNew`/`newUntil` window |
| GET | `/?skill=&search=&area=&sort=rating\|newest\|priceLow\|priceHigh&page=&limit=` | public | Category browse; `isVip` is true only when `vipBySkill` matches the requested skill |
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
| GET | `/verifications?status=pending\|verified\|rejected&page=&limit=` | Verification Queue; requires `verification` permission |
| PATCH | `/users/:userId/toggle-block` | green/red dot action |
| DELETE | `/users/:userId` | trash icon action |
| POST | `/users/vip` | "Add VIP Member" modal; `vipBySkill` must match the tradesman's main or extra skills |
| GET | `/advertisements` | admin list |
| GET | `/advertisements/active` | **public** — active ads only, for sponsored slots in the app |
| POST | `/advertisements` | multipart campaign fields + required JPG/PNG/MP4 media |
| PATCH | `/advertisements/:id` | edit |
| DELETE | `/advertisements/:id` | delete |
| GET | `/administrators` | super-admin only; list administrator accounts |
| POST | `/administrators` | super-admin only; email a single-use admin invitation |
| PATCH | `/administrators/:adminId` | super-admin only; edit permissions/role or revoke/restore access |
| GET | `/administrator-invitations` | super-admin only; pending/expired invitations |
| POST | `/administrator-invitations/:id/resend` | super-admin only; rotate token and resend |
| DELETE | `/administrator-invitations/:id` | super-admin only; revoke an invitation |

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
- "VIP" is modeled as a flag on a tradesman's profile (`isVip`) plus the
  selected category (`vipBySkill`), surfaced via the User list's VIP tab and
  set through "Add VIP Member".
- The dashboard's occupancy/registration charts are computed from real
  signup data rather than hard-coded, since there's no separate "booking"
  entity in the flow shown.
- Static screens (About App, Privacy Policy, Terms & Conditions) don't need
  an API — they're just content you can hardcode in the app.

# Figma Screen → API Route → File Location (Aturservicett)

Base URL: `/api/v1` | Project root folder: `aturservicett-backend/`

| # | Figma Screen | Method | API Route | Route File | Controller File | Function |

|---|---|---|---|---|---|---|
| 1 | Splash | - | - | - | - | - |

| 2 | Welcome — I need a tradesman / I am a tradesman | POST | /auth/register | route/auth.route.js | controller/auth.controller.js | register |

| 3 | Sign up (phone, email, sms code, name, area) | POST | /auth/register | route/auth.route.js | controller/auth.controller.js | register |

| 3 | Sign up (phone, email, sms code, name, area) | POST | /auth/resend-otp | route/auth.route.js | controller/auth.controller.js | resendOtp |

| 3 | Sign up (phone, email, sms code, name, area) | POST | /auth/verify-email | route/auth.route.js | controller/auth.controller.js | verifyEmail |

| 4 | Step 1 of 3 — What can you do? | GET | /options | route/skill.route.js | controller/skill.controller.js | getSkillOptions |

| 4 | Step 1 of 3 — What can you do? | POST | /tradesman/onboarding/skills | route/tradesman.route.js | controller/tradesman.controller.js | setSkills |

| 5 | Step 2 of 3 — What can you work? | POST | /tradesman/onboarding/work-area | route/tradesman.route.js | controller/tradesman.controller.js | setWorkArea |

| 6 | Step 3 of 3 — Tell clients about yourself | POST | /tradesman/onboarding/pitch | route/tradesman.route.js | controller/tradesman.controller.js | setPitchAndRate |

| 7 | You're live! | POST | /tradesman/onboarding/go-live | route/tradesman.route.js | controller/tradesman.controller.js | goLive |

| 8 | Home Screen — category grid | GET | /tradesman/categories | route/tradesman.route.js | controller/tradesman.controller.js | getCategories |

| 9 | Plumbers listing (Near You / sorted by Rating) | GET | /tradesman | route/tradesman.route.js | controller/tradesman.controller.js | browseTradesmen |

| 10 | Tradesman details (Keisha P.) | GET | /tradesman/:id | route/tradesman.route.js | controller/tradesman.controller.js | getTradesmanById |

| 11 | Profile (Contact, Help & Support) | GET | /user/me | route/user.route.js | controller/user.controller.js | getMe |

| 12 | Post review — How was Devon? | GET | /review/:tradesmanId | route/review.route.js | controller/review.controller.js | getReviewsForTradesman |

| 12 | Post review — How was Devon? | POST | /review/:tradesmanId | route/review.route.js | controller/review.controller.js | postReview |

| 13 | Send inquiry — Tell us about your business | POST | /inquiry | route/inquiry.route.js | controller/inquiry.controller.js | sendInquiry |

| 14 | Profile menu (Ken Adams) | GET | /user/me | route/user.route.js | controller/user.controller.js | getMe |

| 14 | Profile menu (Ken Adams) | POST | /auth/logout | route/auth.route.js | controller/auth.controller.js | logout |

| 15 | Edit Profile | PATCH | /user/me | route/user.route.js | controller/user.controller.js | updateMe |

| 16 | About App / Privacy Policy / Terms & Conditions | - | static content, no API | - | - | - |

| 17 | Account Management | PATCH | /user/change-password | route/user.route.js | controller/user.controller.js | changePassword |

| 17 | Account Management | DELETE | /user/me | route/user.route.js | controller/user.controller.js | deleteMe |

| 18 | Change Password | PATCH | /user/change-password | route/user.route.js | controller/user.controller.js | changePassword |

| 19 | Login (web) | POST | /auth/login | route/auth.route.js | controller/auth.controller.js | login |

| 20 | Forgot Password | POST | /auth/forgot-password | route/auth.route.js | controller/auth.controller.js | forgotPassword |

| 21 | Verify Email (reset OTP) | POST | /auth/verify-reset-otp | route/auth.route.js | controller/auth.controller.js | verifyResetPasswordOtp |

| 22 | Reset Password | POST | /auth/reset-password | route/auth.route.js | controller/auth.controller.js | resetPassword |

| 23 | Admin — Dashboard Overview | GET | /admin/dashboard | route/admin.route.js | controller/admin.controller.js | getDashboardOverview |

| 24 | Admin — User list (All/Client/Tradesman + Actions) | GET | /admin/users | route/admin.route.js | controller/admin.controller.js | getUserList |

| 24 | Admin — User list (All/Client/Tradesman + Actions) | PATCH | /admin/users/:userId/toggle-block | route/admin.route.js | controller/admin.controller.js | toggleUserBlock |

| 24 | Admin — User list (All/Client/Tradesman + Actions) | DELETE | /admin/users/:userId | route/admin.route.js | controller/admin.controller.js | deleteUser |

| 25 | Admin — User list (VIP tab) | GET | /admin/users?type=vip | route/admin.route.js | controller/admin.controller.js | getUserList |

| 26 | Admin — Add VIP Member modal | POST | /admin/users/vip | route/admin.route.js | controller/admin.controller.js | addVipMember |

| 27 | Admin — Advertisement list | GET | /admin/advertisements | route/admin.route.js | controller/admin.controller.js | getAdvertisements |

| 27 | Admin — Advertisement list (public sponsored slot) | GET | /admin/advertisements/active | route/admin.route.js | controller/admin.controller.js | getAdvertisements |

| 28 | Admin — Create New Advertisement modal | POST | /admin/advertisements | route/admin.route.js | controller/admin.controller.js | createAdvertisement |

| 29 | Admin — Advertisement edit/delete icons | PATCH | /admin/advertisements/:id | route/admin.route.js | controller/admin.controller.js | updateAdvertisement |

| 29 | Admin — Advertisement edit/delete icons | DELETE | /admin/advertisements/:id | route/admin.route.js | controller/admin.controller.js | deleteAdvertisement |

| 30 | Admin — Settings (Personal Info / Change Password) | GET | /user/me | route/user.route.js | controller/user.controller.js | getMe |

| 30 | Admin — Settings (Personal Info / Change Password) | PATCH | /user/me | route/user.route.js | controller/user.controller.js | updateMe |

| 30 | Admin — Settings (Personal Info / Change Password) | PATCH | /user/change-password | route/user.route.js | controller/user.controller.js | changePassword |

| 31 | Admin — Are you sure to log out? | POST | /auth/logout | route/auth.route.js | controller/auth.controller.js | logout |

## Supporting endpoints (no dedicated Figma screen)

| Purpose | Method | API Route | Route File | Controller File | Function |
|---|---|---|---|---|---|
| Refresh expired access token | POST | /auth/refresh-token | route/auth.route.js | controller/auth.controller.js | refreshAccessToken |
| Tradesman's own profile fetch | GET | /tradesman/me/profile | route/tradesman.route.js | controller/tradesman.controller.js | getMyProfile |
| Admin — list submitted ad inquiries | GET | /inquiry | route/inquiry.route.js | controller/inquiry.controller.js | getAllInquiries |

## Where routes are wired together

| File | Role |
|---|---|
| mainroute/index.js | Mounts every route/*.route.js under its prefix (/auth, /user, /tradesman, /review, /inquiry, /admin, /options) |
| server.js | Mounts mainroute/index.js at /api/v1, connects MongoDB, starts the server |

## Core supporting files

| File | Purpose |
|---|---|
| model/user.model.js | User schema (client / tradesman / admin roles) |
| model/tradesmanProfile.model.js | Skills, work area, pitch, rate, photos, VIP, live status |
| model/review.model.js | Client reviews of a tradesman |
| model/adInquiry.model.js | "Send inquiry" submissions |
| model/advertisement.model.js | Admin-created ads |
| middleware/auth.middleware.js | protect (JWT check), restrictTo(role) |
| constants/skills.js | The 20 skill categories, travel ranges, rate units |

## Static screens (no API)

- About App
- Privacy Policy
- Terms & Conditions

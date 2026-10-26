# Dashboard and app integration

## Reviews

Both `GET /api/v1/tradesman/:id` and `GET /api/v1/review/:tradesmanId` return approved reviews and legacy reviews without a moderation status. Pending and rejected reviews are excluded. The profile ID is the TradesmanProfile ID, not the User ID.

Moderation and review creation/deletion recalculate the public rating from the same set of visible reviews. These public responses disable HTTP caching. The mobile app must refetch on profile/screen focus or pull-to-refresh and replace its review list rather than keeping locally cached rejected reviews.

Run `npm run migrate:ratings` to check existing ratings without changing them. Use `npm run migrate:ratings -- --apply` to repair mismatches.

## Sponsored advertisements

Use public `GET /api/v1/admin/advertisements/active?category=Plumbing`. It needs no admin token. Results are in `data`; media is `media.url` with `media.mediaType` (`image` or `video`). Category names must match the category API exactly. Empty ad categories mean platform-wide.

An enabled advertisement must also be within its start/end window. Legacy missing start dates mean immediately; no end date means no expiry. Dashboard cards show Running, Scheduled, Expired or Disabled independently of the enable switch. Expired campaigns require an intentional schedule update before they run again.

Dashboard inputs use the operator's browser timezone and submit ISO UTC timestamps. Mobile screens should refetch sponsored ads on focus/refresh. Public responses use `Cache-Control: no-store`.

## Tradesman photos

Send multipart/form-data and let the HTTP client set the boundary.

| Method and path (under `/api/v1`) | Fields |
| --- | --- |
| PUT or PATCH `/user/me` | `profileImage` or `avatar` (one profile photo total) |
| PUT `/tradesman/me/profile` | `profileImage` or `avatar`, plus `workPhotos` or `workPhotos[]` |
| POST `/tradesman/onboarding/pitch` | `workPhotos` or `workPhotos[]`, with pitch/rate fields |

Accepted images: JPEG, PNG, WebP, HEIC, HEIF. Maximum 20 MB each; six work photos total. HEIC/HEIF/WebP are uploaded to Cloudinary as JPEG for app display. Videos are allowed only by advertisement media endpoints. Profile photos are returned as `profileImage.url` on the User, including the populated `user` inside the tradesman profile response.

New assets are removed if saving fails; replaced profile images are removed after a successful save. User/profile changes use a MongoDB transaction, requiring a replica set or sharded deployment (MongoDB Atlas supports this). Cloudinary credentials must be set in the deployed backend. Live device upload and actual Cloudinary conversion still need device/deployment acceptance testing.

## Admin tradesman editing

Requires an authenticated administrator with the `users` permission (or super-admin):

- PATCH `/admin/users/:userId/tradesman-profile`: JSON or multipart. Allowed fields: firstName, lastName, phoneNumber, area, mainSkill, extraSkills, homeArea, travelRange, pitch, rateAmount, rateUnit. Photo fields follow the profile upload contract. Use JSON text for multipart extraSkills. Roles, permissions and verification status cannot be modified by this endpoint.
- POST `/admin/users/:userId/contact-change`: JSON `{ "action": "approve" | "reject", "requestedAt": "<timestamp from current request>", "note": "optional" }`. Approval applies the requested name/phone. Rejection preserves existing contact details. Pending request timestamp and profile version protect against stale approvals.

User List → Edit tradesman opens the profile editor. Member details → Contact change request provides approval/rejection. Responses contain the updated User with `tradesmanProfile`; dashboard queries are refreshed. Edits and contact decisions are audited.

## Validation

`npm test` includes HTTP regression tests using mocked persistence/media services for review visibility, rejection/rating updates, photo field aliases/formats, admin editing permissions/validation, contact request approval/rejection and upload rollback. No test sends emails, uploads real media, or changes application records.

Dashboard: `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:campaigns`.

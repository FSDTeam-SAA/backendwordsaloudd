# Trade and review fixes

## Findings

- The default list already has 22 trades, including Maid Service and Caterer. Both `/api/v1/options` and `/api/v1/tradesman/categories` read active database categories without pagination. Initialization only seeds an empty collection, so an older nonempty collection can still lack defaults. The live database and app must be checked to identify the actual two missing trades; this is a possible cause, not a confirmed live finding.
- Public review endpoints already exclude pending/rejected reviews and send `Cache-Control: no-store`. Admin rejection and deletion already refresh aggregate totals. Public browse/detail scores now also calculate directly from visible reviews, avoiding stale stored totals. A mobile app retaining old review state must refetch and replace its list after moderation, navigation, and refresh.
- Reviews previously had no trade field, and uniqueness was only tradesman + reviewer. Ratings therefore appeared across every registered trade. Reviews now record `skill`, and uniqueness includes that skill.

## Database rollout

Configure `MONGO_DB_URL` securely in the environment. No database connection is configured in this checkout, so no live data has been read or changed.

1. Run `npm run migrate:missing-categories` to inspect missing and inactive categories. Review the list, then run `npm run migrate:missing-categories -- --apply` to add absent defaults. Existing inactive categories are preserved, as are category names and order.
2. Before enabling the updated review writer, run `npm run migrate:review-index`, then `npm run migrate:review-index -- --apply`. This installs the trade-specific unique index before removing the obsolete indexes. It does not synchronize/drop unrelated indexes.
3. Deploy the backend with the mobile changes below. Optionally inspect stale overall totals with `npm run migrate:ratings`; use `-- --apply` to refresh them.

Historical reviews without a skill remain visible in overall reviews/scores, but never contribute to a specific trade. Their original trade cannot be reliably inferred from a profile's current skills.

## Mobile / Android AAB changes

- Populate signup trades from `GET /api/v1/options` (`data.skills`) instead of a hardcoded or truncated list. Do not filter out categories that have zero tradesmen.
- Send `skill` with review POSTs, for example `{ "rating": 5, "skill": "Plumber", "reviewText": "Great work" }`. A missing skill is accepted only when the tradesman has exactly one registered trade; multiple trades return HTTP 400 until a skill is supplied.
- Preserve the selected skill when opening a profile: `GET /api/v1/tradesman/:id?skill=Plumber` and `GET /api/v1/review/:tradesmanId?skill=Plumber`. Browse already uses `GET /api/v1/tradesman?skill=Plumber`.
- Render the returned `ratingAverage` and `ratingCount`, including zero. Do not substitute an overall profile score for an unrated trade.
- Refetch review lists and replace cached state so removed reviews disappear. Unscoped profile/review requests intentionally show overall history.

This checkout contains the Node backend only. It has no Flutter/Android source or Gradle build, so an AAB cannot be updated or rebuilt here. Mobile changes and a coordinated release are required, especially for multi-trade review submissions.

## Verification

`npm.cmd test` exercises category defaults, trade validation and unique indexes, moderation filters, category-scoped scores for different browse sorts, and the existing dashboard/admin regression suite. Tests use model mocks; live MongoDB migrations and mobile rendering remain unverified.

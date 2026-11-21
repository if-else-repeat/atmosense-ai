# AtmoSense AI — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants & Relationship Mapping

- **Master Source of Truth**: `/users/{userId}` represents an authenticated, email-verified user's private profile (including email PII).
- **PII Isolation**: `/users/{userId}` can ONLY be read (`get`) by `userId == request.auth.uid`. `allow list` on `/users` is strictly forbidden (`false`).
- **Master Gate (Relational Sync)**: Subcollections `/users/{userId}/savedLocations/{locationId}` and `/users/{userId}/advisories/{advisoryId}` require that the parent `/users/{userId}` document exists on write (`exists(...)`) and that `userId == request.auth.uid` and `ownerId == request.auth.uid`.
- **Temporal Integrity**: `createdAt` must equal `request.time` on `create` and remain immutable on `update`. `updatedAt` must equal `request.time` on `create` and `update`.
- **Append-Only Advisories**: `/users/{userId}/advisories/{advisoryId}` prohibits `update` operations to guarantee historical AI brief integrity.
- **No Unverified Writes**: Every write operation requires `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Identity Spoofing on User Create**: Authenticated user `uid_a` tries to create `/users/uid_b` with `uid: "uid_b"`.
2. **Shadow Field Injection on User Create**: `uid_a` creates `/users/uid_a` with extra field `isAdmin: true`.
3. **PII Blanket Read**: `uid_b` tries `get` on `/users/uid_a` or `list` on `/users`.
4. **Unverified Email Write**: Authenticated user with `email_verified: false` tries to create `/users/uid_a`.
5. **Timestamp Forgery on Create**: `uid_a` creates `/users/uid_a` with client-supplied `createdAt` not matching `request.time`.
6. **Immutable Field Tampering on Update**: `uid_a` updates `/users/uid_a` attempting to change `uid` or `createdAt`.
7. **Orphaned Subcollection Write**: `uid_a` tries to create `/users/uid_a/savedLocations/loc_1` when `/users/uid_a` does not exist.
8. **Cross-Tenant Subcollection Read/List**: `uid_b` tries to `list` or `get` `/users/uid_a/savedLocations`.
9. **Path Variable Poisoning**: `uid_a` tries to create `/users/uid_a/savedLocations/invalid$id!with/specials` or a 200-char ID.
10. **Value Poisoning on Whitelisted Update Key**: `uid_a` updates `/users/uid_a/savedLocations/loc_1` setting `alertThreshold: 9999` or `customLabel: "<100-char string>"`.
11. **Coordinate Out-of-Bounds Injection**: `uid_a` creates a `savedLocation` with `latitude: 145` or `longitude: -220`.
12. **Tampering with Append-Only Advisory**: `uid_a` tries to `update` `/users/uid_a/advisories/adv_1` to alter `summary` or `aqiAtGeneration`.

# Release status — October 26, 2026

Loop Chat · NovaPulse Digital LLC · com.novapulsedigital.loop

## Prepared

- React messaging app with email/password authentication, username profiles/search, private text/photo conversations, message deletion, blocking, reporting, password recovery, and account deletion flow.
- Android Capacitor project, API 36 target / API 24 minimum, native session encryption using Android Keystore, disabled backups/cleartext traffic, adaptive launcher assets, opt-in push integration.
- Supabase migration with row-level security, private storage policies, server-controlled identity/timestamps, message rate limiting, and Edge Functions for deletion and optional push.
- Bundled privacy/terms/deletion/child-safety pages, Play listing copy/icon/feature graphic, release preflight and signing configuration.

## Verified here

- Web production compilation.
- Android debug APK and unsigned release AAB compilation; release lint (warnings from template/unused resources are reported separately).
- PostgreSQL policy tests on PGlite using Supabase auth/storage scaffolding: access isolation, anti-impersonation, private media access, bilateral blocking, restricted reports/tokens, author-only deletion, and database deletion cascades.
- Browser tests: original demo interactions; configured UI with simulated auth/database/storage/Edge Function responses, including auth failures, profile setup, messages/photos, deletion, reports/blocks, offline controls, narrow-phone layout; legal pages without sign-in.

## Not yet verified / not publishable

- Live Supabase deployment, real multi-device delivery, actual SMTP confirmation/reset, real Edge Function deletion, and media cleanup. The project reference was supplied but the public key was not injected in the running instance at the time of this record.
- Live Firebase push delivery (disabled by default).
- Public hosting of legal/deletion pages and operational moderation/support procedures.
- Publisher-owned upload keystore and signed AAB.
- Real Android-device functional checks and Play pre-launch/internal/closed tests.
- Play Console declarations, reviewer accounts, identity verification, policy review, or store approval.

The unsigned/unconfigured QA bundle is not a submission artifact. Development UI screenshots and mocks do not establish live messaging or native-device readiness. Update this record only with evidence from completed checks.

## Test APK handoff

`release/loop-chat-demo.apk` is a debug-signed, local-only test build with a separate `com.novapulsedigital.loop.demo` package, a persistent demo label, and no live backend configuration. Its APK signature and API 24 minimum/API 36 target were verified, and its compiled web assets passed browser checks for navigation, send/persist, demo labeling, and phone layout. It is not a Play submission. The software Android emulator reached ADB but had not finished booting at the initial install attempt; that attempt reported “device is still booting”, so native installation/startup is not yet a passed check.

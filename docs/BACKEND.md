# Connect the live Supabase service

The repository contains the migration and Edge Functions. They have not been applied to a hosted project unless a deployment record says so. Local policy tests use PostgreSQL via PGlite and a minimal Supabase auth/storage scaffold; UI tests mock network responses. Those checks do not establish live delivery.

1. Create a Supabase project owned by NovaPulse Digital LLC. Choose a region appropriate for users and record it in your privacy operations records.
2. In its SQL Editor, run the complete contents of `supabase/migrations/202610260001_loop.sql` once. Alternatively, use the official Supabase CLI, link to your project, and run `supabase db push`.
3. Under Authentication, enable email/password sign-in, email confirmation, a minimum 12-character password, breached-password protection where available, production SMTP, and suitable auth rate limits. Do not disable email confirmation just to bypass setup. Review CAPTCHA/abuse protection before opening registration broadly.
4. Add `com.novapulsedigital.loop://auth-callback` to Authentication's allowed redirect URLs. Set the Site URL to your real support/app website. The password-reset and signup links must be opened on the device where they were requested because PKCE verification is bound to that session.
5. Deploy the two Edge Functions using the official Supabase CLI:

   ```sh
   supabase functions deploy delete-account
   # Only needed when opting into push notifications:
   supabase functions deploy send-notification
   ```

   `supabase/config.toml` deliberately disables the legacy gateway JWT check: `delete-account` explicitly validates the bearer session with Supabase Auth and requires a sign-in within five minutes; the notification function validates its own webhook secret. Never expose the service-role key to the app. Supabase injects server credentials into Edge Functions.

6. Ensure the private `chat-media` bucket has the migration's 5 MB JPEG/PNG/WebP restrictions and all RLS policies are present. Enable `messages`, `conversation_members`, and `blocks` in the `supabase_realtime` publication. The migration does this if the publication already exists.
7. Enter the Project URL and public publishable (or legacy anon) key in environment settings or a local ignored `.env` copied from `.env.example`. These values are public build-time configuration. Changes require rebuilding and resyncing the Android assets. Never put an admin key into a `VITE_*` variable.

## Optional background notifications

The app can launch without push; the settings screen explains when push is unavailable. Foreground messaging uses Realtime plus reconciliation on focus/network changes. Background delivery is not available until the following steps pass:

1. Create a Firebase project and Android app with package `com.novapulsedigital.loop`. Place its real `google-services.json` at `android/app/google-services.json` (ignored by Git).
2. Enable FCM HTTP v1. In Supabase Edge Function secrets, securely set `FIREBASE_SERVICE_ACCOUNT_JSON` to a service account permitted to send FCM messages, and `NOTIFICATION_WEBHOOK_SECRET` to a generated, strong random value. These are server-only secrets; do not paste them into chat or commit them.
3. Create a Supabase Database Webhook for INSERT on `public.messages` targeting `https://YOUR_PROJECT.supabase.co/functions/v1/send-notification`. Set its Authorization header to `Bearer <NOTIFICATION_WEBHOOK_SECRET>`. Confirm the webhook payload contains type/schema/table/record.
4. Set `VITE_PUSH_ENABLED=true` only after configuring both sides. Build/install the app, enable notifications in Settings, and verify background delivery between two real devices. Alerts intentionally contain no sender name or message body. Review retry/failure metrics in function logs. Expired tokens are removed after an FCM UNREGISTERED response.
5. Tokens are removed on local sign-out and account deletion. For force-revoked sessions, provide an operational process to purge stale device tokens; do not claim alerts stop on a lost device merely by rotating a password.

## Operate moderation

The operator must actually monitor `public.reports` and the published support inbox. Never give clients service-role access to moderation data. Use the Supabase dashboard restricted to authorized staff or a separate authenticated administration tool. Review new and escalated reports, investigate minimum necessary evidence, remove violating messages/media, suspend users with Supabase Auth Admin controls, and record actions by moving report status from `pending` to `reviewing`/`resolved`. Establish appeal and child-safety escalation procedures before public launch. Published standards are not a substitute for an active moderation operation.

## Required live acceptance test

Use two confirmed accounts on separate devices. Find the second username, send both directions, attach a photo, refresh/restart, and verify unread counts. Verify a third unrelated account cannot read either messages or media. Test password reset on the original device, sign-out/session restart, blocking in both directions, a message-specific report arriving in the moderation queue, and account deletion removing authored content, media, profile, and tokens. Repeat with intermittent connectivity. Test optional push in the background and after sign-out. Record dates, devices, and outcomes in `docs/RELEASE-STATUS.md`. None of these live checks may be marked passed based only on mocked browser tests.

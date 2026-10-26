# Google Play release preparation

Prepared identity: Loop Chat, NovaPulse Digital LLC, `com.novapulsedigital.loop`. The app targets Android API 36 with minimum API 24, following the installed Capacitor 8 template. Android build tools and a successful bundle do not prove Google Play acceptance. Check the current target/API, SDK, device-compatibility, 16 KB page-size, and other requirements shown in Play Console when submitting. The app itself adds no native `.so` libraries; inspect the final bundle and Play pre-launch report for transitive changes.

## Upload signing

The publisher must own and back up the upload key. No production key or password is generated, embedded, or committed by this repository. Use Google Play App Signing and retain the upload keystore securely outside the checkout. For a new upload key, generate it on the publisher's trusted machine with interactive passwords:

```sh
keytool -genkeypair -v -keystore /secure/path/loop-upload.jks \
  -alias loop-upload -keyalg RSA -keysize 3072 -validity 10000
```

Supply `LOOP_KEYSTORE_PATH`, `LOOP_KEYSTORE_PASSWORD`, `LOOP_KEY_ALIAS`, and `LOOP_KEY_PASSWORD` through your secure local/CI environment. Do not prefix these with `VITE_`, paste them into chat, or put them in tracked files. Run `npm run android:release`; the preflight blocks missing configuration, unhosted policies, and missing signing material. The signed bundle is `android/app/build/outputs/bundle/release/app-release.aab`. Keep the version code strictly increasing for later uploads. Preserve R8 mapping files securely for crash diagnosis.

## Public documents

Four finished static pages live under `public/legal/`: privacy, terms/community standards, account deletion, and child safety. Host them as publicly accessible HTTPS pages, without sign-in, on a website controlled by the publisher. Upload the directory to an existing static host or deploy the Vite `dist` directory. Enter their actual URLs in `VITE_PRIVACY_URL`, `VITE_TERMS_URL`, and `VITE_DELETION_URL`. The bundled copies remain accessible inside the app even when signed out. The Play account-deletion field must use the publicly hosted deletion page, not a local app path. Confirm the mailbox is monitored and all statements match real operations and retention.

## Console declarations requiring the account owner

- Complete developer identity/contact verification and any account-specific device/testing verification.
- Create the app, use the prepared listing/artwork, and upload the signed AAB to internal testing first.
- Complete App access with functional review account credentials and directions. Keep a reviewer account usable without an inaccessible email-confirmation step; do not remove production email confirmation. Establish and verify accounts beforehand.
- Complete IARC content rating, target audience, and applicable social/child-safety declarations honestly. The current product excludes users under 13; choose age bands and parental requirements that match actual product use and local law. A checkbox is not an age-verification guarantee.
- No ads, no billing, no sensitive broad-storage/contact/microphone/camera permissions in this version. Notification permission is requested only on explicit opt-in when push is configured.
- Review the Data safety draft against the actual deployed providers and behavior. The owner must submit it; it is not automatically certified by code.
- Supply the privacy URL, external account deletion URL, support email, and child safety standards URL/contact. Operate moderation and support before inviting users.
- Complete internal/closed testing and Play's pre-launch report. If this developer account has a required closed-test cohort/duration, follow the current requirement shown in Console; it depends on account type/history and must not be assumed satisfied.
- Check the final Android device tests and live service acceptance results before promotion to production.

## Data safety working draft (verify in Console)

| Data                                            | Purpose                      | Behavior                                                               |
| ----------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Email, account ID                               | Account management, security | Required; sent to Supabase Auth                                        |
| Username, display name, optional bio            | Account functionality        | Profile visible through signed-in username search and chats            |
| Text messages, photos, membership/read metadata | App functionality            | Stored by Supabase; visible to participants and authorized operations  |
| Reports and block records                       | Safety, fraud prevention     | Stored in Supabase; reports restricted to operators                    |
| FCM installation/registration token             | Notifications                | Optional; only when push is configured and enabled; sent to Google FCM |
| Provider IP/auth/security logs                  | Security and operations      | Verify provider retention and processing in deployed project           |

No advertising ID, contacts upload, precise location, health/financial data, or analytics SDK is implemented. Network data is encrypted in transit. User content is not end-to-end encrypted. Account/data deletion is offered. Service-provider processing and user-directed transfers have specific definitions/exceptions in Google's form; decide collection/sharing answers against current instructions rather than blindly copying this table. There are no app purchases requiring Play Billing in v1.

## Policy references

- https://support.google.com/googleplay/android-developer/answer/9859152 (app preparation and release)
- https://support.google.com/googleplay/android-developer/answer/13327111 (account deletion)
- https://support.google.com/googleplay/android-developer/answer/10144311 (Data safety)
- https://support.google.com/googleplay/android-developer/answer/14747720 (child safety standards)
- https://developer.android.com/google/play/requirements/target-sdk (target API)

These reference links are provided for owner verification. Policy pages were not accessible from this environment's current egress policy; no claim of an up-to-date policy audit or Play approval is made.

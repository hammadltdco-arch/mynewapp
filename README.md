# Loop Chat

A mobile-first private messenger for **NovaPulse Digital LLC**, with a React UI, a Capacitor Android shell, and a Supabase backend. Android identity: `com.novapulsedigital.loop`.

The project is an implemented release candidate with outstanding deployment/signing/live-test prerequisites, not a published or approved Google Play app. See [release status](docs/RELEASE-STATUS.md).

## Development

Node.js 22.12+ (tested with 24), JDK 21, Android SDK platform 36, and the Gradle wrapper are used.

```sh
npm ci --cache /tmp/loop-npm-cache
npm run dev -- --port 5173
```

Copy `.env.example` to ignored `.env` or provide its variables through secure environment settings. The Supabase URL and publishable/legacy anon key are public application configuration. **Never bundle a service-role or secret key.** Without backend configuration the app shows an honest service-setup screen; sample conversations exist only at `/demo` in development and are excluded from production builds.

## Test

```sh
npm test
npm run build
```

`test:security` executes the actual migration and permissions on PostgreSQL via PGlite with minimal Supabase auth/storage scaffolding. `test:ui` uses Playwright and `/usr/bin/chromium` (override `CHROMIUM_PATH` on other machines). Configured UI tests simulate network responses and do not substitute for live Supabase acceptance tests. Tests run on dedicated ports 5174/5175; development uses 5173.

## Android

```sh
npm run android:debug
npm run release:check
npm run android:release
```

Set `android/local.properties` to your SDK directory (ignored by Git). Cloud tooling is retained under `/workspace/android-sdk`, `/workspace/loop-toolchains/jdk21`, and `/workspace/gradle-cache`; `scripts/gradle.py` uses those where present and honors standard proxy settings without logging their values. Local developer machines can use Android Studio's normal JDK/SDK setup instead. `android:release` deliberately blocks incomplete settings, unhosted legal pages, and absent upload signing credentials. Never distribute a test-key or unconfigured build as a production release.

Session tokens on Android are encrypted by a native Android Keystore plugin; web development uses sessionStorage. Photos are re-encoded to remove metadata before upload and privately served through expiring URLs. This version is not end-to-end encrypted. Calls and groups are outside v1. Push is optional and disabled unless Firebase/server configuration is completed and tested.

- [Supabase deployment and live acceptance](docs/BACKEND.md)
- [Play Console/signing/data-safety preparation](docs/PLAY-CONSOLE.md)
- [Listing copy and assets](store/listing.md)
- [Current verification status and blockers](docs/RELEASE-STATUS.md)

Regenerate legal pages with `npm run legal:build`, and launcher/store art with `npm run assets:build`. Monitor the support and safety inbox `novapulsedigitalllc@gmail.com` and the reports queue before inviting public users.

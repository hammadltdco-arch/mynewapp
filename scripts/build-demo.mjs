import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
const env = {
  ...process.env,
  VITE_DEMO_BUILD: "true",
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_PUSH_ENABLED: "false",
};
for (const [command, args] of [
  ["npm", ["run", "build"]],
  ["npx", ["cap", "sync", "android"]],
  ["python", ["scripts/gradle.py", ":app:assembleDemo"]],
]) {
  const r = spawnSync(command, args, { env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
mkdirSync("release", { recursive: true });
copyFileSync(
  "android/app/build/outputs/apk/demo/app-demo.apk",
  "release/loop-chat-demo.apk",
);
console.log(
  "Local-only, debug-signed test APK: release/loop-chat-demo.apk. Not a Google Play release.",
);

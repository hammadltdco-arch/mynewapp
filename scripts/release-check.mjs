import { loadEnv } from "vite";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const values = { ...loadEnv("production", process.cwd(), ""), ...process.env };
const problems = [];
if (values.VITE_DEMO_BUILD === "true")
  problems.push("Demo builds cannot be submitted as a production release.");
function requireValue(name) {
  if (!values[name]?.trim()) problems.push(`${name} is missing.`);
  return values[name]?.trim() || "";
}
function publicURL(name) {
  const v = requireValue(name);
  if (!v) return;
  try {
    const u = new URL(v);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      /localhost|127\.0\.0\.1|example\.|\.test$/.test(u.hostname)
    )
      throw Error();
    return u;
  } catch {
    problems.push(`${name} must be a real public HTTPS URL.`);
  }
}
const service = publicURL("VITE_SUPABASE_URL");
const key = requireValue("VITE_SUPABASE_PUBLISHABLE_KEY");
if (key) {
  if (key.startsWith("sb_secret_"))
    problems.push("A Supabase secret key must never be bundled in the app.");
  else if (key.startsWith("eyJ")) {
    try {
      if (
        JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role !== "anon"
      )
        throw Error();
    } catch {
      problems.push(
        "The legacy Supabase JWT must be the public anon key, not service_role.",
      );
    }
  } else if (!key.startsWith("sb_publishable_"))
    problems.push("Expected a Supabase publishable key or legacy anon key.");
  if (/local_browser_test|placeholder|replace_me/i.test(key))
    problems.push("Test or placeholder keys cannot be released.");
}
const support = requireValue("VITE_SUPPORT_EMAIL");
if (support && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support))
  problems.push("VITE_SUPPORT_EMAIL must be a valid public email.");
const pages = ["VITE_PRIVACY_URL", "VITE_TERMS_URL", "VITE_DELETION_URL"].map(
  publicURL,
);
const config = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
if (
  config.appId !== "com.novapulsedigital.loop" ||
  config.appName !== "Loop Chat"
)
  problems.push("Unexpected Android release identity.");
if (
  config.server?.url ||
  config.server?.cleartext ||
  config.android?.allowMixedContent ||
  config.android?.webContentsDebuggingEnabled
)
  problems.push(
    "Native config must use bundled assets, verified HTTPS, and no release WebView debugging.",
  );
if (
  values.VITE_PUSH_ENABLED === "true" &&
  !existsSync("android/app/google-services.json")
)
  problems.push("Push enabled without Firebase Android configuration.");
if (
  values.VITE_PUSH_ENABLED &&
  !["true", "false"].includes(values.VITE_PUSH_ENABLED)
)
  problems.push("VITE_PUSH_ENABLED must be true or false.");
const signing = [
  "LOOP_KEYSTORE_PATH",
  "LOOP_KEYSTORE_PASSWORD",
  "LOOP_KEY_ALIAS",
  "LOOP_KEY_PASSWORD",
];
if (!process.argv.includes("--public-only")) {
  for (const name of signing) requireValue(name);
  if (values.LOOP_KEYSTORE_PATH && !existsSync(values.LOOP_KEYSTORE_PATH))
    problems.push("The upload keystore file does not exist.");
  if (
    signing.every((n) => values[n]) &&
    existsSync(values.LOOP_KEYSTORE_PATH)
  ) {
    const check = spawnSync(
      "keytool",
      [
        "-list",
        "-keystore",
        values.LOOP_KEYSTORE_PATH,
        "-storepass:env",
        "LOOP_KEYSTORE_PASSWORD",
        "-alias",
        values.LOOP_KEY_ALIAS,
      ],
      {
        env: {
          ...process.env,
          ...Object.fromEntries(signing.map((n) => [n, values[n]])),
        },
        encoding: "utf8",
      },
    );
    if (check.status !== 0)
      problems.push("The upload keystore or alias could not be verified.");
  }
}
if (problems.length) {
  console.error(
    "Release is blocked:\n" + problems.map((p) => `- ${p}`).join("\n"),
  );
  process.exit(1);
}
// Do not print keys, passwords, tokens, or provider responses.
function remote(url, headers = []) {
  const command = spawnSync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "25",
      ...headers.flatMap((h) => ["--header", h]),
      String(url),
    ],
    { encoding: "utf8" },
  );
  if (command.status !== 0)
    throw Error("Required remote endpoint is unavailable.");
  return command.stdout;
}
try {
  const settings = JSON.parse(
    remote(new URL("/auth/v1/settings", service), [`apikey: ${key}`]),
  );
  if (
    settings.external?.email_enabled === false ||
    settings.external?.email === false
  )
    throw Error("Supabase email sign-in is disabled.");
  const search = spawnSync(
    "curl",
    [
      "--silent",
      "--show-error",
      "--max-time",
      "25",
      "--output",
      "/dev/null",
      "--write-out",
      "%{http_code}",
      String(new URL("/rest/v1/rpc/search_profiles", service)),
      "--header",
      `apikey: ${key}`,
      "--header",
      "Content-Type: application/json",
      "--data",
      '{"prefix":"releasecheck"}',
    ],
    { encoding: "utf8" },
  );
  if (
    search.status !== 0 ||
    !["200", "401", "403"].includes(search.stdout.trim())
  )
    throw Error("The messaging schema is missing or inaccessible.");
  for (let i = 0; i < pages.length; i++) {
    const text = remote(pages[i]);
    if (!text.includes("NovaPulse Digital LLC") || !text.includes(support))
      throw Error(
        "A hosted legal page does not identify the publisher and support contact.",
      );
  }
} catch (e) {
  console.error(`Release is blocked: ${e.message}`);
  process.exit(1);
}
console.log(
  "Release configuration, required endpoints, hosted legal pages, and upload-key checks passed. Live two-user messaging, deletion, moderation operations, and Android device tests must also be completed before submission.",
);

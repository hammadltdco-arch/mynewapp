import { test, expect } from "@playwright/test";
import sharp from "sharp";
const uid = "11111111-1111-4111-8111-111111111111",
  peerid = "22222222-2222-4222-8222-222222222222",
  cid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const profile = {
  id: uid,
  username: "alex",
  display_name: "Alex Morgan",
  about: "Here for the good conversations.",
};
const peer = {
  id: peerid,
  username: "mia",
  display_name: "Mia Chen",
  about: "Collecting little moments. ☀️",
};
async function fixture(page, { onboard = false } = {}) {
  const state = {
    profile: { ...profile, username: onboard ? null : profile.username },
    blocks: [],
    reported: null,
    deleted: false,
    messages: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        conversation_id: cid,
        sender_id: peerid,
        body: "Hey! We’re still on for Saturday, right?",
        attachment_path: null,
        created_at: "2026-10-26T12:34:00Z",
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        conversation_id: cid,
        sender_id: uid,
        body: "Of course! Looking forward to it ☀️",
        attachment_path: null,
        created_at: "2026-10-26T12:35:00Z",
      },
    ],
  };
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "alex@example.test",
    email_confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { display_name: "Alex Morgan" },
    created_at: "2026-10-26T10:00:00Z",
  };
  await page.route("https://loop-test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method();
    let data;
    try {
      data = req.postDataJSON();
    } catch {}
    const send = (body, status = 200, headers = {}) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*", ...headers },
        body: status === 204 ? "" : JSON.stringify(body),
      });
    if (method === "OPTIONS")
      return send({}, 200, {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      });
    if (path === "/auth/v1/token") {
      if (data?.password === "wrong-password")
        return send(
          {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          },
          400,
        );
      const token = `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), role: "authenticated", aud: "authenticated" })).toString("base64url")}.test`;
      return send({
        access_token: token,
        refresh_token: "fixture-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    }
    if (path === "/auth/v1/user") return send(user);
    if (path === "/auth/v1/logout") return send({}, 204);
    if (path === "/auth/v1/recover") return send({});
    if (path === "/auth/v1/signup") {
      state.signup = data;
      return send({ user, session: null });
    }
    if (path === "/rest/v1/profiles") {
      if (method === "PATCH") {
        state.profile = { ...state.profile, ...data };
        return send(state.profile);
      }
      return send(state.profile);
    }
    if (path === "/rest/v1/conversation_members")
      return send(
        url.searchParams.has("user_id") &&
          url.searchParams.get("user_id").startsWith("neq.")
          ? [{ conversation_id: cid, user_id: peerid, profiles: peer }]
          : [{ conversation_id: cid, last_read_at: "2026-10-26T13:00:00Z" }],
      );
    if (path === "/rest/v1/messages") {
      if (method === "HEAD")
        return route.fulfill({
          status: 200,
          headers: {
            "content-range": "*/0",
            "Access-Control-Allow-Origin": "*",
          },
          body: "",
        });
      if (method === "POST") {
        if (state.blocks.length)
          return send({ message: "Blocked conversation", code: "42501" }, 403);
        const m = {
          ...data,
          id: crypto.randomUUID(),
          sender_id: uid,
          created_at: new Date().toISOString(),
        };
        state.messages.push(m);
        return send(m, 201);
      }
      if (method === "DELETE") {
        state.messages = state.messages.filter(
          (m) => `eq.${m.id}` !== url.searchParams.get("id"),
        );
        return send(null, 204);
      }
      const rows = [...state.messages].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
      return send(
        url.searchParams.get("limit") === "1" ? rows.slice(0, 1) : rows,
      );
    }
    if (path === "/rest/v1/blocks") {
      if (method === "POST") {
        state.blocks = [{ blocked_id: data.blocked_id }];
        return send(null, 201);
      }
      if (method === "DELETE") {
        state.blocks = [];
        return send(null, 204);
      }
      return send(state.blocks);
    }
    if (path === "/rest/v1/reports") {
      state.reported = data;
      return send(null, 201);
    }
    if (path === "/rest/v1/rpc/mark_read") return send(null);
    if (path === "/rest/v1/rpc/search_profiles")
      return send(data.prefix === "mia" ? [peer] : []);
    if (path === "/rest/v1/rpc/start_direct_chat") return send(cid);
    if (path.startsWith("/storage/v1/object/sign/"))
      return send({ signedURL: "/object/sign/chat-media/test?token=fixture" });
    if (path.startsWith("/storage/v1/object/"))
      return method === "GET"
        ? route.fulfill({
            status: 200,
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#9ab583"/></svg>',
          })
        : send({ Key: "test" });
    if (path === "/functions/v1/delete-account") {
      state.deleted = true;
      return send({ deleted: true });
    }
    if (path === "/rest/v1/device_tokens")
      return send([], method === "DELETE" ? 204 : 200);
    return send({ message: `Unhandled fixture ${path}` }, 404);
  });
  return state;
}
async function login(page, password = "a-strong-password-123") {
  await page.goto("/");
  await page.getByLabel("Email address").fill("alex@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("real messenger UI signs in, sends text/photos, reloads, and deletes a sent message", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = await fixture(page);
  await login(page);
  await page.locator(".chat-list .chat-row").click();
  await expect(page.locator(".bubble").first()).toContainText("Saturday");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("See you there!");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.locator(".bubble").filter({ hasText: "See you there!" }),
  ).toBeVisible();
  expect(state.messages.at(-1).body).toBe("See you there!");
  await page.reload();
  await page.locator(".chat-list .chat-row").click();
  await expect(
    page.locator(".bubble").filter({ hasText: "See you there!" }),
  ).toBeVisible();
  const photo = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#c9d9b0" },
  })
    .png()
    .toBuffer();
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByAltText("Attachment preview")).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".message-photo")).toBeVisible();
  expect(state.messages.at(-1).attachment_path).toContain(`${uid}/${cid}/`);
  const sent = page.locator(".bubble").filter({ hasText: "See you there!" });
  await sent.getByRole("button", { name: /Options for message/ }).click();
  await page.getByRole("button", { name: "Delete for everyone" }).click();
  await expect(
    page.locator(".bubble").filter({ hasText: "See you there!" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("find people, report abuse, block and unblock", async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await page.getByRole("textbox", { name: "Find by username" }).fill("mia");
  await page.getByRole("button", { name: "Search users" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Mia Chen/ })
    .click();
  await page.getByRole("button", { name: "Conversation information" }).click();
  await page.getByRole("button", { name: "Report user", exact: true }).click();
  await page.getByLabel("Reason").selectOption("harassment");
  await page.getByLabel("What happened?").fill("Unwanted messages");
  await page.getByRole("button", { name: "Submit report" }).click();
  expect(state.reported.reason).toBe("harassment");
  await page.getByRole("button", { name: "Block user", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Block user", exact: true })
    .click();
  await expect(page.locator(".blocked-banner")).toContainText("You blocked");
  await expect(page.getByRole("button", { name: "Send message" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Unblock user", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Unblock user", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeVisible();
});
test("failed sign-in shows error and signup requires acceptance", async ({
  page,
}) => {
  const state = await fixture(page);
  await login(page, "wrong-password");
  await expect(page.getByRole("alert")).toContainText(
    "Invalid login credentials",
  );
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name").fill("New member");
  await page
    .getByLabel("Password", { exact: true })
    .fill("new-strong-password-123");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(state.signup.data.age_confirmed).toBe(true);
  expect(state.signup.data.terms_version).toBe("2026-10-26");
});
test("new account completes profile before messaging", async ({ page }) => {
  const state = await fixture(page, { onboard: true });
  await login(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("new_alex");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.profile.username).toBe("new_alex");
  expect(state.profile.display_name).toBe("Alex Morgan");
});
test("account deletion reauthenticates and returns to sign-in", async ({
  page,
}) => {
  const state = await fixture(page);
  await login(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await page.getByLabel("Confirm your password").fill("a-strong-password-123");
  await page.getByLabel("Type DELETE").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(state.deleted).toBe(true);
});
test("mobile signed-in layout and offline sending protection", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await login(page);
  await page.locator(".chat-list .chat-row").click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Hello from my phone");
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("You’re offline");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.locator(".bubble").filter({ hasText: "Hello from my phone" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/loop-release-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to conversations" }).click();
  await expect(page.locator(".inbox")).toBeVisible();
});
test("release sign-in screen fits narrow phones", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await fixture(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/loop-auth-mobile.png",
    fullPage: true,
  });
});

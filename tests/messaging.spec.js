import { test, expect } from "@playwright/test";
test("send, persist, filter, and manage conversations", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Mia Chen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("See you Saturday!");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.locator(".bubble").filter({ hasText: "See you Saturday!" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".bubble").filter({ hasText: "See you Saturday!" }),
  ).toBeVisible();
  await page.getByPlaceholder("Search conversations").fill("James");
  await expect(page.locator(".chat-list .chat-row")).toHaveCount(1);
  await page.locator(".chat-list .chat-row").click();
  await page.getByRole("button", { name: "Choose emoji" }).click();
  await page.getByRole("button", { name: "👋", exact: true }).click();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".bubble").filter({ hasText: "👋" })).toBeVisible();
  await page.getByRole("button", { name: "Mute chat", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unmute chat", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Conversation information" }).click();
  await expect(page.locator(".details")).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Attach photo" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  await expect(page.getByAltText("Attachment preview")).toBeVisible();
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.locator(".message-photo")).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile navigation and layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(page.locator(".inbox")).toBeVisible();
  await page.locator(".chat-list .chat-row").first().click();
  await expect(page.locator(".conversation")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Hello from mobile");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.locator(".bubble").filter({ hasText: "Hello from mobile" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "artifacts/loop-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Back to conversations" }).click();
  await expect(page.locator(".inbox")).toBeVisible();
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sofia Martinez" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sofia Martinez", exact: true }),
  ).toBeVisible();
});
test("desktop layout", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/demo");
  await expect(page.locator(".composer")).toBeVisible();
  await page.screenshot({ path: "artifacts/loop-desktop.png", fullPage: true });
});

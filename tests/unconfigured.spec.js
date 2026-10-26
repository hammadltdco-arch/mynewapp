import { test, expect } from "@playwright/test";
test("unconfigured install is honest and legal pages work without sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little closer. Soon." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toHaveCount(
    0,
  );
  for (const path of ["privacy", "terms", "delete-account", "child-safety"]) {
    const res = await page.goto(`/legal/${path}.html`);
    expect(res.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "novapulsedigitalllc@gmail.com",
    );
  }
});

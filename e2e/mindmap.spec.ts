import { test, expect } from "@playwright/test";
test("real canvas: dragging, connecting, read-only details, persistence and export/import", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const core = page.locator('.react-flow__node[data-id="core"]');
  await expect(core).toBeVisible();
  await core.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.getByRole("tooltip").hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await core.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const before = await core.boundingBox();
  await core.hover();
  await page.mouse.down();
  await page.mouse.move(before!.x + 150, before!.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("● Saved locally");
  const transform = await core.getAttribute("style");
  expect(transform).toContain("translate(320px, 180px)");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /Ellipse/ }).click();
  await page.getByLabel("Title", { exact: true }).fill("Browser-tested idea");
  await page.getByLabel("Details", { exact: true }).fill("Line one\nLine two");
  const added = page
    .locator(".react-flow__node")
    .filter({ hasText: "Browser-tested idea" });
  let box = await added.boundingBox();
  await page.mouse.move(box!.x + 100, box!.y + 60);
  await page.mouse.down();
  await page.mouse.move(box!.x + 100, box!.y + 250, { steps: 12 });
  await page.mouse.up();
  let moved = await added.boundingBox();
  expect(moved!.y).toBeGreaterThan(box!.y + 100);
  const source = await added.locator('[data-handleid="left"]').boundingBox();
  const target = await core.locator('[data-handleid="bottom"]').boundingBox();
  await page.mouse.move(source!.x + 4, source!.y + 4);
  await page.mouse.down();
  await page.mouse.move(target!.x + 4, target!.y + 4, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  const endpoint = await page
    .locator(
      '.react-flow__edge:not([data-id^="core-"]) .react-flow__edgeupdater-target',
    )
    .boundingBox();
  const newTarget = await page
    .locator('[data-id="explore"] [data-handleid="bottom"]')
    .boundingBox();
  await page.mouse.move(
    endpoint!.x + endpoint!.width / 2,
    endpoint!.y + endpoint!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(newTarget!.x + 4, newTarget!.y + 4, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const raw = localStorage.getItem("mindspace.document.v1");
          return raw
            ? JSON.parse(raw).edges.find(
                (e: { id: string }) => !e.id.startsWith("core-"),
              ).target
            : null;
        }),
    )
    .toBe("explore");
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  await page.getByRole("button", { name: /Undo/ }).click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(3);
  await page.getByRole("button", { name: /Redo/ }).click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  await expect(page.getByRole("status")).toHaveText("● Saved locally");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export JSON/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("mindspace.json");
  await page.reload();
  await expect(
    page.getByText("Browser-tested idea", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
  await expect(page.locator(".react-flow__handle").first()).toHaveCSS(
    "opacity",
    "0",
  );
  await page.getByText("Browser-tested idea", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Line one\nLine two");
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await added.click();
  await page.getByRole("button", { name: "Delete idea", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(page.locator(".react-flow__edge")).toHaveCount(3);
  page.once("dialog", (d) => d.accept());
  await page
    .getByLabel("Import document")
    .setInputFiles((await download.path())!);
  await expect(
    page.getByText("Browser-tested idea", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.screenshot({ path: "/tmp/mindspace-screenshot.png" });
  expect(errors).toEqual([]);
});

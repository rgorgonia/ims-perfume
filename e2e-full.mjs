import { chromium } from "playwright";

const BASE = "http://localhost:3111";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const uniq = `E2E ${Date.now()}`;
async function nav(path) {
  await p.click(`nav a[href="${path}"]`);
  await p.waitForURL(BASE + path, { timeout: 15000 }).catch(() => {});
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(500);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));

// ---------- login as platform admin ----------
await p.goto(BASE + "/login");
await p.fill('input[type="email"]', "admin@local.test");
await p.fill('input[type="password"]', "admin1234");
await p.click('button[type="submit"]');
await p.waitForURL(BASE + "/");
check("Login: redirected to dashboard", p.url() === BASE + "/");

// ---------- 1. Dashboard ----------
await p.waitForLoadState("networkidle");
const body1 = await p.textContent("body");
check("Dashboard: sidebar nav present", await p.locator('nav a[href="/sales"]').count() > 0);
check("Dashboard: Sign out visible", /Sign out/.test(body1));

// ---------- 2. Sales ----------
await nav("/sales");
const body2 = await p.textContent("body");
check("Sales: page renders", /New sale|Record|Sales/i.test(body2));
check("Sales: store dropdown present", await p.waitForSelector('select[name="store_id"]', { timeout: 8000 }).then(() => true).catch(() => false));

// ---------- 3. Inventory ----------
await nav("/inventory");
for (const lbl of ["Store *", "Product variant *", "Movement type", "Quantity *"]) {
  check(`Inventory: label "${lbl}"`, await p.locator(`label:has-text("${lbl}")`).count() > 0);
}
check("Inventory: store select has options", (await p.locator('select[name="store_id"] option').count()) > 1);

// ---------- 4. Products ----------
await nav("/products");
const body4 = await p.textContent("body");
check("Products: page renders", /product/i.test(body4));
check("Products: add-product form present", (await p.locator("form").count()) > 0);

// ---------- 5. Stores ----------
await nav("/stores");
await p.waitForLoadState("networkidle");
const storesText = await p.evaluate(() => document.body.innerText);
check("Stores: Test Store visible", storesText.includes("Test Store"), storesText.slice(0, 300).replace(/\n/g, " | "));

// ---------- 6. Users (full management round-trip) ----------
await nav("/users");
await p.fill("#rf-name", uniq);
await p.fill("#rf-email", `e2e-${Date.now()}@local.test`);
await p.selectOption("#rf-role", "store_manager");
const tenantSel = p.locator("#rf-tenant");
if (await tenantSel.count()) {
  const demoOpt = tenantSel.locator("option", { hasText: "Demo Tenant" });
  await tenantSel.selectOption({ label: (await demoOpt.textContent())?.trim() });
  await p.waitForTimeout(300);
}
await p.selectOption("#rf-store-mode", "existing");
const storeOpts = await p.locator("#rf-store option").allTextContents();
check("Users: register — Test Store listed for Demo Tenant", storeOpts.some((o) => o.includes("Test Store")), JSON.stringify(storeOpts));
await p.locator("#rf-store").selectOption({ label: storeOpts.find((o) => o.includes("Test Store")) });
await p.locator("form", { has: p.locator("#rf-name") }).getByRole("button").last().click();
await p.waitForLoadState("networkidle");
await p.waitForTimeout(1000);
const row = p.locator("tr", { hasText: uniq });
check("Users: new user appears in table", (await row.count()) > 0);
await row.getByText("Disable").click();
await p.waitForLoadState("networkidle");
await p.waitForTimeout(800);
check("Users: Disable flips to Enable", (await p.locator("tr", { hasText: uniq }).getByText("Enable").count()) > 0);
await p.locator("tr", { hasText: uniq }).getByText("Enable").click();
await p.waitForLoadState("networkidle");
await p.waitForTimeout(800);
check("Users: Enable flips back to Disable", (await p.locator("tr", { hasText: uniq }).getByText("Disable").count()) > 0);
p.on("dialog", (d) => d.accept());
await p.locator("tr", { hasText: uniq }).getByText("Delete").click();
await p.waitForLoadState("networkidle");
await p.waitForTimeout(2000);
await p.reload();
await p.waitForLoadState("networkidle");
check("Users: deleted user gone", (await p.locator("tr", { hasText: uniq }).count()) === 0);

// ---------- 7. Capital ----------
await nav("/capital");
const body7 = await p.textContent("body");
check("Capital: page renders", /capital|amount|inject/i.test(body7));

// ---------- 8. Settings ----------
await nav("/settings");
const body8 = await p.textContent("body");
check("Settings: page renders", /settings|business|currency/i.test(body8));

// ---------- 9. Tenants (platform admin) ----------
await nav("/admin/tenants");
const body9 = await p.textContent("body");
check("Tenants: Demo Tenant visible", /Demo Tenant/.test(body9));
const menuBtn = p.locator('button[aria-haspopup="menu"]').first();
if (await menuBtn.count()) {
  await menuBtn.click();
  await p.waitForTimeout(300);
  const menuVisible = await p.locator('[role="menu"]').isVisible().catch(() => false);
  check("Tenants: Actions menu opens and is visible", menuVisible);
  const inViewport = menuVisible
    ? await p.locator('[role="menu"]').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
      })
    : false;
  check("Tenants: Actions menu fully in viewport (not clipped)", inViewport);
  await p.keyboard.press("Escape");
}

// ---------- 10. Audit log ----------
await nav("/admin/audit");
const body10 = await p.textContent("body");
check("Audit: page renders (table or explainer)", /audit|movement|empty/i.test(body10));

// ---------- 11. Sign out ----------
await p.getByText("Sign out").first().click();
await p.waitForURL(/login/, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(500);
check("Sign out: back at login", p.url().includes("/login"));

// ---------- 12. Store manager scoping (separate session) ----------
const ctx2 = await browser.newContext();
const m = await ctx2.newPage();
await m.goto(BASE + "/login");
await m.fill('input[type="email"]', "manager@local.test");
await m.fill('input[type="password"]', "manager1234");
await m.click('button[type="submit"]');
await m.waitForURL(BASE + "/");
check("Manager: sidebar hides Users tab", (await m.locator('nav a[href="/users"]').count()) === 0);
check("Manager: sidebar hides Tenants tab", (await m.locator('nav a[href="/admin/tenants"]').count()) === 0);
check("Manager: sidebar hides Audit tab", (await m.locator('nav a[href="/admin/audit"]').count()) === 0);
await m.goto(BASE + "/inventory");
await m.waitForLoadState("networkidle");
const mStoreOpts = await m.locator('select[name="store_id"] option').allTextContents();
check("Manager: inventory shows only own store", mStoreOpts.every((o) => o === "Select store" || o.includes("Test Store")), JSON.stringify(mStoreOpts));
await m.goto(BASE + "/sales");
await m.waitForLoadState("networkidle");
const mSaleOpts = await m.locator('select[name="store_id"] option').allTextContents().catch(() => []);
const realStores = mSaleOpts.filter((o) => o.trim() && !/^select store/i.test(o));
check("Manager: sales store select scoped", realStores.every((o) => o.includes("Test Store")), JSON.stringify(mSaleOpts));
await m.goto(BASE + "/users");
await m.waitForLoadState("networkidle");
check("Manager: /users direct access denied", !/Register user/.test(await m.textContent("body")));

await browser.close();

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
if (errors.length) console.log("Page errors:", errors.slice(0, 3));
process.exit(fails.length ? 1 : 0);

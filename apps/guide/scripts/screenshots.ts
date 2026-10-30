// `npm run -w @mensal/guide screenshots` (PRD §7.17): the guide's screenshots,
// taken from the local stack with the demo seed's fictitious data. Manual
// only: never run by `npm run check` or CI.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, BrowserContext } from "playwright";
import { captures, demoUser, type Capture } from "./captures.ts";
import {
  exampleOrigin,
  fakeCalendarKey,
  fakeToken,
  redactSecrets,
  type RealToken,
} from "./redact.ts";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

const webUrl = process.env.GUIDE_WEB_URL ?? "http://localhost:5173";
const guideRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(guideRoot, "..", "..");
const outDir = join(guideRoot, "screenshots");

const viewports = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Stops unless the web dev server answers and, through it, a healthy API. */
async function checkStack() {
  let problem: string | undefined;
  try {
    const health = await fetch(`${webUrl}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!health.ok)
      problem = `the API is not healthy (${webUrl}/api/health answered ${health.status})`;
  } catch {
    problem = `nothing answers at ${webUrl}`;
  }
  if (problem)
    fail(
      [
        `The local stack is not up: ${problem}.`,
        "Start it (see AGENTS.md), then run this again:",
        "  docker compose up -d",
        "  npm run -w @mensal/api dev",
        "  npm run -w @mensal/web dev",
      ].join("\n")
    );
}

function runSeed() {
  // Through a shell, where npm is a script on Windows.
  const seed = spawnSync("npm run seed", {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });
  if (seed.status !== 0) fail("The demo seed failed; see above.");
}

await checkStack();
runSeed();
mkdirSync(outDir, { recursive: true });

const { chromium } = await import("playwright");
const browser = await chromium.launch();
try {
  const signIn = await browser.newContext();
  const page = await signIn.newPage();
  await page.goto(`${webUrl}/entrar`);
  await page.getByLabel("E-mail").fill(demoUser.email);
  await page.getByLabel("Senha").fill(demoUser.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${webUrl}/`);
  const storageState = await signIn.storageState();
  await signIn.close();

  for (const capture of captures) {
    await take(browser, capture, storageState);
    console.log(`screenshots/${capture.name}.png`);
  }
} finally {
  await browser.close();
}

async function take(
  browser: Browser,
  {
    name,
    path,
    viewport,
    theme = "dark",
    view = "list",
    signedOut = false,
    init,
    steps,
  }: Capture,
  storageState: StorageState
) {
  const context = await browser.newContext({
    ...(signedOut ? {} : { storageState }),
    viewport: viewports[viewport],
    deviceScaleFactor: 2,
    colorScheme: theme,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  try {
    const page = await context.newPage();
    await init?.(page);
    // Every token the app creates during the steps, and every calendar link
    // key it shows, to keep off the capture.
    const tokens: RealToken[] = [];
    const calendarKeys: string[] = [];
    const reading: Promise<void>[] = [];
    page.on("response", (response) => {
      if (!response.ok()) return;
      const method = response.request().method();
      const { pathname } = new URL(response.url());
      if (method === "POST" && pathname === "/api/v1/access-tokens") {
        reading.push(
          response.json().then(({ token, prefix }: RealToken) => {
            tokens.push({ token, prefix });
          })
        );
      }
      if (
        (method === "GET" || method === "POST") &&
        pathname === "/api/v1/calendar-link"
      ) {
        reading.push(
          response.json().then(({ link }: { link: { url: string } | null }) => {
            const key = link && new URL(link.url).searchParams.get("key");
            if (key) calendarKeys.push(key);
          })
        );
      }
    });

    // The account's preferences, as Configurações would save them. Signed
    // out, the screens use the default theme, Escuro.
    if (!signedOut) {
      await page.goto(`${webUrl}/`);
      const saved = await page.evaluate(
        async (body) =>
          (
            await fetch("/api/auth/update-user", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            })
          ).ok,
        { colorScheme: theme, occurrenceView: view }
      );
      if (!saved) fail(`${name}: could not save the account's preferences.`);
    }

    await page.goto(`${webUrl}${path}`);
    await page.waitForLoadState("networkidle");
    await steps?.(page);
    // Let transitions (modals, popovers) settle.
    await page.waitForTimeout(600);

    await Promise.all(reading);
    const leaked = await page.evaluate(redactSecrets, {
      tokens,
      fakeToken,
      calendarKeys,
      fakeCalendarKey,
      origin: { real: new URL(webUrl).origin, shown: exampleOrigin },
    });
    if (leaked)
      fail(
        `${name}: a real access token or calendar link key is still on the page.`
      );

    await page.screenshot({ path: join(outDir, `${name}.png`) });
  } finally {
    await context.close();
  }
}

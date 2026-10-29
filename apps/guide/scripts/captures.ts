import type { Page } from "playwright";

/**
 * The guide's screenshots (PRD §7.17), each written to
 * `apps/guide/screenshots/<name>.png` by `npm run -w @mensal/guide screenshots`.
 * Add, change or drop shots here; the plumbing is in `screenshots.ts`.
 */
export interface Capture {
  /** The file name, without `.png`. */
  name: string;
  /** The app route the capture starts from. */
  path: string;
  /** 390 px wide for the monthly screen, settling and sign-up, 1280 px otherwise. */
  viewport: "phone" | "desktop";
  /** The account's Tema for this shot: Escuro unless said otherwise. */
  theme?: "dark" | "light";
  /** The account's Visualização for this shot: Lista unless said otherwise. */
  view?: "list" | "table";
  /** Taken signed out, as someone without an account sees it. */
  signedOut?: boolean;
  /** What to set up in the page before it loads, e.g. a stubbed browser API. */
  init?: (page: Page) => Promise<void>;
  /** What to do on the page before the shot. */
  steps?: (page: Page) => Promise<void>;
}

/**
 * The demo user the seed creates (`apps/api/src/seed.ts`); `demo-user.test.ts`
 * fails if the two drift apart.
 */
export const demoUser = {
  email: "demo@mensal.local",
  password: "demo-password-local",
};

function openAccountMenu(page: Page) {
  return page.getByRole("button", { name: "Conta", exact: true }).click();
}

async function openAccountMenuItem(page: Page, item: string) {
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: item }).click();
  await page.getByRole("dialog").waitFor();
}

/**
 * Stands in for the browser's Push API (PRD §7.17): a service worker
 * registration whose push manager hands out a made-up registration, and a
 * permission the user grants. The endpoint is on a reserved `.invalid` host
 * and the keys are not a real key pair, so no push service is ever reached,
 * not even by the API's confirmation, which fails and is only logged.
 */
async function stubPush(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let permission: NotificationPermission = "default";
    let subscription: PushSubscription | null = null;
    const made = {
      endpoint: "https://push.mensal-guia.invalid/dispositivo",
      keys: { p256dh: "chave-do-guia", auth: "segredo-do-guia" },
    };
    const pushManager = {
      getSubscription: async () => subscription,
      subscribe: async () => {
        subscription = {
          endpoint: made.endpoint,
          toJSON: () => made,
          unsubscribe: async () => {
            subscription = null;
            return true;
          },
        } as unknown as PushSubscription;
        return subscription;
      },
    };
    const registration = {
      pushManager,
    } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: async () => registration },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        get permission() {
          return permission;
        },
        requestPermission: async () => (permission = "granted"),
      },
    });
  });
}

export const captures: Capture[] = [
  { name: "cadastro", path: "/cadastro", viewport: "phone", signedOut: true },
  { name: "mes", path: "/", viewport: "phone" },
  {
    name: "liquidar",
    path: "/",
    viewport: "phone",
    // An "A definir" occurrence asks for its amount when settled.
    steps: async (page) => {
      await page.getByRole("checkbox", { name: "Liquidar Freelance" }).click();
      const popover = page.getByRole("dialog", { name: "Liquidar Freelance" });
      await popover.getByLabel("Valor").fill("1200");
    },
  },
  {
    name: "avulsa",
    path: "/",
    viewport: "desktop",
    steps: async (page) => {
      await page.getByRole("button", { name: "Nova avulsa" }).click();
      await page.getByRole("dialog", { name: "Nova conta avulsa" }).waitFor();
    },
  },
  {
    name: "recorrencias",
    path: "/recorrencias",
    viewport: "desktop",
    // A recurrence's menu: Editar, Encerrar and Excluir.
    steps: async (page) => {
      await page
        .getByRole("button", { name: "Mais ações para Aluguel" })
        .click();
      await page
        .getByRole("menuitem", { name: "Encerrar recorrência" })
        .waitFor();
    },
  },
  {
    name: "tabela",
    path: "/",
    viewport: "desktop",
    view: "table",
    // The bar with Lista / Tabela and Exportar CSV at the top, the table below.
    steps: (page) =>
      page
        .getByRole("button", { name: "Exportar CSV" })
        .evaluate((button) => button.scrollIntoView({ block: "start" })),
  },
  {
    name: "evolucao",
    path: "/",
    viewport: "desktop",
    steps: async (page) => {
      await page.getByRole("button", { name: "Evolução" }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    name: "configuracoes",
    path: "/",
    viewport: "phone",
    theme: "light",
    steps: (page) => openAccountMenuItem(page, "Configurações"),
  },
  {
    name: "tokens",
    path: "/",
    viewport: "desktop",
    // A token just created, with its snippets; the script fakes its value.
    steps: async (page) => {
      await openAccountMenuItem(page, "Tokens de acesso");
      await page.getByRole("button", { name: "Criar token" }).click();
      await page.getByLabel("Nome").fill("Claude Code");
      await page.getByLabel("Senha atual").fill(demoUser.password);
      await page.getByRole("button", { name: "Criar", exact: true }).click();
      await page.getByText("Copie o token agora").waitFor();
    },
  },
  {
    name: "lembretes",
    path: "/",
    viewport: "desktop",
    // Ativado on this device: turned on through the stubbed Push API.
    init: stubPush,
    steps: async (page) => {
      await openAccountMenuItem(page, "Lembretes");
      const dialog = page.getByRole("dialog", { name: "Lembretes" });
      await dialog
        .getByRole("button", { name: "Ativar neste dispositivo" })
        .click();
      await dialog.getByText("Ativado", { exact: true }).waitFor();
    },
  },
  {
    name: "calendario",
    path: "/",
    viewport: "desktop",
    // The link, generated if the demo user has none; the script fakes its key.
    steps: async (page) => {
      await openAccountMenuItem(page, "Link do calendário");
      const dialog = page.getByRole("dialog", { name: "Link do calendário" });
      const copy = dialog.getByRole("button", { name: "Copiar link" });
      const generate = dialog.getByRole("button", { name: "Gerar link" });
      await copy.or(generate).first().waitFor();
      if (await generate.isVisible()) {
        await generate.click();
        await dialog.getByLabel("Senha atual").fill(demoUser.password);
        await dialog.getByRole("button", { name: "Gerar link" }).click();
      }
      await copy.waitFor();
    },
  },
  {
    name: "conta",
    path: "/",
    viewport: "desktop",
    // The account menu, with every item of #conta.
    steps: async (page) => {
      await openAccountMenu(page);
      await page.getByRole("menuitem", { name: "Excluir conta" }).waitFor();
    },
  },
];

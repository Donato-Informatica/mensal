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
  /** What to do on the page before the shot. */
  steps?: (page: Page) => Promise<void>;
}

/** The demo user the seed creates (`apps/api/src/seed.ts`). */
export const demoUser = {
  email: "demo@mensal.local",
  password: "demo-password-local",
};

async function openAccountMenuItem(page: Page, item: string) {
  await page.getByRole("button", { name: "Conta", exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
  await page.getByRole("dialog").waitFor();
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
    name: "conta",
    path: "/",
    viewport: "desktop",
    // The account menu, with every item of #conta.
    steps: async (page) => {
      await page.getByRole("button", { name: "Conta", exact: true }).click();
      await page.getByRole("menuitem", { name: "Excluir conta" }).waitFor();
    },
  },
];

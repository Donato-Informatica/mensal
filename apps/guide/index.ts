/**
 * The guide's section ids, in page order (PRD §7.17). Each is the anchor of
 * one section of `/guia/`; the app links to them by these names, so renaming
 * one fails a test instead of breaking a link.
 */
export const guideSections = [
  "cadastro",
  "mes",
  "liquidar",
  "avulsa",
  "recorrencias",
  "visualizacao",
  "evolucao",
  "configuracoes",
  "instalar",
  "mcp",
  "lembretes",
  "calendario",
  "conta",
] as const;

export type GuideSection = (typeof guideSections)[number];

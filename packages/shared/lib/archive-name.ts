/** The data archive's file name on `date` ('YYYY-MM-DD' in America/Sao_Paulo) (PRD §6.5). */
export function dataArchiveName(date: string): string {
  return `mensal-dados-${date}.zip`;
}

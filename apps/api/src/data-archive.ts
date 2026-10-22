import { Readable } from "node:stream";
import { schema, type Database } from "@mensal/database";
import {
  csvAmount,
  csvDate,
  csvPeriod,
  directionLabel,
  occurrenceColumns,
  originLabel,
  situationOf,
  toCsv,
  today,
} from "@mensal/shared";
import { asc, eq, sql } from "drizzle-orm";
import { strToU8, Zip, ZipDeflate } from "fflate";

const { occurrences, recurrences, users } = schema;

/**
 * Everything user `userId` entered, as a ZIP stream of three CSV files
 * (PRD §6.5): `perfil.csv`, `recorrencias.csv` and `ocorrencias.csv`, each
 * present even with no rows. Persisted occurrences only: virtual ones are not
 * data the user entered, so nothing is materialized. It knows nothing of
 * HTTP, so a background job can build the same archive. `now` decides each
 * occurrence's Situação, as the table shows it that day.
 */
export async function dataArchive(
  db: Database,
  userId: string,
  { now = new Date() }: { now?: Date } = {}
): Promise<Readable> {
  const [profile, userRecurrences, userOccurrences] = await Promise.all([
    db
      .select({
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId)),
    db
      .select()
      .from(recurrences)
      .where(eq(recurrences.userId, userId))
      .orderBy(asc(recurrences.createdAt), asc(recurrences.id)),
    db
      .select()
      .from(occurrences)
      .where(eq(occurrences.userId, userId))
      // By period, then as rule 5.11: due date first, none last.
      .orderBy(
        asc(occurrences.period),
        sql`${occurrences.dueDate} ASC NULLS LAST`,
        asc(occurrences.createdAt),
        asc(occurrences.id)
      ),
  ]);
  const date = today(now);

  return zipStream({
    "perfil.csv": toCsv(
      ["Nome", "Email", "Criado em"],
      profile.map(({ name, email, createdAt }) => [
        name,
        email,
        csvDate(today(createdAt)),
      ])
    ),
    "recorrencias.csv": toCsv(
      [
        "ID",
        "Descrição",
        "Tipo",
        "Valor",
        "Dia de vencimento",
        "Início",
        "Fim",
        "Notas",
      ],
      userRecurrences.map((recurrence) => [
        recurrence.id,
        recurrence.description,
        directionLabel(recurrence),
        csvAmount(recurrence.defaultAmount),
        recurrence.dueDay === null ? "" : String(recurrence.dueDay),
        csvPeriod(recurrence.startPeriod),
        csvPeriod(recurrence.endPeriod),
        recurrence.notes ?? "",
      ])
    ),
    "ocorrencias.csv": toCsv(
      // The table's columns, with what identifies each occurrence.
      [
        "ID",
        "Competência",
        occurrenceColumns.description,
        occurrenceColumns.dueDate,
        occurrenceColumns.direction,
        occurrenceColumns.amount,
        occurrenceColumns.situation,
        occurrenceColumns.settledAt,
        occurrenceColumns.origin,
        "Recorrência (ID)",
        occurrenceColumns.notes,
      ],
      userOccurrences.map((occurrence) => [
        occurrence.id,
        csvPeriod(occurrence.period),
        occurrence.description,
        csvDate(occurrence.dueDate),
        directionLabel(occurrence),
        csvAmount(occurrence.amount),
        situationOf(occurrence, date),
        csvDate(occurrence.settledAt),
        originLabel(occurrence),
        occurrence.recurrenceId ?? "",
        occurrence.notes ?? "",
      ])
    ),
  });
}

/** `files`, by name, deflated into a ZIP that streams out as it is built. */
function zipStream(files: Record<string, string>): Readable {
  const stream = new Readable({ read() {} });
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      stream.destroy(error);
      return;
    }
    stream.push(chunk);
    if (final) stream.push(null);
  });
  for (const [name, content] of Object.entries(files)) {
    const file = new ZipDeflate(name);
    zip.add(file);
    file.push(strToU8(content), true);
  }
  zip.end();
  return stream;
}

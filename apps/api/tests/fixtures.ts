import { schema, type Database } from "@mensal/database";

type NewRecurrence = typeof schema.recurrences.$inferInsert;
type NewOccurrence = typeof schema.occurrences.$inferInsert;

/** A recurrence seeded straight into the database, as through Drizzle Studio. */
export async function insertRecurrence(
  db: Database,
  values: Pick<NewRecurrence, "userId"> & Partial<NewRecurrence>
) {
  const [recurrence] = await db
    .insert(schema.recurrences)
    .values({
      direction: "OUTFLOW",
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
      startPeriod: "2026-01-01",
      ...values,
    })
    .returning();
  return recurrence!;
}

/** An occurrence seeded straight into the database, as through Drizzle Studio. */
export async function insertOccurrence(
  db: Database,
  values: Pick<NewOccurrence, "userId"> & Partial<NewOccurrence>
) {
  const [occurrence] = await db
    .insert(schema.occurrences)
    .values({
      direction: "OUTFLOW",
      description: "Conserto do carro",
      status: "PENDING",
      amount: 85000,
      period: "2026-10-01",
      dueDate: "2026-10-20",
      ...values,
    })
    .returning();
  return occurrence!;
}

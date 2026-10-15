import { schema, type Database } from "@mensal/database";
import { clampDueDate, shiftPeriod } from "@mensal/shared";
import { eq } from "drizzle-orm";
import type { Auth } from "./auth.ts";

export const demoUser = {
  name: "Demo",
  email: "demo@mensal.local",
  password: "demo-password-local",
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Refuses anything but a local development database. */
export function assertLocalDatabase(
  databaseUrl: string,
  nodeEnv = process.env.NODE_ENV
): void {
  const { hostname } = new URL(databaseUrl);
  if (nodeEnv === "production" || !LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to seed ${hostname}: the seed is demo data for local development only.`
    );
  }
}

type NewRecurrence = typeof schema.recurrences.$inferInsert;
type NewOccurrence = typeof schema.occurrences.$inferInsert;

/**
 * Replaces the demo user, and everything they own, with example data relative
 * to the current month. Safe to re-run; other users are never touched.
 */
export async function seed(
  db: Database,
  auth: Auth,
  now: () => Date = () => new Date()
): Promise<void> {
  const today = now().toISOString().slice(0, 10);
  const current = `${today.slice(0, 7)}-01`;
  const at = (months: number) => shiftPeriod(current, months);

  // Occurrences and recurrences cascade from the user.
  await db.delete(schema.users).where(eq(schema.users.email, demoUser.email));
  const { user } = await auth.api.signUpEmail({ body: demoUser });
  await db
    .update(schema.users)
    .set({ approved: true })
    .where(eq(schema.users.id, user.id));
  const userId = user.id;

  const recurrenceRows: NewRecurrence[] = [
    {
      userId,
      direction: "INFLOW",
      description: "Salário",
      defaultAmount: 850000,
      dueDay: 5,
      startPeriod: at(-5),
    },
    {
      userId,
      direction: "OUTFLOW",
      description: "Aluguel",
      defaultAmount: 220000,
      dueDay: 10,
      startPeriod: at(-5),
    },
    {
      userId,
      direction: "OUTFLOW",
      description: "Internet",
      defaultAmount: 11990,
      dueDay: 15,
      startPeriod: at(-5),
    },
    {
      userId,
      direction: "OUTFLOW",
      description: "Academia",
      defaultAmount: 9900,
      startPeriod: at(-5),
    },
    {
      userId,
      direction: "OUTFLOW",
      description: "Streaming",
      defaultAmount: 3990,
      dueDay: 20,
      startPeriod: at(-5),
      endPeriod: at(-1),
    },
    {
      userId,
      direction: "INFLOW",
      description: "Freelance",
      dueDay: 25,
      startPeriod: at(-5),
      notes: "Amount varies; filled in when it arrives.",
    },
  ];
  const inserted = await db
    .insert(schema.recurrences)
    .values(recurrenceRows)
    .returning();
  const byName = new Map(inserted.map((row) => [row.description, row]));
  const recurrence = (name: string) => byName.get(name)!;

  const occurrences: NewOccurrence[] = [];

  /** An occurrence materialized from a recurrence; override what differs. */
  const materialize = (
    name: string,
    period: string,
    overrides: Partial<NewOccurrence> = {}
  ) => {
    const source = recurrence(name);
    occurrences.push({
      userId,
      recurrenceId: source.id,
      direction: source.direction,
      description: source.description,
      amount: source.defaultAmount,
      period,
      dueDate: clampDueDate(period, source.dueDay),
      status: "PENDING",
      ...overrides,
    });
  };
  const settle = (
    name: string,
    period: string,
    overrides: Partial<NewOccurrence> = {}
  ) => {
    const dueDate = clampDueDate(period, recurrence(name).dueDay);
    materialize(name, period, {
      status: "SETTLED",
      settledAt: dueDate ?? period,
      ...overrides,
    });
  };

  // Past months, settled; the rest stays virtual on purpose (ADR-0001).
  for (const months of [-5, -4, -3, -2, -1]) {
    settle("Salário", at(months));
    settle("Aluguel", at(months), months === -3 ? { amount: 235000 } : {});
  }
  for (const months of [-5, -4, -3, -2]) {
    settle("Internet", at(months));
    settle("Streaming", at(months));
  }
  settle("Streaming", at(-1));
  settle("Freelance", at(-2), { amount: 120000 });
  settle("Freelance", at(-1), { amount: 180000 });

  // Last month's Internet was never paid: overdue. Academia was skipped.
  materialize("Internet", at(-1));
  materialize("Academia", at(-1), { status: "SKIPPED" });

  // This month: what is already due is settled, the rest is pending.
  for (const name of ["Salário", "Aluguel"]) {
    const dueDate = clampDueDate(current, recurrence(name).dueDay)!;
    if (dueDate <= today) settle(name, current);
    else materialize(name, current);
  }

  const oneOff = (values: Partial<NewOccurrence>) =>
    occurrences.push({
      userId,
      direction: "OUTFLOW",
      description: "",
      status: "PENDING",
      period: current,
      ...values,
    });
  oneOff({
    description: "Conserto do carro",
    amount: 85000,
    dueDate: clampDueDate(current, 20),
  });
  oneOff({
    direction: "INFLOW",
    description: "Venda de bike usada",
    status: "SETTLED",
    amount: 60000,
    settledAt: today,
  });
  oneOff({
    description: "IPVA",
    amount: 150000,
    period: at(1),
    dueDate: clampDueDate(at(1), 10),
  });
  oneOff({ description: "Presente de aniversário", period: at(1) });

  await db.insert(schema.occurrences).values(occurrences);
}

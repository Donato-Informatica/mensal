import type { Database } from "@mensal/database";
import {
  NewRecurrenceSchema,
  RecurrenceEditSchema,
  RecurrenceListQuerySchema,
} from "@mensal/shared";
import { Router, type Response } from "express";
import type { RecordActivity } from "./activity.ts";
import { answer } from "./answer.ts";
import { invalidInput } from "./invalid-input.ts";
import {
  createRecurrence,
  deleteRecurrence,
  editRecurrence,
  getRecurrence,
  listRecurrences,
  type OperationContext,
} from "./operations.ts";

/** `/recurrences`: the user's recurrences (PRD §6.1). */
export function recurrencesRouter({
  db,
  now,
  record,
}: {
  db: Database;
  now: () => Date;
  record: RecordActivity;
}) {
  const router = Router();
  const context = (res: Response): OperationContext => ({
    db,
    now,
    record,
    userId: res.locals.userId,
  });

  router.get("/", (req, res) => {
    const query = RecurrenceListQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json(invalidInput(query.error));
      return;
    }
    return answer(res, 200, () => listRecurrences(context(res), query.data));
  });

  router.get("/:id", (req, res) =>
    answer(res, 200, () => getRecurrence(context(res), req.params.id))
  );

  router.post("/", (req, res) => {
    const input = NewRecurrenceSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    return answer(res, 201, () => createRecurrence(context(res), input.data));
  });

  router.patch("/:id", (req, res) => {
    const input = RecurrenceEditSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    return answer(res, 200, () =>
      editRecurrence(context(res), req.params.id, input.data)
    );
  });

  router.delete("/:id", (req, res) =>
    answer(res, 204, () => deleteRecurrence(context(res), req.params.id))
  );

  return router;
}

import type { Database } from "@mensal/database";
import {
  NewOneOffSchema,
  OccurrenceEditSchema,
  StatusChangeSchema,
} from "@mensal/shared";
import { Router, type Response } from "express";
import type { RecordActivity } from "./activity.ts";
import { answer } from "./answer.ts";
import { invalidInput } from "./invalid-input.ts";
import {
  changeOccurrenceStatus,
  createOneOff,
  deleteOccurrence,
  editOccurrence,
  type OperationContext,
} from "./operations.ts";

/** `/occurrences`: the user's occurrences (PRD §6.3). */
export function occurrencesRouter({
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

  // A one-off occurrence (PRD §5.9).
  router.post("/", (req, res) => {
    const input = NewOneOffSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    return answer(res, 201, () => createOneOff(context(res), input.data));
  });

  // Any transition between the statuses is allowed (PRD §5.7).
  router.patch("/:id/status", (req, res) => {
    const input = StatusChangeSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    return answer(res, 200, () =>
      changeOccurrenceStatus(context(res), req.params.id, input.data)
    );
  });

  // The editable fields (PRD §5.8).
  router.patch("/:id", (req, res) => {
    const input = OccurrenceEditSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json(invalidInput(input.error));
      return;
    }
    return answer(res, 200, () =>
      editOccurrence(context(res), req.params.id, input.data)
    );
  });

  router.delete("/:id", (req, res) =>
    answer(res, 204, () => deleteOccurrence(context(res), req.params.id))
  );

  return router;
}

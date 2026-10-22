# Account deletion is immediate and permanent

A user can delete their own account (PRD §5.13). We delete them at once, with no grace period and no undo: through Better-Auth's `delete-user`, after the current password and the user's email typed as confirmation. Foreign-key cascades erase their recurrences, occurrences, sessions and accounts. The user's access tokens are deleted explicitly just before the user (`deleteUser.beforeDelete`), because the generated `apikeys` table references the user only by `reference_id`, with no foreign key. We chose this because a grace period needs a scheduler and an "account pending deletion" state that every route would have to respect, and this app has neither. The "Excluir conta" modal offers "Baixar meus dados" first instead, and the user is emailed afterwards so a deletion by an intruder does not go unnoticed.

## Consequences

- Nothing is kept: the same email can sign up again as a brand-new user, who needs approval again. The activity log keeps only the user id.
- Restoring an account means restoring a database backup. Support cannot undo a deletion.
- A future table that belongs to a user must either reference `users.id` with `ON DELETE CASCADE` or be cleared in `beforeDelete`. A test proves that a deleted user's token stops working and leaves no rows behind.

/** `400 INVALID_INPUT`, naming each field the body got wrong. */
export function invalidInput({
  issues,
}: {
  issues: readonly { path: readonly PropertyKey[] }[];
}) {
  const fields = new Set(
    issues.flatMap(({ path: [field] }) =>
      field === undefined ? [] : [String(field)]
    )
  );
  return { code: "INVALID_INPUT", fields: [...fields] };
}

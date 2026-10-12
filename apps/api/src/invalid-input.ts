/** `400 INVALID_INPUT`, naming each field the body got wrong. */
export function invalidInput({
  issues,
}: {
  issues: readonly { path: readonly PropertyKey[]; keys?: string[] }[];
}) {
  const fields = new Set(
    issues.flatMap(({ path: [field], keys = [] }) =>
      // A field the body may not carry is named by the issue's keys.
      field === undefined ? keys : [String(field)]
    )
  );
  return { code: "INVALID_INPUT", fields: [...fields] };
}

/**
 * The fields `values` sets to something other than what `item` has. A field
 * left undefined is left as it is, so it changes nothing.
 */
export function changedFields<Values extends object>(
  item: { [Field in keyof Values]?: unknown },
  values: Values
): (keyof Values)[] {
  return (Object.keys(values) as (keyof Values)[]).filter(
    (field) => values[field] !== undefined && values[field] !== item[field]
  );
}

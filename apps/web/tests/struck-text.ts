/** The text struck through in `row`, with plain spaces. */
export function struckText(row: HTMLElement) {
  return [...row.querySelectorAll("s")].map((text) =>
    text.textContent?.replace(/\s/g, " ")
  );
}

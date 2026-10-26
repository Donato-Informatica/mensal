/** A real token as the API gave it: the whole secret and the prefix it lists. */
export interface RealToken {
  token: string;
  start: string;
}

/** What the guide's captures show in place of any access token. */
export const fakeToken = "mensal_EXEMPLO0000000000000000000000000000";

/**
 * Replaces every real access token on the page, and the prefix the token list
 * shows, with `fake`: in text and in form fields. Returns whether any is still
 * on the page afterwards, which must stop the capture.
 *
 * It runs in the browser through Playwright's `page.evaluate`, which sends
 * only its source: it must use nothing from outside its own body.
 */
export function redactTokens({
  tokens,
  fake,
}: {
  tokens: RealToken[];
  fake: string;
}): boolean {
  const pairs = tokens.flatMap(({ token, start }) => [
    [token, fake],
    [start, fake.slice(0, start.length)],
  ]);
  const redact = (text: string) =>
    pairs.reduce((out, [real, shown]) => out.split(real!).join(shown!), text);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? "";
    const redacted = redact(text);
    if (redacted !== text) node.nodeValue = redacted;
  }
  for (const field of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >("input, textarea")) {
    const redacted = redact(field.value);
    if (redacted !== field.value) field.value = redacted;
    const attribute = field.getAttribute("value");
    if (attribute !== null) field.setAttribute("value", redact(attribute));
  }

  const shown = [
    document.body.innerHTML,
    ...[
      ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input, textarea"
      ),
    ].map((field) => field.value),
  ].join("\n");
  return tokens.some(
    ({ token, start }) => shown.includes(token) || shown.includes(start)
  );
}

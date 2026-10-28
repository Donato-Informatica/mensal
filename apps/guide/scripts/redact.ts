/** A real token as the API gave it: the whole secret and the prefix the token list shows. */
export interface RealToken {
  token: string;
  prefix: string;
}

/** What the guide's captures show in place of any access token. */
export const fakeToken = "mensal_EXEMPLO0000000000000000000000000000";

/**
 * What the guide's captures show in place of a calendar link's key: as long
 * as a real one (32 bytes in base64url).
 */
export const fakeCalendarKey = "EXEMPLO000000000000000000000000000000000000";

/**
 * What the guide's captures show in place of the local stack's origin, as in
 * the access token snippets: a reserved example host (RFC 2606).
 */
export const exampleOrigin = "https://mensal.example.com";

/**
 * Replaces every real access token on the page, and the prefix the token list
 * shows, with `fakeToken`, and every calendar link key with
 * `fakeCalendarKey`: in text, in form fields and in attributes (a link's
 * `href`); and `origin.real`, when given, with `origin.shown`. Returns whether
 * any secret is still on the page afterwards, which must stop the capture.
 *
 * It runs in the browser through Playwright's `page.evaluate`, which sends
 * only its source: it must use nothing from outside its own body.
 */
export function redactSecrets({
  tokens,
  fakeToken,
  calendarKeys,
  fakeCalendarKey,
  origin,
}: {
  tokens: RealToken[];
  fakeToken: string;
  calendarKeys: string[];
  fakeCalendarKey: string;
  origin?: { real: string; shown: string };
}): boolean {
  const pairs = [
    ...tokens.flatMap(({ token, prefix }) => [
      [token, fakeToken],
      [prefix, fakeToken.slice(0, prefix.length)],
    ]),
    ...calendarKeys.map((key) => [key, fakeCalendarKey]),
  ];
  if (origin) pairs.push([origin.real, origin.shown]);
  const redact = (text: string) =>
    pairs.reduce((out, [real, shown]) => out.split(real!).join(shown!), text);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? "";
    const redacted = redact(text);
    if (redacted !== text) node.nodeValue = redacted;
  }
  for (const element of document.body.querySelectorAll("*")) {
    for (const { name, value } of [...element.attributes]) {
      const redacted = redact(value);
      if (redacted !== value) element.setAttribute(name, redacted);
    }
  }
  for (const field of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >("input, textarea")) {
    const redacted = redact(field.value);
    if (redacted !== field.value) field.value = redacted;
  }

  const shown = [
    document.body.innerHTML,
    ...[
      ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input, textarea"
      ),
    ].map((field) => field.value),
  ].join("\n");
  return [
    ...tokens.flatMap(({ token, prefix }) => [token, prefix]),
    ...calendarKeys,
  ].some((secret) => shown.includes(secret));
}

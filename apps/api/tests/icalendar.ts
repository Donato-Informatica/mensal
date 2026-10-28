/**
 * A minimal iCalendar reader (RFC 5545) for the feed's tests, so they assert
 * on components and properties, never on the text as a whole: folding and
 * property order are not part of the contract.
 */

export interface Property {
  name: string;
  /** Parameters by upper-case name, e.g. `{ VALUE: "DATE" }`. */
  params: Record<string, string>;
  /** The raw value, still escaped as on the wire. */
  value: string;
}

export interface Component {
  name: string;
  properties: Property[];
  components: Component[];
}

/**
 * Parses `text` into its single top-level component. Throws when it is not
 * well-formed: a line not ended by CRLF, a line without a colon, or BEGIN and
 * END that do not pair up.
 */
export function parseICalendar(text: string): Component {
  if (!text.endsWith("\r\n")) throw new Error("The last line has no CRLF");
  if (/(?<!\r)\n|\r(?!\n)/.test(text)) throw new Error("A bare CR or LF");
  const lines = text
    .slice(0, -2)
    .replace(/\r\n[ \t]/g, "")
    .split("\r\n");

  const stack: Component[] = [];
  let root: Component | undefined;
  for (const line of lines) {
    const property = parseLine(line);
    if (property.name === "BEGIN") {
      const component = {
        name: property.value,
        properties: [],
        components: [],
      };
      if (stack.length === 0) {
        if (root) throw new Error("More than one top-level component");
        root = component;
      } else {
        stack.at(-1)!.components.push(component);
      }
      stack.push(component);
    } else if (property.name === "END") {
      const open = stack.pop();
      if (open?.name !== property.value) {
        throw new Error(`END:${property.value} closes ${open?.name}`);
      }
    } else {
      const open = stack.at(-1);
      if (!open) throw new Error(`${property.name} outside any component`);
      open.properties.push(property);
    }
  }
  if (!root || stack.length > 0) throw new Error("Unclosed component");
  return root;
}

function parseLine(line: string): Property {
  // The name and parameters end at the first colon outside a quoted value.
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) throw new Error(`No colon in ${JSON.stringify(line)}`);
  const [name = "", ...params] = line.slice(0, colon).split(";");
  return {
    name: name.toUpperCase(),
    params: Object.fromEntries(
      params.map((param) => {
        const [key = "", value = ""] = param.split("=");
        return [key.toUpperCase(), value];
      })
    ),
    value: line.slice(colon + 1),
  };
}

/** The value of `component`'s one property `name`, or undefined. */
export function valueOf(component: Component, name: string) {
  const found = component.properties.filter(
    (property) => property.name === name
  );
  if (found.length > 1)
    throw new Error(`${name} appears ${found.length} times`);
  return found[0]?.value;
}

/**
 * The text of `component`'s one property `name`, unescaped (RFC 5545 §3.3.11),
 * or undefined.
 */
export function textOf(component: Component, name: string) {
  return valueOf(component, name)?.replace(/\\([\\;,nN])/g, (_, char) =>
    char === "n" || char === "N" ? "\n" : char
  );
}

/** The VEVENTs of `calendar`. */
export function eventsOf(calendar: Component): Component[] {
  return calendar.components.filter(({ name }) => name === "VEVENT");
}

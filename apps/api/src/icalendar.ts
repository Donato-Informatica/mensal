/**
 * An iCalendar component (RFC 5545) to write: its properties in order, each a
 * name (with any parameters, e.g. `DTSTART;VALUE=DATE`) and a value already
 * in its wire form, then its nested components (a VEVENT, its VALARM).
 */
export interface ICalendarComponent {
  name: string;
  properties: [name: string, value: string][];
  components?: ICalendarComponent[];
}

/**
 * `value` as a TEXT value on the wire (RFC 5545 §3.3.11): backslashes,
 * semicolons and commas escaped, line breaks as `\n`.
 */
export function text(value: string): string {
  return value.replace(/\r\n|[\\;,\r\n]/g, (char) =>
    char === "\\" || char === ";" || char === "," ? `\\${char}` : "\\n"
  );
}

/**
 * `component` as iCalendar text: one CRLF-ended line per content line, folded
 * (RFC 5545 §3.1).
 */
export function writeICalendar(component: ICalendarComponent): string {
  return lines(component)
    .map((line) => `${fold(line)}\r\n`)
    .join("");
}

/** The most octets a line may hold, its CRLF aside. */
const MAX_LINE_OCTETS = 75;

/**
 * `line` split into lines of at most 75 octets, each after the first starting
 * with a space; never inside a UTF-8 character.
 */
function fold(line: string): string {
  const folded: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (octets + size > MAX_LINE_OCTETS) {
      folded.push(current);
      current = " ";
      octets = 1;
    }
    current += char;
    octets += size;
  }
  folded.push(current);
  return folded.join("\r\n");
}

function lines({
  name,
  properties,
  components = [],
}: ICalendarComponent): string[] {
  return [
    `BEGIN:${name}`,
    ...properties.map(([property, value]) => `${property}:${value}`),
    ...components.flatMap(lines),
    `END:${name}`,
  ];
}

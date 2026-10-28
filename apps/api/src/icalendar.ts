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

/** `component` as iCalendar text: one CRLF-ended line per content line. */
export function writeICalendar(component: ICalendarComponent): string {
  return lines(component)
    .map((line) => `${line}\r\n`)
    .join("");
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

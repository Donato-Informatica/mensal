/**
 * A request the stored state turns down; thrown to roll back. `fields` names
 * what an `INVALID_INPUT` got wrong.
 */
export class Refusal extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: string[] | undefined;
  constructor(status: number, code: string, fields?: string[]) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /** The JSON body a REST route answers with. */
  get body() {
    return this.fields
      ? { code: this.code, fields: this.fields }
      : { code: this.code };
  }
}

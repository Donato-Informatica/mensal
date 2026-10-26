import { describe, expect, it } from "vitest";
import { demoUser as seeded } from "../../api/src/seed.ts";
import { demoUser } from "../scripts/captures.ts";

// The screenshots script signs in as the user the demo seed creates. The
// guide keeps its own copy rather than have its scripts reach into the API's
// source and database dependencies, so a change to the seed must fail here.
describe("the screenshots' demo user", () => {
  it("is the one the seed creates", () => {
    expect(demoUser).toEqual({
      email: seeded.email,
      password: seeded.password,
    });
  });
});

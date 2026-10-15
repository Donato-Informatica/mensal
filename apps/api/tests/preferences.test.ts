import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, signUp, startApi, type TestApi } from "./api.ts";

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

async function sessionUser(cookie: string) {
  const response = await request(api, "/api/auth/get-session", { cookie });
  return (await response.json()).user;
}

describe("preferences (PRD §3.5)", () => {
  it("are all on for a new user", async () => {
    const { cookie } = await signUp(api);

    expect(await sessionUser(cookie)).toMatchObject({
      showSummary: true,
      confirmStatusChanges: true,
    });
  });

  it("are changed by the user through update-user", async () => {
    const { cookie } = await signUp(api);

    const response = await request(api, "/api/auth/update-user", {
      cookie,
      body: { showSummary: false, confirmStatusChanges: false },
    });

    expect(response.status).toBe(200);
    expect(await sessionUser(cookie)).toMatchObject({
      showSummary: false,
      confirmStatusChanges: false,
    });
  });

  it("leave approval out of the user's reach", async () => {
    const { cookie } = await signUp(api);

    await request(api, "/api/auth/update-user", {
      cookie,
      body: { approved: true },
    });

    expect((await sessionUser(cookie)).approved).toBe(false);
    const me = await request(api, "/api/v1/me", { cookie });
    expect(me.status).toBe(403);
  });
});

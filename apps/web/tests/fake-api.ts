interface Account {
  id: string;
  name: string;
  email: string;
  password: string;
  approved: boolean;
}

/**
 * An in-memory stand-in for the Better-Auth endpoints the web app calls,
 * answering in the same shapes and error codes. The session cookie is modelled
 * as "who is signed in".
 */
export function fakeApi() {
  const accounts = new Map<string, Account>();
  let signedIn: Account | undefined;
  let down = false;

  function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  function sessionOf({ id, name, email, approved }: Account) {
    return {
      user: { id, name, email, approved, emailVerified: false },
      session: { id: `session-${id}`, userId: id },
    };
  }

  const handlers: Record<string, (body: Record<string, string>) => Response> = {
    "GET /api/auth/get-session": () =>
      json(200, signedIn ? sessionOf(signedIn) : null),
    "POST /api/auth/sign-in/email": ({ email, password }) => {
      const account = accounts.get(email ?? "");
      if (!account || account.password !== password) {
        return json(401, {
          code: "INVALID_EMAIL_OR_PASSWORD",
          message: "Invalid email or password",
        });
      }
      signedIn = account;
      return json(200, { redirect: false, ...sessionOf(account) });
    },
    "POST /api/auth/sign-up/email": ({ name, email, password }) => {
      if (accounts.has(email ?? "")) {
        return json(422, {
          code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
          message: "User already exists. Use another email.",
        });
      }
      signedIn = api.addAccount({
        name: name ?? "",
        email: email ?? "",
        password: password ?? "",
      });
      return json(200, sessionOf(signedIn));
    },
    "POST /api/auth/sign-out": () => {
      signedIn = undefined;
      return json(200, { success: true });
    },
  };

  const api = {
    fetch: async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      if (down) return json(500, { message: "Internal Server Error" });
      const request = new Request(input, init);
      const { pathname } = new URL(request.url);
      const handler = handlers[`${request.method} ${pathname}`];
      if (!handler) return json(404, { message: "Not found" });
      const text = await request.text();
      return handler(text ? JSON.parse(text) : {});
    },

    addAccount({
      approved = false,
      ...account
    }: Omit<Account, "id" | "approved"> & { approved?: boolean }): Account {
      const created = { id: `user-${accounts.size + 1}`, approved, ...account };
      accounts.set(created.email, created);
      return created;
    },

    signIn(email: string) {
      signedIn = accounts.get(email);
    },

    /** Makes every request fail with 500 until `recover` is called. */
    breakDown() {
      down = true;
    },

    recover() {
      down = false;
    },
  };
  return api;
}

export type FakeApi = ReturnType<typeof fakeApi>;

import { describe, expect, it } from "vitest";
import { consoleEmail, resendEmail, type Email } from "../../src/email.ts";

const email: Email = {
  to: "ana@example.com",
  subject: "Redefinir sua senha do Mensal",
  text: "Abra o link: https://mensal.example/reset",
  html: "<p>Abra o link</p>",
};

describe("consoleEmail", () => {
  it("writes the recipient, the subject and the text to the log", async () => {
    const logged: string[] = [];

    await consoleEmail((message) => logged.push(message))(email);

    expect(logged).toEqual([
      "Email to ana@example.com: Redefinir sua senha do Mensal\nAbra o link: https://mensal.example/reset",
    ]);
  });
});

describe("resendEmail", () => {
  it("posts the email to Resend's API with the key and the sender", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const send = resendEmail({
      apiKey: "re_123",
      from: "Mensal <nao-responda@mensal.example>",
      fetch: async (url, init = {}) => {
        requests.push({ url: String(url), init });
        return Response.json({ id: "email-1" });
      },
    });

    await send(email);

    expect(requests).toHaveLength(1);
    const [{ url, init }] = requests as [(typeof requests)[number]];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer re_123"
    );
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json"
    );
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Mensal <nao-responda@mensal.example>",
      to: ["ana@example.com"],
      subject: "Redefinir sua senha do Mensal",
      text: "Abra o link: https://mensal.example/reset",
      html: "<p>Abra o link</p>",
    });
  });

  it("rejects when Resend refuses the email, naming the status", async () => {
    const send = resendEmail({
      apiKey: "re_123",
      from: "Mensal <nao-responda@mensal.example>",
      fetch: async () =>
        Response.json(
          { name: "validation_error", message: "Invalid `from` field." },
          { status: 422 }
        ),
    });

    await expect(send(email)).rejects.toThrow("422");
  });
});

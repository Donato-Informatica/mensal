import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
});

function signInAs(name: string) {
  api.addAccount({ name, email, password: "correct-horse", approved: true });
  api.signIn(email);
  openApp(api, "/");
}

describe("account menu", () => {
  it("opens with the user's name and email", async () => {
    signInAs("Ana Paula Souza");

    await userEvent.click(await screen.findByRole("button", { name: "Conta" }));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Ana Paula Souza")).toBeInTheDocument();
    expect(within(menu).getByText(email)).toBeInTheDocument();
  });
});

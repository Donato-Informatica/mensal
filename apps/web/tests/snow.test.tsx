import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inSnowSeason } from "../src/snow.tsx";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
let api: FakeApi;
beforeEach(() => {
  api = fakeApi();
  api.addAccount({
    name: "Ana",
    email,
    password: "correct-horse",
    approved: true,
  });
  api.signIn(email);
});
afterEach(() => {
  vi.useRealTimers();
});

/** Sets the device's clock to noon, local time, on `day` (`YYYY-MM-DD`). */
function today(day: string) {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${day}T12:00:00`) });
}

describe("the holiday season (PRD §7)", () => {
  it.each([
    ["2026-11-02", false],
    ["2026-11-03", true],
    ["2026-12-25", true],
    ["2027-01-05", true],
    ["2027-01-06", false],
    ["2027-07-15", false],
  ])("on %s is %s", (day, expected) => {
    expect(inSnowSeason(new Date(`${day}T12:00:00`))).toBe(expected);
  });
});

describe("snow", () => {
  it("falls over the app in the holiday season", async () => {
    today("2026-12-10");
    openApp(api, "/");

    expect(await screen.findByTestId("snow")).toBeTruthy();
  });

  it("does not fall outside the holiday season", async () => {
    today("2026-10-10");
    openApp(api, "/");
    await screen.findByRole("button", { name: /Conta/ });

    expect(screen.queryByTestId("snow")).toBeNull();
  });

  it("does not fall for a user who turned it off", async () => {
    today("2026-12-10");
    api.addAccount({
      name: "Bia",
      email: "bia@example.com",
      password: "correct-horse",
      approved: true,
      snow: false,
    });
    api.signIn("bia@example.com");
    openApp(api, "/");
    await screen.findByRole("button", { name: /Conta/ });

    expect(screen.queryByTestId("snow")).toBeNull();
  });

  it("stops at once when turned off in Configurações", async () => {
    today("2026-12-10");
    const user = userEvent.setup();
    openApp(api, "/");
    await screen.findByTestId("snow");

    await chooseFromAccountMenu("Configurações", user);
    await user.click(
      await screen.findByRole("switch", {
        // The row is the label, so its date hint is part of the name.
        name: /^Mostrar neve nas festas de fim de ano/,
      })
    );

    expect(screen.queryByTestId("snow")).toBeNull();
    expect(api.preferencesOf(email).snow).toBe(false);
  });
});

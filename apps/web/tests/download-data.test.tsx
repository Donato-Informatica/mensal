import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseFromAccountMenu } from "./account-menu.ts";
import { fakeApi, type FakeApi } from "./fake-api.ts";
import { openApp } from "./open-app.tsx";

const email = "ana@example.com";
let api: FakeApi;
let user: UserEvent;
let blobs: Blob[];
let downloads: string[];
beforeEach(() => {
  // 23:00 on 2026-10-12 in São Paulo, already the 13th in UTC.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-13T02:00:00Z") });
  api = fakeApi();
  api.addAccount({
    name: "Ana",
    email,
    password: "correct-horse",
    approved: true,
  });
  api.signIn(email);
  user = userEvent.setup();
  blobs = [];
  downloads = [];
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    blobs.push(blob as Blob);
    return "blob:mensal";
  };
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    downloads.push(this.download);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("downloading the user's data", () => {
  it("saves the archive the API builds, under the name it gives", async () => {
    openApp(api, "/");

    await chooseFromAccountMenu("Baixar meus dados", user);

    await waitFor(() =>
      expect(downloads).toEqual(["mensal-dados-2026-10-12.zip"])
    );
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.type).toBe("application/zip");
    expect(api.dataDownloads()).toBe(1);
  });

  it("shows a loader on the item while the archive is being built", async () => {
    openApp(api, "/");
    await user.click(await screen.findByRole("button", { name: "Conta" }));
    api.stall();

    await user.click(
      await screen.findByRole("menuitem", { name: "Baixar meus dados" })
    );

    const item = screen.getByRole("menuitem", { name: "Baixar meus dados" });
    expect(item).toHaveAttribute("aria-busy", "true");
    expect(item).toBeDisabled();
    expect(downloads).toEqual([]);
    api.resume();
    await waitFor(() =>
      expect(downloads).toEqual(["mensal-dados-2026-10-12.zip"])
    );
  });

  it("says so when it fails, and tries again on request", async () => {
    openApp(api, "/");
    await screen.findByRole("button", { name: "Conta" });
    api.breakDown();

    await chooseFromAccountMenu("Baixar meus dados", user);

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("Não foi possível baixar seus dados.");
    expect(downloads).toEqual([]);
    api.recover();
    await user.click(
      within(notice).getByRole("button", { name: "Tentar novamente" })
    );
    await waitFor(() =>
      expect(downloads).toEqual(["mensal-dados-2026-10-12.zip"])
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

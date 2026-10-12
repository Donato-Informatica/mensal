import { describe, expect, it } from "vitest";
import { redirectFor } from "../src/access.ts";

const anonymous = null;
const awaitingApproval = { user: { approved: false } };
const approved = { user: { approved: true } };

describe("redirectFor", () => {
  it("lets each kind of visitor into their own area", () => {
    expect(redirectFor(anonymous, "anonymous")).toBeUndefined();
    expect(redirectFor(awaitingApproval, "awaiting-approval")).toBeUndefined();
    expect(redirectFor(approved, "approved")).toBeUndefined();
  });

  it("sends an unauthenticated visitor to sign-in", () => {
    expect(redirectFor(anonymous, "approved")).toBe("/entrar");
    expect(redirectFor(anonymous, "awaiting-approval")).toBe("/entrar");
  });

  it("sends a user awaiting approval to the waiting screen", () => {
    expect(redirectFor(awaitingApproval, "approved")).toBe(
      "/aguardando-aprovacao"
    );
    expect(redirectFor(awaitingApproval, "anonymous")).toBe(
      "/aguardando-aprovacao"
    );
  });

  it("sends an approved user home", () => {
    expect(redirectFor(approved, "anonymous")).toBe("/");
    expect(redirectFor(approved, "awaiting-approval")).toBe("/");
  });
});

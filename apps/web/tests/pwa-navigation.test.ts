import { describe, expect, it } from "vitest";
import { notAnsweredByShell } from "../src/pwa-navigation.ts";

const answeredByNetwork = (path: string) =>
  notAnsweredByShell.some((pattern) => pattern.test(path));

describe("the service worker's navigation fallback", () => {
  it("leaves /api and the guide to the network", () => {
    expect(answeredByNetwork("/api/docs")).toBe(true);
    expect(answeredByNetwork("/api")).toBe(true);
    expect(answeredByNetwork("/guia/")).toBe(true);
    expect(answeredByNetwork("/guia")).toBe(true);
    expect(answeredByNetwork("/guia/index.html")).toBe(true);
  });

  it("answers the app's own routes with the shell", () => {
    expect(answeredByNetwork("/")).toBe(false);
    expect(answeredByNetwork("/recorrencias")).toBe(false);
    expect(answeredByNetwork("/entrar")).toBe(false);
    expect(answeredByNetwork("/guiax")).toBe(false);
    expect(answeredByNetwork("/apix")).toBe(false);
  });
});

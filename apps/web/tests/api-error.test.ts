import { describe, expect, it } from "vitest";
import { ApiError, errorMessage } from "../src/api-error.ts";

describe("errorMessage", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", "E-mail ou senha incorretos."],
    ["USER_ALREADY_EXISTS", "Já existe uma conta com este e-mail."],
    [
      "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      "Já existe uma conta com este e-mail.",
    ],
    ["INVALID_EMAIL", "E-mail inválido."],
    ["PASSWORD_TOO_SHORT", "A senha deve ter pelo menos 8 caracteres."],
    ["PASSWORD_TOO_LONG", "A senha deve ter no máximo 128 caracteres."],
    ["UNAUTHENTICATED", "Sua sessão expirou. Entre novamente."],
    ["USER_NOT_APPROVED", "Sua conta ainda aguarda aprovação."],
    ["INVALID_PERIOD", "Mês inválido."],
  ])("translates the API code %s", (code, message) => {
    expect(errorMessage(new ApiError(code))).toBe(message);
  });

  it("falls back to a generic message for an unknown code", () => {
    expect(errorMessage(new ApiError("SOMETHING_NEW"))).toBe(
      "Algo deu errado. Tente novamente."
    );
  });

  it("falls back to a generic message when the API sent no code", () => {
    expect(errorMessage(new ApiError(undefined))).toBe(
      "Algo deu errado. Tente novamente."
    );
  });

  it("falls back to a generic message when the request got no answer", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(
      "Algo deu errado. Tente novamente."
    );
  });
});

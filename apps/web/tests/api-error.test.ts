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
    ["INVALID_INPUT", "Confira os campos e tente novamente."],
    ["START_PERIOD_IN_PAST", "O início não pode ser antes do mês atual."],
    [
      "RECURRENCE_HAS_OCCURRENCES",
      "Esta recorrência já tem contas registradas e não pode ser excluída. Encerre-a para que deixe de aparecer nos próximos meses.",
    ],
    ["AMOUNT_REQUIRED_TO_SETTLE", "Informe o valor para liquidar."],
    ["OCCURRENCE_NOT_FOUND", "Esta conta não existe mais."],
    ["DUE_DATE_OUTSIDE_PERIOD", "O vencimento deve cair no mês da conta."],
    [
      "OCCURRENCE_NOT_SETTLED",
      "Só uma conta liquidada tem data de liquidação.",
    ],
    [
      "ONLY_ONE_OFF_DELETABLE",
      "Só uma conta avulsa pode ser excluída. Pule esta no mês.",
    ],
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

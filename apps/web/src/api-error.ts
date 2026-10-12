/** A failed call to the API, carrying its error code when it sent one. */
export class ApiError extends Error {
  readonly code: string | undefined;
  constructor(code: string | undefined) {
    super(code ?? "API error");
    this.code = code;
  }
}

/** What a Better-Auth client call resolves to. */
export type AuthResult<T = unknown> =
  | { data: T; error: null }
  | { data: null; error: { code?: string | undefined } };

/** The data of a Better-Auth client call, or its error thrown as an ApiError. */
export function unwrap<T>(result: AuthResult<T>): T {
  if (result.error) throw new ApiError(result.error.code);
  return result.data;
}

const messages = new Map<string, string>([
  // Better-Auth
  ["INVALID_EMAIL_OR_PASSWORD", "E-mail ou senha incorretos."],
  ["USER_ALREADY_EXISTS", "Já existe uma conta com este e-mail."],
  [
    "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    "Já existe uma conta com este e-mail.",
  ],
  ["INVALID_EMAIL", "E-mail inválido."],
  ["PASSWORD_TOO_SHORT", "A senha deve ter pelo menos 8 caracteres."],
  ["PASSWORD_TOO_LONG", "A senha deve ter no máximo 128 caracteres."],
  // /api/v1
  ["UNAUTHENTICATED", "Sua sessão expirou. Entre novamente."],
  ["USER_NOT_APPROVED", "Sua conta ainda aguarda aprovação."],
  ["INVALID_PERIOD", "Mês inválido."],
  ["INVALID_INPUT", "Confira os campos e tente novamente."],
  ["START_PERIOD_IN_PAST", "O início não pode ser antes do mês atual."],
  ["AMOUNT_REQUIRED_TO_SETTLE", "Informe o valor para liquidar."],
  ["OCCURRENCE_NOT_FOUND", "Esta conta não existe mais."],
  ["DUE_DATE_OUTSIDE_PERIOD", "O vencimento deve cair no mês da conta."],
  ["OCCURRENCE_NOT_SETTLED", "Só uma conta liquidada tem data de liquidação."],
  [
    "ONLY_ONE_OFF_DELETABLE",
    "Só uma conta avulsa pode ser excluída. Pule esta no mês.",
  ],
]);

/** The Portuguese message to show for a failure: its API code's, or a generic one. */
export function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  return (
    (code === undefined ? undefined : messages.get(code)) ??
    "Algo deu errado. Tente novamente."
  );
}

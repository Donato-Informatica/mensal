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
]);

/** The Portuguese message to show for a failure: its API code's, or a generic one. */
export function errorMessage(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  return (
    (code === undefined ? undefined : messages.get(code)) ??
    "Algo deu errado. Tente novamente."
  );
}

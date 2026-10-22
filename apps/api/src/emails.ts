import type { Revocable } from "./activity.ts";
import type { Email } from "./email.ts";

/** The reset link (PRD §8.2); it expires an hour after it was asked for. */
export function resetPasswordEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}): Email {
  return {
    to,
    subject: "Redefinir sua senha do Mensal",
    text: [
      `Olá, ${name}.`,
      "Recebemos um pedido para redefinir a senha da sua conta no Mensal. Para criar uma nova senha, abra o link abaixo. Ele vale por 1 hora.",
      url,
      "Se você não pediu, ignore este e-mail: sua senha continua a mesma.",
    ].join("\n\n"),
    html: layout([
      paragraph(`Olá, ${escape(name)}.`),
      paragraph(
        "Recebemos um pedido para redefinir a senha da sua conta no Mensal. Para criar uma nova senha, use o botão abaixo. Ele vale por 1 hora."
      ),
      button("Criar nova senha", url),
      paragraph(
        "Se você não pediu, ignore este e-mail: sua senha continua a mesma."
      ),
    ]),
  };
}

/**
 * The alert after any password change or reset, so a user whose password
 * someone else replaced can take the account back from `forgotPasswordURL`.
 */
export function passwordChangedEmail({
  to,
  name,
  at,
  forgotPasswordURL,
  revoked,
  reset,
}: {
  to: string;
  name: string;
  at: Date;
  forgotPasswordURL: string;
  /** What the change signed out or revoked; a reset always revokes both. */
  revoked: Revocable[];
  reset: boolean;
}): Email {
  const changed = `A senha da sua conta no Mensal foi alterada em ${when(at)} (horário de Brasília).`;
  const sessions = revoked.includes("sessions");
  const tokens = revoked.includes("access-tokens");
  const revocation = reset
    ? "Por segurança, todos os dispositivos foram desconectados e todos os tokens de acesso foram revogados."
    : sessions && tokens
      ? "Foram desconectados os outros dispositivos e revogados todos os tokens de acesso."
      : sessions
        ? "Foram desconectados os outros dispositivos. Os tokens de acesso continuam valendo."
        : tokens
          ? "Foram revogados todos os tokens de acesso. Os outros dispositivos continuam conectados."
          : "Nada foi revogado: os outros dispositivos continuam conectados e os tokens de acesso continuam valendo.";
  return {
    to,
    subject: "Sua senha do Mensal foi alterada",
    text: [
      `Olá, ${name}.`,
      changed,
      revocation,
      "Se foi você, não precisa fazer nada. Se não foi, redefina sua senha agora:",
      forgotPasswordURL,
    ].join("\n\n"),
    html: layout([
      paragraph(`Olá, ${escape(name)}.`),
      paragraph(changed),
      paragraph(revocation),
      paragraph(
        "Se foi você, não precisa fazer nada. Se não foi, redefina sua senha agora:"
      ),
      button("Redefinir senha", forgotPasswordURL),
    ]),
  };
}

/**
 * The goodbye after an account is deleted (PRD §8.2), so a deletion by an
 * intruder does not go unnoticed (ADR-0005). It has no links: there is
 * nothing left to sign in to.
 */
export function accountDeletedEmail({
  to,
  name,
  at,
}: {
  to: string;
  name: string;
  at: Date;
}): Email {
  const deleted = `Sua conta no Mensal foi excluída em ${when(at)} (horário de Brasília).`;
  const erased =
    "Todas as suas recorrências, contas e tokens de acesso foram apagados e não podem ser recuperados.";
  const notYou =
    "Se foi você, não precisa fazer nada. Se não foi você, responda este e-mail.";
  return {
    to,
    subject: "Sua conta do Mensal foi excluída",
    text: [`Olá, ${name}.`, deleted, erased, notYou].join("\n\n"),
    html: layout([
      paragraph(`Olá, ${escape(name)}.`),
      paragraph(deleted),
      paragraph(erased),
      paragraph(notYou),
    ]),
  };
}

/** A moment as São Paulo reads it, e.g. "17/10/2026 às 14:03". */
function when(at: Date): string {
  return `${saoPaulo(at, { dateStyle: "short" })} às ${saoPaulo(at, { timeStyle: "short" })}`;
}

function saoPaulo(date: Date, style: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", {
    ...style,
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

/** A light card on a light canvas (DESIGN.md's light palette), table-free. */
function layout(blocks: string[]): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px 16px;background:#f5f5f5;font-family:Inter,Arial,sans-serif;color:#333333"><div style="max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px"><p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0a0a0a">Mensal</p>${blocks.join("")}</div></body></html>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${html}</p>`;
}

function button(label: string, url: string): string {
  return `<p style="margin:24px 0"><a href="${escape(url)}" style="display:inline-block;padding:12px 20px;background:#faff69;color:#0a0a0a;font-weight:600;text-decoration:none;border-radius:8px">${escape(label)}</a></p>`;
}

function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

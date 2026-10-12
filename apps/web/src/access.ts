/** Who is visiting: signed out, signed in awaiting approval, or approved. */
export type Access = "anonymous" | "awaiting-approval" | "approved";

const homes = {
  anonymous: "/entrar",
  "awaiting-approval": "/aguardando-aprovacao",
  approved: "/",
} as const satisfies Record<Access, string>;

type Home = (typeof homes)[Access];

/**
 * Where to send the visitor with this session when they open an area meant
 * for `area` visitors, or undefined when they belong there.
 */
export function redirectFor(
  session: { user: { approved: boolean } } | null,
  area: Access
): Home | undefined {
  const access: Access =
    session === null
      ? "anonymous"
      : session.user.approved
        ? "approved"
        : "awaiting-approval";
  return access === area ? undefined : homes[access];
}

import type { AccountStatus, AccountSummary } from "@/lib/centurie-api";

/**
 * ok : connecté (vert) · warn : erreur à corriger (orange) · danger : plus actif du tout (rouge)
 * pending : connexion en cours · neutral : en pause, pas encore connecté.
 */
export type StatusTone = "ok" | "warn" | "danger" | "pending" | "neutral";

type StatusInfo = {
  label: string;
  tone: StatusTone;
  /** Aide pour l'admin, qui corrige depuis la page du compte. */
  help?: string;
  /** Aide pour le client, en lecture seule : ce qui se passe, et ce qu'il peut faire lui-même. */
  clientHelp?: string;
};

const TEAM_ON_IT = "Our team has been notified and is fixing it. Growth resumes as soon as it's solved.";

export const ACCOUNT_STATUS: Record<AccountStatus, StatusInfo> = {
  connected: { label: "Connected", tone: "ok" },
  pending: {
    label: "Connecting",
    tone: "pending",
    help: "We're logging in to the account. This can take a few minutes.",
  },
  waiting_for_connect: {
    label: "Connecting",
    tone: "pending",
    help: "We're logging in to the account. This can take a few minutes.",
  },
  wrong_password: {
    label: "Wrong password",
    tone: "warn",
    help: "Instagram rejected the password. Update it under Login and security.",
    clientHelp: `Instagram rejected the password we have. If you changed it recently, send the new one to your account manager. ${TEAM_ON_IT}`,
  },
  wrong_2fa: {
    label: "2FA issue",
    tone: "warn",
    help: "We couldn't pass two-factor authentication. Add the authenticator key or fresh backup codes below.",
    clientHelp: `We couldn't pass two-factor authentication. ${TEAM_ON_IT}`,
  },
  challenge_required: {
    label: "Verification required",
    tone: "warn",
    help: "Instagram is asking for a security check. The client must confirm the login in the Instagram app.",
    clientHelp:
      "Instagram is asking for a security check. Open the Instagram app and confirm it was you, then we'll resume.",
  },
  username_not_found: {
    label: "Username not found",
    tone: "warn",
    help: "This username doesn't exist on Instagram anymore. Check it with the client.",
    clientHelp: `This username doesn't exist on Instagram anymore. If you renamed the account, tell your account manager. ${TEAM_ON_IT}`,
  },
  cancelled: {
    label: "No longer active",
    tone: "danger",
    help: "This account has been stopped.",
    clientHelp: "This account has been stopped. Contact your account manager to restart it.",
  },
  unlinked: { label: "Not connected", tone: "neutral" },
};

export function accountStatus(status: AccountStatus | null | undefined): StatusInfo {
  return ACCOUNT_STATUS[status ?? "unlinked"] ?? { label: status ?? "Unknown", tone: "warn" };
}

/** Statut affiché pour un compte : la pause volontaire d'un compte connecté n'est pas une erreur. */
export function displayStatus(account: Pick<AccountSummary, "current_status" | "is_active">): StatusInfo {
  const status = accountStatus(account.current_status);
  if (status.tone === "ok" && account.is_active === false) return { ...status, label: "Paused", tone: "neutral" };
  return status;
}

/** Comptes qui demandent une action (orange ou rouge). */
export const hasAccountError = (account: Pick<AccountSummary, "current_status">) => {
  const tone = accountStatus(account.current_status).tone;
  return tone === "warn" || tone === "danger";
};

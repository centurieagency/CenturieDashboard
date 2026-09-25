import type { AccountStatus } from "@/lib/centurie-api";

export const ACCOUNT_STATUS: Record<AccountStatus, { label: string; ok: boolean; help?: string }> = {
  connected: { label: "Connected", ok: true },
  pending: { label: "Connecting", ok: true, help: "We're logging in to your account. This can take a few minutes." },
  waiting_for_connect: {
    label: "Connecting",
    ok: true,
    help: "We're logging in to your account. This can take a few minutes.",
  },
  wrong_password: {
    label: "Wrong password",
    ok: false,
    help: "Instagram rejected the password. Update it under Login and security.",
  },
  wrong_2fa: {
    label: "2FA issue",
    ok: false,
    help: "We couldn't pass two-factor authentication. Add your authenticator key or fresh backup codes below.",
  },
  challenge_required: {
    label: "Verification required",
    ok: false,
    help: "Instagram is asking for a security check. Open the Instagram app and confirm it was you.",
  },
  username_not_found: {
    label: "Username not found",
    ok: false,
    help: "This username doesn't exist on Instagram anymore. Contact your account manager.",
  },
  cancelled: { label: "Cancelled", ok: false },
  unlinked: { label: "Not connected", ok: false },
};

export function accountStatus(status: AccountStatus | null | undefined) {
  return ACCOUNT_STATUS[status ?? "unlinked"] ?? { label: status ?? "Unknown", ok: false };
}

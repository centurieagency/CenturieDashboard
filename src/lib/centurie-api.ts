import "server-only";

import { env } from "@/lib/env";

/**
 * Client de l'API Centurie (voir doc/api.md).
 * Les appels se font au nom d'un client Stripe avec son token client `cbk_`, émis par le token admin
 * (voir `issueClientToken`), ou à défaut avec le token backend `b64_` déduit du cus_id.
 * Aucun de ces tokens ne doit quitter le serveur (ni props client, ni URL, ni log).
 */

const BASE_URL = "https://api.centuriegrowth.com";

export class CenturieApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CenturieApiError";
  }
}

/** Token backend `b64_` : non signé, sert seulement de repli si le token client n'a pas pu être émis. */
export function backendToken(customerId: string): string {
  if (!/^cus_[A-Za-z0-9_-]+$/.test(customerId)) throw new Error("Invalid Stripe customer ID");
  return `b64_${Buffer.from(customerId, "utf8").toString("base64url")}`;
}

async function request<T>(token: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body !== undefined && { "Content-Type": "application/json" }),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : res.statusText;
    throw new CenturieApiError(res.status, message);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const account = (subId: string) => `/account/sub_id/${encodeURIComponent(subId)}`;

// ---------- Types (d'après l'OpenAPI et les réponses réelles) ----------

export type AccountStatus =
  | "connected"
  | "wrong_password"
  | "cancelled"
  | "wrong_2fa"
  | "pending"
  | "username_not_found"
  | "waiting_for_connect"
  | "challenge_required"
  | "unlinked";

export type AccountSummary = {
  sub_id: string;
  username: string | null;
  current_status: AccountStatus | null;
  expert: boolean | null;
  is_active: boolean | null;
};

export type AccountDetailed = AccountSummary & {
  infos?: {
    pk: number;
    username: string;
    full_name: string | null;
    is_verified: boolean;
    media_count: number;
    follower_count: number;
    following_count: number;
    biography: string | null;
  };
};

export type AccountConfig = {
  per_day_like_post: number | null;
  per_day_like_story: number | null;
  per_day_follow: number | null;
  enabled_post_like: boolean | null;
  enabled_like_story: boolean | null;
  enabled_follow: boolean | null;
  enabled_warmup: boolean | null;
  updated_at: string | null;
};

export type ConfigUpdate = Partial<{
  per_day_like_post: number;
  per_day_like_story: number;
  per_day_follow: number;
  enabled_post_like: boolean;
  enabled_like_story: boolean;
  enabled_follow: boolean;
  enabled_warmup: boolean;
}>;

export type Target = {
  username: string;
  full_name: string | null;
  followers: number | null;
  is_private: boolean | null;
  accepted: boolean | null;
};

/** Actions du jour par date : { "2026-09-25": { follow, post_like, story_like, unfollow } } */
export type DailyStats = Record<string, Partial<Record<"follow" | "post_like" | "story_like" | "unfollow", number>>>;

/** Nouveaux followers par jour : { "2026-09-25": 4 } */
export type DailyGains = Record<string, number>;

// ---------- Admin ----------

/**
 * Émet (ou renvoie s'il existe déjà) le token client `cbk_` d'un client Stripe, avec le token admin.
 * 404 si ce cus_id n'est pas un client du compte Stripe Centurie.
 */
export async function issueClientToken(customerId: string): Promise<string> {
  if (!/^cus_[A-Za-z0-9_-]+$/.test(customerId)) throw new Error("Invalid Stripe customer ID");
  const data = await request<{ token?: string }>(
    env.CENTURIE_API_TOKEN,
    `/admin/tokens/${encodeURIComponent(customerId)}`,
    { method: "POST" },
  );
  if (!data?.token?.startsWith("cbk_")) throw new Error("Unexpected token response from Centurie API");
  return data.token;
}

// ---------- Instagram (profils publics) ----------

export type InstagramProfile = {
  pk: number;
  username: string;
  full_name: string | null;
  biography: string | null;
  media_count: number | null;
  follower_count: number | null;
  following_count: number | null;
  is_verified: boolean | null;
};

/** Profil Instagram public : endpoint à privilégier (GET /instagram/username). */
export const getInstagramProfile = (token: string, username: string) =>
  request<InstagramProfile>(token, `/instagram/username?username=${encodeURIComponent(username)}`);

/** Photo de profil publique (image, sans token) : utilisable directement dans une balise <img>. */
export const profilePictureUrl = (username: string) =>
  `${BASE_URL}/instagram/pdp/${encodeURIComponent(username.toLowerCase())}`;

// ---------- Lecture ----------

export const listAccounts = (token: string) => request<AccountSummary[]>(token, "/accounts");

export async function getAccountDetailed(token: string, subId: string): Promise<AccountDetailed | undefined> {
  const accounts = await request<AccountDetailed[]>(token, "/accounts/detailed");
  return accounts.find((a) => a.sub_id === subId);
}

export const getConfig = (token: string, subId: string) =>
  request<AccountConfig>(token, `${account(subId)}/config`);

export async function getTargets(token: string, subId: string): Promise<Target[]> {
  const data = await request<{ targets: Target[] }>(token, `${account(subId)}/targets`);
  return data.targets ?? [];
}

export const getStats = (token: string, subId: string) =>
  request<DailyStats>(token, `${account(subId)}/stats`);

export const getGains = (token: string, subId: string) =>
  request<DailyGains>(token, `${account(subId)}/gains`);

// ---------- Écriture ----------

export const connectAccount = (token: string, body: { sub_id: string; username: string; password: string }) =>
  request(token, "/manage/connectAccount", { method: "POST", body });

export const toggleActive = (token: string, subId: string, isActive: boolean) =>
  request(token, "/manage/toggleActive", { method: "PUT", body: { sub_id: subId, is_active: isActive } });

export const updateConfig = (token: string, subId: string, body: ConfigUpdate) =>
  request<AccountConfig>(token, `${account(subId)}/config`, { method: "PUT", body });

export const addTarget = (token: string, subId: string, targetUsername: string) =>
  request(token, `${account(subId)}/targets`, { method: "POST", body: { target_username: targetUsername } });

export const removeTarget = (token: string, subId: string, targetUsername: string) =>
  request(token, `${account(subId)}/targets`, { method: "DELETE", body: { target_username: targetUsername } });

export const updatePassword = (token: string, subId: string, password: string) =>
  request(token, "/manage/updatePassword", { method: "PUT", body: { sub_id: subId, password } });

export const send2FAKey = (token: string, subId: string, key: string) =>
  request(token, "/manage/send2FAKey", { method: "PUT", body: { sub_id: subId, twofa_key: key } });

export const update2FACodes = (token: string, subId: string, codes: string[]) =>
  request<{ account?: { codes_count?: number; ignored_count?: number } }>(token, "/manage/update2FA", {
    method: "PUT",
    body: { sub_id: subId, codes },
  });

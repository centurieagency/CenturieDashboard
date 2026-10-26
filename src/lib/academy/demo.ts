import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import type {
  AccountConfig,
  DailyGains,
  DailyStats,
  GainedFollower,
  InstagramProfile,
  ProfileSnapshot,
  RecentAction,
} from "@/lib/centurie-api";
import type { PlanId } from "@/lib/plans";

/**
 * Démo de closing : un faux compte client adapté au prospect (handle, niche, nombre de followers actuel).
 * Rien ne touche l'API Centurie ni Stripe : l'état vit dans un cookie, les chiffres sont générés.
 * Les nouveaux followers restent toujours dans la fourchette enseignée (10 à 70 par jour).
 */

export const DEMO_COOKIE = "centurie_demo";
export const DEMO_DAYS = 90;
const MIN_PER_DAY = 10;
const MAX_PER_DAY = 70;

export const NICHES = {
  restaurant: {
    label: "Restaurant / café",
    base: 22,
    bio: "Seasonal kitchen & natural wines 🍷 Open Tue–Sun · Book a table below",
    targets: ["eatlocal.guide", "brunch.spots.daily", "the.dinner.list", "foodie.weekend", "streetfood.diary", "cafe.culture.club", "tablefor2.daily", "localbites.mag", "chef.notebook", "wine.and.dine.co", "pastry.atlas", "citybrunchclub"],
  },
  fitness: {
    label: "Coach / fitness",
    base: 30,
    bio: "Online coaching for busy professionals 💪 Strength · Nutrition · Mindset · DM 'START'",
    targets: ["strong.habits.daily", "fitmeals.guide", "homeworkout.club", "runners.journal", "mobility.daily", "lift.with.lena", "macro.kitchen", "yoga.flow.studio", "gymtok.tips", "wellness.weekly", "protein.pantry", "calisthenics.base"],
  },
  ecommerce: {
    label: "E-commerce / boutique",
    base: 26,
    bio: "Handmade essentials, shipped worldwide 📦 New drop every Friday · Shop below",
    targets: ["shop.small.daily", "minimal.home.edit", "giftguide.weekly", "conscious.closet", "design.finds.mag", "slow.living.co", "homedecor.inspo", "ethical.brands.hub", "the.style.edit", "smallbiz.stories", "unboxing.daily", "makers.market"],
  },
  beauty: {
    label: "Beauté / bien-être",
    base: 28,
    bio: "Skin studio & lash bar ✨ Clean products · Book your appointment below",
    targets: ["skincare.routine.club", "clean.beauty.edit", "nails.inspo.daily", "lash.lovers", "glow.journal", "spa.day.guide", "makeup.minimal", "hair.goals.studio", "selfcare.sunday", "beauty.finds.weekly", "brow.studio.tips", "wellness.rituals"],
  },
  creator: {
    label: "Créateur / lifestyle",
    base: 36,
    bio: "Travel, food & everyday stories 🌍 Partnerships: link below",
    targets: ["travel.diaries.mag", "weekend.getaways", "citylife.stories", "slow.travel.club", "photo.daily.edit", "lifestyle.journal", "hidden.places.guide", "coffee.and.content", "creator.weekly", "vanlife.notes", "golden.hour.club", "everyday.aesthetic"],
  },
} as const;

export type Niche = keyof typeof NICHES;
export const NICHE_IDS = Object.keys(NICHES) as [Niche, ...Niche[]];

const limitsSchema = z.object({
  follow: z.number().int().min(0).max(70),
  post: z.number().int().min(0).max(250),
  story: z.number().int().min(0).max(250),
  followOn: z.boolean(),
  postOn: z.boolean(),
  storyOn: z.boolean(),
  warmup: z.boolean(),
});

export const demoStateSchema = z.object({
  handle: z.string().regex(/^[A-Za-z0-9._]{1,30}$/),
  name: z.string().max(60),
  niche: z.enum(NICHE_IDS),
  followers: z.number().int().min(0).max(5_000_000),
  posts: z.number().int().min(0).max(100_000),
  plan: z.enum(["essential", "growth", "signature"]),
  targets: z.array(z.string().regex(/^[A-Za-z0-9._]{1,30}$/)).max(60),
  paused: z.boolean(),
  limits: limitsSchema,
  seed: z.number().int(),
});

export type DemoState = z.infer<typeof demoStateSchema>;

export const DEFAULT_LIMITS: DemoState["limits"] = {
  follow: 30, post: 150, story: 250, followOn: true, postOn: true, storyOn: true, warmup: false,
};

export function newDemoState(input: { handle: string; name: string; niche: Niche; followers: number; posts: number; plan: PlanId }): DemoState {
  return {
    ...input,
    targets: [...NICHES[input.niche].targets].slice(0, 10),
    paused: false,
    limits: DEFAULT_LIMITS,
    seed: Math.floor(Math.random() * 1_000_000),
  };
}

export async function readDemoState(): Promise<DemoState | null> {
  const raw = (await cookies()).get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = demoStateSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** À appeler depuis une server action uniquement (écriture de cookie). */
export async function writeDemoState(state: DemoState | null) {
  const jar = await cookies();
  if (!state) {
    jar.delete(DEMO_COOKIE);
    return;
  }
  jar.set(DEMO_COOKIE, Buffer.from(JSON.stringify(demoStateSchema.parse(state))).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}

// ---------- Génération des données ----------

/** Générateur pseudo-aléatoire reproductible (mulberry32) : même prospect, mêmes courbes. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["emma", "liam", "olivia", "noah", "ava", "lucas", "mia", "ethan", "chloe", "leo", "zoe", "jack", "lily", "ryan", "grace", "max", "ella", "sam", "nina", "theo", "ruby", "adam", "sofia", "jules", "maya", "oscar", "isla", "nate", "lucy", "alex"];
const SUFFIX = ["", ".m", "_r", ".daily", "92", "_life", ".co", "x", ".jpg", "_official", "_88", ".k", "_01", ".b", "__"];

function fakeUser(r: () => number) {
  const f = FIRST[Math.floor(r() * FIRST.length)]!;
  const s = SUFFIX[Math.floor(r() * SUFFIX.length)]!;
  const sep = r() < 0.5 ? "." : "_";
  const last = String.fromCharCode(97 + Math.floor(r() * 26));
  return `${f}${sep}${last}${s}`.slice(0, 30);
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export type DemoData = {
  profile: InstagramProfile;
  profileStats: ProfileSnapshot[];
  gains: DailyGains;
  stats: DailyStats;
  followers: { total: number; followers: GainedFollower[] };
  recentActions: RecentAction[];
  prospects: number;
  config: AccountConfig;
  targets: { username: string; fullName: string; followers: number }[];
};

/**
 * Données sur `days` jours (7, 30 ou 90). La démo représente le compte après 3 mois de service :
 * il part du nombre de followers actuel du prospect et grandit chaque jour.
 */
export function generateDemoData(state: DemoState, days: number): DemoData {
  const r = rng(state.seed);
  const niche = NICHES[state.niche];
  const l = state.limits;

  // Effet des réglages : plus de follows et de cibles = un peu plus de croissance, toujours borné à la fourchette.
  const followFactor = l.followOn ? Math.min(1.35, Math.max(0.55, 0.55 + 0.45 * (l.follow / 30))) : 0.45;
  const likesFactor = (l.postOn ? 0.5 : 0.42) + (l.storyOn ? 0.5 : 0.42);
  const targetFactor = state.targets.length >= 15 ? 1.05 : state.targets.length >= 6 ? 0.95 : 0.7;
  const level = niche.base * followFactor * likesFactor * targetFactor;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const allDays: string[] = [];
  for (let i = DEMO_DAYS - 1; i >= 0; i--) allDays.push(isoDay(new Date(today.getTime() - i * 86_400_000)));

  // Croissance qui s'installe (montée progressive les 3 premières semaines), puis jours plus ou moins bons.
  const gainsAll: number[] = allDays.map((d, i) => {
    const ramp = Math.min(1, 0.55 + i / 40);
    const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
    const week = weekday === 0 || weekday === 6 ? 1.12 : 1;
    const noise = 0.72 + r() * 0.56;
    const paused = state.paused && i >= DEMO_DAYS - 2;
    if (paused) return 0;
    return Math.round(Math.min(MAX_PER_DAY, Math.max(MIN_PER_DAY, level * ramp * week * noise)));
  });

  const startFollowers = state.followers;
  let running = startFollowers;
  const snapshotsAll = allDays.map((d, i) => {
    running += gainsAll[i]!;
    return {
      followers: running,
      followings: 480 + Math.round(r() * 60),
      nb_posts: state.posts + Math.floor(i / 9),
      date_checked: `${d}T08:00:00Z`,
    };
  });

  const statsAll: DailyStats = {};
  allDays.forEach((d, i) => {
    const ramp = l.warmup ? Math.min(1, 0.4 + i / 30) : 1;
    const off = state.paused && i >= DEMO_DAYS - 2;
    const pick = (on: boolean, max: number) => (on && !off ? Math.round(max * ramp * (0.86 + r() * 0.14)) : 0);
    const follow = pick(l.followOn, l.follow);
    statsAll[d] = {
      follow,
      post_like: pick(l.postOn, l.post),
      story_like: pick(l.storyOn, l.story),
      unfollow: off ? 0 : Math.round(follow * (0.88 + r() * 0.1)),
    };
  });

  const window = allDays.slice(-days);
  const gains: DailyGains = {};
  const stats: DailyStats = {};
  window.forEach((d) => {
    gains[d] = gainsAll[allDays.indexOf(d)]!;
    stats[d] = statsAll[d]!;
  });

  // Followers nominatifs, attribués aux cibles (les premières de la liste performent mieux).
  const targets = state.targets.length ? state.targets : [...niche.targets];
  const weights = targets.map((_, i) => 1 / (1 + i * 0.35));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const pickTarget = () => {
    let x = r() * wSum;
    for (let i = 0; i < targets.length; i++) if ((x -= weights[i]!) <= 0) return targets[i]!;
    return targets[0]!;
  };
  const followers: GainedFollower[] = [];
  for (let i = window.length - 1; i >= 0 && followers.length < 1000; i--) {
    const d = window[i]!;
    for (let k = 0; k < (gains[d] ?? 0) && followers.length < 1000; k++) {
      followers.push({ username: fakeUser(r), date: d, attributed_action_date: d, sources: [pickTarget()] });
    }
  }

  const now = Date.now();
  const kinds = [
    ...(l.storyOn ? ["story_like", "story_like", "story_like"] : []),
    ...(l.postOn ? ["post_like", "post_like"] : []),
    ...(l.followOn ? ["follow"] : []),
  ];
  const recentActions: RecentAction[] = state.paused || kinds.length === 0
    ? []
    : Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        interactor_username: fakeUser(r),
        action_type: kinds[Math.floor(r() * kinds.length)]!,
        action_date: new Date(now - (i * 3 + Math.floor(r() * 3)) * 60_000).toISOString(),
      }));

  const interactions = window.reduce((s, d) => s + (stats[d]!.follow ?? 0) + (stats[d]!.post_like ?? 0) + (stats[d]!.story_like ?? 0), 0);
  const conversions = new Map<string, number>();
  followers.forEach((f) => conversions.set(f.sources[0]!, (conversions.get(f.sources[0]!) ?? 0) + 1));
  const last = snapshotsAll.at(-1)!;

  return {
    profile: {
      pk: 0,
      username: state.handle,
      full_name: state.name || null,
      biography: niche.bio,
      media_count: last.nb_posts,
      follower_count: last.followers,
      following_count: last.followings,
      is_verified: false,
    },
    profileStats: snapshotsAll.slice(-days),
    gains,
    stats,
    followers: { total: followers.length, followers },
    recentActions,
    prospects: Math.round(interactions * 0.62),
    config: {
      per_day_follow: l.follow,
      per_day_like_post: l.post,
      per_day_like_story: l.story,
      enabled_follow: l.followOn,
      enabled_post_like: l.postOn,
      enabled_like_story: l.storyOn,
      enabled_warmup: l.warmup,
      updated_at: null,
    },
    targets: state.targets.map((u, i) => ({
      username: u,
      fullName: u.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      followers: 8_000 + Math.round(rng(state.seed + i + u.length)() * 240_000),
    })),
  };
}

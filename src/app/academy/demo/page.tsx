import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import account from "@/app/accounts/[subId]/account.module.css";
import { AccountTabs, parseTab } from "@/app/accounts/[subId]/account-tabs";
import { parsePeriod } from "@/app/accounts/[subId]/account-view";
import { ActiveToggle, ConfigForm } from "@/app/accounts/[subId]/forms";
import { Overview } from "@/app/accounts/[subId]/overview";
import { Statistics } from "@/app/accounts/[subId]/statistics";
import { TabTransition } from "@/app/accounts/[subId]/tab-transition";
import { TargetsTable, TargetTools, type TargetRow } from "@/app/accounts/[subId]/targets-ui";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { StatusBadge } from "@/components/status-badge";
import { accreditationOf, requireAcademy } from "@/lib/academy/academy";
import { generateDemoData, NICHES, readDemoState } from "@/lib/academy/demo";
import { PLAN_LABEL } from "@/lib/academy/partner";
import { profilePictureUrl } from "@/lib/centurie-api";
import { AcademyShell } from "../academy-shell";
import styles from "../academy.module.css";
import {
  demoAddTarget,
  demoAddTargets,
  demoRemoveTarget,
  demoSaveConfig,
  demoSetActive,
  newProspectAction,
  resetDemoAction,
} from "./actions";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Demo · Centurie Growth", robots: { index: false } };

type PageProps = { searchParams: Promise<{ tab?: string; days?: string }> };

const HREF = "/academy/demo";
const DEMO_SUB = "sub_demo";

export default async function DemoPage({ searchParams }: PageProps) {
  const viewer = await requireAcademy(HREF);
  const allowed = viewer.mode === "preview" || (await accreditationOf(viewer.user.id)).status === "valid";

  if (!allowed) {
    return (
      <AcademyShell viewer={viewer} back={{ href: "/academy", label: "Academy" }}>
        <section className={styles.card}>
          <h1 className={styles.cardTitle}>Démo réservée aux partenaires accrédités</h1>
          <p className={styles.cardText}>Réussis l&apos;examen pour débloquer la démo à utiliser pendant tes appels de closing.</p>
          <Link href="/academy" className={styles.primary}>
            Aller à l&apos;Academy
          </Link>
        </section>
      </AcademyShell>
    );
  }

  const state = await readDemoState();
  if (!state) {
    return (
      <AcademyShell viewer={viewer} back={{ href: "/academy/partner", label: "Espace partenaire" }}>
        <header>
          <span className={styles.eyebrow}>Démo de closing</span>
          <h1 className={styles.title}>Prépare la démo pour ton prospect</h1>
          <p className={styles.lead}>
            La démo affiche un vrai dashboard client, à son nom, avec sa photo Instagram et des chiffres simulés pour sa niche :
            ce que son compte pourrait donner après 3 mois. Tu peux tout manipuler pendant l&apos;appel, rien ne touche un vrai
            compte.
          </p>
        </header>
        <section className={styles.card}>
          <SetupForm niches={Object.entries(NICHES).map(([id, n]) => ({ id, label: n.label }))} />
        </section>
        <p className={styles.notice}>
          Les nouveaux followers simulés restent entre 10 et 70 par jour, comme dans le cours. Dis-le au prospect : ce sont des
          chiffres d&apos;illustration, pas une promesse.
        </p>
      </AcademyShell>
    );
  }

  const query = await searchParams;
  const days = parsePeriod(query.days);
  const tab = parseTab(query.tab);
  const data = generateDemoData(state, days);
  const status = state.paused ? { tone: "neutral" as const, label: "Paused" } : { tone: "ok" as const, label: "Connected" };
  const rows: TargetRow[] = data.targets.map((t) => ({
    username: t.username,
    fullName: t.fullName,
    followers: t.followers,
    isPrivate: false,
    pending: false,
    avatar: "",
  }));

  return (
    <div className={account.page}>
      <header className={styles.demoHeader}>
        <div className={styles.demoHeaderInner}>
          <BrandLockup tone="dark" />
          <span className={styles.demoPill}>Demo</span>
        </div>
      </header>

      <main className={account.main}>
        <div className={styles.demoToolbar}>
          <span>
            Démo pour <b>@{state.handle}</b> · {NICHES[state.niche].label} · offre {PLAN_LABEL[state.plan]}
          </span>
          <div className={styles.actions}>
            <form action={resetDemoAction}>
              <button type="submit" className={styles.ghostSmall}>
                Réinitialiser
              </button>
            </form>
            <form action={newProspectAction}>
              <button type="submit" className={styles.ghostSmall}>
                Nouveau prospect
              </button>
            </form>
            <Link href="/academy/partner" className={styles.ghostSmall}>
              Quitter
            </Link>
          </div>
        </div>

        <p className={styles.notice}>
          <b>Demo account · illustrative figures.</b> This is what your dashboard could look like after 3 months with Centurie
          Growth. Real results depend on your niche and your profile.
        </p>

        <TabTransition>
          <div className={account.topRow}>
            <div className={account.miniIdentity}>
              <Image src={profilePictureUrl(state.handle)} alt="" width={40} height={40} className={account.miniAvatar} />
              <div>
                <span className={account.miniHandle}>@{state.handle}</span>
                <StatusBadge tone={status.tone} label={status.label} size="sm" />
              </div>
            </div>
            <AccountTabs href={HREF} tab={tab} days={days} admin={false} />
          </div>

          {tab === "overview" && (
            <Overview
              href={HREF}
              days={days}
              data={{
                username: state.handle,
                profile: data.profile,
                status,
                expert: false,
                profileStats: data.profileStats,
                gains: data.gains,
                stats: data.stats,
                prospects: data.prospects,
                followers: data.followers,
                recentActions: data.recentActions,
              }}
            />
          )}

          {tab === "statistics" && (
            <Statistics
              href={`${HREF}?tab=statistics`}
              days={days}
              data={{ stats: data.stats, gains: data.gains, profileStats: data.profileStats, followers: data.followers }}
            />
          )}

          {tab === "targets" && (
            <div className={account.tabStack}>
              <TargetTools subId={DEMO_SUB} actions={{ add: demoAddTarget, addMany: demoAddTargets, remove: demoRemoveTarget }} />
              {rows.length === 0 ? (
                <p className={account.muted}>No targets yet.</p>
              ) : (
                <TargetsTable subId={DEMO_SUB} rows={rows} admin={false} removeAction={demoRemoveTarget} />
              )}
            </div>
          )}

          {tab === "settings" && (
            <>
              <section className={`${account.panel} ${account.inlinePanel}`}>
                <div>
                  <h2 className={account.panelTitle}>Growth</h2>
                  <p className={account.muted}>{state.paused ? "Paused: no actions are sent." : "Running every day."}</p>
                </div>
                <ActiveToggle subId={DEMO_SUB} isActive={!state.paused} action={demoSetActive} />
              </section>
              <section className={account.panel}>
                <div className={account.panelHead}>
                  <h2 className={account.panelTitle}>Daily limits</h2>
                </div>
                <ConfigForm
                  subId={DEMO_SUB}
                  expert={false}
                  action={demoSaveConfig}
                  config={{
                    per_day_follow: state.limits.follow,
                    per_day_like_post: state.limits.post,
                    per_day_like_story: state.limits.story,
                    enabled_follow: state.limits.followOn,
                    enabled_post_like: state.limits.postOn,
                    enabled_like_story: state.limits.storyOn,
                    enabled_warmup: state.limits.warmup,
                  }}
                />
              </section>
              <section className={account.panel}>
                <div className={account.panelHead}>
                  <h2 className={account.panelTitle}>Subscription</h2>
                </div>
                <dl className={account.readList}>
                  <div>
                    <dt>Plan</dt>
                    <dd>{PLAN_LABEL[state.plan]}</dd>
                  </div>
                  <div>
                    <dt>Commitment</dt>
                    <dd>12 months for this Instagram account</dd>
                  </div>
                  {state.name && (
                    <div>
                      <dt>Account name</dt>
                      <dd>{state.name}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </>
          )}
        </TabTransition>
      </main>
    </div>
  );
}

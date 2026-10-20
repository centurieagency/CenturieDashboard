"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";

import styles from "./account-tabs.module.css";

type TransitionState = { pending: boolean; target: string | null; go: (href: string) => void };

const TransitionContext = createContext<TransitionState | null>(null);

/**
 * Enveloppe de la page compte : un changement d'onglet ou de période passe par une transition,
 * ce qui garde l'onglet actuel affiché (estompé) avec un indicateur, au lieu d'un écran figé.
 */
export function TabTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);

  function go(href: string) {
    setTarget(href);
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <TransitionContext.Provider value={{ pending, target: pending ? target : null, go }}>
      <div className={styles.root} data-pending={pending || undefined} aria-busy={pending}>
        {children}
      </div>
    </TransitionContext.Provider>
  );
}

/** Lien d'onglet ou de période : spinner sur le lien cliqué pendant le chargement. */
export function TransitionLink({
  href,
  className,
  children,
  ...rest
}: { href: string; className?: string; children: React.ReactNode } & Omit<
  React.ComponentProps<typeof Link>,
  "href" | "className" | "children" | "onClick"
>) {
  const ctx = useContext(TransitionContext);
  const loading = ctx?.target === href;
  return (
    <Link
      href={href}
      scroll={false}
      className={className}
      data-loading={loading || undefined}
      onClick={(e) => {
        // Ctrl/Cmd + clic, clic milieu : comportement normal du navigateur (nouvel onglet).
        if (!ctx || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        ctx.go(href);
      }}
      {...rest}
    >
      {children}
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </Link>
  );
}

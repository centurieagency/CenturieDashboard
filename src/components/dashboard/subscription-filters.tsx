"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import styles from "./subscription-filters.module.css";

export type FilterOption = { value: string; label: string; count: number };

/** Filtres de la liste d'abonnements : l'état vit dans l'URL (partageable, rendu côté serveur). */
export function SubscriptionFilters({
  subscription,
  account,
  query,
  placeholder = "Search @username, plan or sub ID",
}: {
  subscription: { value: string; options: FilterOption[] };
  account: { value: string; options: FilterOption[] };
  query: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Recherche : met à jour l'URL 300 ms après la dernière frappe.
  useEffect(() => {
    if (text === query) return;
    const id = setTimeout(() => update("q", text.trim()), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const hasFilters = subscription.value !== "all" || account.value !== "all" || query !== "";

  return (
    <div className={styles.bar} data-pending={pending || undefined}>
      <div className={styles.search}>
        <label htmlFor="sub-search" className={styles.srOnly}>
          Search subscriptions
        </label>
        <svg className={styles.searchIcon} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          id="sub-search"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className={styles.searchInput}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <Segmented
        label="Subscription"
        name="sub"
        value={subscription.value}
        options={subscription.options}
        onChange={(v) => update("sub", v)}
      />
      <Segmented
        label="Instagram"
        name="account"
        value={account.value}
        options={account.options}
        onChange={(v) => update("account", v)}
      />

      {hasFilters && (
        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            setText("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Segmented({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.segmented}>
        {options.map((o) => (
          <label key={o.value} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className={styles.radio}
            />
            <span>
              {o.label} <span className={styles.count}>{o.count}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

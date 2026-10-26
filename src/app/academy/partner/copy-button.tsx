"use client";

import { useState } from "react";

export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          },
          () => setCopied(false),
        )
      }
    >
      {copied ? "Copié ✓" : "Copier le lien"}
    </button>
  );
}

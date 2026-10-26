"use client";

import { useState } from "react";

export function CopyButton({
  value,
  className,
  label = "Copier le lien",
  copiedLabel = "Copié ✓",
}: {
  value: string;
  className?: string;
  label?: string;
  copiedLabel?: string;
}) {
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
      {copied ? copiedLabel : label}
    </button>
  );
}

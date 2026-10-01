import Image from "next/image";

import styles from "./brand-lockup.module.css";

type BrandLockupProps = {
  tone?: "light" | "dark";
  /** "lg" : pages de connexion et d'inscription, où le logo est le premier repère. */
  size?: "md" | "lg";
};

/** Fleur de lys + logotype « CENTURIE » avec « Growth » en script dessous. */
export function BrandLockup({ tone = "dark", size = "md" }: BrandLockupProps) {
  const mark = tone === "dark" ? "/brand/centurie-mark-white.png" : "/brand/centurie-mark-black.png";
  const markWidth = size === "lg" ? 48 : 28;

  return (
    <div className={`${styles.lockup} ${tone === "dark" ? styles.onDark : ""} ${size === "lg" ? styles.lg : ""}`}>
      <Image
        src={mark}
        alt=""
        width={markWidth}
        height={Math.round(markWidth * 0.86)}
        className={styles.mark}
        priority
      />
      <div className={styles.words}>
        <span className={styles.wordmark}>CENTURIE</span>
        <span className={styles.script}>Growth</span>
      </div>
    </div>
  );
}

import Image from "next/image";

import styles from "./brand-lockup.module.css";

type BrandLockupProps = {
  tone?: "light" | "dark";
};

/** Fleur de lys + logotype « CENTURIE » avec « Growth » en script dessous. */
export function BrandLockup({ tone = "dark" }: BrandLockupProps) {
  const mark = tone === "dark" ? "/brand/centurie-mark-white.png" : "/brand/centurie-mark-black.png";

  return (
    <div className={`${styles.lockup} ${tone === "dark" ? styles.onDark : ""}`}>
      <Image src={mark} alt="" width={28} height={24} className={styles.mark} priority />
      <div className={styles.words}>
        <span className={styles.wordmark}>CENTURIE</span>
        <span className={styles.script}>Growth</span>
      </div>
    </div>
  );
}

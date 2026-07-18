import { META_PRODUCTS_NOTICE } from "@/lib/legal";
import styles from "./meta-products-notice.module.css";

export function MetaProductsNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`${styles.notice} ${compact ? styles.compact : ""}`}>
      <span aria-hidden="true">*</span>
      {META_PRODUCTS_NOTICE}
    </p>
  );
}

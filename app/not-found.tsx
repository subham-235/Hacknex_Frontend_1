import Link from 'next/link';
import { ArrowLeft, MapPinOff, Phone, ShieldCheck } from 'lucide-react';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.card} aria-labelledby="not-found-title">
        <Link className={styles.brand} href="/#overview" aria-label="Suraksha dashboard">
          <span className={styles.brandMark}><ShieldCheck /></span>
          <span>suraksha<span className={styles.dot}>.</span></span>
        </Link>

        <div className={styles.icon} aria-hidden="true"><MapPinOff /></div>
        <p className={styles.eyebrow}>ERROR 404</p>
        <h1 id="not-found-title">This page is off the map.</h1>
        <p className={styles.copy}>
          The address may be incorrect, or the page may have moved. Your safety
          workspace is still available from the dashboard.
        </p>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/#overview">
            <ArrowLeft /> Return to dashboard
          </Link>
          <a className={styles.secondary} href="tel:112">
            <Phone /> Call 112
          </a>
        </div>

        <p className={styles.note}>
          If you are in immediate danger, contact emergency services directly.
        </p>
      </section>
    </main>
  );
}

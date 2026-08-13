import Link from '@docusaurus/Link';
import styles from './styles.module.css';

export default function Hero() {
  return (
    <div className={styles.hero}>
      <div className={styles.glow} />
      <span className={styles.badge}>
        <span className={styles.dot} />
        Open Source Docs
      </span>
      <h1 className={styles.title}>
        Scrape the web.
        <br />
        <span className={styles.titleAccent}>Feed your AI.</span>
      </h1>
      <p className={styles.lead}>
        Tentacrawl turns modern, browser-rendered websites into clean, reusable data. Site-specific adaptation —
        proxies, captchas, fingerprinting, login — plugs in through the Challenger framework, without touching core
        code.
      </p>
      <div className={styles.actions}>
        <Link className="button button--primary button--lg" to="/getting-started/installation">
          Get Started
        </Link>
        <Link className="button button--secondary button--lg" to="https://github.com/tentastack/tentacrawl">
          View on GitHub
        </Link>
      </div>
    </div>
  );
}

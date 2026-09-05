import Link from 'next/link';
import { SITE, consoleHref, isExternal } from '@/lib/site/content';
import { AgentFieldLazy, HeroMonolithLazy } from '@/components/site/SceneLazy';
import { SiteNav } from '@/components/site/SiteNav';
import { KineticText } from '@/components/site/KineticText';
import { WordFlow } from '@/components/site/WordFlow';
import { Reveal } from '@/components/site/Reveal';
import { ScrollTrack } from '@/components/site/ScrollTrack';
import { TiltCard } from '@/components/site/TiltCard';
import { PillarCarousel } from '@/components/site/PillarCarousel';
import { CountUp } from '@/components/site/CountUp';
import { MagneticButton } from '@/components/site/MagneticButton';
import { CursorLight } from '@/components/site/CursorLight';

/**
 * A link into the operator console. Routed through `consoleHref`, so the same
 * markup works whether the console is the same origin or somewhere else
 * entirely (a standalone static deploy of this site).
 */
function ConsoleLink({
  route,
  className,
  children,
}: {
  route: string;
  className?: string;
  children: React.ReactNode;
}) {
  const href = consoleHref(route);
  return isExternal(href) ? (
    <a href={href} className={className} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * The public site. A server component: every word is in the HTML on first
 * response, and the two WebGL scenes are the only client-side heavy lifting —
 * both lazy, both optional, neither load-bearing for the content.
 */
export default function SitePage() {
  const { brand, hero, manifesto, system, pillarSection, pillars, moduleSection, modules, metrics, process, cta, footer } =
    SITE;

  return (
    <div className="site-root">
      <CursorLight />
      <div className="site-grain" aria-hidden="true" />
      <SiteNav />

      <main id="site-main">
        {/* ---------------------------------------------------------- hero */}
        <section id="hero" className="hero">
          <div className="hero-scene">
            <HeroMonolithLazy />
          </div>

          <div className="hero-content">
            <p className="eyebrow hero-eyebrow">
              <span className="eyebrow-rule" aria-hidden="true" />
              {hero.eyebrow}
            </p>

            <h1 className="hero-headline">
              {hero.headline.map((line, i) => (
                <span className="hero-line" key={line}>
                  <KineticText text={line} delay={0.35 + i * 0.16} step={0.055} />
                </span>
              ))}
            </h1>

            <p className="hero-sub">{hero.sub}</p>

            <div className="hero-actions">
              <MagneticButton href={consoleHref(hero.primary.href)} external={isExternal(consoleHref(hero.primary.href))}>
                {hero.primary.label}
              </MagneticButton>
              <MagneticButton href={hero.secondary.href} variant="ghost">
                {hero.secondary.label}
              </MagneticButton>
            </div>
          </div>

          <div className="hero-foot">
            <span className="scroll-cue" aria-hidden="true">
              <span className="scroll-cue-rail">
                <span className="scroll-cue-dot" />
              </span>
              Scroll
            </span>
            <span className="hero-coords" aria-hidden="true">
              {brand.tagline}
            </span>
          </div>
        </section>

        {/* -------------------------------------------------------- ticker */}
        <div className="ticker" aria-hidden="true">
          <div className="ticker-lane">
            {[0, 1].map((copy) => (
              <div className="ticker-run" key={copy}>
                {hero.ticker.map((item) => (
                  <span className="ticker-item" key={`${copy}-${item}`}>
                    {item}
                    <i className="ticker-sep" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------- manifesto */}
        <ScrollTrack id={manifesto.id} className="section manifesto">
          <div className="shell">
            <Reveal className="section-head">
              <p className="eyebrow">
                <span className="eyebrow-rule" aria-hidden="true" />
                {manifesto.eyebrow}
              </p>
              <h2 className="section-title">{manifesto.title}</h2>
            </Reveal>
            <WordFlow text={manifesto.body} className="manifesto-body" />
            <Reveal className="manifesto-sign">{manifesto.signature}</Reveal>
          </div>
        </ScrollTrack>

        {/* -------------------------------------------------------- system */}
        <ScrollTrack id={system.id} className="section system" track>
          <div className="shell system-grid">
            <div className="system-copy">
              <Reveal className="section-head">
                <p className="eyebrow">
                  <span className="eyebrow-rule" aria-hidden="true" />
                  {system.eyebrow}
                </p>
                <h2 className="section-title">{system.title}</h2>
                <p className="section-lede">{system.lede}</p>
              </Reveal>

              <ol className="state-list">
                {system.states.map((state, i) => (
                  <Reveal as="li" className="state" key={state.key} delay={i * 0.08}>
                    <span className="state-index">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3 className="state-name">{state.name}</h3>
                      <p className="state-copy">{state.copy}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>

            <div className="system-scene">
              <div className="system-scene-sticky">
                <AgentFieldLazy />
                <span className="system-scene-frame" aria-hidden="true" />
              </div>
            </div>
          </div>
        </ScrollTrack>

        {/* ------------------------------------------------------- pillars */}
        <section id={pillarSection.id} className="section pillars">
          <div className="shell">
            <Reveal className="section-head centered">
              <p className="eyebrow">
                <span className="eyebrow-rule" aria-hidden="true" />
                {pillarSection.eyebrow}
              </p>
              <h2 className="section-title">{pillarSection.title}</h2>
            </Reveal>
          </div>
          <PillarCarousel pillars={pillars} />
        </section>

        {/* ------------------------------------------------------- modules */}
        <section id={moduleSection.id} className="section modules">
          <div className="shell">
            <Reveal className="section-head">
              <p className="eyebrow">
                <span className="eyebrow-rule" aria-hidden="true" />
                {moduleSection.eyebrow}
              </p>
              <h2 className="section-title">{moduleSection.title}</h2>
            </Reveal>

            <div className="module-grid">
              {modules.map((module, i) => (
                <Reveal key={module.route} delay={(i % 3) * 0.07}>
                  <TiltCard>
                    <ConsoleLink route={module.route} className="module-card">
                      <header className="module-head">
                        <span className="module-route">{module.route}</span>
                        <h3 className="module-title">{module.title}</h3>
                      </header>
                      <p className="module-blurb">{module.blurb}</p>
                      <ul className="module-detail">
                        {module.detail.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <span className="module-go" aria-hidden="true">
                        Open <i>→</i>
                      </span>
                    </ConsoleLink>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- proof */}
        <section id="proof" className="section proof">
          <div className="shell">
            <Reveal>
              <p className="eyebrow proof-eyebrow">
                <span className="eyebrow-rule" aria-hidden="true" />
                {brand.tagline}
              </p>
            </Reveal>
          </div>
          <div className="shell metric-row">
            {metrics.map((metric, i) => (
              <Reveal className="metric" key={metric.label} delay={i * 0.07}>
                <CountUp className="metric-value" value={metric.value} prefix={metric.prefix} suffix={metric.suffix} />
                <p className="metric-label">{metric.label}</p>
                <p className="metric-note">{metric.note}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------- process */}
        <ScrollTrack id={process.id} className="section process">
          <div className="shell">
            <Reveal className="section-head">
              <p className="eyebrow">
                <span className="eyebrow-rule" aria-hidden="true" />
                {process.eyebrow}
              </p>
              <h2 className="section-title">{process.title}</h2>
            </Reveal>

            <ol className="process-list">
              <span className="process-spine" aria-hidden="true">
                <span className="process-spine-fill" />
              </span>
              {process.steps.map((step, i) => (
                <Reveal as="li" className="process-step" key={step.index} delay={i * 0.06}>
                  <span className="process-index">{step.index}</span>
                  <h3 className="process-title">{step.title}</h3>
                  <p className="process-copy">{step.copy}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </ScrollTrack>

        {/* ----------------------------------------------------------- cta */}
        <section id={cta.id} className="section cta">
          <div className="shell cta-inner">
            <Reveal>
              <p className="eyebrow centered-eyebrow">
                <span className="eyebrow-rule" aria-hidden="true" />
                {cta.eyebrow}
              </p>
              <h2 className="cta-title">{cta.title}</h2>
              <p className="cta-body">{cta.body}</p>
              <div className="hero-actions cta-actions">
                <MagneticButton href={consoleHref(cta.primary.href)} external={isExternal(consoleHref(cta.primary.href))}>
                  {cta.primary.label}
                </MagneticButton>
                <MagneticButton href={cta.secondary.href} variant="ghost" external>
                  {cta.secondary.label}
                </MagneticButton>
              </div>
              <p className="cta-reassurance">{cta.reassurance}</p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <span className="site-wordmark static">
              <span className="site-glyph" aria-hidden="true" />
              {brand.wordmark}
            </span>
            <p className="footer-blurb">{footer.blurb}</p>
          </div>
          {footer.columns.map((column) => (
            <nav className="footer-col" key={column.title} aria-label={column.title}>
              <p className="footer-col-title">{column.title}</p>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith('#') ? (
                      <a href={link.href}>{link.label}</a>
                    ) : (
                      <ConsoleLink route={link.href}>{link.label}</ConsoleLink>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="shell footer-legal">
          <span>{footer.legal}</span>
          <span>{brand.domain}</span>
        </div>
      </footer>
    </div>
  );
}

import { CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MagazinePreview } from '../components/MagazinePreview';
import { SiteLegalFooter } from '../components/SiteLegalFooter';
import { SitePageHeader } from '../components/SitePageHeader';
import { fetchSiteContent, logoutUser } from '../editor/api';
import { getTemplateLabel } from '../editor/demoData';
import { createHomepageDemoPreview, defaultSiteContent } from '../product/defaults';
import { HomepagePreviewPayload, SiteContent } from '../product/types';
import { useSession } from '../session';

const fallbackPreview = createHomepageDemoPreview();

const MOBILE_HOME_PREVIEW_MEDIA_QUERY = '(max-width: 760px) and (hover: none) and (pointer: coarse)';

const productCapabilityCards = [
  {
    step: '01',
    title: 'Upload real selects',
    copy: 'Bring in source images and keep them attached to a real project instead of a temporary demo state.',
  },
  {
    step: '02',
    title: 'Arrange page rhythm',
    copy: 'Sequence cover, essay, grid, panorama, and custom pages while the folio stays visible.',
  },
  {
    step: '03',
    title: 'Save the project',
    copy: 'Keep the working state on the server so you can reopen the same project URL and continue editing later.',
  },
  {
    step: '04',
    title: 'Share or export',
    copy: 'Publish a read-only folio for review or export the same page model for print and PDF output.',
  },
];

const productTrustNotes = [
  {
    title: 'Project-backed editing',
    copy: 'Uploads, pages, and exports stay attached to named projects instead of disappearing into a one-shot canvas.',
  },
  {
    title: 'Operational storage',
    copy: 'Uploaded images are stored through object storage delivery today, and CDN acceleration may be layered on later for public viewing.',
  },
  {
    title: 'Account and recovery',
    copy: 'Session cookies keep accounts signed in, while email verification and password reset flows protect account ownership.',
  },
];

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Built-in demo sequence';
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return `Updated ${new Date(parsed).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}


function getBrowserStageMeta(template: string) {
  switch (template) {
    case 'cover':
      return {
        role: 'Opening sheet',
        summary: 'Lead with one image and a clear title before the sequence opens out.',
        focus: 'Lead image',
        adjustments: ['Lead image', 'Issue title', 'Deck copy'],
      };
    case 'essay':
      return {
        role: 'Text and image',
        summary: 'Adjust crop and opening copy on the same page without losing the finished layout.',
        focus: 'Lead crop',
        adjustments: ['Lead crop', 'Opening note', 'Caption'],
      };
    case 'grid':
      return {
        role: 'Multi-image rhythm',
        summary: 'Compare density, image order, and pacing before you lock the center of the folio.',
        focus: 'Image grid',
        adjustments: ['Image order', 'Grid density', 'Captions'],
      };
    case 'panorama':
      return {
        role: 'Wide spread',
        summary: 'Switch into a broader page when the sequence needs a calmer, wider breath.',
        focus: 'Wide crop',
        adjustments: ['Wide crop', 'Spread balance', 'Pacing'],
      };
    case 'folio':
      return {
        role: 'Single image page',
        summary: 'Let a single frame hold the page while the sequence keeps moving around it.',
        focus: 'Primary frame',
        adjustments: ['Crop', 'Caption', 'Page order'],
      };
    case 'mosaic':
      return {
        role: 'Dense layout',
        summary: 'Pack several images together when the folio needs a more compressed rhythm.',
        focus: 'Mosaic frames',
        adjustments: ['Frame mix', 'Spacing', 'Order'],
      };
    case 'diptych':
      return {
        role: 'Two-image spread',
        summary: 'Balance two frames together so the pair reads as one editorial move.',
        focus: 'Image pair',
        adjustments: ['Pairing', 'Alignment', 'Spacing'],
      };
    case 'triptych':
      return {
        role: 'Three-frame sequence',
        summary: 'Use three adjacent frames when the story needs motion without turning the page.',
        focus: 'Frame trio',
        adjustments: ['Sequence', 'Spacing', 'Balance'],
      };
    default:
      return {
        role: 'Active page',
        summary: 'Keep the folio visible while you refine crop, order, and text in place.',
        focus: 'Primary frame',
        adjustments: ['Crop', 'Order', 'Caption'],
      };
  }
}

export function HomePage() {
  const [siteContent, setSiteContent] = useState<SiteContent>(defaultSiteContent);
  const [homepagePreview, setHomepagePreview] = useState<HomepagePreviewPayload>(fallbackPreview);
  const [mobilePreviewMode, setMobilePreviewMode] = useState(false);
  const { user: session, ready: sessionReady, setSessionUser } = useSession();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_HOME_PREVIEW_MEDIA_QUERY);
    const updateMobilePreviewMode = () => {
      setMobilePreviewMode(mediaQuery.matches);
    };

    updateMobilePreviewMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMobilePreviewMode);
      return () => mediaQuery.removeEventListener('change', updateMobilePreviewMode);
    }

    mediaQuery.addListener(updateMobilePreviewMode);
    return () => mediaQuery.removeListener(updateMobilePreviewMode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchSiteContent()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setSiteContent(payload.siteContent);
        setHomepagePreview(payload.homepagePreview ?? fallbackPreview);
      })
      .catch(() => {
        if (!cancelled) {
          setSiteContent(defaultSiteContent);
          setHomepagePreview(fallbackPreview);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const heroPreviewStyle = useMemo(
    () => ({ '--page-scale': mobilePreviewMode ? 0.17 : 0.19 }) as CSSProperties,
    [mobilePreviewMode],
  );
  const browserPreviewStyle = useMemo(
    () => ({ '--page-scale': mobilePreviewMode ? 0.22 : 0.24 }) as CSSProperties,
    [mobilePreviewMode],
  );

  const previewAssetsById = useMemo(
    () => Object.fromEntries(homepagePreview.assets.map((asset) => [asset.id, asset])),
    [homepagePreview.assets],
  );
  const heroPreviewPages = useMemo(() => {
    const sourcePages = homepagePreview.pages;
    if (sourcePages.length <= 1) {
      return sourcePages.slice(0, 1);
    }

    const targetCount = mobilePreviewMode ? Math.min(4, sourcePages.length) : 10;
    return Array.from({ length: targetCount }, (_, index) => sourcePages[index % sourcePages.length]);
  }, [homepagePreview.pages, mobilePreviewMode]);
  const heroPreviewCopies = heroPreviewPages.length > 1 ? (mobilePreviewMode ? 2 : 3) : 1;
  const homepagePreviewAssetVariant = mobilePreviewMode ? 'thumb' : 'preview';
  const heroPreviewTrackRef = useRef<HTMLDivElement | null>(null);
  const heroPreviewItemRefs = useRef<Array<HTMLElement | null>>([]);
  const [heroPreviewLoopDistance, setHeroPreviewLoopDistance] = useState(0);
  const heroPreviewPausedRef = useRef(false);
  const heroPreviewEntries = useMemo(
    () =>
      Array.from({ length: heroPreviewCopies }, (_, copyIndex) =>
        heroPreviewPages.map((page, index) => ({
          page,
          index,
          copyIndex,
        })),
      ).flat(),
    [heroPreviewCopies, heroPreviewPages],
  );

  useLayoutEffect(() => {
    heroPreviewItemRefs.current.length = heroPreviewEntries.length;
  }, [heroPreviewEntries.length]);

  useLayoutEffect(() => {
    if (heroPreviewCopies <= 1) {
      setHeroPreviewLoopDistance(0);
      return;
    }

    const track = heroPreviewTrackRef.current;
    if (!track) {
      return;
    }

    const updateDistance = () => {
      track.style.transform = 'translate3d(0, 0, 0)';
      const firstPage = heroPreviewItemRefs.current[0];
      const repeatedFirstPage = heroPreviewItemRefs.current[heroPreviewPages.length];
      if (!firstPage || !repeatedFirstPage) {
        return;
      }
      setHeroPreviewLoopDistance(Math.max(0, repeatedFirstPage.offsetLeft - firstPage.offsetLeft));
    };

    updateDistance();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateDistance);
      return () => {
        window.removeEventListener('resize', updateDistance);
      };
    }

    const observer = new ResizeObserver(() => {
      updateDistance();
    });
    observer.observe(track);
    const firstPage = heroPreviewItemRefs.current[0];
    const repeatedFirstPage = heroPreviewItemRefs.current[heroPreviewPages.length];
    if (firstPage) {
      observer.observe(firstPage);
    }
    if (repeatedFirstPage) {
      observer.observe(repeatedFirstPage);
    }

    return () => {
      observer.disconnect();
    };
  }, [heroPreviewCopies, heroPreviewPages.length]);

  const isHeroPreviewAnimated = heroPreviewCopies > 1 && heroPreviewLoopDistance > 0;

  useEffect(() => {
    const track = heroPreviewTrackRef.current;
    if (!track) {
      return;
    }

    track.style.transform = 'translate3d(0, 0, 0)';

    if (heroPreviewCopies <= 1 || heroPreviewLoopDistance <= 0 || typeof window === 'undefined') {
      return;
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      return;
    }

    const speed = heroPreviewLoopDistance / 42;
    let animationFrame = 0;
    let lastTimestamp: number | null = null;
    let offset = 0;

    const step = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      const elapsed = Math.min(64, timestamp - lastTimestamp);
      lastTimestamp = timestamp;

      if (!heroPreviewPausedRef.current) {
        offset += (elapsed / 1000) * speed;
        if (offset >= heroPreviewLoopDistance) {
          offset %= heroPreviewLoopDistance;
        }
        track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }

      animationFrame = window.requestAnimationFrame(step);
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      track.style.transform = 'translate3d(0, 0, 0)';
    };
  }, [heroPreviewCopies, heroPreviewLoopDistance]);

  const browserStagePages = useMemo(() => homepagePreview.pages.slice(0, 4), [homepagePreview.pages]);
  const [browserStageActiveIndex, setBrowserStageActiveIndex] = useState(1);
  const [browserStagePaused, setBrowserStagePaused] = useState(false);
  const browserStageDetails = useMemo(
    () =>
      browserStagePages.map((page, index) => {
        const templateLabel = getTemplateLabel(page.template, page.customTemplate);
        const meta = getBrowserStageMeta(page.template);
        return {
          page,
          index,
          number: String(index + 1).padStart(2, '0'),
          pageTitle: page.title.trim() || templateLabel,
          templateLabel,
          ...meta,
        };
      }),
    [browserStagePages],
  );
  const browserStageActiveDetail = browserStageDetails[browserStageActiveIndex] ?? null;
  const footerPrimaryCtaLabel = /^open\s*\/editor$/i.test(siteContent.cta.primaryLabel.trim())
    ? 'Open Editor'
    : siteContent.cta.primaryLabel;

  useEffect(() => {
    if (browserStageDetails.length === 0) {
      setBrowserStageActiveIndex(0);
      return;
    }

    setBrowserStageActiveIndex((current) => Math.min(current, browserStageDetails.length - 1));
  }, [browserStageDetails.length]);

  useEffect(() => {
    if (browserStageDetails.length <= 1 || browserStagePaused || typeof window === 'undefined') {
      return;
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setBrowserStageActiveIndex((current) => (current + 1) % browserStageDetails.length);
    }, 3600);

    return () => {
      window.clearInterval(interval);
    };
  }, [browserStageActiveIndex, browserStageDetails.length, browserStagePaused]);

  async function handleLogout() {
    try {
      await logoutUser();
      setSessionUser(null);
    } catch {
      setSessionUser(null);
    }
  }

  return (
    <div className="site-shell">
      <SitePageHeader
        current="home"
        accountPath={session ? '/account' : '/auth'}
        signedIn={Boolean(session)}
        sessionReady={sessionReady}
        onSignOut={session ? handleLogout : undefined}
        canAccessAdmin={session?.role === 'admin'}
      />

      <main id="main-content" className="site-main">
        <section className="hero" id="showcase" data-reveal>
          <div className="hero__copy">
            <p className="eyebrow">{siteContent.hero.eyebrow}</p>
            <h1>{siteContent.hero.title}</h1>
            <p className="hero__lede">{siteContent.hero.lede}</p>
            <div className="hero__actions">
              <Link className="button button--primary" to="/editor">
                {siteContent.hero.primaryCtaLabel}
              </Link>
              <Link className="button button--ghost" to="/auth">
                {siteContent.hero.secondaryCtaLabel}
              </Link>
              <a className="button button--ghost" href="#workflow">
                {siteContent.hero.tertiaryCtaLabel}
              </a>
            </div>
          </div>

          <div className="hero__preview hero-proof" aria-label="Featured magazine output preview">
            <div className="hero-proof__header">
              <div>
                <p className="eyebrow">{siteContent.featuredIssue.eyebrow}</p>
                <strong>{siteContent.featuredIssue.title}</strong>
                <p>{siteContent.featuredIssue.body}</p>
              </div>
              <div className="hero-proof__meta">
                <span>{homepagePreview.source === 'project' ? 'Pinned live folio' : 'Built-in demo'}</span>
                <strong>{homepagePreview.title}</strong>
                <small>{formatTimestamp(homepagePreview.updatedAt)}</small>
              </div>
            </div>

            <div
              className="hero-proof__grid"
              onPointerEnter={isHeroPreviewAnimated ? () => { heroPreviewPausedRef.current = true; } : undefined}
              onPointerLeave={isHeroPreviewAnimated ? () => { heroPreviewPausedRef.current = false; } : undefined}
            >
              <div
                ref={heroPreviewTrackRef}
                className={`hero-proof__track ${isHeroPreviewAnimated ? 'is-animated' : ''}`.trim()}
              >
                {heroPreviewEntries.map(({ page, index, copyIndex }, entryIndex) => (
                  <article
                    key={`${page.id}-${copyIndex}-${index}`}
                    ref={(node) => {
                      heroPreviewItemRefs.current[entryIndex] = node;
                    }}
                    className="hero-proof__page"
                    aria-hidden={copyIndex > 0}
                  >
                    <div className="magazine-sheet magazine-sheet--editor" style={heroPreviewStyle}>
                      <MagazinePreview
                        issue={homepagePreview.issue}
                        page={page}
                        assets={previewAssetsById}
                        assetVariant={homepagePreviewAssetVariant}
                        imageDecoding="async"
                        frameRadius={homepagePreview.frameRadius}
                        pageNumber={index + 1}
                      />
                    </div>
                    <div className="hero-proof__caption">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{page.title.trim() || getTemplateLabel(page.template, page.customTemplate)}</strong>
                      <small>{getTemplateLabel(page.template, page.customTemplate)}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="hero-proof__footer">
              <span>{homepagePreview.subtitle}</span>
              <strong>Same page renderer as the editor preview</strong>
            </div>
          </div>
        </section>

        <section className="editorial-note" data-reveal>
          <p>{siteContent.editorialNote.body}</p>
        </section>

        <section className="feature-grid" id="product" data-reveal>
          {siteContent.features.map((feature, index) => (
            <article key={feature.id} className="feature-card">
              <p className="feature-card__index">0{index + 1}</p>
              <h2>{feature.title}</h2>
              <p>{feature.copy}</p>
            </article>
          ))}
        </section>

        <section className="product-brief" data-reveal>
          <div className="product-brief__intro">
            <p className="eyebrow">Product path</p>
            <h2>Upload, arrange, save, and share from one product.</h2>
            <p>
              FinalFolio is built for paced editorial output, not an endless gallery dump. The editor keeps crop, copy, page rhythm,
              and public delivery tied to the same folio.
            </p>
          </div>
          <div className="product-brief__grid">
            {productCapabilityCards.map((card) => (
              <article key={card.step} className="product-brief-card">
                <span>{card.step}</span>
                <strong>{card.title}</strong>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
          <div className="product-brief__notes">
            {productTrustNotes.map((note) => (
              <article key={note.title} className="product-brief-note">
                <strong>{note.title}</strong>
                <p>{note.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-panel" id="workflow" data-reveal>
          <div className="split-panel__copy">
            <p className="eyebrow">{siteContent.workflow.eyebrow}</p>
            <h2>{siteContent.workflow.title}</h2>
            <p>{siteContent.workflow.body}</p>
            <ol className="workflow-list">
              {siteContent.workflow.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div
            className="split-panel__browser product-proof-browser"
            onPointerEnter={browserStageDetails.length > 1 ? () => { setBrowserStagePaused(true); } : undefined}
            onPointerLeave={browserStageDetails.length > 1 ? () => { setBrowserStagePaused(false); } : undefined}
          >
            <div className="browser-chrome">
              <span />
              <span />
              <span />
            </div>
            <div className="browser-stage">
              <div className="browser-stage__rail">
                <div className="browser-stage__rail-head">
                  <span>Sequence</span>
                  <strong>{homepagePreview.issue}</strong>
                </div>
                {browserStageDetails.map((detail, index) => (
                  <button
                    key={detail.page.id}
                    type="button"
                    className={`browser-stage__rail-card ${index === browserStageActiveIndex ? 'is-active' : ''}`.trim()}
                    aria-pressed={index === browserStageActiveIndex}
                    onClick={() => {
                      setBrowserStageActiveIndex(index);
                    }}
                  >
                    <span>{detail.number}</span>
                    <strong>{detail.pageTitle}</strong>
                    <small>{detail.templateLabel}</small>
                  </button>
                ))}
              </div>
              <div className="browser-stage__workspace">
                <div className="browser-stage__toolbar">
                  <strong>{browserStageActiveDetail?.pageTitle ?? homepagePreview.title}</strong>
                  <div className="browser-stage__toolbar-actions">
                    <span>{browserStagePaused ? 'Paused' : 'Auto'}</span>
                    <span>Preview</span>
                    <span>Share</span>
                  </div>
                </div>
                <div className="browser-stage__canvas">
                  <div className="browser-stage__canvas-surface">
                    <div className="browser-stage__canvas-stack">
                      {browserStageDetails.map((detail, index) => {
                        const total = browserStageDetails.length;
                        const backwardOffset = total > 0 ? (browserStageActiveIndex - index + total) % total : 0;
                        const forwardOffset = total > 0 ? (index - browserStageActiveIndex + total) % total : 0;
                        let stateClass = 'is-hidden';
                        if (index === browserStageActiveIndex) {
                          stateClass = 'is-active';
                        } else if (backwardOffset === 1) {
                          stateClass = 'is-previous';
                        } else if (forwardOffset === 1) {
                          stateClass = 'is-next';
                        }

                        return (
                          <div
                            key={detail.page.id}
                            className={`browser-stage__canvas-card ${stateClass}`.trim()}
                            aria-hidden={index !== browserStageActiveIndex}
                          >
                            <div className="magazine-sheet magazine-sheet--editor" style={browserPreviewStyle}>
                              <MagazinePreview
                                issue={homepagePreview.issue}
                                page={detail.page}
                                assets={previewAssetsById}
                                assetVariant={homepagePreviewAssetVariant}
                                imageDecoding="async"
                                frameRadius={homepagePreview.frameRadius}
                                pageNumber={index + 1}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="browser-stage__copy">
                    <p>{browserStageActiveDetail ? `${browserStageActiveDetail.number} · ${browserStageActiveDetail.role}` : 'Page preview'}</p>
                    <strong>{browserStageActiveDetail?.summary ?? 'Keep the finished folio in view while you edit.'}</strong>
                  </div>
                </div>
              </div>
              <div className="browser-stage__panel">
                <div className="browser-stage__panel-head">
                  <span>Inspector</span>
                  <strong>{browserStageActiveDetail?.templateLabel ?? 'Page setup'}</strong>
                </div>
                <div className="browser-stage__field">
                  <span>Page</span>
                  <strong>{browserStageActiveDetail ? `${browserStageActiveDetail.number} · ${browserStageActiveDetail.pageTitle}` : homepagePreview.title}</strong>
                </div>
                <div className="browser-stage__field">
                  <span>Role</span>
                  <strong>{browserStageActiveDetail?.role ?? 'Active page'}</strong>
                </div>
                <div className="browser-stage__field">
                  <span>Selected area</span>
                  <strong>{browserStageActiveDetail?.focus ?? 'Primary frame'}</strong>
                </div>
                <div className="browser-stage__field browser-stage__field--stacked">
                  <span>Adjustments</span>
                  <div className="browser-stage__field-list">
                    {(browserStageActiveDetail?.adjustments ?? ['Crop', 'Order', 'Caption']).map((step) => (
                      <small key={step}>{step}</small>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="quote-panel" data-reveal>
          <div>
            <p className="eyebrow">{siteContent.positioning.eyebrow}</p>
            <h2>{siteContent.positioning.title}</h2>
          </div>
          <p>{siteContent.positioning.body}</p>
        </section>

        <section className="cta-panel" data-reveal>
          <div>
            <p className="eyebrow">{siteContent.cta.eyebrow}</p>
            <h2>{siteContent.cta.title}</h2>
            <p>{siteContent.cta.body}</p>
          </div>
          <div className="cta-panel__actions">
            <Link className="button button--primary" to="/editor">
              {footerPrimaryCtaLabel}
            </Link>
            <Link className="button button--ghost" to="/auth">
              {siteContent.cta.secondaryLabel}
            </Link>
          </div>
        </section>
      </main>

      <SiteLegalFooter />
    </div>
  );
}

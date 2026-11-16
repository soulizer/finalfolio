import { CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MagazinePreview } from '../components/MagazinePreview';
import { SiteLegalFooter } from '../components/SiteLegalFooter';
import { SitePageHeader } from '../components/SitePageHeader';
import { fetchSiteContent, logoutUser } from '../editor/api';
import { getTemplateLabel } from '../editor/demoData';
import { translate as tModule, useT } from '../i18n';
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
    return tModule('Built-in demo sequence');
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
        role: tModule('Opening sheet'),
        summary: tModule('Lead with one image and a clear title before the sequence opens out.'),
        focus: tModule('Lead image'),
        adjustments: [tModule('Lead image'), tModule('Issue title'), tModule('Deck copy')],
      };
    case 'essay':
      return {
        role: tModule('Text and image'),
        summary: tModule('Adjust crop and opening copy on the same page without losing the finished layout.'),
        focus: tModule('Lead crop'),
        adjustments: [tModule('Lead crop'), tModule('Opening note'), tModule('Caption')],
      };
    case 'grid':
      return {
        role: tModule('Multi-image rhythm'),
        summary: tModule('Compare density, image order, and pacing before you lock the center of the folio.'),
        focus: tModule('Image grid'),
        adjustments: [tModule('Image order'), tModule('Grid density'), tModule('Captions')],
      };
    case 'panorama':
      return {
        role: tModule('Wide spread'),
        summary: tModule('Switch into a broader page when the sequence needs a calmer, wider breath.'),
        focus: tModule('Wide crop'),
        adjustments: [tModule('Wide crop'), tModule('Spread balance'), tModule('Pacing')],
      };
    case 'folio':
      return {
        role: tModule('Single image page'),
        summary: tModule('Let a single frame hold the page while the sequence keeps moving around it.'),
        focus: tModule('Primary frame'),
        adjustments: [tModule('Crop'), tModule('Caption'), tModule('Page order')],
      };
    case 'mosaic':
      return {
        role: tModule('Dense layout'),
        summary: tModule('Pack several images together when the folio needs a more compressed rhythm.'),
        focus: tModule('Mosaic frames'),
        adjustments: [tModule('Frame mix'), tModule('Spacing'), tModule('Order')],
      };
    case 'diptych':
      return {
        role: tModule('Two-image spread'),
        summary: tModule('Balance two frames together so the pair reads as one editorial move.'),
        focus: tModule('Image pair'),
        adjustments: [tModule('Pairing'), tModule('Alignment'), tModule('Spacing')],
      };
    case 'triptych':
      return {
        role: tModule('Three-frame sequence'),
        summary: tModule('Use three adjacent frames when the story needs motion without turning the page.'),
        focus: tModule('Frame trio'),
        adjustments: [tModule('Sequence'), tModule('Spacing'), tModule('Balance')],
      };
    default:
      return {
        role: tModule('Active page'),
        summary: tModule('Keep the folio visible while you refine crop, order, and text in place.'),
        focus: tModule('Primary frame'),
        adjustments: [tModule('Crop'), tModule('Order'), tModule('Caption')],
      };
  }
}

export function HomePage() {
  const t = useT();
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
      track.style.transform = t('translate3d(0, 0, 0)');
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

    track.style.transform = t('translate3d(0, 0, 0)');

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
      track.style.transform = t('translate3d(0, 0, 0)');
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
    ? t('Open Editor')
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
            <p className="eyebrow">{t(siteContent.hero.eyebrow)}</p>
            <h1>{t(siteContent.hero.title)}</h1>
            <p className="hero__lede">{t(siteContent.hero.lede)}</p>
            <div className="hero__actions">
              <Link className="button button--primary" to="/editor">
                {t(siteContent.hero.primaryCtaLabel)}
              </Link>
              <Link className="button button--ghost" to="/auth">
                {t(siteContent.hero.secondaryCtaLabel)}
              </Link>
              <a className="button button--ghost" href="#workflow">
                {t(siteContent.hero.tertiaryCtaLabel)}
              </a>
            </div>
          </div>

          <div className="hero__preview hero-proof" aria-label={t("Featured magazine output preview")}>
            <div className="hero-proof__header">
              <div>
                <p className="eyebrow">{t(siteContent.featuredIssue.eyebrow)}</p>
                <strong>{t(siteContent.featuredIssue.title)}</strong>
                <p>{t(siteContent.featuredIssue.body)}</p>
              </div>
              <div className="hero-proof__meta">
                <span>{homepagePreview.source === 'project' ? t('Pinned live folio') : t('Built-in demo')}</span>
                <strong>{t(homepagePreview.title)}</strong>
                {homepagePreview.source === 'project' ? (
                  <small>{t(formatTimestamp(homepagePreview.updatedAt))}</small>
                ) : null}
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
                        localizeContent
                      />
                    </div>
                    <div className="hero-proof__caption">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{t(page.title.trim() || getTemplateLabel(page.template, page.customTemplate))}</strong>
                      <small>{t(getTemplateLabel(page.template, page.customTemplate))}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="hero-proof__footer">
              <span>{t(homepagePreview.subtitle)}</span>
              <strong>{t('Same page renderer as the editor preview')}</strong>
            </div>
          </div>
        </section>

        <section className="editorial-note" data-reveal>
          <p>{t(siteContent.editorialNote.body)}</p>
        </section>

        <section className="feature-grid" id="product" data-reveal>
          {siteContent.features.map((feature, index) => (
            <article key={feature.id} className="feature-card">
              <p className="feature-card__index">0{index + 1}</p>
              <h2>{t(feature.title)}</h2>
              <p>{t(feature.copy)}</p>
            </article>
          ))}
        </section>

        <section className="product-brief" data-reveal>
          <div className="product-brief__intro">
            <p className="eyebrow">{t('Product path')}</p>
            <h2>{t('Upload, arrange, save, and share from one product.')}</h2>
            <p>{t('FinalFolio is built for paced editorial output, not an endless gallery dump. The editor keeps crop, copy, page rhythm, and public delivery tied to the same folio.')}</p>
          </div>
          <div className="product-brief__grid">
            {productCapabilityCards.map((card) => (
              <article key={card.step} className="product-brief-card">
                <span>{card.step}</span>
                <strong>{t(card.title)}</strong>
                <p>{t(card.copy)}</p>
              </article>
            ))}
          </div>
          <div className="product-brief__notes">
            {productTrustNotes.map((note) => (
              <article key={note.title} className="product-brief-note">
                <strong>{t(note.title)}</strong>
                <p>{t(note.copy)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-panel" id="workflow" data-reveal>
          <div className="split-panel__copy">
            <p className="eyebrow">{t(siteContent.workflow.eyebrow)}</p>
            <h2>{t(siteContent.workflow.title)}</h2>
            <p>{t(siteContent.workflow.body)}</p>
            <ol className="workflow-list">
              {siteContent.workflow.steps.map((step) => (
                <li key={step}>{t(step)}</li>
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
                  <span>{t('Sequence')}</span>
                  <strong>{t(homepagePreview.issue)}</strong>
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
                    <strong>{t(detail.pageTitle)}</strong>
                    <small>{t(detail.templateLabel)}</small>
                  </button>
                ))}
              </div>
              <div className="browser-stage__workspace">
                <div className="browser-stage__toolbar">
                  <strong>{t(browserStageActiveDetail?.pageTitle ?? homepagePreview.title)}</strong>
                  <div className="browser-stage__toolbar-actions">
                    <span>{browserStagePaused ? t('Paused') : t('Auto')}</span>
                    <span>{t('Preview')}</span>
                    <span>{t('Share')}</span>
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
                                localizeContent
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="browser-stage__copy">
                    <p>{browserStageActiveDetail ? `${browserStageActiveDetail.number} · ${browserStageActiveDetail.role}` : t('Page preview')}</p>
                    <strong>{t(browserStageActiveDetail?.summary ?? t('Keep the finished folio in view while you edit.'))}</strong>
                  </div>
                </div>
              </div>
              <div className="browser-stage__panel">
                <div className="browser-stage__panel-head">
                  <span>{t('Inspector')}</span>
                  <strong>{t(browserStageActiveDetail?.templateLabel ?? t('Page setup'))}</strong>
                </div>
                <div className="browser-stage__field">
                  <span>{t('Page')}</span>
                  <strong>{browserStageActiveDetail ? `${browserStageActiveDetail.number} · ${t(browserStageActiveDetail.pageTitle)}` : t(homepagePreview.title)}</strong>
                </div>
                <div className="browser-stage__field">
                  <span>{t('Role')}</span>
                  <strong>{t(browserStageActiveDetail?.role ?? t('Active page'))}</strong>
                </div>
                <div className="browser-stage__field">
                  <span>{t('Selected area')}</span>
                  <strong>{t(browserStageActiveDetail?.focus ?? t('Primary frame'))}</strong>
                </div>
                <div className="browser-stage__field browser-stage__field--stacked">
                  <span>{t('Adjustments')}</span>
                  <div className="browser-stage__field-list">
                    {(browserStageActiveDetail?.adjustments ?? [t('Crop'), t('Order'), t('Caption')]).map((step) => (
                      <small key={step}>{t(step)}</small>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="quote-panel" data-reveal>
          <div>
            <p className="eyebrow">{t(siteContent.positioning.eyebrow)}</p>
            <h2>{t(siteContent.positioning.title)}</h2>
          </div>
          <p>{t(siteContent.positioning.body)}</p>
        </section>

        <section className="cta-panel" data-reveal>
          <div>
            <p className="eyebrow">{t(siteContent.cta.eyebrow)}</p>
            <h2>{t(siteContent.cta.title)}</h2>
            <p>{t(siteContent.cta.body)}</p>
          </div>
          <div className="cta-panel__actions">
            <Link className="button button--primary" to="/editor">
              {t(footerPrimaryCtaLabel)}
            </Link>
            <Link className="button button--ghost" to="/auth">
              {t(siteContent.cta.secondaryLabel)}
            </Link>
          </div>
        </section>
      </main>

      <SiteLegalFooter />
    </div>
  );
}

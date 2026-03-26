import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'Live page composition',
    copy: 'Arrange pages while looking at the issue itself, not a separate settings form.',
  },
  {
    title: 'Quiet templates',
    copy: 'Cover, essay, folio, grid, panorama, mosaic, triptych, and diptych layouts keep magazines consistent without feeling canned.',
  },
  {
    title: 'Server-backed issues',
    copy: 'Keep an issue on the server, reopen it later from the same stable URL, and continue editing from there.',
  },
];

const workflow = [
  'Upload photographs and keep them on the server.',
  'Shape the issue page-by-page while the final layout stays visible.',
  'Save a stable editor URL and print to PDF when the sequence is ready.',
];

export function HomePage() {
  return (
    <div className="site-shell">
      <header className="site-header" data-reveal>
        <Link to="/" className="site-brand">
          CrazyAlbum
        </Link>
        <nav className="site-nav">
          <a href="#product">Product</a>
          <a href="#workflow">Workflow</a>
          <Link to="/editor">Editor</Link>
        </nav>
      </header>

      <main>
        <section className="hero" data-reveal>
          <div className="hero__copy">
            <p className="eyebrow">Electronic magazines for photographs</p>
            <h1>Make a magazine, not another endless gallery.</h1>
            <p className="hero__lede">
              CrazyAlbum turns photo sets into restrained digital issues with a WYSIWYG editor built for pacing,
              whitespace, and text that actually belongs on the page.
            </p>
            <div className="hero__actions">
              <Link className="button button--primary" to="/editor">
                Start a project
              </Link>
              <a className="button button--ghost" href="#product">
                See the product
              </a>
            </div>
          </div>

          <div className="hero__preview" aria-label="Magazine preview">
            <div className="hero-sheet hero-sheet--front">
              <img alt="Architectural cover study" src="/builtins/architecture.svg" />
              <div className="hero-sheet__label">
                <span>Issue 01</span>
                <strong>Quiet Streets</strong>
              </div>
            </div>
            <div className="hero-sheet hero-sheet--back">
              <img alt="Studio essay spread" src="/builtins/studio.svg" />
              <div className="hero-sheet__caption">Essay page</div>
            </div>
            <div className="hero-sheet hero-sheet--detail">
              <img alt="Portrait contact frame" src="/builtins/portrait.svg" />
            </div>
          </div>
        </section>

        <section className="editorial-note" data-reveal>
          <p>
            Designed for photographers, studios, and brand teams that want the calm of an editorial layout without
            moving into desktop publishing software too early.
          </p>
        </section>

        <section className="feature-grid" id="product" data-reveal>
          {sections.map((section) => (
            <article key={section.title} className="feature-card">
              <p className="feature-card__index">0{sections.indexOf(section) + 1}</p>
              <h2>{section.title}</h2>
              <p>{section.copy}</p>
            </article>
          ))}
        </section>

        <section className="split-panel" id="workflow" data-reveal>
          <div className="split-panel__copy">
            <p className="eyebrow">Workflow</p>
            <h2>A quiet, credible publishing flow.</h2>
            <p>
              The editor focuses on sequencing and composition first. Upload your own images, pick a page structure,
              and adjust fit and crop positions while the page stays in view.
            </p>
            <ol className="workflow-list">
              {workflow.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div className="split-panel__browser" aria-hidden="true">
            <div className="browser-chrome">
              <span />
              <span />
              <span />
            </div>
            <div className="browser-stage">
              <div className="browser-stage__rail">
                <div />
                <div />
                <div />
              </div>
              <div className="browser-stage__page">
                <img alt="" src="/builtins/studio.svg" />
                <div className="browser-stage__copy">
                  <p>Live page preview</p>
                  <strong>Templates, crops, captions.</strong>
                </div>
              </div>
              <div className="browser-stage__panel">
                <div />
                <div />
                <div />
                <div />
              </div>
            </div>
          </div>
        </section>

        <section className="quote-panel" data-reveal>
          <div>
            <p className="eyebrow">Positioning</p>
            <h2>Closer to a lightweight editorial studio than a template storefront.</h2>
          </div>
          <p>
            The goal is a credible first publishing workflow: server-stored projects, stable editor links, restrained
            layouts, and PDF output without turning the product into generic SaaS furniture.
          </p>
        </section>

        <section className="cta-panel" data-reveal>
          <div>
            <p className="eyebrow">Editor</p>
            <h2>Build an issue now.</h2>
            <p>Upload your own photographs, shape the sequence, then save a stable editor URL.</p>
          </div>
          <Link className="button button--primary" to="/editor">
            Open /editor
          </Link>
        </section>
      </main>
    </div>
  );
}

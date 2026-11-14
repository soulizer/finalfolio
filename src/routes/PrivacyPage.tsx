import { Link } from 'react-router-dom';
import { SiteLegalFooter } from '../components/SiteLegalFooter';
import { SitePageHeader } from '../components/SitePageHeader';
import { getPrivacyDocument, PrivacyBlock } from '../legal/privacy';
import { useSession } from '../session';

function renderSectionBlock(block: PrivacyBlock, key: string) {
  if (block.type === 'paragraph') {
    return <p key={key}>{block.text}</p>;
  }

  return (
    <ul key={key} className="terms-list">
      {block.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  const document = getPrivacyDocument();
  const { user: session, ready: sessionReady } = useSession();

  return (
    <div className="editor-shell editor-shell--site-page editor-shell--auth editor-shell--legal">
      <SitePageHeader current="privacy" accountPath={session ? '/account' : '/auth'} signedIn={Boolean(session)} sessionReady={sessionReady} subtitle={document.title} canAccessAdmin={session?.role === 'admin'} />

      <section id="main-content" className="editor-empty-state terms-state">
        <div className="terms-state__header">
          <p className="eyebrow">{document.shortTitle}</p>
          <h1>{document.title}</h1>
          <div className="terms-intro">
            {document.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <section className="terms-risk-notice" aria-label={document.storageNoticeTitle}>
          <strong>{document.storageNoticeTitle}</strong>
          <p>{document.storageNoticeBody}</p>
        </section>

        <div className="terms-document">
          {document.sections.map((section) => (
            <section key={section.title} className="terms-section">
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => renderSectionBlock(block, section.title + '-' + index))}
            </section>
          ))}
        </div>

        <section className="terms-gate">
          <div className="terms-gate__copy">
            <strong>Questions or deletion requests</strong>
            <p>{'For account removal, upload deletion, or privacy questions, contact ' + document.contactEmail + '.'}</p>
          </div>
          <div className="terms-actions">
            <Link className="button button--primary" to="/auth">
              Open account access
            </Link>
            <Link className="button button--ghost" to="/">
              Back home
            </Link>
          </div>
        </section>
      </section>

      <SiteLegalFooter />
    </div>
  );
}

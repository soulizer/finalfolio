import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SiteLegalFooter } from '../components/SiteLegalFooter';
import { SitePageHeader } from '../components/SitePageHeader';
import { acceptTerms, logoutUser } from '../editor/api';
import { getPageLanguage, getTermsDocument } from '../legal/terms';
import { useSession } from '../session';

function normalizeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

function renderSectionBlock(block: { type: 'paragraph'; text: string } | { type: 'list'; items: string[] }, key: string) {
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

export function TermsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const nextPath = normalizeNextPath(searchParams.get('next'));
  const language = getPageLanguage();
  const document = getTermsDocument(language);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { user: session, ready: sessionReady, setSessionUser } = useSession();

  function openRoute(path: string, { replace = false }: { replace?: boolean } = {}) {
    navigate(path, replace ? { replace: true } : undefined);
  }

  const continuePath = nextPath ?? (session?.role === 'admin' ? '/admin' : '/account');

  async function handleAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      const payload = await acceptTerms(language);
      setSessionUser(payload.user);
      openRoute(continuePath, { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to accept the Terms of Service.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setMessage(null);

    try {
      await logoutUser();
      setSessionUser(null);
      openRoute('/auth', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor-shell editor-shell--site-page editor-shell--auth editor-shell--legal">
      <SitePageHeader
        current="terms"
        accountPath={session ? '/account' : '/auth'}
        signedIn={Boolean(session)}
        sessionReady={sessionReady}
        onSignOut={session ? handleLogout : undefined}
        subtitle={document.title}
        canAccessAdmin={session?.role === 'admin'}
      />

      <section className="editor-empty-state terms-state">
        <div className="terms-state__header">
          <p className="eyebrow">{document.shortTitle}</p>
          <h1>{document.title}</h1>
          <div className="terms-intro">
            {document.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>

        <section className="terms-risk-notice" aria-label={document.riskNoticeTitle}>
          <strong>{document.riskNoticeTitle}</strong>
          <p>{document.riskNoticeBody}</p>
        </section>

        {!sessionReady ? (
          <section className="terms-gate">
            <div className="terms-gate__copy">
              <strong>{document.acceptanceHeading}</strong>
              <p>Preparing the correct account gate for this session.</p>
            </div>
          </section>
        ) : session ? (
          <section className="terms-gate">
            <div className="terms-gate__copy">
              <strong>{document.acceptanceHeading}</strong>
              <p>
                {session.needsTermsAcceptance ? document.acceptanceBody : document.acceptedSummaryLabel}
              </p>
            </div>
            <div className="terms-actions">
              {session.needsTermsAcceptance ? (
                <form onSubmit={handleAccept}>
                  <button type="submit" className="button button--primary" disabled={busy}>
                    {busy ? 'Working…' : document.acceptButtonLabel}
                  </button>
                </form>
              ) : (
                <button type="button" className="button button--primary" onClick={() => openRoute(continuePath)}>
                  {document.continueButtonLabel}
                </button>
              )}
              <button type="button" className="button button--ghost" onClick={() => void handleLogout()} disabled={busy}>
                Log Out
              </button>
            </div>
          </section>
        ) : (
          <section className="terms-gate">
            <div className="terms-gate__copy">
              <strong>{document.acceptanceHeading}</strong>
              <p>Sign in first, then accept the current Terms of Service to continue using uploads, editor, account, or admin features.</p>
            </div>
            <div className="terms-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => openRoute(`/auth?next=${encodeURIComponent(nextPath ?? '/account')}`)}
              >
                {document.signInButtonLabel}
              </button>
              <Link className="button button--ghost" to="/">
                Back home
              </Link>
            </div>
          </section>
        )}

        <div className="terms-document">
          {document.sections.map((section) => (
            <section key={section.title} className="terms-section">
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => renderSectionBlock(block, `${section.title}-${index}`))}
            </section>
          ))}
        </div>

        {message ? <p className="terms-message">{message}</p> : null}
      </section>

      <SiteLegalFooter />
    </div>
  );
}

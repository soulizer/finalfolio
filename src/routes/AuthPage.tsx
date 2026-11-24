import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AuthCaptchaChallenge,
  BootstrapStatus,
  confirmPasswordReset,
  fetchAuthCaptcha,
  fetchBootstrapStatus,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resendVerificationEmail,
  startUnalbumLogin,
  verifyEmailToken,
} from '../editor/api';
import { useUnalbumStatus } from '../editor/useUnalbumStatus';
import { getUserIdentitySummary, getUserPrimaryIdentity } from '../editor/identity';
import { LoadingStack } from '../components/LoadingStack';
import { SiteLegalFooter } from '../components/SiteLegalFooter';
import { useT } from '../i18n';
import { SitePageHeader } from '../components/SitePageHeader';
import { buildTermsPath, getPageLanguage, getTermsDocument } from '../legal/terms';
import { useSession } from '../session';
import { useDelayedVisibility } from '../useDelayedVisibility';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

export function AuthPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const verifyToken = searchParams.get('verify');
  const resetToken = searchParams.get('reset');
  const nextPath = (() => {
    const value = searchParams.get('next');
    return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
  })();
  const termsDocument = useMemo(() => getTermsDocument(getPageLanguage()), []);
  const [identifier, setIdentifier] = useState('');
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : 'login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<AuthCaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaBusy, setCaptchaBusy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [unalbumBusy, setUnalbumBusy] = useState(false);
  const unalbumStatus = useUnalbumStatus();
  const { user: session, ready: sessionReady, setSessionUser } = useSession();

  useEffect(() => {
    const unalbumOutcome = searchParams.get('unalbum');
    if (unalbumOutcome !== 'error') {
      return;
    }
    const reason = searchParams.get('reason');
    setMessage(
      reason === 'no-email'
        ? t('UnAlbum did not share an email address, so FinalFolio could not create the account.')
        : reason === 'disabled'
          ? t('This account is disabled.')
          : reason === 'state'
            ? t('The UnAlbum sign-in link expired. Please start again.')
            : reason === 'denied'
              ? t('You cancelled the UnAlbum authorization.')
              : reason === 'network'
                ? t('UnAlbum did not answer in time. Please try again.')
                : t('UnAlbum sign-in did not finish. Please try again.'),
    );
    // Only react to the callback landing, not to every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('unalbum'), searchParams.get('reason')]);

  async function handleUnalbumLogin() {
    if (unalbumBusy) {
      return;
    }
    setUnalbumBusy(true);
    setMessage(null);
    try {
      const { authorizeUrl } = await startUnalbumLogin(nextPath ?? '/editor');
      window.location.assign(authorizeUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to start UnAlbum sign-in.'));
      setUnalbumBusy(false);
    }
  }

  function openRoute(path: string) {
    navigate(path);
  }

  function replaceRoute(path: string) {
    navigate(path, { replace: true });
  }

  function openTerms(nextTarget?: string | null) {
    navigate(buildTermsPath(nextTarget), { replace: true });
  }

  useEffect(() => {
    setMode(resetToken ? 'reset' : 'login');
  }, [resetToken]);

  useEffect(() => {
    void fetchBootstrapStatus()
      .then((payload) => {
        setBootstrapStatus(payload);
        setBootstrapReady(true);
      })
      .catch(() => {
        setBootstrapStatus(null);
        setBootstrapReady(true);
      });
  }, []);

  useEffect(() => {
    if (!sessionReady || !session || verifyToken || resetToken) {
      return;
    }

    if (session.needsTermsAcceptance) {
      openTerms(nextPath ?? (session.role === 'admin' ? '/admin' : '/account'));
      return;
    }

    replaceRoute(nextPath ?? (session.role === 'admin' ? '/admin' : '/account'));
  }, [nextPath, resetToken, session, sessionReady, verifyToken]);

  async function loadCaptcha({ clearAnswer = true, surfaceError = true } = {}) {
    setCaptchaBusy(true);

    try {
      const payload = await fetchAuthCaptcha('register');
      setCaptcha(payload);
      if (clearAnswer) {
        setCaptchaAnswer('');
      }
    } catch (error) {
      setCaptcha(null);
      if (surfaceError) {
        setMessage(error instanceof Error ? error.message : t('Unable to load captcha.'));
      }
    } finally {
      setCaptchaBusy(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || session || mode !== 'register') {
      setCaptcha(null);
      setCaptchaAnswer('');
      return;
    }

    let cancelled = false;
    setCaptchaBusy(true);

    void fetchAuthCaptcha('register')
      .then((payload) => {
        if (!cancelled) {
          setCaptcha(payload);
          setCaptchaAnswer('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCaptcha(null);
          setMessage(error instanceof Error ? error.message : t('Unable to load captcha.'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCaptchaBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mode, session, sessionReady]);

  useEffect(() => {
    if (!verifyToken) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    setMessage(t('Verifying your email...'));

    void verifyEmailToken(verifyToken)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setSessionUser(payload.user);
        setMessage(t('Email verified. You are now signed in.'));
        replaceRoute(
          payload.user.needsTermsAcceptance
            ? buildTermsPath(nextPath ?? (payload.user.role === 'admin' ? '/admin' : '/account'))
            : nextPath ?? (payload.user.role === 'admin' ? '/admin' : '/account'),
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setMessage(error instanceof Error ? error.message : t('Unable to verify email.'));
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, nextPath, verifyToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      if (mode === 'register') {
        if (!captcha) {
          setMessage(t('Loading verification challenge. Refresh and try again.'));
          return;
        }

        const requiresBootstrap = bootstrapStatus?.requiresBootstrap === true;
        const payload = await registerUser(username, email, password, captcha.id, captchaAnswer, acceptTerms, termsDocument.language);
        setPendingVerificationEmail(payload.user.email);
        setPassword('');
        setCaptchaAnswer('');
        setMessage(
          requiresBootstrap
            ? t('Initial admin account created. Check your inbox to verify the email before signing in.')
            : t('Account created. Check your inbox to verify your email before signing in.'),
        );
        return;
      }

      if (mode === 'forgot') {
        await requestPasswordReset(email);
        setMessage(t('If this email exists, a password reset link has been sent.'));
        return;
      }

      if (mode === 'reset' && resetToken) {
        const payload = await confirmPasswordReset(resetToken, password);
        setSessionUser(payload.user);
        setPendingVerificationEmail(null);
        setPassword('');
        setMessage(t('Password reset complete. You are now signed in.'));
        replaceRoute(
          payload.user.needsTermsAcceptance
            ? buildTermsPath(nextPath ?? (payload.user.role === 'admin' ? '/admin' : '/account'))
            : nextPath ?? (payload.user.role === 'admin' ? '/admin' : '/account'),
        );
        return;
      }

      const payload = await loginUser(identifier, password);
      setSessionUser(payload.user);
      setPassword('');
      setMessage(t('Signed in.'));
      replaceRoute(
        payload.user.needsTermsAcceptance
          ? buildTermsPath(nextPath ?? (payload.user.role === 'admin' ? '/admin' : '/account'))
          : nextPath ?? (payload.user.role === 'admin' ? '/admin' : '/account'),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to continue.'));
      if (mode === 'register') {
        void loadCaptcha({ clearAnswer: true, surfaceError: false });
      }
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
      setMessage(t('Signed out.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to sign out.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    const targetEmail = pendingVerificationEmail ?? email;
    if (!targetEmail) {
      setMessage(t('Enter the email address that needs a new verification link.'));
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await resendVerificationEmail(targetEmail);
      setMessage(t('Verification email sent.'));
    } catch (error) {
      setMessage(error instanceof Error ? t(error.message) : t('Unable to resend verification email.'));
    } finally {
      setBusy(false);
    }
  }

  const title = session
    ? t('Account ready.')
    : verifyToken
      ? t('Verifying your email.')
      : mode === 'register'
        ? bootstrapStatus?.requiresBootstrap
          ? t('Create the first admin account.')
          : t('Create your account.')
        : mode === 'forgot'
          ? t('Reset your password.')
          : mode === 'reset'
            ? t('Set a new password.')
            : t('Sign in to FinalFolio.');
  const registerActionLabel = bootstrapStatus?.requiresBootstrap ? t('Create admin account') : t('Register');
  const showLoadingShell = useDelayedVisibility(!sessionReady || !bootstrapReady);

  if (!sessionReady || !bootstrapReady) {
    if (!showLoadingShell) {
      return (
        <div className="editor-shell editor-shell--site-page editor-shell--auth" aria-hidden="true">
          <SitePageHeader current="auth" accountPath="/auth" sessionReady={false} canAccessAdmin={false} />
          <SiteLegalFooter />
        </div>
      );
    }

    return (
      <div className="editor-shell editor-shell--site-page editor-shell--auth">
        <SitePageHeader current="auth" accountPath="/auth" sessionReady={false} canAccessAdmin={false} />

        <section id="main-content" className="editor-empty-state" aria-busy="true">
          <p className="eyebrow">{t('Auth')}</p>
          <h1>{t('Account access')}</h1>
          <p>{t('Checking the current session and access state.')}</p>
          <div className="auth-form">
            <LoadingStack lines={['line-full', 'line-full', 'line-medium', 'line-short']} />
          </div>
        </section>

        <SiteLegalFooter />
      </div>
    );
  }

  return (
    <div className="editor-shell editor-shell--site-page editor-shell--auth">
      <SitePageHeader
        current="auth"
        accountPath={session ? '/account' : '/auth'}
        signedIn={Boolean(session)}
        sessionReady={sessionReady}
        onSignOut={session ? handleLogout : undefined}
        canAccessAdmin={session?.role === 'admin'}
      />

      <section id="main-content" className="editor-empty-state">
        <p className="eyebrow">{t('Auth')}</p>
        <h1>{title}</h1>
        {!session && bootstrapStatus?.requiresBootstrap ? (
          <p>{t('No account exists yet. The first registered account will become the initial administrator after verification.')}</p>
        ) : null}
        {session ? (
          <>
            <p>{`${getUserIdentitySummary(session)} · ${t(session.role)} · ${t(session.emailVerifiedAt ? 'verified' : 'unverified')}`}</p>
            <div className="editor-empty-state__actions">
              <button
                type="button"
                className={`button ${session.role === 'admin' || nextPath ? 'button--primary' : 'button--ghost'}`}
                onClick={() => openRoute(nextPath ?? (session.role === 'admin' ? '/admin' : '/account'))}
              >
                {nextPath ? t('Continue') : session.role === 'admin' ? t('Open admin') : t('Open account')}
              </button>
              {session.role !== 'admin' ? (
                <button
                  type="button"
                  className={`button ${nextPath ? 'button--ghost' : 'button--primary'}`}
                  onClick={() => openRoute('/editor')}
                >
                  {t('Open editor')}
                </button>
              ) : (
                <button type="button" className="button button--ghost" onClick={() => openRoute('/account')}>
                  {t('Open account')}
                </button>
              )}
              <button type="button" className="button button--ghost" onClick={() => void handleLogout()} disabled={busy}>
                {t('Sign out')}
              </button>
            </div>
            <p>{t('Your projects, uploads, and account settings now live in the dedicated account dashboard instead of this auth screen.')}</p>
          </>
        ) : verifyToken ? (
          <div className="editor-empty-state__actions">
            <button type="button" className="button button--ghost" onClick={() => openRoute('/auth')}>
              {t('Back to sign in')}
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'login' ? (
              <label className="field">
                <span>{t('Email or username')}</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
            ) : null}
            {mode === 'register' ? (
              <label className="field">
                <span>{t('Username')}</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t('3-40 letters, numbers, hyphen, underscore')}
                  minLength={3}
                  maxLength={40}
                  pattern="[A-Za-z0-9](?:[A-Za-z0-9_-]{1,38}[A-Za-z0-9])?"
                  autoComplete="username"
                  required
                />
              </label>
            ) : null}
            {mode !== 'login' && mode !== 'reset' ? (
              <label className="field">
                <span>{t('Email')}</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </label>
            ) : null}
            {mode !== 'forgot' ? (
              <label className="field">
                <span>{t('Password')}</span>
                <input
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'register' || mode === 'reset' ? 'new-password' : 'current-password'}
                  required
                />
              </label>
            ) : null}
            {mode === 'register' ? (
              <section className="auth-captcha" aria-label={t('Registration verification')}>
                <div className="auth-captcha__header">
                  <div>
                    <strong>{t('Human check')}</strong>
                    <p className="field-note">{t('Usernames are unique across FinalFolio. Registration sends email and is rate-limited per IP to protect delivery reputation.')}</p>
                  </div>
                </div>
                <div className="auth-captcha__panel">
                  <div className="auth-captcha__visual">
                    {captcha ? (
                      <img className="auth-captcha__image" src={captcha.imageDataUrl} alt={t('Registration captcha challenge')} />
                    ) : (
                      <div className="auth-captcha__image auth-captcha__image--placeholder">{t('Loading challenge…')}</div>
                    )}
                    <button
                      type="button"
                      className="button button--ghost auth-captcha__refresh"
                      disabled={busy || captchaBusy}
                      onClick={() => void loadCaptcha()}
                    >
                      {captchaBusy ? t('Refreshing…') : t('Refresh code')}
                    </button>
                  </div>
                  <label className="field auth-captcha__field">
                    <span>{captcha?.prompt ? t(captcha.prompt) : t('Enter the characters shown above')}</span>
                    <input
                      type="text"
                      value={captchaAnswer}
                      onChange={(event) => setCaptchaAnswer(event.target.value.toUpperCase())}
                      required
                      minLength={5}
                      maxLength={8}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="text"
                    />
                  </label>
                </div>
              </section>
            ) : null}
            {mode === 'register' ? (
              <section className="auth-terms">
                <div className="auth-terms__notice">
                  <strong>{termsDocument.riskNoticeTitle}</strong>
                  <p>{termsDocument.riskNoticeBody}</p>
                </div>
                <label className="auth-terms__checkbox">
                  <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
                  <span>{termsDocument.agreementLabel}</span>
                </label>
                <p className="auth-terms__linkline legal-inline-links">
                  <Link to={buildTermsPath('/auth')}>{t('Terms of Service')}</Link>
                  <span>·</span>
                  <Link to="/privacy">{t('Privacy Policy')}</Link>
                </p>
              </section>
            ) : null}
            <div className="editor-empty-state__actions auth-form__actions">
              <button type="submit" className="button button--primary" disabled={busy || (mode === 'register' && !acceptTerms)}>
                {busy
                  ? t('Working…')
                  : mode === 'register'
                    ? registerActionLabel
                    : mode === 'forgot'
                      ? t('Send reset link')
                      : mode === 'reset'
                        ? t('Reset password')
                        : t('Sign in')}
              </button>
              <button
                type="button"
                className="button button--ghost"
                disabled={busy}
                onClick={() =>
                  setMode((current) => {
                    if (current === 'login') {
                      return 'register';
                    }

                    if (current === 'register') {
                      return 'login';
                    }

                    return 'login';
                  })
                }
              >
                {mode === 'login' ? t('Need an account?') : t('Back to sign in')}
              </button>
              {mode === 'login' ? (
                <button type="button" className="button button--ghost" disabled={busy} onClick={() => setMode('forgot')}>
                  {t('Forgot password')}
                </button>
              ) : null}
              {mode === 'register' || pendingVerificationEmail ? (
                <button type="button" className="button button--ghost" disabled={busy} onClick={() => void handleResendVerification()}>
                  {t('Resend verification')}
                </button>
              ) : null}
            </div>
          </form>
        )}
        {!session && !verifyToken && unalbumStatus?.configured ? (
          <div className="auth-unalbum">
            <span className="auth-unalbum__divider">{t('or')}</span>
            <button
              type="button"
              className="button button--ghost auth-unalbum__button"
              disabled={busy || unalbumBusy}
              onClick={() => void handleUnalbumLogin()}
            >
              {unalbumBusy ? t('Opening UnAlbum…') : t('Sign in with UnAlbum')}
            </button>
            <p className="field-note">
              {t('Authorise FinalFolio on UnAlbum. Your UnAlbum photos and AI tags can then be imported directly.')}
            </p>
          </div>
        ) : null}
        {message ? <p>{message}</p> : null}
        {!session && mode === 'register' ? (
          <p className="panel-note">
            {username.trim()
              ? t('%s will become your primary account identity after sign-in.').replace(
                  '%s',
                  getUserPrimaryIdentity({ username, email }, t('This username')),
                )
              : t('Choose a username to create your account. It becomes your primary account identity after sign-in.')}
          </p>
        ) : null}
      </section>

      <SiteLegalFooter />
    </div>
  );
}

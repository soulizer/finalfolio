import { lazy, Suspense, useDeferredValue, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { SiteSkipLink } from './components/SiteSkipLink';
import { SessionProvider } from './session';
import { ConfirmProvider } from './ui/confirm';

const HomePage = lazy(() => import('./routes/HomePage').then((module) => ({ default: module.HomePage })));
const AuthPage = lazy(() => import('./routes/AuthPage').then((module) => ({ default: module.AuthPage })));
const TermsPage = lazy(() => import('./routes/TermsPage').then((module) => ({ default: module.TermsPage })));
const PrivacyPage = lazy(() => import('./routes/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));
const AccountPage = lazy(() => import('./routes/AccountPage').then((module) => ({ default: module.AccountPage })));
const AdminPage = lazy(() => import('./routes/AdminPage').then((module) => ({ default: module.AdminPage })));
const IssueViewPage = lazy(() => import('./routes/IssueViewPage').then((module) => ({ default: module.IssueViewPage })));
const EditorPage = lazy(() => import('./routes/EditorPage').then((module) => ({ default: module.EditorPage })));
const NotFoundPage = lazy(() => import('./routes/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="route-fallback__mark" aria-hidden="true" />
      <p>Loading</p>
    </div>
  );
}

function useRevealObserver(pathname: string) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });

    const observedNodes = new WeakSet<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );

    const observeRevealNodes = () => {
      const revealNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
      revealNodes.forEach((node) => {
        if (observedNodes.has(node) || node.classList.contains('is-visible')) {
          return;
        }

        observedNodes.add(node);
        observer.observe(node);
      });
    };

    observeRevealNodes();

    const mutationObserver = new MutationObserver(() => {
      observeRevealNodes();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    const frameId = window.requestAnimationFrame(() => {
      observeRevealNodes();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [pathname]);
}

export default function App() {
  const location = useLocation();
  const deferredLocation = useDeferredValue(location);

  useRevealObserver(deferredLocation.pathname);

  return (
    <SessionProvider>
      <AppErrorBoundary>
        <ConfirmProvider>
          <SiteSkipLink />
          <Suspense fallback={<RouteFallback />}>
          <Routes location={deferredLocation}>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/project/:shareId" element={<IssueViewPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/editor/:projectId" element={<EditorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </ConfirmProvider>
      </AppErrorBoundary>
    </SessionProvider>
  );
}

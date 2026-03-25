import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { HomePage } from './routes/HomePage';
import { EditorPage } from './routes/EditorPage';

function useRevealObserver() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });

    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
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

    revealNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [location.pathname]);
}

export default function App() {
  useRevealObserver();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/editor/:projectId" element={<EditorPage />} />
    </Routes>
  );
}

import { useEffect, useState } from 'react';

export function useDelayedVisibility(active: boolean, delayMs = 180) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    const timerId = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [active, delayMs]);

  return visible;
}

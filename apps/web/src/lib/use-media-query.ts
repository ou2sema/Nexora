import { useEffect, useState } from 'react';

/**
 * The counter renders one layout at a time — a two-column desk or a step wizard —
 * rather than the same DOM restyled, so the breakpoint has to be a fact in JS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

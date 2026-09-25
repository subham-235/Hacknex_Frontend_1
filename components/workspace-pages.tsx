'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const PageVisibility = createContext(true);
export const usePageVisible = () => useContext(PageVisibility);

// The workspace owns page lifetimes. Navigation changes visibility instead of
// destroying forms, selections and results. Account changes remount this tree.
export function WorkspacePage({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  if (!active && !visited) return null;
  return <PageVisibility.Provider value={active}>
    <div className="workspace-page" hidden={!active}>{children}</div>
  </PageVisibility.Provider>;
}

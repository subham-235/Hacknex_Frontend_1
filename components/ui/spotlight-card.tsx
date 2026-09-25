'use client';
import { useRef, type ReactNode } from 'react';
/** Local spotlight treatment inspired by the community cards on 21st.dev. */
export function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const card = useRef<HTMLElement>(null);
  return (
    <article
      ref={card}
      className={`card spotlight-card ${className}`}
      onPointerMove={(event) => {
        if (
          event.pointerType === 'touch' ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
          return;
        const bounds = event.currentTarget.getBoundingClientRect();
        card.current?.style.setProperty(
          '--pointer-x',
          `${event.clientX - bounds.left}px`,
        );
        card.current?.style.setProperty(
          '--pointer-y',
          `${event.clientY - bounds.top}px`,
        );
      }}
    >
      {children}
    </article>
  );
}

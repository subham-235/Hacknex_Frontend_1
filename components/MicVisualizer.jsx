'use client';
import { useEffect, useRef } from 'react';

export default function MicVisualizer({ isActive }) {
  const bars = useRef([]);
  useEffect(() => {
    let frame;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (time) => {
      bars.current.forEach((bar, index) => {
        if (!bar) return;
        const weight = 1 - Math.abs(index - 17.5) / 18;
        const height = isActive
          ? 6 + (preference.matches ? 30 : Math.random() * 58) * weight
          : 4 + (1 + Math.sin(time / 900 + index / 4)) * 4;
        bar.style.height = `${height}px`;
        bar.style.backgroundColor = isActive ? '#e4a0bd' : '#71688e';
        bar.style.opacity = String(
          isActive && !preference.matches ? 0.4 + Math.random() * 0.6 : 1,
        );
      });
      if (!preference.matches) frame = requestAnimationFrame(draw);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      draw(0);
    };
    start();
    preference.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', start);
    };
  }, [isActive]);
  return (
    <div
      className="mic-visualizer"
      aria-hidden="true"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 3,
        height: 52,
      }}
    >
      {Array.from({ length: 36 }, (_, index) => (
        <div
          key={index}
          ref={(element) => {
            bars.current[index] = element;
          }}
          style={{
            width: 3,
            height: 6,
            borderRadius: 2,
            background: '#374151',
          }}
        />
      ))}
    </div>
  );
}

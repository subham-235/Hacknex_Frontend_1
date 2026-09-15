'use client';
import { useEffect, useRef } from 'react';

export default function LiveTranscript({ transcript, isActive }) {
  const box = useRef(null),
    cursor = useRef(null);
  useEffect(() => {
    if (
      !isActive ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const fade = box.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 250,
    });
    const blink = cursor.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 800,
      iterations: Infinity,
    });
    return () => {
      fade?.cancel();
      blink?.cancel();
    };
  }, [isActive]);
  if (!isActive) return null;
  return (
    <div
      ref={box}
      style={{
        background: '#11192c',
        border: '1px solid #ffffff20',
        borderRadius: 12,
        padding: '10px 14px',
        textAlign: 'left',
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <div style={{ fontSize: 9, color: '#a8b5ce', letterSpacing: 2 }}>
        LIVE TRANSCRIPT
      </div>
      <div
        role="status"
        style={{
          marginTop: 8,
          fontSize: 12,
          lineHeight: '20px',
          maxHeight: 40,
          color: transcript ? '#edf1ff' : '#a8b5ce',
          overflow: 'hidden',
          overflowWrap: 'anywhere',
        }}
      >
        {transcript || 'Listening...'}
        <span ref={cursor} aria-hidden="true">
          {' '}
          ▍
        </span>
      </div>
    </div>
  );
}

'use client';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { usePageVisible } from './workspace-pages';

export default function MapVisibility() {
  const map = useMap();
  const visible = usePageVisible();
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    return () => cancelAnimationFrame(frame);
  }, [map, visible]);
  return null;
}

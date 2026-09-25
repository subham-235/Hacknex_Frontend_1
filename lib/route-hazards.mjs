const EARTH_METERS = 6371000;

export function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const x = dLon * Math.cos(((a.latitude + b.latitude) / 2) * rad);
  return EARTH_METERS * Math.hypot(dLat, x);
}

function segmentDistanceMeters(point, start, end) {
  const rad = Math.PI / 180;
  const scale = EARTH_METERS * rad;
  const cosine = Math.cos((point.latitude * Math.PI) / 180);
  const ax = (start.longitude - point.longitude) * scale * cosine;
  const ay = (start.latitude - point.latitude) * scale;
  const bx = (end.longitude - point.longitude) * scale * cosine;
  const by = (end.latitude - point.latitude) * scale;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function hazardsAlongRoute(route, points, radiusMeters = 800) {
  if (!Array.isArray(route) || route.length < 2) return [];
  return points
    .map(([latitude, longitude, intensity], index) => ({
      id: `${latitude}:${longitude}`,
      latitude,
      longitude,
      intensity: Number(intensity) || 0,
      radiusMeters,
      sourceIndex: index,
    }))
    .filter((hazard) => {
      for (let index = 1; index < route.length; index++) {
        if (segmentDistanceMeters(hazard, route[index - 1], route[index]) <= radiusMeters) return true;
      }
      return false;
    });
}

export function hazardsAtLocation(location, hazards) {
  if (!location) return [];
  return hazards
    .map((hazard) => ({ ...hazard, distanceMeters: Math.round(distanceMeters(location, hazard)) }))
    .filter((hazard) => hazard.distanceMeters <= hazard.radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

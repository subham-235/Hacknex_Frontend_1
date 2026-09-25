'use client';
import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapVisibility from './map-visibility';
export type MapPoint = { latitude: number; longitude: number };
export type RouteHazard = MapPoint & {
  id: string;
  intensity: number;
  radiusMeters: number;
};
type Props = {
  current?: MapPoint;
  destination?: MapPoint;
  route?: MapPoint[];
  radius?: number;
  onPick?: (point: MapPoint) => void;
  hazards?: RouteHazard[];
};
function View({ current, destination, route = [], onPick }: Props) {
  const map = useMap();
  const signature = JSON.stringify(
    route.length
      ? route
      : destination
        ? [destination, ...(current ? [current] : [])]
        : current
          ? [current]
          : [],
  );
  useEffect(() => {
    const points = JSON.parse(signature) as MapPoint[];
    if (points.length > 1)
      map.fitBounds(
        points.map((p) => [p.latitude, p.longitude]),
        { padding: [45, 45], maxZoom: 16 },
      );
    else if (points[0])
      map.setView([points[0].latitude, points[0].longitude], 15);
  }, [map, signature]);
  useMapEvents({
    click: (e) => onPick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng }),
  });
  return null;
}
export default function JourneyMap(props: Props) {
  const { current, destination, route = [], radius = 150, hazards = [] } = props;
  const center = current ||
    destination || { latitude: 22.5726, longitude: 88.3639 };
  const positions = route.map(
    (p) => [p.latitude, p.longitude] as [number, number],
  );
  return (
    <MapContainer
      className="journey-map"
      center={[center.latitude, center.longitude]}
      zoom={12}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <View {...props} />
      <MapVisibility />
      {positions.length > 1 && (
        <>
          <Polyline
            positions={positions}
            pathOptions={{ color: '#fff', weight: 9, opacity: 0.85 }}
          />
          <Polyline
            positions={positions}
            pathOptions={{ color: '#7054d8', weight: 5, opacity: 1 }}
          />
        </>
      )}
      {hazards.map((hazard) => (
        <Circle
          key={hazard.id}
          center={[hazard.latitude, hazard.longitude]}
          radius={hazard.radiusMeters}
          pathOptions={{
            color: '#ef8354',
            weight: 2,
            dashArray: '6 6',
            fillColor: '#ef8354',
            fillOpacity: 0.18 + Math.min(hazard.intensity, 1) * 0.12,
          }}
        >
          <Popup>Reported unsafe area<br />Approximate community report zone</Popup>
        </Circle>
      ))}
      {destination && (
        <>
          <Circle
            center={[destination.latitude, destination.longitude]}
            radius={radius}
            pathOptions={{ color: '#7054d8', weight: 2, fillOpacity: 0.12 }}
          />
          <CircleMarker
            center={[destination.latitude, destination.longitude]}
            radius={9}
            pathOptions={{
              color: '#fff',
              weight: 3,
              fillColor: '#7054d8',
              fillOpacity: 1,
            }}
          >
            <Popup>Your destination · arrival zone</Popup>
          </CircleMarker>
        </>
      )}
      {current && (
        <CircleMarker
          center={[current.latitude, current.longitude]}
          radius={8}
          pathOptions={{
            color: '#fff',
            weight: 3,
            fillColor: '#208ce8',
            fillOpacity: 1,
          }}
        >
          <Popup>Your latest location</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}

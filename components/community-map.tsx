'use client';
import { useEffect } from 'react';
import { divIcon } from 'leaflet';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapVisibility from './map-visibility';
type Point = [number, number];
const pin = divIcon({
  className: 'report-map-pin',
  html: '<span></span>',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});
function Selection({
  selected,
  onSelect,
  disabled,
}: {
  selected: Point | null;
  onSelect: (point: Point) => void;
  disabled: boolean;
}) {
  const map = useMapEvents({
    click(event) {
      if (!disabled) {
        const point = event.latlng.wrap();
        onSelect([Math.max(-90, Math.min(90, point.lat)), point.lng]);
      }
    },
  });
  const latitude = selected?.[0],
    longitude = selected?.[1];
  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined)
      map.panTo([latitude, longitude]);
  }, [map, latitude, longitude]);
  return selected ? (
    <Marker
      position={selected}
      icon={pin}
      draggable={!disabled}
      title="Selected report location. Drag to adjust."
      eventHandlers={{
        dragend(event) {
          const point = event.target.getLatLng().wrap();
          onSelect([Math.max(-90, Math.min(90, point.lat)), point.lng]);
        },
      }}
    />
  ) : null;
}
export default function CommunityMap({
  points,
  selected,
  onSelect,
  disabled = false,
}: {
  points: number[][];
  selected: Point | null;
  onSelect: (point: Point) => void;
  disabled?: boolean;
}) {
  return (
    <MapContainer
      center={points[0] ? [points[0][0], points[0][1]] : [22.5726, 88.3639]}
      zoom={13}
      scrollWheelZoom={false}
      className="community-map"
    >
      <MapVisibility />
      <Selection selected={selected} onSelect={onSelect} disabled={disabled} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p[0], p[1]]}
          radius={9 + Math.min(p[2] || 1, 5) * 2}
          pathOptions={{
            color: '#d77958',
            fillColor: '#df8b69',
            fillOpacity: 0.3,
            weight: 1,
          }}
        >
          <Popup>
            Reported incident
            <br />
            Intensity: {p[2]}
            <br />
            {p[0].toFixed(4)}, {p[1].toFixed(4)}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

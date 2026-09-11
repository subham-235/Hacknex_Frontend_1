'use client';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
export default function CommunityMap({ points }: { points: number[][] }) {
  return (
    <MapContainer
      center={points[0] ? [points[0][0], points[0][1]] : [22.5726, 88.3639]}
      zoom={13}
      scrollWheelZoom={false}
      className="community-map"
    >
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

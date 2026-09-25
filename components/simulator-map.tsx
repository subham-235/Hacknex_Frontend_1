'use client';
import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Polyline,
  Polygon,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapVisibility from './map-visibility';
type Point = { latitude: number; longitude: number };
type SimulatorData = {
  run: { previousCenter?: Point };
  route: Point[];
  config: { tolerance: number; destinationRadius: number };
  routeDistanceMeters?: number | null;
  session?: {
    latestVictimLocation?: Point;
    emergencyGeofence?: { center: Point; radiusMeters: number };
    responderTracking?: { fresh: boolean; distanceMeters: number };
    activeResponder?: { lastLocation?: Point };
  } | null;
  journey?: {
    currentLocation: Point;
    routeDeviationDetected?: boolean;
    checkInState?: string;
  } | null;
};
const latlng = (p: Point): [number, number] => [p.latitude, p.longitude];
function Bounds({ center, radius }: { center: Point; radius: number }) {
  const map = useMap();
  useEffect(() => {
    const d = Math.max(radius, 140) / 111195;
    map.fitBounds(
      [
        [
          center.latitude - d,
          center.longitude - d / Math.cos((center.latitude * Math.PI) / 180),
        ],
        [
          center.latitude + d,
          center.longitude + d / Math.cos((center.latitude * Math.PI) / 180),
        ],
      ],
      {
        padding: [35, 35],
        maxZoom: 17,
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        duration: 1,
      },
    );
  }, [map, center.latitude, center.longitude, radius]);
  return null;
}
export default function SimulatorMap({ data }: { data: SimulatorData }) {
  const s = data.session,
    j = data.journey;
  const victim = s?.latestVictimLocation || j?.currentLocation || data.route[0];
  const responder = s?.activeResponder?.lastLocation;
  const previousVictim = s && data.run.previousCenter;
  const fence = s?.emergencyGeofence;
  const route: Point[] = data.route;
  const width =
    data.config.tolerance /
    (111195 * Math.cos((route[0].latitude * Math.PI) / 180));
  const corridor: [number, number][] = [
    [route[0].latitude, route[0].longitude - width],
    [route.at(-1)!.latitude, route.at(-1)!.longitude - width],
    [route.at(-1)!.latitude, route.at(-1)!.longitude + width],
    [route[0].latitude, route[0].longitude + width],
  ];
  return (
    <MapContainer
      className="journey-map"
      center={latlng(victim)}
      zoom={14}
      scrollWheelZoom={false}
    >
      <MapVisibility />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Bounds
        center={fence?.center || victim}
        radius={
          responder && s?.responderTracking?.fresh
            ? Math.max(s.responderTracking.distanceMeters * 1.15, 140)
            : fence?.radiusMeters || 2200
        }
      />
      <Polygon
        positions={corridor}
        pathOptions={{ color: '#7054d8', weight: 1, fillOpacity: 0.12 }}
      />
      {[route[0], route.at(-1)!].map((p, i) => (
        <Circle
          key={i}
          center={latlng(p)}
          radius={data.config.tolerance}
          pathOptions={{ color: '#7054d8', weight: 1, fillOpacity: 0.12 }}
        />
      ))}
      <Polyline
        positions={route.map(latlng)}
        pathOptions={{ color: '#7054d8', weight: 4 }}
      />
      {j?.routeDeviationDetected && (
        <Polyline
          positions={[
            latlng(victim),
            [
              Math.max(
                route[0].latitude,
                Math.min(route.at(-1)!.latitude, victim.latitude),
              ),
              route[0].longitude,
            ],
          ]}
          pathOptions={{ color: '#e99065', weight: 3, dashArray: '6 8' }}
        >
          <Tooltip>
            Distance from the planned route:{' '}
            {Math.round(data.routeDistanceMeters || 0)} m
          </Tooltip>
        </Polyline>
      )}
      <Circle
        center={latlng(route.at(-1)!)}
        radius={data.config.destinationRadius}
        pathOptions={{ color: '#23824f' }}
      >
        <Popup>Destination · {data.config.destinationRadius} m</Popup>
      </Circle>
      {fence && (
        <Circle
          center={latlng(fence.center)}
          radius={fence.radiusMeters}
          pathOptions={{ color: '#dc3545', fillOpacity: 0.08 }}
        >
          <Popup>Backend emergency geofence</Popup>
        </Circle>
      )}
      {previousVictim && (
        <>
          <CircleMarker
            center={latlng(previousVictim)}
            radius={7}
            pathOptions={{ color: '#e99065', fillOpacity: 0.25, dashArray: '4 4' }}
          >
            <Tooltip direction="left">Previous victim location</Tooltip>
          </CircleMarker>
          <Polyline
            positions={[latlng(previousVictim), latlng(victim)]}
            pathOptions={{ color: '#e99065', weight: 3, dashArray: '7 8' }}
          >
            <Tooltip>Victim moved · emergency area recalculated</Tooltip>
          </Polyline>
        </>
      )}
      <CircleMarker
        center={latlng(victim)}
        radius={9}
        pathOptions={{ color: '#dc3545', fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -10]}>
          {j && !s
            ? j.checkInState === 'safe'
              ? 'Checked in safely'
              : j.routeDeviationDetected
                ? 'Off route — safety check'
                : 'Person on journey'
            : 'Person needing help'}
        </Tooltip>
        <Popup>Victim — SIMULATED GPS</Popup>
      </CircleMarker>
      {responder && (
        <CircleMarker
          center={latlng(responder)}
          radius={9}
          pathOptions={{ color: '#168047', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            Responder
            {s?.responderTracking?.fresh
              ? ` · ${s.responderTracking.distanceMeters} m`
              : ''}
          </Tooltip>
          <Popup>Responder — SIMULATED GPS</Popup>
        </CircleMarker>
      )}
      {responder && (
        <Polyline
          positions={[latlng(victim), latlng(responder)]}
          pathOptions={{
            color: '#168047',
            weight: 2,
            dashArray: '5 8',
            opacity: 0.7,
          }}
        >
          <Tooltip>Straight-line distance, not a travel route</Tooltip>
        </Polyline>
      )}
    </MapContainer>
  );
}

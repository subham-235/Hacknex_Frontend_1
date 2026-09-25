'use client';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  MapPin,
  LocateFixed,
  Route,
  Navigation,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Status } from './shared';
import { api, useApp } from './app-provider';
import {
  LocationSharing,
  currentPosition,
  payload,
  useGeoRefresh,
} from './rescue-panel';
import type { MapPoint, RouteHazard } from './journey-map';
import { hazardsAlongRoute, hazardsAtLocation } from '@/lib/route-hazards.mjs';
import { usePageVisible } from './workspace-pages';
const Map = lazy(() => import('./journey-map'));
type Place = MapPoint & { id: string; label: string };
type Preview = {
  route: MapPoint[];
  distanceMeters: number;
  estimatedDurationSeconds: number;
  travelMode: 'driving';
  destinationRadiusMeters: number;
  corridorToleranceMeters: number;
  routeMode?: 'normal' | 'safer';
  detourRouteSelected?: boolean;
  alternativeRoutesConsidered?: number;
  reportedAreasOnRoute?: number;
  reportedAreasAvoided?: number;
};
type Journey = {
  _id: string;
  open: boolean;
  status: string;
  checkInState: string;
  checkInDueAt?: string;
  autoSosEnabled?: boolean;
  sosState?: string;
  routeDeviationDetected: boolean;
  destination: MapPoint;
  destinationLabel?: string;
  currentLocation?: MapPoint;
  route?: MapPoint[];
  destinationRadiusMeters?: number;
  expectedArrivalAt?: string;
  travelMode?: string;
  routingPreference?: 'normal' | 'safer';
  locationFresh?: boolean;
  locationPrecise?: boolean;
  locationAgeSeconds?: number;
  destinationDistanceMeters?: number | null;
};
function JourneySosStatus({ journey }: { journey: Journey }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.ceil((new Date(journey.checkInDueAt || '').getTime() - now) / 1000),
  );
  const messages: Record<string, string> = {
    sending:
      'Automatic SOS is being submitted. Confirming you are safe now cannot recall messages already being sent.',
    accepted:
      'Automatic SOS was accepted by the SMS provider for all contacts. Delivery and help are not yet confirmed.',
    partial:
      'Some SOS messages were accepted; others failed or could not be confirmed.',
    failed:
      'Automatic SOS failed. Open Emergency SOS or contact help directly.',
    unknown:
      'Automatic SOS submission could not be confirmed. Contact help directly if needed.',
    no_contacts:
      'An SOS session was created, but no active trusted contacts were available for SMS.',
  };
  if (journey.sosState && messages[journey.sosState])
    return (
      <p role="alert" className="notice">
        {messages[journey.sosState]} <a href="#agent">Open Safety agent</a>
      </p>
    );
  if (
    !journey.autoSosEnabled ||
    !journey.open ||
    !['pending', 'unanswered'].includes(journey.checkInState)
  )
    return null;
  return (
    <div className="notice">
      <p role="alert">
        Are you safe? If you do not check in before the deadline, an automatic
        SOS will be sent to your active trusted contacts with your last known
        location.
      </p>
      <p>
        {seconds > 0
          ? `Time remaining: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
          : 'Check-in deadline passed. Waiting for the server to start SOS.'}
      </p>
      <p>
        End the journey if you have arrived, continue monitoring if traffic has
        delayed you, or{' '}
        <a href="#sos">open Emergency SOS</a> for help now.
      </p>
    </div>
  );
}
export default function JourneyPanel() {
  const visible = usePageVisible();
  const locationRequest = useRef<AbortController | null>(null);
  const { demo, user, notify } = useApp();
  useGeoRefresh();
  const [mounted, setMounted] = useState(false),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(''),
    [places, setPlaces] = useState<Place[]>([]),
    [searching, setSearching] = useState(false),
    [searched, setSearched] = useState(false);
  const [destination, setDestination] = useState<Place>(),
    [origin, setOrigin] = useState<MapPoint>(),
    [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState(''),
    [arrival, setArrival] = useState('');
  const [routeMode, setRouteMode] = useState<'normal' | 'safer'>('normal');
  const [routeFeedback, setRouteFeedback] = useState('');
  const [startedHere, setStartedHere] = useState(false);
  const [ending, setEnding] = useState(false);
  const [completed, setCompleted] = useState<Journey>();
  const previousJourney = useRef<string | undefined>(undefined);
  const warnedHazards = useRef(new Set<string>());
  const generation = useRef(0),
    searchGeneration = useRef(0);
  const cancelPendingWork = useCallback(() => {
    locationRequest.current?.abort();
    generation.current++;
    searchGeneration.current++;
  }, []);
  useEffect(() => {
    if (!visible) {
      cancelPendingWork();
      setBusy(false);
      setSearching(false);
    }
  }, [visible, cancelPendingWork]);
  useEffect(() => {
    setMounted(true);
    return cancelPendingWork;
  }, [cancelPendingWork]);
  useEffect(() => {
    generation.current++;
    searchGeneration.current++;
    setOrigin(undefined);
    setDestination(undefined);
    setPreview(undefined);
    setPlaces([]);
    setSearch('');
    setError('');
    setRouteFeedback('');
    setBusy(false);
  }, [user?._id, demo]);
  const query = useQuery({
    queryKey: ['coordination', 'journeys', user?._id],
    enabled: !demo && !!user,
    queryFn: async () => (await api('/agent/journeys')).journeys as Journey[],
    refetchInterval: 10000,
  });
  const journey = query.data?.find((j) => j.open);
  const incidents = useQuery({
    queryKey: ['heatmap'],
    queryFn: () => api('/incident/heatmap'),
    enabled: !demo && visible,
    retry: false,
    refetchInterval: journey ? 60000 : false,
  });
  const displayedRoute = useMemo(
    () => journey?.route || preview?.route || [],
    [journey?.route, preview?.route],
  );
  const routeHazards = useMemo(
    () =>
      hazardsAlongRoute(
        displayedRoute,
        incidents.data?.heatmapPoints || [],
        incidents.data?.areaRadiusMeters || 800,
      ) as RouteHazard[],
    [displayedRoute, incidents.data],
  );
  const nearbyHazards = useMemo(
    () =>
      journey?.locationFresh
        ? hazardsAtLocation(journey.currentLocation, routeHazards)
        : [],
    [journey?.currentLocation, journey?.locationFresh, routeHazards],
  );
  useEffect(() => {
    warnedHazards.current.clear();
  }, [journey?._id]);
  useEffect(() => {
    if (!journey?.open || !journey.locationFresh) return;
    const hazard = nearbyHazards.find(
      (item: RouteHazard & { distanceMeters: number }) =>
        !warnedHazards.current.has(item.id),
    );
    if (!hazard) return;
    warnedHazards.current.add(hazard.id);
    notify(
      'Unsafe place ahead. You are entering an approximate community-reported area. Please stay alert and be safe.',
    );
  }, [journey?.open, journey?.locationFresh, nearbyHazards, notify]);
  useEffect(() => {
    if (previousJourney.current && !journey && query.data) {
      const finished = query.data.find(
        (j) => j._id === previousJourney.current,
      );
      if (finished && !finished.open) {
        setCompleted(finished);
        setStartedHere(false);
        setEnding(false);
        setPreview(undefined);
      }
    }
    previousJourney.current = journey?._id;
  }, [journey, query.data]);
  async function findPlaces() {
    const run = ++searchGeneration.current;
    if (search.trim().length < 3) {
      setError('Enter at least three characters, including a city if needed.');
      return;
    }
    setSearching(true);
    setError('');
    setRouteFeedback('');
    setPlaces([]);
    setSearched(false);
    try {
      const data = await api(
        `/agent/journeys/places?q=${encodeURIComponent(search.trim())}`,
      );
      if (run === searchGeneration.current) {
        setPlaces(data.places);
        setSearched(true);
      }
    } catch (e) {
      if (run === searchGeneration.current) setError((e as Error).message);
    } finally {
      if (run === searchGeneration.current) setSearching(false);
    }
  }
  function choose(place: Place) {
    generation.current++;
    searchGeneration.current++;
    setDestination(place);
    setSearch(place.label);
    setPlaces([]);
    setSearched(false);
    setSearching(false);
    setPreview(undefined);
    setArrival('');
    setError('');
  }
  async function getRoute() {
    if (!destination) return;
    const run = ++generation.current;
    setBusy(true);
    setPreview(undefined);
    setError('');
    setRouteFeedback('Finding your current location…');
    try {
      locationRequest.current = new AbortController();
      // A coarse desktop fix is sufficient to preview a route. Starting the
      // monitored journey below still requires the configured precise fix.
      const p = await currentPosition(locationRequest.current.signal, {
        journeyAccuracy: true,
        timeout: 15000,
      });
      if (run !== generation.current) return;
      const start = payload(p);
      setOrigin(start);
      setRouteFeedback(
        routeMode === 'safer'
          ? 'Location found. Comparing alternative routes with reported unsafe areas…'
          : 'Location found. Calculating the driving route…',
      );
      const result = await api('/agent/journeys/route', {
        method: 'POST',
        body: { start, destination, routeMode },
        timeout: 15000,
      });
      if (run === generation.current) {
        setPreview(result);
        const safetyMessage =
          result.routeMode === 'safer'
            ? result.reportedAreasOnRoute === 0
              ? ` Safer mode ${result.detourRouteSelected ? 'created a detour' : 'found a route'} clear of the reported areas after comparing ${result.alternativeRoutesConsidered} route${result.alternativeRoutesConsidered === 1 ? '' : 's'}.`
              : ` After comparing ${result.alternativeRoutesConsidered} route${result.alternativeRoutesConsidered === 1 ? '' : 's'}, this is the lowest-exposure route found, but it still crosses ${result.reportedAreasOnRoute} reported ${result.reportedAreasOnRoute === 1 ? 'area' : 'areas'}.`
            : '';
        setRouteFeedback(
          `Route ready from your current location (${Math.round(p.coords.accuracy)} m location accuracy).${safetyMessage}`,
        );
      }
    } catch (e) {
      if (run === generation.current) {
        const message = (e as Error).message;
        setError(message);
        setRouteFeedback(`Could not show the route: ${message}`);
      }
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }
  async function startJourney() {
    if (!destination || !preview || !origin) return;
    if (
      arrival &&
      (!Number.isFinite(+new Date(arrival)) ||
        +new Date(arrival) <= Date.now() ||
        +new Date(arrival) > Date.now() + 86400000)
    ) {
      setError(
        'Choose an arrival time in the next 24 hours, or leave it blank to use the route estimate.',
      );
      return;
    }
    const run = ++generation.current;
    setBusy(true);
    setError('');
    setRouteFeedback('Starting your journey from the captured location…');
    try {
      await api('/agent/journeys', {
        method: 'POST',
        body: {
          startLocation: origin,
          destination,
          destinationLabel: destination.label,
          travelMode: preview.travelMode,
          routingPreference: preview.routeMode || 'normal',
          route: preview.route,
          expectedArrivalAt: arrival
            ? new Date(arrival).toISOString()
            : new Date(
                Date.now() +
                  Math.max(300, preview.estimatedDurationSeconds) * 1000,
              ).toISOString(),
        },
      });
      if (run === generation.current) {
        setStartedHere(true);
        setCompleted(undefined);
        await query.refetch();
        setRouteFeedback('');
        notify(
          'Journey started. Keep this page open for live location updates.',
        );
      }
    } catch (e) {
      if (run === generation.current) {
        const message = (e as Error).message;
        setError(message);
        setRouteFeedback(`Could not start the journey: ${message}`);
      }
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }
  async function close(action: string) {
    setBusy(true);
    try {
      await api(`/agent/journeys/${journey?._id}/checkin`, {
        method: 'POST',
        body: { action },
      });
      await query.refetch();
      setPreview(undefined);
      setEnding(false);
      if (action === 'continue') {
        notify(
          'Safety confirmed. Your journey is still active and monitoring will continue.',
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card journey-planner journey-studio">
      <div className="section-heading journey-heading">
        <div>
          <p className="eyebrow">YOUR ROUTE, YOUR PEACE OF MIND</p>
          <h2>
            {journey ? 'Your journey is active' : 'Where are you heading?'}
          </h2>
          <p>
            {journey
              ? 'Follow your planned route and keep your location up to date.'
              : 'Search for a place, preview your route, then start monitoring.'}
          </p>
        </div>
        <span className="badge">
          <Navigation size={14} />{' '}
          {journey?.routingPreference === 'safer' ||
          (!journey && routeMode === 'safer')
            ? 'Safer driving route'
            : 'Driving route'}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {query.error && (
        <p className="error" role="alert">
          {query.error.message}
        </p>
      )}
      {completed && !journey && (
        <div className="journey-completion" role="status">
          <JourneySosStatus
            journey={
              query.data?.find((j) => j._id === completed._id) || completed
            }
          />
          <strong>
            {completed.status === 'arrived'
              ? 'You reached your destination'
              : completed.checkInState === 'safe'
                ? 'You checked in safely'
                : 'Journey cancelled'}
          </strong>
          <p>
            {completed.destinationLabel || 'Your journey'} — monitoring has
            ended.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setCompleted(undefined);
              setDestination(undefined);
              setPreview(undefined);
              setSearch('');
              setArrival('');
            }}
          >
            Plan another journey
          </Button>
        </div>
      )}
      {!journey && (
        <ol className="journey-steps" aria-label="Journey setup">
          <li className={!destination ? 'current' : 'complete'}><span>01</span><div><strong>Choose destination</strong><small>Search or pin a place</small></div></li>
          <li className={destination && !preview ? 'current' : preview ? 'complete' : ''}><span>02</span><div><strong>Preview route</strong><small>Compare your options</small></div></li>
          <li className={preview ? 'current' : ''}><span>03</span><div><strong>Start monitoring</strong><small>Share live location</small></div></li>
        </ol>
      )}
      <div className="journey-planner-grid">
        <div className="journey-controls">
          {journey ? (
            <>
              <Status value={journey.status} />
              <div className="journey-route-summary" aria-live="polite">
                <div>
                  <strong>
                    {journey.destinationDistanceMeters == null
                      ? '—'
                      : `${(journey.destinationDistanceMeters / 1000).toFixed(1)} km`}
                  </strong>
                  <span>Straight-line distance to destination</span>
                </div>
                <div>
                  <strong>
                    {journey.locationFresh ? 'Recent' : 'Outdated'}
                  </strong>
                  <span>
                    Last GPS update{' '}
                    {journey.locationAgeSeconds == null
                      ? 'unavailable'
                      : `${journey.locationAgeSeconds}s ago`}
                  </span>
                </div>
              </div>
              {!journey.locationFresh && (
                <p className="notice">
                  Your position is out of date. Resume location sharing below to
                  update your journey.
                </p>
              )}
              {journey.locationFresh && !journey.locationPrecise && (
                <p className="notice">
                  Tracking is active with an approximate location. Keep location
                  sharing on while the app looks for a more precise GPS reading.
                </p>
              )}
              <h3>
                <MapPin size={18} />{' '}
                {journey.destinationLabel || 'Selected destination'}
              </h3>
              {journey.expectedArrivalAt && (
                <p>
                  Expected arrival:{' '}
                  {new Date(journey.expectedArrivalAt).toLocaleString()}
                </p>
              )}
              {journey.routeDeviationDetected && (
                <p role="alert" className="notice">
                  You have remained outside your planned route.
                </p>
              )}
              <JourneySosStatus journey={journey} />
              {!journey.autoSosEnabled &&
                ['pending', 'unanswered'].includes(journey.checkInState) && (
                  <p role="alert" className="notice">
                    Are you safe? Confirm below to end this journey safely, or
                    open Emergency SOS if you need help.
                  </p>
                )}
              {routeHazards.length > 0 && (
                <div
                  className={`journey-hazard-summary ${nearbyHazards.length ? 'is-nearby' : ''}`}
                  role={nearbyHazards.length ? 'alert' : 'status'}
                >
                  <ShieldAlert size={20} />
                  <div>
                    <strong>
                      {nearbyHazards.length
                        ? 'Unsafe place nearby — please be careful'
                        : `${routeHazards.length} reported unsafe ${routeHazards.length === 1 ? 'area' : 'areas'} along this route`}
                    </strong>
                    <p>
                      {nearbyHazards.length
                        ? `You are approximately ${nearbyHazards[0].distanceMeters} m from a community-reported area.`
                        : 'Orange zones on the map show approximate community reports.'}
                    </p>
                  </div>
                </div>
              )}
              <LocationSharing
                key={journey._id}
                path={`/agent/journeys/${journey._id}/location`}
                active={journey.open}
                autoStart={startedHere}
                journeyAccuracy
              />
              <p className="fine">
                Arrival is confirmed automatically when a precise GPS reading
                places you inside the destination zone. You can also confirm you
                are safe below.
              </p>
              <div className="actions">
                <Button disabled={busy} onClick={() => close('safe')}>
                  I’m safe — end journey
                </Button>
                {['pending', 'unanswered'].includes(journey.checkInState) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => close('continue')}
                  >
                    I’m safe — continue journey
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEnding(true)}
                >
                  Cancel journey
                </Button>
              </div>
              {ending && (
                <div className="notice">
                  <p>End monitoring without confirming that you are safe?</p>
                  <div className="actions">
                    <Button disabled={busy} onClick={() => close('cancel')}>
                      Yes, cancel journey
                    </Button>
                    <Button variant="outline" onClick={() => setEnding(false)}>
                      Keep monitoring
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="journey-origin">
                <span className="journey-origin-dot" />
                <div>
                  <strong>Your current location</strong>
                  <small>
                    {origin
                      ? 'Location captured for your route'
                      : 'Used when you preview the route'}
                  </small>
                </div>
                <LocateFixed size={18} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void findPlaces();
                }}
              >
                <Field label="Where to?">
                  <div className="journey-search">
                    <Search size={18} />
                    <Input
                      name="destination"
                      placeholder="Search a place, address or landmark"
                      value={search}
                      maxLength={160}
                      disabled={demo || busy}
                      onChange={(e) => {
                        searchGeneration.current++;
                        generation.current++;
                        setSearch(e.target.value);
                        setDestination(undefined);
                        setPreview(undefined);
                        setPlaces([]);
                        setSearched(false);
                        setSearching(false);
                      }}
                    />
                    <Button
                      type="submit"
                      disabled={
                        demo || busy || searching || search.trim().length < 3
                      }
                    >
                      {searching ? 'Searching…' : 'Search'}
                    </Button>
                  </div>
                </Field>
              </form>
              {places.length > 0 && (
                <ul className="journey-results" aria-label="Matching places">
                  {places.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => choose(p)}>
                        <MapPin size={18} />
                        <span>{p.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searched && places.length === 0 && (
                <p role="status" className="fine">
                  No places found. Add a city or choose a point on the map.
                </p>
              )}
              {destination && (
                <div className="journey-selected">
                  <MapPin size={18} />
                  <span>{destination.label}</span>
                </div>
              )}
              <fieldset className="journey-route-modes" disabled={demo || busy}>
                <legend>Choose route mode</legend>
                <label className={routeMode === 'normal' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="route-mode"
                    value="normal"
                    checked={routeMode === 'normal'}
                    onChange={() => {
                      setRouteMode('normal');
                      setPreview(undefined);
                      setRouteFeedback('');
                    }}
                  />
                  <Navigation size={17} />
                  <span>
                    <strong>Normal route</strong>
                    <small>
                      Use the usual route and keep existing safety alerts.
                    </small>
                  </span>
                </label>
                <label className={routeMode === 'safer' ? 'is-selected' : ''}>
                  <input
                    type="radio"
                    name="route-mode"
                    value="safer"
                    checked={routeMode === 'safer'}
                    onChange={() => {
                      setRouteMode('safer');
                      setPreview(undefined);
                      setRouteFeedback('');
                    }}
                  />
                  <ShieldAlert size={17} />
                  <span>
                    <strong>Safer route</strong>
                    <small>
                      Compare alternatives and reduce exposure to reported areas.
                    </small>
                  </span>
                </label>
              </fieldset>
              <Button
                variant="outline"
                type="button"
                disabled={demo || busy || !destination}
                onClick={() => void getRoute()}
              >
                <Route size={17} />
                {busy
                  ? 'Preparing route…'
                  : preview
                    ? 'Refresh route'
                    : routeMode === 'safer'
                      ? 'Find safer route from my location'
                      : 'Show route from my location'}
              </Button>
              {routeFeedback && (
                <p
                  className={
                    preview
                      ? 'journey-route-feedback'
                      : 'journey-route-feedback is-error'
                  }
                  role={preview ? 'status' : 'alert'}
                  aria-live="polite"
                >
                  {routeFeedback}
                </p>
              )}
              {preview && (
                <div className="journey-route-summary" aria-live="polite">
                  <div>
                    <strong>
                      {(preview.distanceMeters / 1000).toFixed(1)} km
                    </strong>
                    <span>Route distance</span>
                  </div>
                  <div>
                    <strong>
                      {Math.max(
                        1,
                        Math.ceil(preview.estimatedDurationSeconds / 60),
                      )}{' '}
                      min
                    </strong>
                    <span>Estimated drive</span>
                  </div>
                </div>
              )}
              <Field label="Change expected arrival (optional)">
                <Input
                  type="datetime-local"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                  disabled={demo || busy}
                />
              </Field>
              <p className="fine">
                {arrival
                  ? 'Your selected arrival time will be used for safety check-ins.'
                  : preview
                    ? `Arrival is estimated ${Math.max(5, Math.ceil(preview.estimatedDurationSeconds / 60))} minutes after you start. Leave this blank to use that estimate.`
                    : 'Preview a route to calculate your expected arrival.'}
              </p>
              <div className="journey-start-bar">
                <Button
                  disabled={
                    demo || busy || !preview || query.isLoading || !!query.error
                  }
                  onClick={() => void startJourney()}
                >
                  {busy
                    ? 'Preparing journey…'
                    : 'Start journey & share location'}
                </Button>
                <p className="fine">
                  Starting shares your GPS location while this page is open.
                  Returning to this page requires you to resume sharing.
                </p>
              </div>
              {demo && (
                <p className="fine">
                  Sign in to search places and start a real journey.
                </p>
              )}
              <p className="fine">
                Search shares the place name with our map provider. Route
                preview uses your location and destination. Driving estimates do
                not include live traffic.
              </p>
            </>
          )}
        </div>
        <div className="journey-map-panel">
          {mounted ? (
            <Suspense
              fallback={
                <div className="journey-map-placeholder">Loading your map…</div>
              }
            >
              <Map
                current={journey?.currentLocation || origin}
                destination={journey?.destination || destination}
                route={journey?.route || preview?.route}
                radius={
                  journey?.destinationRadiusMeters ||
                  preview?.destinationRadiusMeters
                }
                hazards={routeHazards}
                onPick={
                  !journey && !demo && !busy
                    ? (p) =>
                        choose({
                          ...p,
                          id: 'map-pin',
                          label: 'Pinned destination',
                        })
                    : undefined
                }
              />
            </Suspense>
          ) : (
            <div className="journey-map-placeholder">Loading your map…</div>
          )}
          <div className="journey-map-caption">
            <span>
              <i className="journey-current-key" /> Your location
            </span>
            <span>
              <i className="journey-route-key" /> Planned route
            </span>
            <span>Shaded circle: arrival zone</span>
            {routeHazards.length > 0 && (
              <span>
                <i className="journey-hazard-key" /> Reported unsafe area
              </span>
            )}
          </div>
          {!journey && (
            <p className="fine">
              You can also click the map to choose your destination.
            </p>
          )}
          {routeHazards.length > 0 && (
            <p className="fine">
              Community reports are rounded into approximate areas. They are a
              caution signal, not proof that a place is currently dangerous.
            </p>
          )}
          <p className="fine">
            Map data ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>{' '}
            · Search by Photon · Routing by OSRM
          </p>
        </div>
      </div>
      <p className="fine journey-disclaimer">
        A route deviation or overdue arrival requests a safety check. New
        journeys automatically trigger an SOS to active trusted contacts if you
        miss the check-in deadline (5 minutes by default). The alert includes
        your last known location. Keep location sharing on for route monitoring.
        Once a check-in is pending, closing this page does not cancel its
        server-side deadline. The backend and worker must stay running.
        {journey &&
          !journey.autoSosEnabled &&
          ' This existing journey uses check-in-only mode; start a new journey to enable automatic SOS.'}
      </p>
      {query.data
        ?.filter((j) => !j.open)
        .slice(0, 3)
        .map((j) => (
          <p className="fine journey-previous" key={j._id}>
            Previous journey: {j.destinationLabel || 'Destination'} ·{' '}
            {j.status === 'arrived'
              ? 'Destination reached'
              : j.checkInState === 'safe'
                ? 'Safety confirmed'
                : j.status === 'cancelled'
                  ? 'Cancelled'
                  : j.status}
          </p>
        ))}
    </section>
  );
}

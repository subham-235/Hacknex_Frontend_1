'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { createApi } from '@/lib/api.mjs';
import { sosProgress } from '@/lib/sos-progress.mjs';
import { helpNotification } from '@/lib/help-notification.mjs';
import {
  enableNotificationSound,
  playNotificationSound,
} from '@/lib/notification-sound.mjs';
import { useEmergencyLocation } from '@/hooks/useEmergencyLocation';
import {
  demoContacts,
  demoHistory,
  demoSessions,
  type User,
  type Contact,
  type Alert,
  type Session,
} from '@/lib/models';
export const API_BASE = import.meta.env.VITE_API_URL || '/api';
export const api = createApi(API_BASE);
interface NearbyAlert {
  id: string;
  message: string;
  distance: string;
  mapsLink?: string;
  severity?: string;
  timestamp: number;
}
interface Store {
  demo: boolean;
  user: User | null;
  contacts: Contact[];
  history: Alert[];
  sessions: Session[];
  loading: boolean;
  error: string;
  message: string;
  notify: (s: string) => void;
  refresh: () => Promise<void>;
  setDemo: (v: boolean) => void;
  signIn: (u: User) => void;
  signOut: () => Promise<void>;
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  setHistory: React.Dispatch<React.SetStateAction<Alert[]>>;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  socket: React.RefObject<Socket | null>;
  live: boolean;
  socketError: string;
  nearbyAlerts: NearbyAlert[];
  rescueError: string;
  locationStatus: string;
}
const Context = createContext<Store | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing app provider');
  return value;
}
function StoreProvider({ children }: { children: ReactNode }) {
  const [demo, setDemoState] = useState(true),
    [user, setUser] = useState<User | null>(null),
    [message, setMessage] = useState(''),
    [live, setLive] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [nearbyAlerts, setNearbyAlerts] = useState<NearbyAlert[]>([]);
  const [contacts, setContacts] = useState(demoContacts),
    [history, setHistory] = useState(demoHistory),
    [sessions, setSessions] = useState(demoSessions);
  const socket = useRef<Socket | null>(null);
  const authGeneration = useRef(0);
  const cache = useQueryClient();
  const notify = useCallback((text: string) => {
    setMessage(text);
    if (text) playNotificationSound();
  }, []);
  useEffect(() => {
    const unlock = () => {
      void enableNotificationSound();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  const query = useQuery({
    queryKey: ['workspace', user?._id],
    enabled: !!user && !demo,
    retry: false,
    refetchInterval: 10000,
    queryFn: async () => {
      const [c, h] = await Promise.all([
        api('/contact/list'),
        api('/history/list'),
      ]);
      return {
        contacts: c.contacts as Contact[],
        history: h.history as Alert[],
      };
    },
  });
  // Rescue monitoring outlives the microphone and cannot be blocked by a
  // failed contacts/history request.
  const rescueQuery = useQuery({
    queryKey: ['owned-rescue', user?._id],
    enabled: !!user && !demo,
    queryFn: async () => (await api('/agent/sessions')).sessions as Session[],
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    retry: 1,
  });
  const progressSeen = useRef(new Map<string, string>());
  const activeIds =
    !demo && user
      ? sessions
          .filter((s) => sosProgress(s).active)
          .map((s) => s._id)
          .sort()
      : [];
  const locationStatus = useEmergencyLocation(
    activeIds.length ? JSON.stringify(activeIds) : '',
    api,
  );
  useEffect(() => {
    progressSeen.current.clear();
  }, [user?._id, demo]);
  useEffect(() => {
    if (demo || !rescueQuery.data) return;
    setSessions(rescueQuery.data);
    for (const session of rescueQuery.data) {
      const progress = helpNotification(session);
      const previous = progressSeen.current.get(session._id);
      if (
        previous !== progress.key &&
        (progress.active || previous !== undefined)
      ) {
        notify(progress.message);
      }
      progressSeen.current.set(session._id, progress.key);
    }
  }, [rescueQuery.data, demo, notify]);
  const refresh = useCallback(async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['workspace'] }),
      cache.invalidateQueries({ queryKey: ['owned-rescue'] }),
    ]);
  }, [cache]);
  useEffect(() => {
    if (query.data && !demo) {
      setContacts(query.data.contacts);
      setHistory(query.data.history);
    }
  }, [query.data, demo]);
  useEffect(() => {
    if (!user || demo) return;
    const localSocketOrigin =
      import.meta.env.DEV && API_BASE.startsWith('/')
        ? `${window.location.protocol}//${window.location.hostname}:5000`
        : undefined;
    const connection = io(
      import.meta.env.VITE_SOCKET_URL ||
        localSocketOrigin ||
        (API_BASE.startsWith('/') ? undefined : new URL(API_BASE).origin),
      {
        withCredentials: true,
        // Connect directly in local development so Vite/Cloudflare does not
        // interrupt long-polling requests during rebuilds. WebSocket can fall
        // back to polling if the browser or network blocks the upgrade.
        ...(localSocketOrigin ? { transports: ['websocket', 'polling'] } : {}),
      },
    );
    socket.current = connection;
    connection.on('connect', () => {
      setLive(true);
      setSocketError('');
      connection.emit('register', user._id);
      connection.emit('nearby-sos-sync');
      void refresh();
    });
    connection.on('disconnect', (reason) => {
      console.warn('Notification socket disconnected:', reason);
      setLive(false);
      setSocketError(
        reason === 'io server disconnect'
          ? 'The server ended your connection. Sign in again if your session has expired.'
          : 'Connection lost. Reconnecting to nearby alerts…',
      );
    });
    connection.on('connect_error', (error) => {
      setLive(false);
      setSocketError(
        error.message === 'Authentication required'
          ? 'Notification sign-in failed. Sign out and sign in again, then reconnect.'
          : `Notification connection failed: ${error.message}. Check that the backend is running and reachable.`,
      );
    });
    connection.on('agent-session-updated', () => void refresh());
    connection.on('responder-request-created', () =>
      notify('Emergency nearby. Open Respond to SOS to accept or decline.'),
    );
    connection.on('journey-checkin-required', () =>
      notify(
        'Your journey needs a safety check. Open Safety journey to check in.',
      ),
    );
    connection.on('journey-deviation-detected', () =>
      notify(
        'You moved away from your planned route. Open Safety journey: are you safe?',
      ),
    );
    for (const event of [
      'responder-accepted',
      'responder-declined',
      'responder-assigned',
      'responder-location-updated',
      'responder-nearby',
      'responder-arrival-candidate',
      'responder-arrived',
      'emergency-radius-expanded',
    ]) {
      connection.on(event, (payload) => {
        if (payload?.simulated) return;
        void cache.invalidateQueries({ queryKey: ['owned-rescue'] });
        void cache.invalidateQueries({ queryKey: ['coordination'] });
      });
    }
    connection.on('nearby-sos', (event: NearbyAlert) => {
      const alert = {
        ...event,
        id: event.id || `legacy-${Date.now()}`,
        timestamp: event.timestamp || Date.now(),
      };
      setNearbyAlerts((previous) =>
        previous.some((item) => item.id === alert.id)
          ? previous
          : [alert, ...previous]
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 10),
      );
      if (event.id) connection.emit('nearby-sos-received', event.id);
      void cache.invalidateQueries({ queryKey: ['heatmap'] });
      notify(
        `${event.message} ${event.distance}. Check your surroundings and contact emergency services if needed.`,
      );
    });
    return () => {
      console.info(
        'Notification socket cleanup: account changed, provider unmounted, or development refresh',
      );
      connection.disconnect();
      socket.current = null;
      setLive(false);
      setSocketError('');
    };
  }, [user, demo, refresh, cache, notify]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => notify(''), 9000);
    return () => clearTimeout(timer);
  }, [message, notify]);
  useEffect(() => {
    const generation = authGeneration.current;
    if (sessionStorage.getItem('suraksha-live') === '1') {
      setDemoState(false);
      setContacts([]);
      setHistory([]);
      setSessions([]);
      api('/user/auth', { method: 'POST' })
        .then((data) => {
          if (authGeneration.current === generation) setUser(data.user);
        })
        .catch(() =>
          notify(
            'Please sign in to reconnect. If the backend is offline, you can explore the demo.',
          ),
        );
    }
  }, [notify]);
  function setDemo(value: boolean) {
    authGeneration.current++;
    setDemoState(value);
    setUser(null);
    setNearbyAlerts([]);
    cache.clear();
    setContacts(value ? demoContacts : []);
    setHistory(value ? demoHistory : []);
    setSessions(value ? demoSessions : []);
    sessionStorage.removeItem('suraksha-live');
  }
  function signIn(u: User) {
    setNearbyAlerts([]);
    authGeneration.current++;
    setDemoState(false);
    setUser(u);
    setContacts([]);
    setHistory([]);
    setSessions([]);
    sessionStorage.setItem('suraksha-live', '1');
  }
  async function signOut() {
    await api('/user/logout', { method: 'POST' });
    setDemo(false);
  }
  return (
    <Context.Provider
      value={{
        demo,
        user,
        contacts,
        history,
        sessions,
        loading: query.isFetching,
        error: !demo && query.error ? query.error.message : '',
        message,
        notify,
        refresh,
        setDemo,
        signIn,
        signOut,
        setContacts,
        setHistory,
        setSessions,
        socket,
        live,
        socketError,
        nearbyAlerts,
        rescueError: rescueQuery.error?.message || '',
        locationStatus,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <StoreProvider>{children}</StoreProvider>
    </QueryClientProvider>
  );
}

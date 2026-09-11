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
    [message, notify] = useState(''),
    [live, setLive] = useState(false);
  const [contacts, setContacts] = useState(demoContacts),
    [history, setHistory] = useState(demoHistory),
    [sessions, setSessions] = useState(demoSessions);
  const socket = useRef<Socket | null>(null);
  const authGeneration = useRef(0);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['workspace', user?._id],
    enabled: !!user && !demo,
    retry: false,
    queryFn: async () => {
      const [c, h, s] = await Promise.all([
        api('/contact/list'),
        api('/history/list'),
        api('/agent/sessions'),
      ]);
      return {
        contacts: c.contacts as Contact[],
        history: h.history as Alert[],
        sessions: s.sessions as Session[],
      };
    },
  });
  const refresh = useCallback(async () => {
    await cache.invalidateQueries({ queryKey: ['workspace'] });
  }, [cache]);
  useEffect(() => {
    if (query.data && !demo) {
      setContacts(query.data.contacts);
      setHistory(query.data.history);
      setSessions(query.data.sessions);
    }
  }, [query.data, demo]);
  useEffect(() => {
    if (!user || demo) return;
    const connection = io(
      API_BASE.startsWith('/') ? undefined : new URL(API_BASE).origin,
      { withCredentials: true, reconnectionAttempts: 5 },
    );
    socket.current = connection;
    connection.on('connect', () => {
      setLive(true);
      connection.emit('register', user._id);
    });
    connection.on('disconnect', () => setLive(false));
    connection.on('connect_error', () => setLive(false));
    connection.on('agent-session-updated', () => void refresh());
    connection.on(
      'nearby-sos',
      (event: { message: string; distance: string }) =>
        notify(
          `${event.message} ${event.distance}. Check your surroundings and contact emergency services if needed.`,
        ),
    );
    return () => {
      connection.disconnect();
      socket.current = null;
      setLive(false);
    };
  }, [user, demo, refresh]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => notify(''), 9000);
    return () => clearTimeout(timer);
  }, [message]);
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
  }, []);
  function setDemo(value: boolean) {
    authGeneration.current++;
    setDemoState(value);
    setUser(null);
    cache.clear();
    setContacts(value ? demoContacts : []);
    setHistory(value ? demoHistory : []);
    setSessions(value ? demoSessions : []);
    sessionStorage.removeItem('suraksha-live');
  }
  function signIn(u: User) {
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

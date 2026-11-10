import { useEffect } from 'react';
import { useLocation, useRoutes } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from './lib/auth';
import { isMisconfigured, useSync } from './lib/store';
import { motionTokens } from './lib/motion';
import { TabBar } from './components/Layout';
import { SyncNotice } from './components/SyncNotice';
import Gate, { NotConfigured, SetNewPassword } from './pages/Gate';
import Home from './pages/Home';
import Trips from './pages/Trips';
import TripForm from './pages/TripForm';
import Partners from './pages/Partners';
import EntryForm from './pages/EntryForm';
import More from './pages/More';
import Logins from './pages/Logins';
import Login from './pages/Login';

const routes = [
  { path: '/', element: <Home /> },
  { path: '/trips', element: <Trips /> },
  { path: '/trips/new', element: <TripForm /> },
  { path: '/trips/:id', element: <TripForm key="edit" /> },
  { path: '/partners', element: <Partners /> },
  { path: '/partners/capital/new', element: <EntryForm kind="capital" /> },
  { path: '/partners/capital/:id', element: <EntryForm kind="capital" /> },
  { path: '/partners/expense/new', element: <EntryForm kind="expense" /> },
  { path: '/partners/expense/:id', element: <EntryForm kind="expense" /> },
  { path: '/more', element: <More /> },
  { path: '/more/logins', element: <Logins /> },
  { path: '*', element: <Home /> },
];

const isFormRoute = (path: string) => /^\/(trips|partners\/(capital|expense)|more)\/[^/]+$/.test(path);

export default function App() {
  const { session, loading, recovering } = useAuth();
  const sync = useSync();
  const location = useLocation();
  const element = useRoutes(routes, location);
  const reduce = useReducedMotion();
  const form = isFormRoute(location.pathname);

  useEffect(() => {
    if (!(location.state as { savedId?: string } | null)?.savedId) window.scrollTo(0, 0);
  }, [location.pathname, location.state]);

  if (isMisconfigured) return <NotConfigured />;
  if (loading) return <div className="min-h-dvh bg-shell" />;
  if (!session) return <Login />;
  if (recovering) return <SetNewPassword />;
  if (sync.phase !== 'ready') return <Gate sync={sync} />;

  // Forms rise up from below; tab screens cross-fade in place.
  const y = reduce ? 0 : form ? motionTokens.distance.lg : 0;

  return (
    <div className={`min-h-dvh ${form ? '' : 'pb-[calc(env(safe-area-inset-bottom)+4.5rem)]'}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : form ? motionTokens.distance.md : 0 }}
          transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth }}
        >
          {element}
        </motion.div>
      </AnimatePresence>
      {!form && <TabBar />}
      <SyncNotice />
    </div>
  );
}

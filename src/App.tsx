import { useEffect } from 'react';
import { Navigate, useLocation, useParams, useRoutes } from 'react-router-dom';
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
import Vehicles from './pages/Vehicles';
import VehicleForm from './pages/VehicleForm';
import ItemForm from './pages/ItemForm';
import Expenses from './pages/Expenses';
import ExpenseForm from './pages/ExpenseForm';
import More from './pages/More';
import Logins from './pages/Logins';
import Login from './pages/Login';

const routes = [
  { path: '/', element: <Home /> },
  { path: '/trips', element: <Trips /> },
  { path: '/trips/new', element: <TripForm /> },
  { path: '/trips/:id', element: <TripForm key="edit" /> },
  { path: '/partners', element: <Partners /> },
  { path: '/partners/capital/new', element: <EntryForm /> },
  { path: '/partners/capital/:id', element: <EntryForm key="edit" /> },
  // Older links to partner-paid expenses now open the company expense.
  { path: '/partners/expense/new', element: <Navigate to="/expenses/new" replace /> },
  { path: '/partners/expense/:id', element: <LegacyExpense /> },
  { path: '/vehicles', element: <Vehicles /> },
  { path: '/vehicles/new', element: <VehicleForm /> },
  { path: '/vehicles/:id', element: <VehicleForm key="edit" /> },
  { path: '/vehicles/:vid/items/new', element: <ItemForm /> },
  { path: '/vehicles/:vid/items/:iid', element: <ItemForm key="edit" /> },
  { path: '/expenses', element: <Expenses /> },
  { path: '/expenses/new', element: <ExpenseForm /> },
  { path: '/expenses/:id', element: <ExpenseForm key="edit" /> },
  { path: '/more', element: <More /> },
  { path: '/more/logins', element: <Logins /> },
  { path: '*', element: <Home /> },
];

/** Full-screen forms: no tab bar. */
const isFormRoute = (path: string) => /^\/(trips|partners\/(capital|expense)|more|expenses|vehicles)\/.+$/.test(path);

function LegacyExpense() {
  const { id } = useParams();
  return <Navigate to={`/expenses/${id}`} replace />;
}

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

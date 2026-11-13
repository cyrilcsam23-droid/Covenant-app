import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { CarFront, House, Menu, ReceiptText, Route } from 'lucide-react';
import { springs } from '../lib/motion';

const tabs = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/trips', label: 'Trips', icon: Route, end: false },
  { to: '/vehicles', label: 'Vehicle', icon: CarFront, end: false },
  { to: '/expenses', label: 'Expenses', icon: ReceiptText, end: false },
  { to: '/more', label: 'More', icon: Menu, end: false },
];

export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="on-shell fixed inset-x-0 bottom-0 z-30 border-t border-shell-line bg-shell pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex h-16 flex-col items-center justify-center gap-1 text-[0.72rem] font-semibold tracking-wide transition-colors ${
                  isActive ? 'text-white' : 'text-shell-muted hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-mark"
                      transition={springs.snappy}
                      className="absolute top-0 h-[3px] w-10 rounded-b bg-plate"
                    />
                  )}
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} className={isActive ? 'text-plate' : ''} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Charcoal page header used by the tab screens. */
export function ShellHeader({ children }: { children: ReactNode }) {
  return (
    <header className="on-shell bg-shell px-4 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
      <div className="mx-auto max-w-xl">{children}</div>
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="px-4">
      <div className="mx-auto max-w-xl">{children}</div>
    </div>
  );
}

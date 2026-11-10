import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { actions, useSync } from '../lib/store';
import { motionTokens } from '../lib/motion';

/**
 * Small floating notice for cloud sync: changes waiting for internet, offline,
 * or a change the server refused. Hidden when everything is in sync.
 */
export function SyncNotice() {
  const sync = useSync();
  const reduce = useReducedMotion();
  if (sync.mode !== 'cloud' || sync.phase !== 'ready') return null;

  let tone: 'info' | 'error' = 'info';
  let text: string | null = null;
  if (sync.message) {
    tone = 'error';
    text = sync.message;
  } else if (sync.pending > 0 && sync.offline) {
    text = `No internet. ${sync.pending} ${sync.pending === 1 ? 'change is' : 'changes are'} saved on this phone and will upload automatically.`;
  } else if (sync.pending > 0) {
    text = `Saving ${sync.pending} ${sync.pending === 1 ? 'change' : 'changes'}…`;
  } else if (sync.offline) {
    text = 'No internet. Showing the last saved data.';
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {text && (
          <motion.div
            key={tone + text}
            initial={{ opacity: 0, y: reduce ? 0 : -motionTokens.distance.sm }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -motionTokens.distance.sm }}
            transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth }}
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium shadow-[0_2px_10px_rgba(0,0,0,0.25)] ${
              tone === 'error' ? 'bg-loss text-white' : 'bg-shell-2 text-white ring-1 ring-shell-line'
            }`}
          >
            {tone === 'info' && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-plate" aria-hidden />}
            <span className="min-w-0 flex-1">{text}</span>
            {tone === 'error' && (
              <button
                type="button"
                onClick={() => actions.dismissMessage()}
                className="-mr-1 -mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-white/15"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

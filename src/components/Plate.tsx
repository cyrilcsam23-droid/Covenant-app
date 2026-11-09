import { useEffect, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { motionTokens } from '../lib/motion';
import { money, signedMoney } from '../lib/format';

type Size = 'sm' | 'md' | 'lg';
type Tone = 'gain' | 'loss' | 'zero';

export function Plate({
  children,
  size = 'md',
  tone = 'gain',
  className = '',
  label,
}: {
  children: ReactNode;
  size?: Size;
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  return (
    <span className={`plate plate-${size} ${className}`} data-tone={tone} aria-label={label}>
      {children}
    </span>
  );
}

/** A rupee figure that rolls to its new value whenever it changes. */
export function RollingMoney({ value, signed = false }: { value: number; signed?: boolean }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => (signed ? signedMoney(v) : money(v)));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: motionTokens.duration.slow,
      ease: motionTokens.easing.smooth,
    });
    return () => controls.stop();
  }, [value, reduce, mv]);

  return <motion.span>{text}</motion.span>;
}

/** Profit is a yellow plate; a loss turns the plate red. */
export function ResultPlate({ value, size = 'sm', className = '' }: { value: number; size?: Size; className?: string }) {
  const tone: Tone = value < 0 ? 'loss' : value === 0 ? 'zero' : 'gain';
  const word = value < 0 ? 'Loss' : 'Profit';
  return (
    <Plate size={size} tone={tone} className={className} label={`${word} ${money(Math.abs(value))}`}>
      <RollingMoney value={value} signed />
    </Plate>
  );
}

export function VehiclePlate({ number }: { number: string }) {
  if (!number) return null;
  return (
    <Plate size="sm" className="!min-w-0 tracking-[0.06em]" label={`Vehicle ${number}`}>
      {number.toUpperCase()}
    </Plate>
  );
}

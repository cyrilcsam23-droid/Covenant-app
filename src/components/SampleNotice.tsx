import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

export function SampleNotice() {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl bg-[#e6e6df] px-4 py-3 text-sm text-ink-2">
      <Info size={18} className="mt-0.5 shrink-0" />
      <p>
        You’re looking at <strong className="font-semibold text-ink">sample data</strong>.{' '}
        <Link to="/more" className="font-semibold text-ink underline underline-offset-2">
          Clear it in More
        </Link>{' '}
        when you’re ready to log real trips.
      </p>
    </div>
  );
}

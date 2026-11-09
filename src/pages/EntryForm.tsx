import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { actions, useData } from '../lib/store';
import { EXPENSE_CATEGORIES } from '../lib/types';
import { toNum, todayISO } from '../lib/format';
import { Button, ConfirmButton, Empty, Field, FormBar, MoneyField, TextField } from '../components/ui';

/** Add or edit a capital entry or a partner-paid expense. */
export default function EntryForm({ kind }: { kind: 'capital' | 'expense' }) {
  const { id } = useParams();
  const data = useData();
  const navigate = useNavigate();
  const backTo = kind === 'capital' ? '/partners?tab=capital' : '/partners?tab=expenses';
  // Snapshots keep the form visible while it animates out after a delete.
  const capitalSnap = useRef(kind === 'capital' && id ? data.capital.find((c) => c.id === id) : undefined);
  const expenseSnap = useRef(kind === 'expense' && id ? data.expenses.find((e) => e.id === id) : undefined);
  const capital = (kind === 'capital' && id ? data.capital.find((c) => c.id === id) : undefined) ?? capitalSnap.current;
  const expense = (kind === 'expense' && id ? data.expenses.find((e) => e.id === id) : undefined) ?? expenseSnap.current;
  const existing = capital ?? expense;

  const [partnerId, setPartnerId] = useState(existing?.partnerId ?? '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [category, setCategory] = useState<string>(expense?.category ?? 'Maintenance');
  const [text, setText] = useState(capital?.note ?? expense?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const groupId = useId();
  const catId = useId();

  if (id && !existing) {
    return (
      <>
        <FormBar title="Entry not found" backTo={backTo} />
        <div className="mx-auto max-w-xl p-4">
          <Empty title="This entry no longer exists">It may have been deleted.</Empty>
        </div>
      </>
    );
  }

  const title =
    kind === 'capital' ? (existing ? 'Edit capital' : 'Add capital') : existing ? 'Edit partner expense' : 'Expense paid by a partner';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!partnerId) err.partner = 'Choose which partner.';
    if (!date) err.date = 'Pick a date.';
    if (toNum(amount) <= 0) err.amount = 'Enter an amount above ₹0.';
    if (kind === 'expense' && !text.trim()) err.text = 'Say what it was for, e.g. “Oil change”.';
    setErrors(err);
    if (Object.keys(err).length) return;

    if (kind === 'capital') {
      actions.saveCapital({ partnerId, date, amount: toNum(amount), note: text.trim() }, existing?.id);
    } else {
      actions.saveExpense({ partnerId, date, amount: toNum(amount), category, description: text.trim() }, existing?.id);
    }
    navigate(backTo);
  };

  return (
    <>
      <FormBar title={title} backTo={backTo} />
      <form onSubmit={submit} noValidate className="mx-auto max-w-xl space-y-5 px-4 pb-12 pt-6">
        <fieldset aria-describedby={errors.partner ? `${groupId}-err` : undefined}>
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Partner</legend>
          <div className="grid grid-cols-3 gap-2">
            {data.partners.map((p) => {
              const on = p.id === partnerId;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPartnerId(p.id)}
                  className={`h-12 truncate rounded-xl border px-2 text-sm font-semibold transition-colors ${
                    on ? 'border-ink bg-shell text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          {errors.partner && (
            <p id={`${groupId}-err`} className="mt-1.5 text-sm font-medium text-loss" role="alert">
              {errors.partner}
            </p>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
          <MoneyField label="Amount" value={amount} onChange={setAmount} error={errors.amount} />
        </div>

        {kind === 'expense' && (
          <Field label="Type" htmlFor={catId}>
            <div id={catId} className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === category}
                  onClick={() => setCategory(c)}
                  className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                    c === category ? 'border-ink bg-shell text-white' : 'border-line bg-surface text-ink-2 hover:border-ink-3'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
        )}

        <TextField
          label={kind === 'capital' ? 'Note' : 'What was it for?'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={kind === 'capital' ? 'Optional, e.g. “Initial capital”' : 'e.g. Oil change and filter'}
          error={errors.text}
        />

        <Button type="submit" className="h-14 w-full text-[1.05rem]">
          {existing ? 'Save changes' : kind === 'capital' ? 'Save capital' : 'Save expense'}
        </Button>

        {existing && (
          <ConfirmButton
            onConfirm={() => {
              if (kind === 'capital') actions.deleteCapital(existing.id);
              else actions.deleteExpense(existing.id);
              navigate(backTo, { replace: true });
            }}
          >
            Delete entry
          </ConfirmButton>
        )}
      </form>
    </>
  );
}

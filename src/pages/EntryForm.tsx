import { useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { actions, useData } from '../lib/store';
import { toNum, todayISO } from '../lib/format';
import { Button, ConfirmButton, Empty, FormBar, MoneyField, TextField } from '../components/ui';
import { ChoiceChips } from '../components/ChoiceChips';

/** Add or edit a capital entry (money a partner put into the business). */
export default function EntryForm() {
  const { id } = useParams();
  const data = useData();
  const navigate = useNavigate();
  const backTo = '/partners';
  // Snapshot keeps the form visible while it animates out after a delete.
  const snap = useRef(id ? data.capital.find((c) => c.id === id) : undefined);
  const existing = (id ? data.capital.find((c) => c.id === id) : undefined) ?? snap.current;

  const [partnerId, setPartnerId] = useState(existing?.partnerId ?? '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const groupId = useId();

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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!partnerId) err.partner = 'Choose which partner.';
    if (!date) err.date = 'Pick a date.';
    if (toNum(amount) <= 0) err.amount = 'Enter an amount above ₹0.';
    setErrors(err);
    if (Object.keys(err).length) return;
    actions.saveCapital({ partnerId, date, amount: toNum(amount), note: note.trim() }, existing?.id);
    navigate(backTo);
  };

  return (
    <>
      <FormBar title={existing ? 'Edit capital' : 'Add capital'} backTo={backTo} />
      <form onSubmit={submit} noValidate className="mx-auto max-w-xl space-y-5 px-4 pb-12 pt-6">
        <fieldset aria-describedby={errors.partner ? `${groupId}-err` : undefined}>
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Partner</legend>
          <ChoiceChips grid value={partnerId} onChange={setPartnerId} options={data.partners.map((p) => ({ value: p.id, label: p.name }))} />
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

        <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, e.g. “Initial capital”" maxLength={500} />

        <Button type="submit" className="h-14 w-full text-[1.05rem]">
          {existing ? 'Save changes' : 'Save capital'}
        </Button>

        {existing && (
          <ConfirmButton
            onConfirm={() => {
              actions.deleteCapital(existing.id);
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

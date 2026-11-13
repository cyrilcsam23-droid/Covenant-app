import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { actions, useData } from '../lib/store';
import { addMonths, fmtDate, monthOf, num, toNum, todayISO } from '../lib/format';
import { EXPENSE_CATEGORIES } from '../lib/types';
import { categoryFor, formatPlate, plateKey, vehicleOdometer } from '../lib/vehicle';
import { Button, ConfirmButton, Empty, Field, FormBar, MoneyField, TextField } from '../components/ui';
import { ChoiceChips } from '../components/ChoiceChips';

const NONE = 'none';

/** Add or edit a company expense. Can complete a vehicle reminder ("Done" / "Renewed"). */
export default function ExpenseForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const data = useData();
  const navigate = useNavigate();
  const snap = useRef(id ? data.expenses.find((e) => e.id === id) : undefined);
  const existing = (id ? data.expenses.find((e) => e.id === id) : undefined) ?? snap.current;

  const fromItem = !existing && params.get('item') ? data.vehicleItems.find((i) => i.id === params.get('item')) : undefined;
  const defaultVehicle = data.vehicles.find((v) => plateKey(v.number) === plateKey(data.settings.defaultVehicle));
  const initialVehicle = existing?.vehicleId ?? fromItem?.vehicleId ?? params.get('vehicle') ?? (data.vehicles.length === 1 ? data.vehicles[0].id : (defaultVehicle?.id ?? null));

  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [category, setCategory] = useState<string>(existing?.category ?? (fromItem ? categoryFor(fromItem) : ''));
  const [description, setDescription] = useState(existing?.description ?? (fromItem ? (fromItem.kind === 'paper' ? `${fromItem.name} renewed` : fromItem.name) : ''));
  const [vehicleId, setVehicleId] = useState<string>(initialVehicle ?? NONE);
  const [itemId, setItemId] = useState<string>(existing?.itemId ?? fromItem?.id ?? NONE);
  const vehicle = data.vehicles.find((v) => v.id === vehicleId);
  const reading = vehicle ? vehicleOdometer(data, vehicle) : null;
  const [odometer, setOdometer] = useState(() => (existing?.odometerKm != null ? String(existing.odometerKm) : fromItem?.kind === 'service' && reading && reading.km > 0 ? String(reading.km) : ''));
  const item = data.vehicleItems.find((i) => i.id === itemId && i.vehicleId === vehicleId);
  const [validUntil, setValidUntil] = useState(() => {
    const it = fromItem ?? (existing?.itemId ? data.vehicleItems.find((i) => i.id === existing.itemId) : undefined);
    if (it?.kind !== 'paper') return '';
    if (existing) return it.dueDate ?? '';
    const base = it.dueDate && it.dueDate > todayISO() ? it.dueDate : todayISO();
    return it.everyMonths ? addMonths(base, it.everyMonths) : '';
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (id && !existing) {
    return (
      <>
        <FormBar title="Expense not found" backTo="/expenses" />
        <div className="mx-auto max-w-xl p-4">
          <Empty title="This expense no longer exists">It may have been deleted.</Empty>
        </div>
      </>
    );
  }

  const backTo = fromItem || params.get('vehicle') ? `/vehicles?v=${vehicleId}` : `/expenses?m=${monthOf(existing?.date ?? date)}`;
  const vehicleItems = vehicle ? data.vehicleItems.filter((i) => i.vehicleId === vehicle.id).sort((a, b) => a.position - b.position) : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!date) err.date = 'Pick a date.';
    if (toNum(amount) <= 0) err.amount = 'Enter an amount above ₹0.';
    if (!category) err.category = 'Choose a type.';
    if (!description.trim()) err.description = 'Say what it was for, e.g. “Oil change”.';
    if (odometer && reading && item?.kind === 'service' && toNum(odometer) + 50000 < reading.km)
      err.odometer = `That’s far below the current reading (${num(reading.km)} km). Check the number.`;
    if (item?.kind === 'paper' && validUntil && validUntil <= date) err.validUntil = 'The new expiry should be after the renewal date.';
    setErrors(err);
    if (Object.keys(err).length) return;

    actions.saveExpense(
      {
        date,
        amount: toNum(amount),
        category,
        description: description.trim(),
        vehicleId: vehicle ? vehicle.id : null,
        itemId: item ? item.id : null,
        odometerKm: vehicle && odometer ? toNum(odometer) : null,
      },
      existing?.id,
      item?.kind === 'paper' ? { validUntil: validUntil || null } : undefined,
    );
    navigate(backTo);
  };

  const title = existing ? 'Edit expense' : fromItem ? (fromItem.kind === 'paper' ? `${fromItem.name} renewed` : `${fromItem.name} done`) : 'Add expense';

  return (
    <>
      <FormBar title={title} backTo={backTo} />
      <form onSubmit={submit} noValidate className="mx-auto max-w-xl space-y-5 px-4 pb-12 pt-6">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} max="2100-12-31" />
          <MoneyField label="Amount" value={amount} onChange={setAmount} error={errors.amount} autoFocus={!existing} />
        </div>

        <Field label="Type" error={errors.category}>
          <ChoiceChips
            label="Type"
            value={category}
            onChange={setCategory}
            options={[...EXPENSE_CATEGORIES, ...(existing && !EXPENSE_CATEGORIES.includes(existing.category as never) ? [existing.category] : [])].map((c) => ({ value: c, label: c }))}
          />
        </Field>

        <TextField label="What was it for?" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Oil change and filter" maxLength={500} error={errors.description} />

        {data.vehicles.length > 0 && (
          <Field label="Vehicle">
            <ChoiceChips
              label="Vehicle"
              value={vehicleId}
              onChange={(v) => {
                setVehicleId(v);
                setItemId(NONE);
              }}
              options={[{ value: NONE, label: 'Not for a vehicle' }, ...data.vehicles.map((v) => ({ value: v.id, label: formatPlate(v.number) }))]}
            />
          </Field>
        )}

        {vehicle && vehicleItems.length > 0 && (
          <Field label="Does it complete a reminder?">
            <ChoiceChips label="Reminder" value={item ? item.id : NONE} onChange={setItemId} options={[{ value: NONE, label: 'No' }, ...vehicleItems.map((i) => ({ value: i.id, label: i.name }))]} />
          </Field>
        )}

        {vehicle && (!item || item.kind === 'service') && (
          <TextField
            label={item ? 'Odometer when done' : 'Odometer (optional)'}
            inputMode="decimal"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder={reading && reading.km > 0 ? String(reading.km) : 'km'}
            error={errors.odometer}
            hint={item ? `The next ${item.name.toLowerCase()} is counted from here.` : undefined}
          />
        )}

        {item?.kind === 'paper' && (
          <TextField
            label="New valid until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            error={errors.validUntil}
            hint={item.dueDate ? `Was valid until ${fmtDate(item.dueDate)}.` : 'The date printed on the new certificate.'}
            max="2100-12-31"
          />
        )}

        <Button type="submit" className="h-14 w-full text-[1.05rem]">
          {existing ? 'Save changes' : 'Save expense'}
        </Button>

        {existing && (
          <ConfirmButton
            onConfirm={() => {
              actions.deleteExpense(existing.id);
              navigate(backTo, { replace: true });
            }}
          >
            Delete expense
          </ConfirmButton>
        )}
      </form>
    </>
  );
}

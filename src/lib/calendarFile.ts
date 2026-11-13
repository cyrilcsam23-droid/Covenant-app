/**
 * "Add to phone calendar": builds a standard .ics event for a trip. Opening the file on a
 * phone adds the trip to its own calendar, which then reminds the driver (the evening
 * before, and again the morning of the trip). No notification server needed.
 */
import type { Trip } from './types';
import { tripAdvance } from './calc';
import { addDays, money } from './format';
import { downloadFile } from '../components/ui';

const compact = (iso: string) => iso.replace(/-/g, '');

/** Escape text for an .ics field (RFC 5545 §3.3.11). */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold lines longer than 75 characters (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function tripCalendarFile(t: Trip, businessName: string): string {
  const lastDay = t.endDate ?? t.date;
  const who = t.customerName.trim();
  const title = `${t.from} → ${t.to}${who ? ` (${who})` : ''}`;
  const details = [
    who && `Customer: ${who}${t.customerPhone ? `, ${t.customerPhone}` : ''}`,
    t.fare > 0 && `Fare: ${money(t.fare)}`,
    tripAdvance(t) > 0 && `Advance received: ${money(tripAdvance(t))}`,
    t.vehicle && `Vehicle: ${t.vehicle}`,
    t.endDate === null && 'End date not known yet',
    t.notes,
  ]
    .filter(Boolean)
    .join('\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${esc(businessName)}//Trips//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${t.id}@covenant-trips`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(t.date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(lastDay, 1))}`,
    `SUMMARY:${esc(`Trip: ${title}`)}`,
    `DESCRIPTION:${esc(details)}`,
    `LOCATION:${esc(t.from)}`,
    'TRANSP:OPAQUE',
    // Evening before (6 pm) and the morning of the trip (7 am).
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`Trip tomorrow: ${title}`)}`,
    'TRIGGER:-PT6H',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`Trip today: ${title}`)}`,
    'TRIGGER:PT7H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A paper's expiry (insurance, pollution test…) as an all-day event, reminded a week before and on the day. */
export function paperCalendarFile(o: { id: string; name: string; vehicle: string; validUntil: string }, businessName: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const title = `${o.name} expires (${o.vehicle})`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${esc(businessName)}//Vehicle//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${o.id}-${compact(o.validUntil)}@covenant-vehicle`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(o.validUntil)}`,
    `DTEND;VALUE=DATE:${compact(addDays(o.validUntil, 1))}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`Renew the ${o.name.toLowerCase()} for ${o.vehicle}. Valid until this day.`)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`${o.name} for ${o.vehicle} expires in a week`)}`,
    'TRIGGER:-P7D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`${o.name} for ${o.vehicle} expires today`)}`,
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function addPaperToPhoneCalendar(o: { id: string; name: string; vehicle: string; validUntil: string }, businessName: string) {
  const slug = o.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  downloadFile(`${slug}-${o.validUntil}.ics`, paperCalendarFile(o, businessName), 'text/calendar');
}

export function addTripToPhoneCalendar(t: Trip, businessName: string) {
  const name = `trip-${t.date}-${t.to.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'booking'}.ics`;
  downloadFile(name, tripCalendarFile(t, businessName), 'text/calendar');
}

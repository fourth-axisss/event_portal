import { REGISTRATION_LABELS } from './format';

const LIVE_STATUSES = ['pending', 'approved', 'confirmed'];
//const STATUS_TONES = { pending: 'info', approved: 'info', confirmed: 'success', rejected: 'danger', cancelled: 'muted' };

export const STATUS_TONES = { pending: 'info', approved: 'info', confirmed: 'success', rejected: 'danger', cancelled: 'muted' };
export function seatsLeft(event) {
  if (!event.capacity) return null; // no limit
  return Math.max(event.capacity - (event.my?.seats_taken ?? 0), 0);
}

// Event + my flags → [{ label, tone }]
export function getEventBadges(event) {
  const my = event.my ?? {};
  const badges = [];

  if (event.kind === 'umbrella') {
    badges.push({ label: `${event.child_count} event${event.child_count === 1 ? '' : 's'}`, tone: 'neutral' });
    return badges;
  }

  const status = my.registration?.status;
  if (status) badges.push({ label: REGISTRATION_LABELS[status], tone: STATUS_TONES[status] });

  const registrable = Boolean(event.registration_required);
  if (registrable && !LIVE_STATUSES.includes(status)) {
    if (my.eligible === false) badges.push({ label: 'Not eligible', tone: 'muted' });
    if (my.clash_with?.length > 0) badges.push({ label: `Clashes with ${my.clash_with[0].title}`, tone: 'warning' });

    const left = seatsLeft(event);
    if (left === 0) {
      badges.push({ label: 'Full', tone: 'danger' });
    } else if (left !== null && left <= Math.max(1, Math.ceil(event.capacity * 0.1))) {
      badges.push({ label: `${left} seat${left === 1 ? '' : 's'} left`, tone: 'warning' });
    }
  }

  if (!registrable) badges.push({ label: 'No registration needed', tone: 'neutral' });
  else badges.push({ label: Number(event.fee) > 0 ? `₹${event.fee}` : 'Free', tone: 'neutral' });

  return badges;
}
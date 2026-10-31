// '2026-11-20 18:00:00' → Date in the browser's local time (no 'Z', so no UTC shift)
function toDate(text) {
  return new Date(text.replace(' ', 'T'));
}

const DATE_OPTIONS = { day: 'numeric', month: 'short', year: 'numeric' };
const TIME_OPTIONS = { hour: 'numeric', minute: '2-digit' };

export function formatDate(text) {
  return text ? toDate(text).toLocaleDateString('en-IN', DATE_OPTIONS) : '—';
}

export function formatTime(text) {
  return text ? toDate(text).toLocaleTimeString('en-IN', TIME_OPTIONS) : '';
}

export function formatDateTime(text) {
  return text ? `${formatDate(text)}, ${formatTime(text)}` : '—';
}

// Same day → '20 Nov 2026, 6:00 pm – 9:00 pm'; otherwise both ends in full
export function formatRange(start, end) {
  if (!start) return '—';
  if (start.slice(0, 10) === end.slice(0, 10)) return `${formatDateTime(start)} – ${formatTime(end)}`;
  return `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

// '2026-11-20 18:00:00' → '2026-11-20T18:00' for <input type="datetime-local">
export function toInputDateTime(text) {
  return text ? text.slice(0, 16).replace(' ', 'T') : '';
}

export const LIFECYCLE_LABELS = {
  draft: 'Draft',
  registration_open: 'Registration open',
  registration_closed: 'Registration closed',
  upcoming: 'Upcoming',
  ongoing: 'Happening now',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const SCOPE_LABELS = {
  single_club: 'Club event',
  multi_club: 'Multi-club event',
  fest: 'Fest event',
  faculty: 'Faculty event',
};

export const CRITERIA_LABELS = {
  attendance: 'Attendance (minimum % of sessions)',
  completion: 'Marked complete by the organizer',
  none: 'No certificates',
};
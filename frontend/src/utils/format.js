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



// { cells, departments } → { grid: 'UG: years 1, 2 · PG: year 1', departments: 'CSE, ECE' }
export function describeEligibility(eligibility) {
  const byProgram = {};
  for (const c of eligibility.cells) {
    (byProgram[c.program] ||= []).push(c.year);
  }
  const programs = Object.entries(byProgram).map(
    ([program, years]) => `${program}: year${years.length > 1 ? 's' : ''} ${years.join(', ')}`
  );
  return {
    grid: programs.length > 0 ? programs.join(' · ') : 'All programs and years',
    departments: eligibility.departments.length > 0 ? eligibility.departments.map((d) => d.code).join(', ') : 'All departments',
  };
}

export const REGISTRATION_LABELS = {
  pending: 'Awaiting approval',
  approved: 'Approved: pay to confirm',
  confirmed: 'Registered',
  rejected: 'Not approved',
  cancelled: 'Cancelled',
};




// '2026-11-01 17:30:00' → 'just now' / '5 min ago' / '3 h ago' / '2 days ago' / '20 Oct 2026'
export function timeAgo(text) {
  const seconds = Math.floor((Date.now() - toDate(text).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} day${seconds < 2 * 86400 ? '' : 's'} ago`;
  return formatDate(text);
}




export const CERTIFICATE_TYPE_LABELS = {
  participation: 'Participation',
  merit: 'Merit',
  organizer: 'Appreciation',
};
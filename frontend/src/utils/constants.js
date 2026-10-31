export const ROLES = { STUDENT: 'student', FACULTY: 'faculty', ADMIN: 'admin' };

export const POSITION_LABELS = {
  fest_head: 'Fest Head',
  gsec: 'GSec',
  fest_event_creator: 'Fest Event Creator',
  club_coordinator: 'Club Coordinator',
};

export const ORGANIZE_OPTIONS = [
  { value: 'faculty', label: 'Faculty only' },
  { value: 'student', label: 'Students only' },
  { value: 'both', label: 'Faculty and students' },
];

export const PARTICIPATE_OPTIONS = [
  { value: 'student', label: 'Students only' },
  { value: 'faculty', label: 'Faculty only' },
  { value: 'both', label: 'Faculty and students' },
];
export const ROLE_LABELS = { student: 'Student', faculty: 'Faculty', admin: 'Admin' };

export const PROGRAM_OPTIONS = [
  { value: 'UG', label: 'UG' },
  { value: 'DD', label: 'Dual Degree' },
  { value: 'PG', label: 'PG' },
  { value: 'PHD', label: 'PhD' },
];

export const PROGRAM_MAX_YEAR = { UG: 4, DD: 5, PG: 2, PHD: 5 };
const ROLES = { STUDENT: 'student', FACULTY: 'faculty', ADMIN: 'admin' };

const POSITION_TYPES = {
  FEST_HEAD: 'fest_head',
  GSEC: 'gsec',
  FEST_EVENT_CREATOR: 'fest_event_creator',
  CLUB_COORDINATOR: 'club_coordinator',
};

const EVENT_KINDS = { NORMAL: 'normal', UMBRELLA: 'umbrella' };
const EVENT_SCOPES = { SINGLE_CLUB: 'single_club', MULTI_CLUB: 'multi_club', FEST: 'fest', FACULTY: 'faculty' };
const EVENT_STATUS = { DRAFT: 'draft', PUBLISHED: 'published', CANCELLED: 'cancelled' };

const REGISTRATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};
const SEAT_TAKING_STATUSES = ['approved', 'confirmed'];
const CLASH_STATUSES = ['pending', 'approved', 'confirmed'];

const EVENT_PERMISSIONS = {
  MANAGE: 'manage',
  REGISTRATIONS: 'registrations',
  ATTENDANCE: 'attendance',
  ANNOUNCEMENTS_FILES: 'announcements_files',
  CERTIFICATES: 'certificates',
};
const DELEGABLE_PERMISSIONS = ['registrations', 'attendance', 'announcements_files', 'certificates'];

const DELEGATION_EXPIRY_DAYS = 15;
const DEFAULT_MIN_ATTENDANCE_PERCENT = 75;
const ORGANIZE_RULES = ['faculty', 'student', 'both'];
const PARTICIPATE_RULES = ['student', 'faculty', 'both'];
module.exports = {
  ROLES,
  POSITION_TYPES,
  EVENT_KINDS,
  EVENT_SCOPES,
  EVENT_STATUS,
  REGISTRATION_STATUS,
  SEAT_TAKING_STATUSES,
  CLASH_STATUSES,
  EVENT_PERMISSIONS,
  DELEGABLE_PERMISSIONS,
  DELEGATION_EXPIRY_DAYS,
  DEFAULT_MIN_ATTENDANCE_PERCENT,
  ORGANIZE_RULES,
  PARTICIPATE_RULES
};
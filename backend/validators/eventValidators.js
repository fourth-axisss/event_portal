   const { body, param, query } = require('express-validator');
const {
  EVENT_KINDS,
  EVENT_SCOPES,
  CERTIFICATE_CRITERIA,
  PROGRAMS,
  PROGRAM_MAX_YEAR,
} = require('../config/constants');
const { toSqlDateTime } = require('../services/eventService');

// mode: 'required' | 'optional' (may be left out) | 'nullable' (may be left out or null)
function dateTimeRule(field, label, mode = 'required') {
  let chain = body(field);
  if (mode === 'optional') chain = chain.optional();
  if (mode === 'nullable') chain = chain.optional({ values: 'null' });
  return chain
    .custom((value) => {
      if (!toSqlDateTime(value)) throw new Error(`${label}: use a valid date and time`);
      return true;
    })
    .customSanitizer(toSqlDateTime);
}

function titleRule(optional) {
  const chain = optional ? body('title').optional() : body('title');
  return chain.isString().trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 150 }).withMessage('Title can be at most 150 characters');
}

function idRule(field, label) {
  return body(field).optional({ values: 'null' }).isInt({ min: 1 }).withMessage(`Invalid ${label}`).toInt();
}

function boolRule(field, label) {
  return body(field).optional().isBoolean().withMessage(`${label} must be true or false`).toBoolean();
}

const sessionIdParam = param('sessionId').isInt({ min: 1 }).withMessage('Invalid session id').toInt();

// Fields shared by create and edit
const sharedRules = [
  idRule('event_type_id', 'event type'),
  idRule('parent_event_id', 'umbrella event'),
  idRule('venue_id', 'venue'),
  body('participating_club_ids').optional().isArray().withMessage('Participating clubs must be a list'),
  body('participating_club_ids.*').isInt({ min: 1 }).withMessage('Invalid club in the list').toInt(),
  body('description').optional({ values: 'null' }).isString().trim()
    .isLength({ max: 5000 }).withMessage('Description can be at most 5000 characters'),

  dateTimeRule('registration_deadline', 'Registration deadline', 'nullable'),
  boolRule('registration_required', 'Registration required'),
  body('capacity').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Capacity must be at least 1').toInt(),
  body('fee').optional({ values: 'null' }).isFloat({ min: 0, max: 999999.99 }).withMessage('Fee must be 0 or more').toFloat(),
  boolRule('auto_approve', 'Auto-approve'),
  boolRule('is_team_event', 'Team event'),
  body('team_min').optional({ values: 'null' }).isInt({ min: 1, max: 50 }).withMessage('Team minimum must be 1 to 50').toInt(),
  body('team_max').optional({ values: 'null' }).isInt({ min: 1, max: 50 }).withMessage('Team maximum must be 1 to 50').toInt(),
  body('certificate_criteria').optional().isIn(CERTIFICATE_CRITERIA)
    .withMessage(`Certificate criteria must be one of: ${CERTIFICATE_CRITERIA.join(', ')}`),
  body('min_attendance_percent').optional().isInt({ min: 1, max: 100 })
    .withMessage('Minimum attendance must be 1 to 100').toInt(),

  body('eligibility').optional({ values: 'null' }).isObject().withMessage('Eligibility must be an object'),
  body('eligibility.cells').optional().isArray().withMessage('Eligibility cells must be a list'),
  body('eligibility.cells.*.program').isIn(PROGRAMS).withMessage(`Program must be one of: ${PROGRAMS.join(', ')}`),
  body('eligibility.cells.*.year').isInt({ min: 1, max: 5 }).withMessage('Year must be 1 to 5').toInt(),
  body('eligibility.cells').optional().custom((cells) => {
    const bad = cells.find((c) => c.year > PROGRAM_MAX_YEAR[c.program]);
    if (bad) throw new Error(`${bad.program} has only ${PROGRAM_MAX_YEAR[bad.program]} years`);
    return true;
  }),
  body('eligibility.department_ids').optional().isArray().withMessage('Departments must be a list'),
  body('eligibility.department_ids.*').isInt({ min: 1 }).withMessage('Invalid department').toInt(),
];

const eventCreate = [
  body('kind').optional().isIn(Object.values(EVENT_KINDS)).withMessage('Kind must be normal or umbrella'),
  body('scope').optional({ values: 'null' }).isIn(Object.values(EVENT_SCOPES)).withMessage('Unknown scope'),
  idRule('fest_id', 'fest'),
  idRule('club_id', 'club'),
  titleRule(false),
  dateTimeRule('start_time', 'Start'),
  dateTimeRule('end_time', 'End'),
  ...sharedRules,
];

const eventUpdate = [
  titleRule(true),
  dateTimeRule('start_time', 'Start', 'optional'),
  dateTimeRule('end_time', 'End', 'optional'),
  ...sharedRules,
];

const cancelRules = [
  body('reason').isString().trim().notEmpty().withMessage('Give a reason for cancelling')
    .isLength({ max: 500 }).withMessage('Reason can be at most 500 characters'),
];

const sessionCreate = [
  body('title').isString().trim().notEmpty().withMessage('Session title is required')
    .isLength({ max: 100 }).withMessage('Title can be at most 100 characters'),
  dateTimeRule('start_time', 'Start'),
  dateTimeRule('end_time', 'End'),
];

const sessionUpdate = [
  sessionIdParam,
  body('title').optional().isString().trim().notEmpty().withMessage('Session title cannot be empty')
    .isLength({ max: 100 }).withMessage('Title can be at most 100 characters'),
  dateTimeRule('start_time', 'Start', 'optional'),
  dateTimeRule('end_time', 'End', 'optional'),
];

const sessionIdRules = [sessionIdParam];

   const browseRules = [
     query('q').optional().isString().isLength({ max: 100 }).withMessage('Search text is too long'),
     query('fest_id').optional().isInt({ min: 1 }).withMessage('Invalid fest'),
     query('event_type_id').optional().isInt({ min: 1 }).withMessage('Invalid event type'),
     query('umbrella_id').optional().isInt({ min: 1 }).withMessage('Invalid umbrella event'),
     query('lifecycle').optional().isIn(['registration_open', 'upcoming', 'ongoing', 'completed'])
       .withMessage('Lifecycle must be registration_open, upcoming, ongoing or completed'),
   ];

   module.exports = { eventCreate, eventUpdate, cancelRules, sessionCreate, sessionUpdate, sessionIdRules, browseRules };
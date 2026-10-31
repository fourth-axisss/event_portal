const { body } = require('express-validator');
const {
  EVENT_KINDS,
  EVENT_SCOPES,
  CERTIFICATE_CRITERIA,
  PROGRAMS,
  PROGRAM_MAX_YEAR,
} = require('../config/constants');
const { toSqlDateTime } = require('../services/eventService');

function dateTimeRule(field, label, optional = false) {
  let chain = body(field);
  if (optional) chain = chain.optional({ values: 'null' });
  return chain
    .custom((value) => {
      if (!toSqlDateTime(value)) throw new Error(`${label}: use a valid date and time`);
      return true;
    })
    .customSanitizer(toSqlDateTime);
}

function idRule(field, label) {
  return body(field).optional({ values: 'null' }).isInt({ min: 1 }).withMessage(`Invalid ${label}`).toInt();
}

function boolRule(field, label) {
  return body(field).optional().isBoolean().withMessage(`${label} must be true or false`).toBoolean();
}

const eventCreate = [
  body('kind').optional().isIn(Object.values(EVENT_KINDS)).withMessage('Kind must be normal or umbrella'),
  body('scope').optional({ values: 'null' }).isIn(Object.values(EVENT_SCOPES)).withMessage('Unknown scope'),
  idRule('event_type_id', 'event type'),
  idRule('fest_id', 'fest'),
  idRule('club_id', 'club'),
  idRule('parent_event_id', 'umbrella event'),
  idRule('venue_id', 'venue'),
  body('participating_club_ids').optional().isArray().withMessage('Participating clubs must be a list'),
  body('participating_club_ids.*').isInt({ min: 1 }).withMessage('Invalid club in the list').toInt(),

  body('title').isString().trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 150 }).withMessage('Title can be at most 150 characters'),
  body('description').optional({ values: 'null' }).isString().trim()
    .isLength({ max: 5000 }).withMessage('Description can be at most 5000 characters'),

  dateTimeRule('start_time', 'Start'),
  dateTimeRule('end_time', 'End'),
  dateTimeRule('registration_deadline', 'Registration deadline', true),

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

module.exports = { eventCreate };
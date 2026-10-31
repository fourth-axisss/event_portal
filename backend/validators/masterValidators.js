const { body, param, query } = require('express-validator');
const { ORGANIZE_RULES, PARTICIPATE_RULES } = require('../config/constants');

// mode: 'required' = must be sent; 'optional' = may be left out, but not empty if sent;
// 'nullable' = may be left out, null or empty (stored as NULL)
function textRule(field, label, max, mode = 'required') {
  let chain = body(field);
  if (mode === 'optional') chain = chain.optional();
  if (mode === 'nullable') chain = chain.optional({ values: 'null' });
  chain = chain.isString().withMessage(`${label} must be text`).trim();
  if (mode !== 'nullable') chain = chain.notEmpty().withMessage(`${label} is required`);
  return chain.isLength({ max }).withMessage(`${label} can be at most ${max} characters`);
}

function choiceRule(field, label, choices, optional = false) {
  let chain = body(field);
  if (optional) chain = chain.optional();
  return chain.isIn(choices).withMessage(`${label} must be one of: ${choices.join(', ')}`);
}

function boolRule(field, label, optional = false) {
  let chain = body(field);
  if (optional) chain = chain.optional();
  return chain.isBoolean().withMessage(`${label} must be true or false`).toBoolean();
}

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid id').toInt();
const activeRule = boolRule('is_active', 'Active', true);
const capacityRule = body('capacity')
  .optional({ values: 'null' })
  .isInt({ min: 1 })
  .withMessage('Capacity must be a whole number above 0')
  .toInt();

const departmentCreate = [
  textRule('code', 'Code', 10).toUpperCase(),
  textRule('name', 'Name', 100),
];
const departmentUpdate = [
  idParam,
  textRule('code', 'Code', 10, 'optional').toUpperCase(),
  textRule('name', 'Name', 100, 'optional'),
  activeRule,
];

const venueCreate = [textRule('name', 'Name', 100), capacityRule];
const venueUpdate = [idParam, textRule('name', 'Name', 100, 'optional'), capacityRule, activeRule];

const eventTypeCreate = [
  textRule('name', 'Name', 60),
  choiceRule('organize_rule', 'Who can organize', ORGANIZE_RULES),
  choiceRule('participate_rule', 'Who can participate', PARTICIPATE_RULES),
  boolRule('clash_check', 'Clash check'),
];
const eventTypeUpdate = [
  idParam,
  textRule('name', 'Name', 60, 'optional'),
  choiceRule('organize_rule', 'Who can organize', ORGANIZE_RULES, true),
  choiceRule('participate_rule', 'Who can participate', PARTICIPATE_RULES, true),
  boolRule('clash_check', 'Clash check', true),
  activeRule,
];

const orgDetailRules = [
  textRule('description', 'Description', 500, 'nullable'),
  textRule('signatory_name', 'Signatory name', 100, 'nullable'),
  textRule('signatory_title', 'Signatory title', 100, 'nullable'),
];

const festCreate = [textRule('name', 'Name', 60), ...orgDetailRules];
const festUpdate = [idParam, textRule('name', 'Name', 60, 'optional'), ...orgDetailRules, activeRule];

const clubCreate = [
  body('fest_id').isInt({ min: 1 }).withMessage('Choose a fest').toInt(),
  textRule('name', 'Name', 100),
  ...orgDetailRules,
];
const clubUpdate = [idParam, textRule('name', 'Name', 100, 'optional'), ...orgDetailRules, activeRule];

const lookupRules = [query('roll_no').trim().notEmpty().withMessage('Roll number is required')];

module.exports = {
  departmentCreate,
  departmentUpdate,
  venueCreate,
  venueUpdate,
  eventTypeCreate,
  eventTypeUpdate,
  festCreate,
  festUpdate,
  clubCreate,
  clubUpdate,
  lookupRules,
};
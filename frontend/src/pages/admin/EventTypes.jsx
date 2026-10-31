import MasterTable from '../../components/MasterTable';
import { ORGANIZE_OPTIONS, PARTICIPATE_OPTIONS } from '../../utils/constants';

const EVENT_TYPE_FIELDS = [
  { name: 'name', label: 'Name', required: true, maxLength: 60 },
  { name: 'organize_rule', label: 'Who can organize', type: 'select', options: ORGANIZE_OPTIONS },
  { name: 'participate_rule', label: 'Who can participate', type: 'select', options: PARTICIPATE_OPTIONS },
  {
    name: 'clash_check',
    label: 'Check for clashes',
    type: 'checkbox',
    defaultValue: true,
    help: 'If on, a student cannot register for two overlapping events of clash-checked types.',
  },
];

export default function EventTypes() {
  return <MasterTable title="Event types" itemName="event type" endpoint="/event-types" fields={EVENT_TYPE_FIELDS} />;
}
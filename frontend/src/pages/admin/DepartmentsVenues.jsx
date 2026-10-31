import { Col, Row } from 'react-bootstrap';
import MasterTable from '../../components/MasterTable';

const DEPARTMENT_FIELDS = [
  { name: 'code', label: 'Code', required: true, maxLength: 10 },
  { name: 'name', label: 'Name', required: true, maxLength: 100 },
];

const VENUE_FIELDS = [
  { name: 'name', label: 'Name', required: true, maxLength: 100 },
  { name: 'capacity', label: 'Capacity', type: 'number', min: 1, help: 'Leave empty if it has no fixed capacity.' },
];

export default function DepartmentsVenues() {
  return (
    <Row className="g-4">
      <Col lg={6}>
        <MasterTable title="Departments" itemName="department" endpoint="/departments" fields={DEPARTMENT_FIELDS} />
      </Col>
      <Col lg={6}>
        <MasterTable title="Venues" itemName="venue" endpoint="/venues" fields={VENUE_FIELDS} />
      </Col>
    </Row>
  );
}
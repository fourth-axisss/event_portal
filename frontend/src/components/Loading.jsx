import { Spinner } from 'react-bootstrap';

export default function Loading() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <Spinner animation="border" role="status" style={{ color: 'var(--brand)' }} />
    </div>
  );
}
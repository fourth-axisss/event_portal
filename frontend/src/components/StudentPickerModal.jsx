import { useState } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import { getErrorMessage } from '../api/client';
import StudentPicker from './StudentPicker';

export default function StudentPickerModal({ show, title, note, confirmLabel = 'Save', onConfirm, onHide }) {
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setStudent(null);
    setError('');
  }

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm(student);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} onExited={reset} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h3" className="h5">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {note && <p className="text-muted">{note}</p>}
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}
        <StudentPicker selected={student} onSelect={setStudent} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={!student || busy}>
          {busy ? 'Saving…' : confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
import { useState } from 'react';
import { Alert, Button, Form, InputGroup } from 'react-bootstrap';
import api, { getErrorMessage } from '../api/client';

export default function StudentPicker({ selected, onSelect }) {
  const [rollNo, setRollNo] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  async function find() {
    if (!rollNo.trim()) return;
    setSearching(true);
    setError('');
    onSelect(null);
    try {
      const res = await api.get('/users/lookup', { params: { roll_no: rollNo.trim() } });
      onSelect(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      find();
    }
  }

  return (
    <>
      <Form.Label htmlFor="student-roll">Student roll number</Form.Label>
      <InputGroup>
        <Form.Control
          id="student-roll"
          value={rollNo}
          onChange={(e) => setRollNo(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 23UCS045"
          autoFocus
        />
        <Button variant="outline-primary" onClick={find} disabled={searching}>
          {searching ? 'Finding…' : 'Find'}
        </Button>
      </InputGroup>

      {error && <Alert variant="warning" className="py-2 mt-2 mb-0">{error}</Alert>}

      {selected && (
        <div className="picked-student mt-2">
          <strong>{selected.name}</strong>
          <span className="text-muted">
            {' '}· {selected.roll_no} · {selected.department_code} {selected.program}, Year {selected.year}
          </span>
        </div>
      )}
    </>
  );
}
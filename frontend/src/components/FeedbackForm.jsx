import { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import api, { getErrorMessage } from '../api/client';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function FeedbackForm({ eventId, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/events/${eventId}/feedback`, { rating, comment });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <div className="star-input mb-1" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= rating ? 'on' : ''}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            aria-pressed={n === rating}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <div className="small text-muted mb-3">{rating ? LABELS[rating] : 'Choose a rating'}</div>

      <Form.Label htmlFor="fb-comment" className="small">Anything to add? (optional)</Form.Label>
      <Form.Control
        id="fb-comment"
        as="textarea"
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
      />
      <Form.Text muted>Organizers see your comment but not your name.</Form.Text>

      <Button type="submit" className="w-100 mt-3" disabled={busy || rating === 0}>
        {busy ? 'Sending…' : 'Send feedback'}
      </Button>
    </Form>
  );
}
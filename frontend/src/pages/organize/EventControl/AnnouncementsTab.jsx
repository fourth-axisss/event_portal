import { useState } from 'react';
import { Alert, Button, Card, Form } from 'react-bootstrap';
import api, { getErrorMessage } from '../../../api/client';
import AnnouncementList from '../../../components/AnnouncementList';
import ConfirmModal from '../../../components/ConfirmModal';

export default function AnnouncementsTab({ event }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canPost = event.status === 'published';

  async function handlePost(e) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await api.post(`/events/${event.id}/announcements`, { title, body });
      setNotice(res.data.message);
      setTitle('');
      setBody('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/events/${event.id}/announcements/${deleteTarget.id}`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <Card body className="mb-4">
        <div className="section-label">New announcement</div>
        {!canPost && (
          <Alert variant="info" className="py-2">
            {event.status === 'draft' ? 'You can post once the event is published.' : 'This event was cancelled.'}
          </Alert>
        )}
        {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        <Form onSubmit={handlePost}>
          <fieldset disabled={!canPost || busy}>
            <Form.Group className="mb-3" controlId="ann-title">
              <Form.Label>Title</Form.Label>
              <Form.Control
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={150}
                placeholder="e.g. Venue changed to the Auditorium"
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="ann-body">
              <Form.Label>Message</Form.Label>
              <Form.Control as="textarea" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={5000} />
            </Form.Group>
            <Button type="submit">{busy ? 'Posting…' : 'Post & notify participants'}</Button>
            <Form.Text muted className="ms-3">
              Everyone registered{event.kind === 'umbrella' ? ' for its events' : ''} gets a notification and an email.
            </Form.Text>
          </fieldset>
        </Form>
      </Card>

      <div className="section-label">Posted</div>
      <AnnouncementList eventId={event.id} refreshKey={refreshKey} onDelete={setDeleteTarget} />

      <ConfirmModal
        show={deleteTarget !== null}
        title="Delete announcement"
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onConfirm={handleDelete}
        onHide={() => setDeleteTarget(null)}
      >
        Delete <strong>{deleteTarget?.title}</strong> from the event page? Notifications already sent stay in people's bells.
      </ConfirmModal>
    </>
  );
}
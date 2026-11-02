import { Button, Card } from 'react-bootstrap';
import useLoad from '../utils/useLoad';
import { timeAgo } from '../utils/format';

export default function AnnouncementList({ eventId, refreshKey = 0, onDelete, hideWhenEmpty = false }) {
  const { data: items } = useLoad(`/events/${eventId}/announcements?r=${refreshKey}`);

  if (!items) return null;
  if (items.length === 0) {
    return hideWhenEmpty ? null : <p className="text-muted">No announcements yet.</p>;
  }

  return items.map((a) => (
    <Card body key={a.id} className="mb-3" style={{ borderLeft: '3px solid var(--accent)' }}>
      <div className="d-flex justify-content-between gap-2">
        <h3 className="h6 mb-1">{a.title}</h3>
        {onDelete && (
          <Button size="sm" variant="link" className="text-danger p-0" onClick={() => onDelete(a)}>Delete</Button>
        )}
      </div>
      <div className="small text-muted mb-2">
        {timeAgo(a.created_at)} · {a.posted_by_name}
      </div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{a.body}</div>
    </Card>
  ));
}
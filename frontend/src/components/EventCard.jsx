import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import BadgeList from './BadgeList';
import StatusBadge from './StatusBadge';
import { uploadUrl } from '../utils/assets';
import { getEventBadges } from '../utils/eventBadges';
import { formatRange, SCOPE_LABELS } from '../utils/format';

function dateParts(text) {
  const d = new Date(text.replace(' ', 'T'));
  return { day: d.getDate(), month: d.toLocaleString('en-IN', { month: 'short' }) };
}

function kindLine(event) {
  if (event.kind === 'umbrella') return `${event.fest_name} · Umbrella event`;
  const owner = event.club_name || event.fest_name || SCOPE_LABELS[event.scope];
  return `${event.type_name} · ${owner}`;
}

export default function EventCard({ event, featured = false }) {
  const poster = uploadUrl(event.poster_path);
  const { day, month } = dateParts(event.start_time);
  const badges = getEventBadges(event);

  return (
    <Card className={`event-card h-100${featured ? ' featured-umbrella flex-md-row' : ''}`}>
      <div className="event-poster" style={featured ? { flex: '0 0 40%' } : undefined}>
        {poster ? <img src={poster} alt="" /> : <div className="event-poster-placeholder">{event.type_name || event.title}</div>}
        <div className="date-tag">
          <span className="day">{day}</span>
          <span className="month">{month}</span>
        </div>
      </div>
      <Card.Body className="d-flex flex-column">
        <div className="small text-muted mb-1">{kindLine(event)}</div>
        <h3 className={featured ? 'h5 mb-2' : 'h6 mb-2'}>
          <Link to={`/events/${event.id}`} className="stretched-link text-reset text-decoration-none">
            {event.title}
          </Link>
        </h3>
        <div className="small text-muted mb-3">
          {formatRange(event.start_time, event.end_time)}
          {event.venue_name && ` · ${event.venue_name}`}
        </div>
        <div className="mt-auto d-flex flex-wrap gap-1">
          <StatusBadge lifecycle={event.lifecycle} />
          <BadgeList badges={badges} />
        </div>
      </Card.Body>
    </Card>
  );
}
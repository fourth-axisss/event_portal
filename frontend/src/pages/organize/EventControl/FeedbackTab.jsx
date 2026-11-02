import { Alert, Card, Col, ListGroup, Row } from 'react-bootstrap';
import Loading from '../../../components/Loading';
import useLoad from '../../../utils/useLoad';
import { timeAgo } from '../../../utils/format';

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export default function FeedbackTab({ event }) {
  const { data, loading, error } = useLoad(`/events/${event.id}/feedback`);

  if (loading && !data) return <Loading />;
  if (!data) return <Alert variant="danger">{error}</Alert>;
  if (data.count === 0) {
    return <p className="text-muted">No feedback yet. Confirmed participants can respond once the event has ended.</p>;
  }

  return (
    <Row className="g-4">
      <Col md={5} lg={4}>
        <Card body>
          <div className="section-label">Average rating</div>
          <div className="d-flex align-items-end gap-2 mb-1">
            <span className="big-number">{data.average}</span>
            <span className="text-muted mb-1">/ 5</span>
          </div>
          <div className="stars-static mb-3" aria-hidden="true">{stars(Math.round(data.average))}</div>
          <div className="small text-muted mb-3">
            {data.count} response{data.count === 1 ? '' : 's'}
          </div>

          {[5, 4, 3, 2, 1].map((n) => {
            const share = Math.round((data.distribution[n] / data.count) * 100);
            return (
              <div className="feedback-row" key={n}>
                <span>{n} ★</span>
                <div className="feedback-bar" role="img" aria-label={`${n} stars: ${data.distribution[n]} responses`}>
                  <span style={{ width: `${share}%` }} />
                </div>
                <span className="text-muted text-end">{data.distribution[n]}</span>
              </div>
            );
          })}
        </Card>
      </Col>

      <Col md={7} lg={8}>
        <Card>
          <Card.Body className="pb-0">
            <div className="section-label">Comments ({data.comments.length})</div>
          </Card.Body>
          {data.comments.length === 0 ? (
            <Card.Body className="pt-0 text-muted">Nobody left a comment.</Card.Body>
          ) : (
            <ListGroup variant="flush">
              {data.comments.map((c, i) => (
                <ListGroup.Item key={i}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="stars-static" aria-label={`${c.rating} stars`}>{stars(c.rating)}</span>
                    <span className="text-muted">{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{c.comment}</div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Card>
      </Col>
    </Row>
  );
}
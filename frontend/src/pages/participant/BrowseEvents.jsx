import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import EventCard from '../../components/EventCard';
import Loading from '../../components/Loading';
import useLoad from '../../utils/useLoad';

const WHEN_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'registration_open', label: 'Open for registration' },
  { value: 'ongoing', label: 'Happening now' },
  { value: 'completed', label: 'Past' },
];

export default function BrowseEvents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const festId = searchParams.get('fest_id') ?? '';
  const lifecycle = searchParams.get('lifecycle') ?? 'upcoming';
  const [searchText, setSearchText] = useState(q);

  const apiQuery = new URLSearchParams({ lifecycle });
  if (q) apiQuery.set('q', q);
  if (festId) apiQuery.set('fest_id', festId);

  const { data: events, loading, error } = useLoad(`/events?${apiQuery.toString()}`);
  const { data: fests } = useLoad('/fests');

  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  }

  function handleSearch(e) {
    e.preventDefault();
    updateFilter('q', searchText.trim());
  }

  const umbrellas = events?.filter((e) => e.kind === 'umbrella') ?? [];
  const normal = events?.filter((e) => e.kind !== 'umbrella') ?? [];

  return (
    <>
      <div className="page-header">
        <h1>Browse events</h1>
        <p>Fests, workshops, talks and more across the institute.</p>
      </div>

      <Card body className="mb-4">
        <Form onSubmit={handleSearch}>
          <Row className="g-2 align-items-end">
            <Col md={5}>
              <Form.Label htmlFor="browse-q" className="small text-muted mb-1">Search</Form.Label>
              <div className="d-flex gap-2">
                <Form.Control
                  id="browse-q"
                  placeholder="Event name"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <Button type="submit" variant="outline-primary">Search</Button>
              </div>
            </Col>
            <Col sm={6} md={3}>
              <Form.Label htmlFor="browse-fest" className="small text-muted mb-1">Fest</Form.Label>
              <Form.Select id="browse-fest" value={festId} onChange={(e) => updateFilter('fest_id', e.target.value)}>
                <option value="">All (incl. faculty events)</option>
                {fests?.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col sm={6} md={4}>
              <Form.Label htmlFor="browse-when" className="small text-muted mb-1">When</Form.Label>
              <Form.Select id="browse-when" value={lifecycle} onChange={(e) => updateFilter('lifecycle', e.target.value)}>
                {WHEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Form>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && !events && <Loading />}

      {umbrellas.length > 0 && (
        <section className="mb-4">
          <div className="section-label">Featured</div>
          <Row className="g-4">
            {umbrellas.map((u) => (
              <Col key={u.id} lg={6}>
                <EventCard event={u} featured />
              </Col>
            ))}
          </Row>
        </section>
      )}

      {events && (
        <section>
          <div className="section-label">{normal.length} event{normal.length === 1 ? '' : 's'}</div>
          {normal.length === 0 ? (
            <p className="text-muted">No events match these filters.</p>
          ) : (
            <Row className="g-4">
              {normal.map((e) => (
                <Col key={e.id} sm={6} lg={4}>
                  <EventCard event={e} />
                </Col>
              ))}
            </Row>
          )}
        </section>
      )}
    </>
  );
}
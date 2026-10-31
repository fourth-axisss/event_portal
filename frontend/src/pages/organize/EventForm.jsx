import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/client';
import Loading from '../../components/Loading';
import useLoad from '../../utils/useLoad';
import { PROGRAM_MAX_YEAR, PROGRAM_OPTIONS } from '../../utils/constants';
import { CRITERIA_LABELS, SCOPE_LABELS, toInputDateTime } from '../../utils/format';

const EMPTY_FORM = {
  organizer: '',
  event_type_id: '',
  parent_event_id: '',
  participating_club_ids: [],
  title: '',
  description: '',
  venue_id: '',
  start_time: '',
  end_time: '',
  registration_required: true,
  registration_deadline: '',
  capacity: '',
  fee: '0',
  auto_approve: true,
  certificate_criteria: 'attendance',
  min_attendance_percent: 75,
  cells: [], // ticked eligibility cells as 'UG-1', 'PG-2', ...
  department_ids: [],
};

// 'club:5' → { kind, scope, fest_id, club_id }  (a club's fest is found in the options)
function parseOrganizer(value, fests) {
  const [type, rawId] = value.split(':');
  const id = Number(rawId);
  if (type === 'faculty') return { kind: 'normal', scope: 'faculty', fest_id: null, club_id: null };
  if (type === 'club') {
    const fest = fests.find((f) => f.clubs.some((c) => c.id === id));
    return { kind: 'normal', scope: 'single_club', fest_id: fest?.id ?? null, club_id: id };
  }
  if (type === 'multi') return { kind: 'normal', scope: 'multi_club', fest_id: id, club_id: null };
  if (type === 'fest') return { kind: 'normal', scope: 'fest', fest_id: id, club_id: null };
  if (type === 'umbrella') return { kind: 'umbrella', scope: 'fest', fest_id: id, club_id: null };
  return null;
}

// The reverse, for an existing event
function organizerValue(event) {
  if (event.kind === 'umbrella') return `umbrella:${event.fest_id}`;
  if (event.scope === 'faculty') return 'faculty';
  if (event.scope === 'single_club') return `club:${event.club_id}`;
  if (event.scope === 'multi_club') return `multi:${event.fest_id}`;
  return `fest:${event.fest_id}`;
}

function formFromEvent(e) {
  return {
    organizer: organizerValue(e),
    event_type_id: e.event_type_id ?? '',
    parent_event_id: e.parent_event_id ?? '',
    participating_club_ids: e.participating_clubs.map((c) => c.id),
    title: e.title,
    description: e.description ?? '',
    venue_id: e.venue_id ?? '',
    start_time: toInputDateTime(e.start_time),
    end_time: toInputDateTime(e.end_time),
    registration_required: Boolean(e.registration_required),
    registration_deadline: toInputDateTime(e.registration_deadline),
    capacity: e.capacity ?? '',
    fee: String(e.fee ?? 0),
    auto_approve: Boolean(e.auto_approve),
    certificate_criteria: e.certificate_criteria,
    min_attendance_percent: e.min_attendance_percent,
    cells: e.eligibility.cells.map((c) => `${c.program}-${c.year}`),
    department_ids: e.eligibility.departments.map((d) => d.id),
  };
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function toNumberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

export default function EventForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { data: options, error: optionsError } = useLoad('/organize/event-form-options');
  const { data: venues } = useLoad('/venues');
  const { data: departments } = useLoad('/departments');

  const [form, setForm] = useState(EMPTY_FORM);
  const [existing, setExisting] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(isEdit);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit mode: load the event once and fill the form
  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/events/${id}`)
      .then((res) => {
        setExisting(res.data);
        setForm(formFromEvent(res.data));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingEvent(false));
  }, [id, isEdit]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function chooseOrganizer(value) {
    setForm((prev) => ({ ...prev, organizer: value, event_type_id: '', parent_event_id: '', participating_club_ids: [] }));
  }

  if (!options || (isEdit && loadingEvent)) {
    return optionsError ? <Alert variant="danger">{optionsError}</Alert> : <Loading />;
  }

  // ----- values derived from the current choice -----
  const fests = options.fests;
  const target = existing
    ? { kind: existing.kind, scope: existing.scope, fest_id: existing.fest_id, club_id: existing.club_id }
    : form.organizer
      ? parseOrganizer(form.organizer, fests)
      : null;
  const isUmbrella = target?.kind === 'umbrella';
  const festOptions = fests.find((f) => f.id === target?.fest_id);
  const typeRules = target?.scope === 'faculty' ? ['faculty', 'both'] : ['student', 'both'];
  const eventTypes = options.event_types.filter((t) => typeRules.includes(t.organize_rule));
  const umbrellas = festOptions?.umbrellas ?? [];
  const clubChoices = festOptions?.all_clubs ?? [];
  const canCreateAnything = options.can_create_faculty_event || fests.length > 0;
  const locked = existing && (existing.lifecycle === 'completed' || existing.status === 'cancelled');

  function buildBody() {
    const body = {
      parent_event_id: target.scope === 'faculty' || isUmbrella ? null : toNumberOrNull(form.parent_event_id),
      title: form.title,
      description: form.description || null,
      venue_id: toNumberOrNull(form.venue_id),
      start_time: form.start_time,
      end_time: form.end_time,
    };

    if (!isUmbrella) {
      Object.assign(body, {
        event_type_id: toNumberOrNull(form.event_type_id),
        registration_required: form.registration_required,
        registration_deadline: form.registration_required ? form.registration_deadline || null : null,
        capacity: toNumberOrNull(form.capacity),
        fee: toNumberOrNull(form.fee) ?? 0,
        auto_approve: form.auto_approve,
        certificate_criteria: form.registration_required ? form.certificate_criteria : 'none',
        min_attendance_percent: toNumberOrNull(form.min_attendance_percent) ?? 75,
        eligibility: {
          cells: form.cells.map((key) => {
            const [program, year] = key.split('-');
            return { program, year: Number(year) };
          }),
          department_ids: form.department_ids,
        },
      });
    }
    if (target.scope === 'multi_club') body.participating_club_ids = form.participating_club_ids;
    if (!isEdit) Object.assign(body, { kind: target.kind, scope: target.scope, fest_id: target.fest_id, club_id: target.club_id });
    return body;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        const res = await api.patch(`/events/${id}`, buildBody());
        navigate('/organize', { state: { message: res.data.note ? `Changes saved. ${res.data.note}` : 'Changes saved.' } });
      } else {
        await api.post('/events', buildBody());
        navigate('/organize', { state: { message: `"${form.title}" saved as a draft. Publish it when you are ready.` } });
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (!isEdit && !canCreateAnything) {
    return (
      <>
        <div className="page-header"><h1>Create event</h1></div>
        <Alert variant="info">You can't create events yet. Club coordinators, fest leaders and faculty can.</Alert>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>{isEdit ? 'Edit event' : 'Create event'}</h1>
        <p>{isEdit ? existing.title : 'New events are saved as drafts. Nobody sees them until you publish.'}</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {locked && <Alert variant="warning">Completed or cancelled events can no longer be edited.</Alert>}

      <Form onSubmit={handleSubmit}>
        <fieldset disabled={locked || saving}>
          {/* ----- Basics ----- */}
          <Card body className="form-section">
            <div className="section-label">Basics</div>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label htmlFor="ev-organizer">Organized by</Form.Label>
                {isEdit ? (
                  <Form.Control
                    id="ev-organizer"
                    readOnly
                    value={
                      isUmbrella
                        ? `${existing.fest_name} · umbrella event`
                        : `${SCOPE_LABELS[existing.scope]}${existing.club_name ? ` · ${existing.club_name}` : existing.fest_name ? ` · ${existing.fest_name}` : ''}`
                    }
                  />
                ) : (
                  <Form.Select id="ev-organizer" value={form.organizer} onChange={(e) => chooseOrganizer(e.target.value)} required>
                    <option value="">Choose…</option>
                    {options.can_create_faculty_event && <option value="faculty">Faculty event (not part of a fest)</option>}
                    {fests.map((f) => (
                      <optgroup key={f.id} label={f.name}>
                        {f.clubs.map((c) => (
                          <option key={c.id} value={`club:${c.id}`}>{c.name}</option>
                        ))}
                        {f.can_create_fest_level && <option value={`multi:${f.id}`}>{f.name} · several clubs together</option>}
                        {f.can_create_fest_level && <option value={`fest:${f.id}`}>{f.name} · fest-level event</option>}
                        {f.can_create_umbrella && <option value={`umbrella:${f.id}`}>{f.name} · umbrella (groups other events)</option>}
                      </optgroup>
                    ))}
                  </Form.Select>
                )}
                {isEdit && <Form.Text muted>This cannot change after creation.</Form.Text>}
              </Col>

              {target && !isUmbrella && (
                <Col md={6}>
                  <Form.Label htmlFor="ev-type">Event type</Form.Label>
                  <Form.Select id="ev-type" value={form.event_type_id} onChange={(e) => setField('event_type_id', e.target.value)} required>
                    <option value="">Choose…</option>
                    {eventTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              {target && !isUmbrella && target.scope !== 'faculty' && umbrellas.length > 0 && (
                <Col md={6}>
                  <Form.Label htmlFor="ev-parent">Part of (optional)</Form.Label>
                  <Form.Select id="ev-parent" value={form.parent_event_id} onChange={(e) => setField('parent_event_id', e.target.value)}>
                    <option value="">Not part of an umbrella event</option>
                    {umbrellas.map((u) => (
                      <option key={u.id} value={u.id}>{u.title}{u.status === 'draft' ? ' (draft)' : ''}</option>
                    ))}
                  </Form.Select>
                  <Form.Text muted>The event must take place within the umbrella's dates.</Form.Text>
                </Col>
              )}

              {target?.scope === 'multi_club' && (
                <Col xs={12}>
                  <Form.Label>Participating clubs (at least two)</Form.Label>
                  <div>
                    {clubChoices.map((c) => (
                      <Form.Check
                        inline
                        key={c.id}
                        id={`club-${c.id}`}
                        label={c.name}
                        checked={form.participating_club_ids.includes(c.id)}
                        onChange={() => setField('participating_club_ids', toggle(form.participating_club_ids, c.id))}
                      />
                    ))}
                  </div>
                </Col>
              )}

              <Col xs={12}>
                <Form.Label htmlFor="ev-title">Title</Form.Label>
                <Form.Control id="ev-title" value={form.title} onChange={(e) => setField('title', e.target.value)} required maxLength={150} />
              </Col>
              <Col xs={12}>
                <Form.Label htmlFor="ev-description">Description</Form.Label>
                <Form.Control
                  id="ev-description"
                  as="textarea"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  maxLength={5000}
                />
              </Col>
            </Row>
          </Card>

          {/* ----- When and where ----- */}
          <Card body className="form-section">
            <div className="section-label">When and where</div>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label htmlFor="ev-start">Starts</Form.Label>
                <Form.Control id="ev-start" type="datetime-local" value={form.start_time} onChange={(e) => setField('start_time', e.target.value)} required />
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="ev-end">Ends</Form.Label>
                <Form.Control id="ev-end" type="datetime-local" value={form.end_time} onChange={(e) => setField('end_time', e.target.value)} required />
              </Col>
              <Col md={4}>
                <Form.Label htmlFor="ev-venue">Venue</Form.Label>
                <Form.Select id="ev-venue" value={form.venue_id} onChange={(e) => setField('venue_id', e.target.value)}>
                  <option value="">To be announced</option>
                  {venues?.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.capacity ? ` (${v.capacity})` : ''}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
            {!isUmbrella && (
              <Form.Text muted className="d-block mt-2">
                Sessions for attendance are created automatically: one per day if the event spans several days.
              </Form.Text>
            )}
          </Card>

          {/* ----- Registration ----- */}
          {target && !isUmbrella && (
            <Card body className="form-section">
              <div className="section-label">Registration</div>
              <Form.Check
                type="switch"
                id="ev-registration"
                label="People must register for this event"
                checked={form.registration_required}
                onChange={(e) => setField('registration_required', e.target.checked)}
              />

              {form.registration_required && (
                <Row className="g-3 mt-1">
                  <Col md={4}>
                    <Form.Label htmlFor="ev-deadline">Registration closes</Form.Label>
                    <Form.Control
                      id="ev-deadline"
                      type="datetime-local"
                      value={form.registration_deadline}
                      onChange={(e) => setField('registration_deadline', e.target.value)}
                    />
                    <Form.Text muted>Leave empty to close when the event starts.</Form.Text>
                  </Col>
                  <Col md={4}>
                    <Form.Label htmlFor="ev-capacity">Seats</Form.Label>
                    <Form.Control id="ev-capacity" type="number" min={1} value={form.capacity} onChange={(e) => setField('capacity', e.target.value)} />
                    <Form.Text muted>Leave empty for no limit.</Form.Text>
                  </Col>
                  <Col md={4}>
                    <Form.Label htmlFor="ev-fee">Fee (₹)</Form.Label>
                    <Form.Control id="ev-fee" type="number" min={0} step="1" value={form.fee} onChange={(e) => setField('fee', e.target.value)} />
                  </Col>
                  <Col xs={12}>
                    <Form.Check
                      type="switch"
                      id="ev-auto"
                      label="Accept registrations automatically (no manual approval)"
                      checked={form.auto_approve}
                      onChange={(e) => setField('auto_approve', e.target.checked)}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label htmlFor="ev-criteria">Certificates</Form.Label>
                    <Form.Select id="ev-criteria" value={form.certificate_criteria} onChange={(e) => setField('certificate_criteria', e.target.value)}>
                      {Object.entries(CRITERIA_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Form.Select>
                  </Col>
                  {form.certificate_criteria === 'attendance' && (
                    <Col md={6}>
                      <Form.Label htmlFor="ev-min">Minimum attendance (%)</Form.Label>
                      <Form.Control
                        id="ev-min"
                        type="number"
                        min={1}
                        max={100}
                        value={form.min_attendance_percent}
                        onChange={(e) => setField('min_attendance_percent', e.target.value)}
                      />
                    </Col>
                  )}
                </Row>
              )}
            </Card>
          )}

          {/* ----- Who can take part ----- */}
          {target && !isUmbrella && form.registration_required && (
            <Card body className="form-section">
              <div className="section-label">Who can take part (students)</div>
              <EligibilityPicker
                cells={form.cells}
                departmentIds={form.department_ids}
                departments={departments ?? []}
                onToggleCell={(key) => setField('cells', toggle(form.cells, key))}
                onToggleDepartment={(deptId) => setField('department_ids', toggle(form.department_ids, deptId))}
              />
            </Card>
          )}

          <div className="d-flex gap-2 mt-4">
            <Button type="submit">{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save as draft'}</Button>
            <Button as={Link} to="/organize" variant="outline-secondary">Cancel</Button>
          </div>
        </fieldset>
      </Form>
    </>
  );
}

function EligibilityPicker({ cells, departmentIds, departments, onToggleCell, onToggleDepartment }) {
  const years = [1, 2, 3, 4, 5];
  return (
    <>
      <p className="small text-muted">Leave everything unticked to open the event to all students.</p>
      <Table bordered size="sm" className="eligibility-grid mb-3" style={{ maxWidth: '28rem' }}>
        <thead>
          <tr>
            <th>Program</th>
            {years.map((y) => <th key={y}>Year {y}</th>)}
          </tr>
        </thead>
        <tbody>
          {PROGRAM_OPTIONS.map((p) => (
            <tr key={p.value}>
              <td>{p.label}</td>
              {years.map((y) => {
                const key = `${p.value}-${y}`;
                return (
                  <td key={y}>
                    {y <= PROGRAM_MAX_YEAR[p.value] && (
                      <Form.Check aria-label={`${p.label} year ${y}`} checked={cells.includes(key)} onChange={() => onToggleCell(key)} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>

      <Form.Label>Departments</Form.Label>
      <div>
        {departments.map((d) => (
          <Form.Check
            inline
            key={d.id}
            id={`dept-${d.id}`}
            label={d.code}
            checked={departmentIds.includes(d.id)}
            onChange={() => onToggleDepartment(d.id)}
          />
        ))}
      </div>
    </>
  );
}
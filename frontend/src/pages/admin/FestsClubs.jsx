import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';
import Loading from '../../components/Loading';
import StudentPickerModal from '../../components/StudentPickerModal';
import useLoad from '../../utils/useLoad';
import { POSITION_LABELS } from '../../utils/constants';

const HOLDER_TYPES = ['fest_head', 'gsec'];

export default function FestsClubs() {
  const { data: fests, loading, error, reload } = useLoad('/fests?all=1');
  const [orgTarget, setOrgTarget] = useState(null); // { kind: 'fest'|'club', fest?, item? }
  const [holderTarget, setHolderTarget] = useState(null); // { fest, type }
  const [coordinatorClub, setCoordinatorClub] = useState(null); // club getting a new coordinator
  const [removeTarget, setRemoveTarget] = useState(null); // { person, club }
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState('');

  async function toggleActive(kind, item) {
    setActionError('');
    try {
      await api.patch(`/${kind}s/${item.id}`, { is_active: !item.is_active });
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  async function saveHolder(student) {
    await api.put(`/admin/fests/${holderTarget.fest.id}/holders/${holderTarget.type}`, { user_id: student.id });
    setHolderTarget(null);
    reload();
  }

  async function addCoordinator(student) {
    await api.post(`/admin/clubs/${coordinatorClub.id}/coordinators`, { user_id: student.id });
    setCoordinatorClub(null);
    reload();
  }

  async function confirmRemove() {
    setRemoving(true);
    setActionError('');
    try {
      await api.delete(`/admin/positions/${removeTarget.person.position_id}`);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  if (loading && !fests) return <Loading />;

  const currentHolder = holderTarget ? holderTarget.fest[holderTarget.type] : null;

  return (
    <>
      <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
        <p className="text-muted mb-0">Every club belongs to one fest. Fest Head and GSec run the whole fest.</p>
        <Button onClick={() => setOrgTarget({ kind: 'fest' })}>+ Add fest</Button>
      </div>

      {(error || actionError) && <Alert variant="danger">{error || actionError}</Alert>}

      {fests?.map((fest) => (
        <Card key={fest.id} className="mb-4">
          <Card.Header className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <h2 className="h5 mb-0">
              {fest.name}
              {!fest.is_active && <Badge bg="secondary" className="ms-2">Inactive</Badge>}
            </h2>
            <div className="d-flex gap-1">
              <Button size="sm" variant="link" onClick={() => setOrgTarget({ kind: 'fest', item: fest })}>Edit</Button>
              <Button size="sm" variant="link" className="text-muted" onClick={() => toggleActive('fest', fest)}>
                {fest.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" variant="outline-primary" onClick={() => setOrgTarget({ kind: 'club', fest })}>+ Add club</Button>
            </div>
          </Card.Header>

          <Card.Body>
            <Row className="g-3 mb-3">
              {HOLDER_TYPES.map((type) => (
                <Col sm={6} key={type}>
                  <div className="holder d-flex justify-content-between align-items-center">
                    <div>
                      <div className="section-label mb-1">{POSITION_LABELS[type]}</div>
                      {fest[type] ? (
                        <>
                          <strong>{fest[type].name}</strong>{' '}
                          <span className="text-muted small">{fest[type].roll_no}</span>
                        </>
                      ) : (
                        <span className="text-muted">Not assigned</span>
                      )}
                    </div>
                    <Button size="sm" variant="link" onClick={() => setHolderTarget({ fest, type })}>
                      {fest[type] ? 'Change' : 'Assign'}
                    </Button>
                  </div>
                </Col>
              ))}
            </Row>

            <Table hover responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Club</th>
                  <th>Coordinators</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fest.clubs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-3">No clubs yet.</td>
                  </tr>
                )}
                {fest.clubs.map((club) => (
                  <tr key={club.id} className={club.is_active ? '' : 'row-inactive'}>
                    <td>
                      {club.name}
                      {!club.is_active && <Badge bg="secondary" className="ms-2">Inactive</Badge>}
                    </td>
                    <td>
                      {club.coordinators.length === 0 && <span className="text-muted">None</span>}
                      {club.coordinators.map((person) => (
                        <span className="chip" key={person.position_id}>
                          {person.name}
                          <button type="button" aria-label={`Remove ${person.name}`} onClick={() => setRemoveTarget({ person, club })}>
                            ×
                          </button>
                        </span>
                      ))}
                    </td>
                    <td className="text-end text-nowrap">
                      <Button size="sm" variant="link" onClick={() => setCoordinatorClub(club)}>+ Coordinator</Button>
                      <Button size="sm" variant="link" onClick={() => setOrgTarget({ kind: 'club', fest, item: club })}>Edit</Button>
                      <Button size="sm" variant="link" className="text-muted" onClick={() => toggleActive('club', club)}>
                        {club.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      ))}

      <OrgFormModal
        target={orgTarget}
        onHide={() => setOrgTarget(null)}
        onSaved={() => {
          setOrgTarget(null);
          reload();
        }}
      />

      <StudentPickerModal
        show={holderTarget !== null}
        title={holderTarget ? `${POSITION_LABELS[holderTarget.type]} of ${holderTarget.fest.name}` : ''}
        note={
          currentHolder
            ? `${currentHolder.name} will be replaced. Fest Event Creators they granted keep their access.`
            : 'Nobody holds this position yet.'
        }
        confirmLabel="Hand over"
        onConfirm={saveHolder}
        onHide={() => setHolderTarget(null)}
      />

      <StudentPickerModal
        show={coordinatorClub !== null}
        title={coordinatorClub ? `Add coordinator · ${coordinatorClub.name}` : ''}
        confirmLabel="Add coordinator"
        onConfirm={addCoordinator}
        onHide={() => setCoordinatorClub(null)}
      />

      <ConfirmModal
        show={removeTarget !== null}
        title="Remove coordinator"
        confirmLabel="Remove"
        variant="danger"
        busy={removing}
        onConfirm={confirmRemove}
        onHide={() => setRemoveTarget(null)}
      >
        Remove <strong>{removeTarget?.person.name}</strong> as coordinator of {removeTarget?.club.name}? They lose organizer access
        for this club straight away.
      </ConfirmModal>
    </>
  );
}

const EMPTY_ORG = { name: '', description: '', signatory_name: '', signatory_title: '' };

function OrgFormModal({ target, onHide, onSaved }) {
  const [form, setForm] = useState(EMPTY_ORG);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const kind = target?.kind; // 'fest' or 'club'
  const item = target?.item; // the row being edited, or undefined when adding

  function handleEnter() {
    setError('');
    setForm(
      item
        ? {
            name: item.name,
            description: item.description ?? '',
            signatory_name: item.signatory_name ?? '',
            signatory_title: item.signatory_title ?? '',
          }
        : EMPTY_ORG
    );
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const body = { ...form };
    if (kind === 'club' && !item) body.fest_id = target.fest.id;

    setSaving(true);
    setError('');
    try {
      if (item) {
        await api.patch(`/${kind}s/${item.id}`, body);
      } else {
        await api.post(`/${kind}s`, body);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const title = item ? `Edit ${item.name}` : kind === 'club' ? `Add club to ${target?.fest.name}` : 'Add fest';

  return (
    <Modal show={target !== null} onHide={onHide} onEnter={handleEnter} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title as="h3" className="h5">{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2">{error}</Alert>}
          <Form.Group className="mb-3" controlId="org-name">
            <Form.Label>Name</Form.Label>
            <Form.Control value={form.name} onChange={(e) => setField('name', e.target.value)} required maxLength={kind === 'fest' ? 60 : 100} />
          </Form.Group>
          <Form.Group className="mb-3" controlId="org-description">
            <Form.Label>Description (optional)</Form.Label>
            <Form.Control as="textarea" rows={2} value={form.description} onChange={(e) => setField('description', e.target.value)} maxLength={500} />
          </Form.Group>
          <Row className="g-3">
            <Col sm={6}>
              <Form.Group controlId="org-signatory-name">
                <Form.Label>Certificate signatory</Form.Label>
                <Form.Control value={form.signatory_name} onChange={(e) => setField('signatory_name', e.target.value)} maxLength={100} />
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="org-signatory-title">
                <Form.Label>Signatory title</Form.Label>
                <Form.Control
                  value={form.signatory_title}
                  onChange={(e) => setField('signatory_title', e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Faculty Advisor"
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Text muted>The signatory is printed on certificates from this {kind ?? 'fest'}.</Form.Text>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
import { useState } from 'react';
import { Alert, Button, Card, Form, Modal, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../../../api/client';
import ConfirmModal from '../../../components/ConfirmModal';
import Loading from '../../../components/Loading';
import StudentPicker from '../../../components/StudentPicker';
import useLoad from '../../../utils/useLoad';
import { DELEGATE_PRESETS, PERMISSION_LABELS } from '../../../utils/constants';
import { formatDate } from '../../../utils/format';

const ALL = Object.keys(PERMISSION_LABELS);

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function DelegatesTab({ event }) {
  const url = `/events/${event.id}/delegates`;
  const { data: delegates, loading, error, reload } = useLoad(url);
  const [editing, setEditing] = useState(null); // null = closed, 'new' = adding, a delegate = changing
  const [student, setStudent] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  function openForm(delegate) {
    setStudent(null);
    setPermissions(delegate ? delegate.permissions : []);
    setFormError('');
    setEditing(delegate || 'new');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const res =
        editing === 'new'
          ? await api.post(url, { user_id: student.id, permissions })
          : await api.put(`${url}/${editing.delegation_id}/permissions`, { permissions });
      setNotice(res.data.message);
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      const res = await api.post(`${url}/${revokeTarget.delegation_id}/revoke`);
      setNotice(res.data.message);
      reload();
    } catch (err) {
      setNotice('');
      setFormError(getErrorMessage(err));
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  if (loading && !delegates) return <Loading />;

  const isNew = editing === 'new';
  const canSave = permissions.length > 0 && (!isNew || student !== null);

  return (
    <>
      <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
        <p className="text-muted mb-0">
          Let students help with this event. They only get what you tick, never editing or cancelling, and access ends
          15 days after the event.
        </p>
        <Button onClick={() => openForm(null)} disabled={event.status === 'cancelled'}>+ Add delegate</Button>
      </div>

      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      <Card>
        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Delegate</th>
              <th>Can help with</th>
              <th>Access</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {delegates?.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted py-4">No delegates yet.</td>
              </tr>
            )}
            {delegates?.map((d) => {
              const status = d.active ? 'Active' : d.revoked_at ? 'Revoked' : 'Expired';
              return (
                <tr key={d.delegation_id} className={d.active ? '' : 'row-inactive'}>
                  <td>
                    {d.name}
                    <div className="small text-muted">{d.roll_no}</div>
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      {d.permissions.map((p) => (
                        <span key={p} className="soft-badge tone-neutral">{PERMISSION_LABELS[p]}</span>
                      ))}
                    </div>
                  </td>
                  <td className="small">
                    <span className={`soft-badge tone-${d.active ? 'success' : 'muted'} me-1`}>{status}</span>
                    <div className="text-muted mt-1">
                      {d.active ? `until ${formatDate(d.expires_at)} · granted by ${d.granted_by_name}` : d.revoked_by_name ? `by ${d.revoked_by_name}` : ''}
                    </div>
                  </td>
                  <td className="text-end text-nowrap">
                    {d.active ? (
                      <>
                        <Button size="sm" variant="link" onClick={() => openForm(d)}>Change</Button>
                        <Button size="sm" variant="link" className="text-danger" onClick={() => setRevokeTarget(d)}>Revoke</Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Modal show={editing !== null} onHide={() => setEditing(null)} centered>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton>
            <Modal.Title as="h3" className="h5">{isNew ? 'Add a delegate' : `Change access · ${editing?.name}`}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger" className="py-2">{formError}</Alert>}

            {isNew && (
              <div className="mb-4">
                <StudentPicker selected={student} onSelect={setStudent} />
              </div>
            )}

            <div className="section-label mb-2">Quick choices</div>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {DELEGATE_PRESETS.map((preset) => (
                <Button key={preset.label} size="sm" variant="outline-secondary" onClick={() => setPermissions(preset.permissions)}>
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="section-label mb-2">Can help with</div>
            {ALL.map((p) => (
              <Form.Check
                key={p}
                id={`perm-${p}`}
                label={PERMISSION_LABELS[p]}
                checked={permissions.includes(p)}
                onChange={() => setPermissions((prev) => toggle(prev, p))}
              />
            ))}
            <Form.Text muted>Editing, publishing and cancelling always stay with the event's managers.</Form.Text>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={!canSave || saving}>{saving ? 'Saving…' : isNew ? 'Add delegate' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmModal
        show={revokeTarget !== null}
        title="Revoke access"
        confirmLabel="Revoke"
        variant="danger"
        busy={revoking}
        onConfirm={handleRevoke}
        onHide={() => setRevokeTarget(null)}
      >
        Remove <strong>{revokeTarget?.name}</strong>'s access to this event? They'll be told.
      </ConfirmModal>
    </>
  );
}
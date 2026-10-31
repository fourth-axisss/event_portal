import { useState } from 'react';
import { Alert, Badge, Button, Card, Form, Modal, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../api/client';
import useLoad from '../utils/useLoad';
import Loading from './Loading';

// Value to put in the form: from the row when editing, a default when adding
function initialValue(field, row) {
  const value = row ? row[field.name] : undefined;
  if (field.type === 'checkbox') return row ? Boolean(value) : (field.defaultValue ?? false);
  if (field.type === 'select') return value ?? field.options[0].value;
  return value ?? '';
}

// How a value looks in the table
function displayValue(field, value) {
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  if (field.type === 'select') return field.options.find((o) => o.value === value)?.label ?? value;
  return value === null || value === '' ? '—' : value;
}

export default function MasterTable({ title, itemName, endpoint, fields }) {
  const { data, loading, error, reload } = useLoad(`${endpoint}?all=1`);
  const [editing, setEditing] = useState(null); // null = closed, 'new' = adding, a row = editing it
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  function openForm(row) {
    setForm(Object.fromEntries(fields.map((f) => [f.name, initialValue(f, row)])));
    setFormError('');
    setEditing(row || 'new');
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    const body = {};
    for (const f of fields) {
      const value = form[f.name];
      body[f.name] = f.type === 'number' ? (value === '' ? null : Number(value)) : value;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await api.post(endpoint, body);
      } else {
        await api.patch(`${endpoint}/${editing.id}`, body);
      }
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row) {
    setActionError('');
    try {
      await api.patch(`${endpoint}/${row.id}`, { is_active: !row.is_active });
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h2 className="h5 mb-0">{title}</h2>
        <Button size="sm" onClick={() => openForm()}>+ Add {itemName}</Button>
      </Card.Header>

      {(error || actionError) && (
        <Alert variant="danger" className="m-3 mb-0">{error || actionError}</Alert>
      )}

      {loading && !data ? (
        <Loading />
      ) : (
        <Table hover responsive className="mb-0 align-middle">
          <thead>
            <tr>
              {fields.map((f) => <th key={f.name}>{f.label}</th>)}
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.length === 0 && (
              <tr>
                <td colSpan={fields.length + 1} className="text-center text-muted py-4">Nothing added yet.</td>
              </tr>
            )}
            {data?.map((row) => (
              <tr key={row.id} className={row.is_active ? '' : 'row-inactive'}>
                {fields.map((f, i) => (
                  <td key={f.name}>
                    {displayValue(f, row[f.name])}
                    {i === 0 && !row.is_active && <Badge bg="secondary" className="ms-2">Inactive</Badge>}
                  </td>
                ))}
                <td className="text-end text-nowrap">
                  <Button size="sm" variant="link" onClick={() => openForm(row)}>Edit</Button>
                  <Button size="sm" variant="link" className="text-muted" onClick={() => toggleActive(row)}>
                    {row.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={editing !== null} onHide={() => setEditing(null)} centered>
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton>
            <Modal.Title as="h3" className="h5">
              {editing === 'new' ? `Add ${itemName}` : `Edit ${itemName}`}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger" className="py-2">{formError}</Alert>}
            {fields.map((f) => (
              <Form.Group key={f.name} className="mb-3" controlId={`${endpoint}-${f.name}`}>
                {f.type === 'checkbox' ? (
                  <Form.Check
                    type="switch"
                    label={f.label}
                    checked={form[f.name] ?? false}
                    onChange={(e) => setField(f.name, e.target.checked)}
                  />
                ) : (
                  <>
                    <Form.Label>{f.label}</Form.Label>
                    {f.type === 'select' ? (
                      <Form.Select value={form[f.name] ?? ''} onChange={(e) => setField(f.name, e.target.value)}>
                        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Form.Select>
                    ) : (
                      <Form.Control
                        type={f.type || 'text'}
                        value={form[f.name] ?? ''}
                        onChange={(e) => setField(f.name, e.target.value)}
                        required={f.required}
                        maxLength={f.maxLength}
                        min={f.min}
                      />
                    )}
                  </>
                )}
                {f.help && <Form.Text muted>{f.help}</Form.Text>}
              </Form.Group>
            ))}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Card>
  );
}
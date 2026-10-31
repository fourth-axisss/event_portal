import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../../api/client';
import Loading from '../../components/Loading';
import useLoad from '../../utils/useLoad';
import { PROGRAM_MAX_YEAR, PROGRAM_OPTIONS, ROLE_LABELS, ROLES } from '../../utils/constants';

const EMPTY_FILTERS = { role: '', q: '', is_active: '' };
const EMPTY_USER = {
  role: ROLES.STUDENT,
  name: '',
  email: '',
  password: '',
  phone: '',
  department_id: '',
  roll_no: '',
  program: 'UG',
  year: 1,
};

export default function Users() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | a user
  const [resetting, setResetting] = useState(null); // user whose password is being reset
  const [actionError, setActionError] = useState('');

  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '')).toString();
  const { data: users, loading, error, reload } = useLoad(`/admin/users${query ? `?${query}` : ''}`);
  const { data: departments } = useLoad('/departments');

  function setFilter(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleSearch(e) {
    e.preventDefault();
    setFilter('q', searchText.trim());
  }

  async function toggleActive(user) {
    setActionError('');
    try {
      await api.patch(`/admin/users/${user.id}`, { is_active: !user.is_active });
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  }

  return (
    <>
      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row className="g-2 align-items-end">
              <Col sm={6} lg={2}>
                <Form.Label htmlFor="filter-role" className="small text-muted mb-1">Role</Form.Label>
                <Form.Select id="filter-role" value={filters.role} onChange={(e) => setFilter('role', e.target.value)}>
                  <option value="">All roles</option>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={6} lg={2}>
                <Form.Label htmlFor="filter-status" className="small text-muted mb-1">Status</Form.Label>
                <Form.Select id="filter-status" value={filters.is_active} onChange={(e) => setFilter('is_active', e.target.value)}>
                  <option value="">Any status</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </Form.Select>
              </Col>
              <Col lg={5}>
                <Form.Label htmlFor="filter-q" className="small text-muted mb-1">Search</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control
                    id="filter-q"
                    placeholder="Name, email or roll no."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                  <Button type="submit" variant="outline-primary">Search</Button>
                </div>
              </Col>
              <Col lg={3} className="text-lg-end">
                <Button onClick={() => setEditing('new')}>+ Add user</Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {(error || actionError) && <Alert variant="danger">{error || actionError}</Alert>}

      <Card>
        {loading && !users ? (
          <Loading />
        ) : (
          <Table hover responsive className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Roll no.</th>
                <th>Dept</th>
                <th>Program</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">No users match these filters.</td>
                </tr>
              )}
              {users?.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'row-inactive'}>
                  <td>
                    {u.name}
                    {!u.is_active && <Badge bg="secondary" className="ms-2">Inactive</Badge>}
                    <div className="small text-muted">{u.email}</div>
                  </td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>{u.roll_no || '—'}</td>
                  <td>{u.department_code || '—'}</td>
                  <td>{u.program ? `${u.program}, Year ${u.year}` : '—'}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="link" onClick={() => setEditing(u)}>Edit</Button>
                    <Button size="sm" variant="link" onClick={() => setResetting(u)}>Reset password</Button>
                    <Button size="sm" variant="link" className="text-muted" onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {users && <p className="small text-muted mt-2">{users.length} user(s)</p>}

      <UserFormModal
        show={editing !== null}
        user={editing === 'new' ? null : editing}
        departments={departments || []}
        onHide={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
      <ResetPasswordModal user={resetting} onHide={() => setResetting(null)} />
    </>
  );
}

function UserFormModal({ show, user, departments, onHide, onSaved }) {
  const isNew = !user;
  const [form, setForm] = useState(EMPTY_USER);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isStudent = form.role === ROLES.STUDENT;
  const maxYear = PROGRAM_MAX_YEAR[form.program] || 5;

  function handleEnter() {
    setError('');
    setForm(
      user
        ? {
            role: user.role,
            name: user.name,
            email: user.email,
            password: '',
            phone: user.phone ?? '',
            department_id: user.department_id ?? '',
            roll_no: user.roll_no ?? '',
            program: user.program ?? 'UG',
            year: user.year ?? 1,
          }
        : EMPTY_USER
    );
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function setProgram(program) {
    setForm((prev) => ({ ...prev, program, year: Math.min(prev.year, PROGRAM_MAX_YEAR[program]) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const body = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      department_id: form.department_id === '' ? null : Number(form.department_id),
    };
    if (isStudent) {
      Object.assign(body, { roll_no: form.roll_no, program: form.program, year: Number(form.year) });
    }
    if (isNew) {
      Object.assign(body, { role: form.role, password: form.password });
    }

    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await api.post('/admin/users', body);
      } else {
        await api.patch(`/admin/users/${user.id}`, body);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} onEnter={handleEnter} centered size="lg">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title as="h3" className="h5">{isNew ? 'Add user' : `Edit ${user.name}`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2">{error}</Alert>}
          <Row className="g-3">
            <Col md={4}>
              <Form.Label htmlFor="u-role">Role</Form.Label>
              <Form.Select id="u-role" value={form.role} onChange={(e) => setField('role', e.target.value)} disabled={!isNew}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Form.Select>
              {!isNew && <Form.Text muted>Role cannot be changed.</Form.Text>}
            </Col>
            <Col md={8}>
              <Form.Label htmlFor="u-name">Full name</Form.Label>
              <Form.Control id="u-name" value={form.name} onChange={(e) => setField('name', e.target.value)} required maxLength={100} />
            </Col>
            <Col md={6}>
              <Form.Label htmlFor="u-email">Email</Form.Label>
              <Form.Control id="u-email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
            </Col>
            <Col md={6}>
              <Form.Label htmlFor="u-phone">Phone (optional)</Form.Label>
              <Form.Control id="u-phone" value={form.phone} onChange={(e) => setField('phone', e.target.value)} maxLength={15} />
            </Col>
            {isNew && (
              <Col md={6}>
                <Form.Label htmlFor="u-password">Password</Form.Label>
                <Form.Control
                  id="u-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <Form.Text muted>At least 8 characters.</Form.Text>
              </Col>
            )}
            <Col md={6}>
              <Form.Label htmlFor="u-dept">Department{isStudent ? '' : ' (optional)'}</Form.Label>
              <Form.Select id="u-dept" value={form.department_id} onChange={(e) => setField('department_id', e.target.value)} required={isStudent}>
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} · {d.name}</option>
                ))}
              </Form.Select>
            </Col>

            {isStudent && (
              <>
                <Col md={4}>
                  <Form.Label htmlFor="u-roll">Roll no.</Form.Label>
                  <Form.Control id="u-roll" value={form.roll_no} onChange={(e) => setField('roll_no', e.target.value)} required maxLength={20} />
                </Col>
                <Col md={4}>
                  <Form.Label htmlFor="u-program">Program</Form.Label>
                  <Form.Select id="u-program" value={form.program} onChange={(e) => setProgram(e.target.value)}>
                    {PROGRAM_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label htmlFor="u-year">Year</Form.Label>
                  <Form.Select id="u-year" value={form.year} onChange={(e) => setField('year', Number(e.target.value))}>
                    {Array.from({ length: maxYear }, (_, i) => i + 1).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Form.Select>
                </Col>
              </>
            )}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onHide }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setPassword('');
    setError('');
    setDone(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/admin/users/${user.id}/reset-password`, { new_password: password });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal show={user !== null} onHide={onHide} onExited={reset} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title as="h3" className="h5">Reset password · {user?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2">{error}</Alert>}
          {done ? (
            <Alert variant="success" className="mb-0">Password changed. Share it with {user?.name} privately.</Alert>
          ) : (
            <>
              <Form.Label htmlFor="new-password">New password</Form.Label>
              <Form.Control
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <Form.Text muted>At least 8 characters.</Form.Text>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {done ? (
            <Button onClick={onHide}>Close</Button>
          ) : (
            <>
              <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Set password'}</Button>
            </>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
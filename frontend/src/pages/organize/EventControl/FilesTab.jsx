import { useRef, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import api, { getErrorMessage } from '../../../api/client';
import ConfirmModal from '../../../components/ConfirmModal';
import { canOpenInBrowser, openFile } from '../../../utils/download';
import { FILE_ACCEPT, fileTypeLabel, formatFileSize, MAX_FILE_MB } from '../../../utils/files';
import { formatDateTime } from '../../../utils/format';

// Titled files (brochure, rulebook, schedule…) that everyone who can see the event can open
export default function FilesTab({ event, onChanged }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState(null); // { id, title } while a title is being edited
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInput = useRef(null);

  const locked = event.status === 'cancelled';
  const files = event.files;

  function chooseFile(e) {
    const chosen = e.target.files[0] || null;
    setError('');
    if (chosen && chosen.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`${chosen.name} is larger than ${MAX_FILE_MB} MB.`);
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(chosen);
    // Suggest a title from the file name, e.g. "Brochure_2026.pdf" → "Brochure 2026"
    if (chosen && !title.trim()) setTitle(chosen.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return setError('Choose a file to upload.');
    setBusy(true);
    setNotice('');
    setError('');
    try {
      // FormData = the browser's format for sending files; the title goes first, then the file
      const form = new FormData();
      form.append('title', title.trim());
      form.append('file', file);
      const res = await api.post(`/events/${event.id}/files`, form);
      setNotice(res.data.message);
      setTitle('');
      setFile(null);
      fileInput.current.value = '';
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(f) {
    setError('');
    try {
      await openFile(`/files/${f.id}/download`, f.original_name, f.mime_type);
    } catch {
      setError(`Could not open ${f.title}. Please try again.`);
    }
  }

  async function handleRename(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.patch(`/events/${event.id}/files/${renaming.id}`, { title: renaming.title });
      setRenaming(null);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError('');
    try {
      await api.delete(`/events/${event.id}/files/${deleteTarget.id}`);
      setNotice(`"${deleteTarget.title}" deleted`);
      onChanged();
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
        <div className="section-label">Upload a file</div>
        {event.status === 'draft' && (
          <Alert variant="info" className="py-2">
            Participants will see these files once the event is published.
          </Alert>
        )}
        {locked && <Alert variant="info" className="py-2">This event was cancelled.</Alert>}
        {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        <Form onSubmit={handleUpload}>
          <fieldset disabled={locked || busy}>
            <Row className="g-3 align-items-end">
              <Col md={5}>
                <Form.Group controlId="file-title">
                  <Form.Label>Title</Form.Label>
                  <Form.Control
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={150}
                    placeholder="e.g. Brochure, Rulebook, Schedule"
                  />
                </Form.Group>
              </Col>
              <Col md={5}>
                <Form.Group controlId="file-input">
                  <Form.Label>File</Form.Label>
                  <Form.Control type="file" ref={fileInput} accept={FILE_ACCEPT} onChange={chooseFile} required />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Button type="submit" className="w-100">{busy ? 'Uploading…' : 'Upload'}</Button>
              </Col>
            </Row>
            <Form.Text muted>PDF, Word, PowerPoint, Excel, JPG or PNG · up to {MAX_FILE_MB} MB.</Form.Text>
          </fieldset>
        </Form>
      </Card>

      <div className="section-label">Files on the event page ({files.length})</div>
      {files.length === 0 ? (
        <p className="text-muted">No files yet.</p>
      ) : (
        <Card>
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td>
                    {renaming?.id === f.id ? (
                      <Form onSubmit={handleRename} className="d-flex gap-2">
                        <Form.Control
                          size="sm"
                          value={renaming.title}
                          onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
                          required
                          maxLength={150}
                          autoFocus
                        />
                        <Button size="sm" type="submit" disabled={busy}>Save</Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => setRenaming(null)}>Cancel</Button>
                      </Form>
                    ) : (
                      <>
                        <div className="fw-semibold">{f.title}</div>
                        <div className="small text-muted">{f.original_name}</div>
                      </>
                    )}
                  </td>
                  <td>{fileTypeLabel(f)}</td>
                  <td className="text-nowrap">{formatFileSize(f.size_bytes)}</td>
                  <td className="text-nowrap small">{formatDateTime(f.created_at)}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-primary" onClick={() => handleOpen(f)}>
                      {canOpenInBrowser(f.mime_type) ? 'Open' : 'Download'}
                    </Button>
                    {!locked && (
                      <>
                        <Button size="sm" variant="link" onClick={() => setRenaming({ id: f.id, title: f.title })}>
                          Rename
                        </Button>
                        <Button size="sm" variant="link" className="text-danger" onClick={() => setDeleteTarget(f)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <ConfirmModal
        show={deleteTarget !== null}
        title="Delete file"
        confirmLabel="Delete"
        variant="danger"
        busy={busy}
        onConfirm={handleDelete}
        onHide={() => setDeleteTarget(null)}
      >
        Delete <strong>{deleteTarget?.title}</strong>? It disappears from the event page for everyone.
      </ConfirmModal>
    </>
  );
}

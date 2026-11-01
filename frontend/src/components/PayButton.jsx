import { useState } from 'react';
import { Alert, Button, Modal } from 'react-bootstrap';
import api, { getErrorMessage } from '../api/client';

export default function PayButton({ registrationId, amount, title, onDone, size, className }) {
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }
  const [error, setError] = useState('');

  async function start() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post(`/registrations/${registrationId}/payments`);
      setOrder(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function finish(success) {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/payments/${order.payment_id}/verify`, { success });
      setResult({ ok: res.data.status === 'paid', message: res.data.message });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    const paid = result?.ok;
    setOrder(null);
    setResult(null);
    setError('');
    if (paid) onDone?.();
  }

  return (
    <>
      <Button size={size} className={className} onClick={start} disabled={busy}>
        {busy && !order ? 'Starting…' : `Pay ₹${amount}`}
      </Button>
      {error && !order && <div className="small text-danger mt-1">{error}</div>}

      <Modal show={order !== null} onHide={close} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title as="h3" className="h5">Demo payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="py-2 small">
            This is a simulated payment page for the demo. No real money is involved.
          </Alert>
          <dl className="info-list mb-3">
            <dt>Event</dt>
            <dd>{title}</dd>
            <dt>Amount</dt>
            <dd><strong>₹{order?.amount}</strong></dd>
            <dt>Order</dt>
            <dd className="small text-muted text-break">{order?.order_id}</dd>
          </dl>
          {result && <Alert variant={result.ok ? 'success' : 'danger'} className="py-2 mb-0">{result.message}</Alert>}
          {error && <Alert variant="danger" className="py-2 mb-0">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          {result?.ok ? (
            <Button onClick={close}>Done</Button>
          ) : result ? (
            <>
              <Button variant="outline-secondary" onClick={close}>Close</Button>
              <Button onClick={start} disabled={busy}>Try again</Button>
            </>
          ) : (
            <>
              <Button variant="outline-danger" onClick={() => finish(false)} disabled={busy}>Simulate failure</Button>
              <Button onClick={() => finish(true)} disabled={busy}>{busy ? 'Processing…' : `Pay ₹${order?.amount}`}</Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
}
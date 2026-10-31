import { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../api/client';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="brand-mark">
          <span className="brand-square" />
          LNMIIT <span className="brand-sub">Events</span>
        </div>
        <div>
          <h1>Every fest, workshop and FDP in one place.</h1>
          <p>Browse events, register, track approvals and download your certificates.</p>
        </div>
        <div className="login-fests">Vivacity · Desportivos · Plinth</div>
      </div>

      <div className="login-form-wrap">
        <Form className="login-form" onSubmit={handleSubmit} noValidate={false}>
          <h2 className="h3 mb-1">Sign in</h2>
          <p className="text-muted mb-4">Use your institute email.</p>

          {error && <Alert variant="danger" className="py-2">{error}</Alert>}

          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </Form.Group>

          <Form.Group className="mb-4" controlId="password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Form.Group>

          <Button type="submit" className="w-100" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </Form>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useState } from 'react';
import { Dropdown, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { timeAgo } from '../utils/format';

const POLL_MS = 30000;

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setCount(res.data.count);
    } catch {
      // a missed poll is harmless; the next one will try again
    }
  }, []);

  // Poll every 30 s while the tab is visible, and again when the user comes back to the tab
  useEffect(() => {
    refreshCount();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount();
    }, POLL_MS);
    window.addEventListener('focus', refreshCount);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshCount);
    };
  }, [refreshCount]);

  async function handleToggle(isOpen) {
    setOpen(isOpen);
    if (!isOpen) return;
    setItems(null);
    try {
      const res = await api.get('/notifications');
      setItems(res.data);
    } catch {
      setItems([]);
    }
  }

  function openItem(item) {
    if (!item.is_read) {
      api.post(`/notifications/${item.id}/read`).then(refreshCount).catch(() => {});
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  }

  async function markAllRead() {
    await api.post('/notifications/read-all');
    setItems((prev) => prev?.map((n) => ({ ...n, is_read: 1 })) ?? prev);
    setCount(0);
  }

  return (
    <Dropdown align="end" show={open} onToggle={handleToggle} className="me-lg-2">
      <Dropdown.Toggle className="bell-toggle" aria-label={`Notifications, ${count} unread`}>
        <BellIcon />
        {count > 0 && <span className="bell-count">{count > 9 ? '9+' : count}</span>}
      </Dropdown.Toggle>

      <Dropdown.Menu className="bell-menu shadow">
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
          <strong className="small">Notifications</strong>
          {count > 0 && (
            <button type="button" className="btn btn-link btn-sm p-0" onClick={markAllRead}>Mark all read</button>
          )}
        </div>

        <div className="bell-list">
          {items === null && (
            <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
          )}
          {items?.length === 0 && <div className="text-center text-muted small py-4">No notifications yet.</div>}
          {items?.map((n) => (
            <Dropdown.Item as="button" key={n.id} className={`bell-item${n.is_read ? '' : ' unread'}`} onClick={() => openItem(n)}>
              <span className="unread-dot" aria-hidden="true" />
              <span>
                <span className="bell-text d-block small">{n.message}</span>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>{timeAgo(n.created_at)}</span>
              </span>
            </Dropdown.Item>
          ))}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
}
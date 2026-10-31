import { LIFECYCLE_LABELS } from '../utils/format';

export default function StatusBadge({ lifecycle }) {
  return <span className={`status-badge status-${lifecycle}`}>{LIFECYCLE_LABELS[lifecycle] ?? lifecycle}</span>;
}
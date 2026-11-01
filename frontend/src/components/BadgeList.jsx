export default function BadgeList({ badges }) {
  return badges.map((b) => (
    <span key={b.label} className={`soft-badge tone-${b.tone}`}>{b.label}</span>
  ));
}
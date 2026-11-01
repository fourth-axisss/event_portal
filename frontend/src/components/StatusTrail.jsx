function trailSteps(r) {
  const confirmed = r.status === 'confirmed';
  const byCompletion = r.certificate_criteria === 'completion';
  const attendedDone = byCompletion ? Boolean(r.completed) : r.sessions_attended > 0;
  const eventStarted = ['ongoing', 'completed'].includes(r.lifecycle);

  const steps = [
    { label: 'Registered', state: 'done' },
    {
      label: confirmed ? 'Confirmed' : r.status === 'approved' ? 'Payment due' : 'Awaiting approval',
      state: confirmed ? 'done' : 'current',
    },
    {
      label: byCompletion
        ? 'Completed'
        : r.sessions_total > 0
          ? `Attended ${r.sessions_attended}/${r.sessions_total}`
          : 'Attended',
      state: !confirmed ? 'todo' : attendedDone ? 'done' : eventStarted ? 'current' : 'todo',
    },
  ];
  if (r.certificate_criteria !== 'none') {
    steps.push({ label: 'Certificate', state: r.certificates.length > 0 ? 'done' : 'todo' });
  }
  return steps;
}

export default function StatusTrail({ registration }) {
  return (
    <ol className="trail" aria-label="Registration progress">
      {trailSteps(registration).map((step) => (
        <li key={step.label} className={step.state}>
          <span className="dot" aria-hidden="true" />
          {step.label}
          {step.state === 'current' && <span className="visually-hidden"> (current step)</span>}
        </li>
      ))}
    </ol>
  );
}
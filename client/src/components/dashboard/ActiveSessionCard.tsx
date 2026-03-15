interface Props {
  code: string;
  status: string;
  clientIp?: string;
  duration?: string;
  onClick: () => void;
}

export default function ActiveSessionCard({ code, status, clientIp, duration, onClick }: Props) {
  const statusColor = status === 'connected' || status === 'view_only'
    ? 'text-n10-success bg-n10-success/10 border-n10-success/20'
    : status === 'claimed'
    ? 'text-n10-primary bg-n10-primary/10 border-n10-primary/20'
    : 'text-n10-text-dim bg-n10-surface border-n10-border';

  return (
    <button
      onClick={onClick}
      className="bg-n10-mid rounded-xl border border-n10-border p-4 text-left hover:border-n10-primary/50 transition-colors w-full"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-bold text-lg text-n10-text">{code}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium border ${statusColor}`}>
          {status.toUpperCase().replace('_', ' ')}
        </span>
      </div>
      {clientIp && <p className="text-sm text-n10-text-dim">Client: {clientIp}</p>}
      {duration && <p className="text-sm text-n10-text-dim">Duration: {duration}</p>}
    </button>
  );
}

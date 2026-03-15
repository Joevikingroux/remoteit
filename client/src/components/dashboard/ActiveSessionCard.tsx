interface Props {
  code: string;
  status: string;
  clientIp?: string;
  duration?: string;
  onClick: () => void;
}

export default function ActiveSessionCard({ code, status, clientIp, duration, onClick }: Props) {
  const statusColor = status === 'connected' || status === 'view_only'
    ? 'text-green-600 bg-green-50'
    : status === 'claimed'
    ? 'text-blue-600 bg-blue-50'
    : 'text-gray-600 bg-gray-50';

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition-shadow w-full"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-bold text-lg text-gray-900">{code}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}>
          {status.toUpperCase().replace('_', ' ')}
        </span>
      </div>
      {clientIp && <p className="text-sm text-gray-500">Client: {clientIp}</p>}
      {duration && <p className="text-sm text-gray-500">Duration: {duration}</p>}
    </button>
  );
}

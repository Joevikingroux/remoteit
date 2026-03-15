interface Props {
  connected: boolean;
  sharing: boolean;
}

export default function StatusIndicator({ connected, sharing }: Props) {
  if (connected && sharing) {
    return (
      <div className="flex items-center justify-center gap-2 mt-4 text-green-600">
        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        <span className="font-medium">Technician connected — screen sharing active</span>
      </div>
    );
  }

  if (sharing && !connected) {
    return (
      <div className="flex items-center justify-center gap-2 mt-4 text-amber-600">
        <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
        <span className="font-medium">Screen sharing ready — waiting for technician...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-4 text-gray-500">
      <span className="w-3 h-3 bg-gray-400 rounded-full animate-pulse" />
      <span>Waiting for technician to connect...</span>
    </div>
  );
}

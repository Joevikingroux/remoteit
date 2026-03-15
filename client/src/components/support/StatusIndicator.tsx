interface Props {
  connected: boolean;
  sharing: boolean;
}

export default function StatusIndicator({ connected, sharing }: Props) {
  if (connected && sharing) {
    return (
      <div className="flex items-center justify-center gap-2 mt-4 text-n10-success">
        <span className="w-3 h-3 bg-n10-success rounded-full animate-pulse" />
        <span className="font-medium">Technician connected — screen sharing active</span>
      </div>
    );
  }

  if (sharing && !connected) {
    return (
      <div className="flex items-center justify-center gap-2 mt-4 text-n10-warning">
        <span className="w-3 h-3 bg-n10-warning rounded-full animate-pulse" />
        <span className="font-medium">Screen sharing ready — waiting for technician...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-4 text-n10-text-dim">
      <span className="w-3 h-3 bg-n10-text-dim rounded-full animate-pulse" />
      <span>Waiting for technician to connect...</span>
    </div>
  );
}

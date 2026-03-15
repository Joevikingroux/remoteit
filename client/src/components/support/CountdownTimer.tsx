import { useState, useEffect } from 'react';

interface Props {
  expiresAt: string;
  onExpired: () => void;
}

export default function CountdownTimer({ expiresAt, onExpired }: Props) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('0:00');
        onExpired();
        return false;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      return true;
    };

    if (!update()) return;
    const interval = setInterval(() => {
      if (!update()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  return (
    <p className="text-sm text-n10-text-dim">
      Code expires in <span className="font-mono font-semibold text-n10-warning">{timeLeft}</span>
    </p>
  );
}

interface SignalingSession {
  sessionId: string;
  code: string;
  clientSocketId: string | null;
  techSocketId: string | null;
  status: 'waiting' | 'active' | 'ended';
}

const store = new Map<string, SignalingSession>();

export function getSignalingSession(code: string): SignalingSession | undefined {
  return store.get(code);
}

export function setSignalingSession(code: string, session: SignalingSession) {
  store.set(code, session);
}

export function removeSignalingSession(code: string) {
  store.delete(code);
}

export function findSessionBySocketId(socketId: string): { code: string; role: 'client' | 'technician' } | undefined {
  for (const [code, session] of store.entries()) {
    if (session.clientSocketId === socketId) return { code, role: 'client' };
    if (session.techSocketId === socketId) return { code, role: 'technician' };
  }
  return undefined;
}

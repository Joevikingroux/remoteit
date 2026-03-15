import { Server, Socket } from 'socket.io';
import { getSessionByCode, updateSessionStatus } from '../services/session.service';
import { logAudit } from '../services/audit.service';
import { getIceServers } from '../utils/turnCredentials';
import {
  getSignalingSession,
  setSignalingSession,
  removeSignalingSession,
  findSessionBySocketId,
} from './sessionStore';

export function registerHandlers(io: Server, socket: Socket) {
  socket.on('join', (data: { role: 'client' | 'technician'; sessionCode: string }) => {
    const { role, sessionCode } = data;
    const code = sessionCode.toUpperCase();

    const dbSession = getSessionByCode(code);
    if (!dbSession || dbSession.status === 'ended') {
      socket.emit('error', { message: 'Invalid or expired session code' });
      return;
    }

    let sigSession = getSignalingSession(code);
    if (!sigSession) {
      sigSession = {
        sessionId: dbSession.id,
        code,
        clientSocketId: null,
        techSocketId: null,
        status: 'waiting',
      };
    }

    if (role === 'client') {
      sigSession.clientSocketId = socket.id;
    } else {
      sigSession.techSocketId = socket.id;
    }

    setSignalingSession(code, sigSession);
    socket.join(code);

    const iceServers = getIceServers(dbSession.id);
    socket.emit('joined', { role, iceServers, sessionId: dbSession.id });

    // Notify the other peer
    if (sigSession.clientSocketId && sigSession.techSocketId) {
      sigSession.status = 'active';
      setSignalingSession(code, sigSession);
      updateSessionStatus(code, 'connected');

      io.to(code).emit('peer-joined', { role });
      logAudit({ sessionId: dbSession.id, actor: 'system', action: 'peers_connected' });
    }
  });

  socket.on('sdp-offer', (data: { sdp: any; sessionCode: string }) => {
    const code = data.sessionCode.toUpperCase();
    const sigSession = getSignalingSession(code);
    if (!sigSession) return;

    const targetId = sigSession.techSocketId;
    if (targetId) {
      io.to(targetId).emit('sdp-offer', { sdp: data.sdp });
    }
  });

  socket.on('sdp-answer', (data: { sdp: any; sessionCode: string }) => {
    const code = data.sessionCode.toUpperCase();
    const sigSession = getSignalingSession(code);
    if (!sigSession) return;

    const targetId = sigSession.clientSocketId;
    if (targetId) {
      io.to(targetId).emit('sdp-answer', { sdp: data.sdp });
    }
  });

  socket.on('ice-candidate', (data: { candidate: any; sessionCode: string }) => {
    const code = data.sessionCode.toUpperCase();
    const sigSession = getSignalingSession(code);
    if (!sigSession) return;

    // Send to the other peer
    const targetId = sigSession.clientSocketId === socket.id
      ? sigSession.techSocketId
      : sigSession.clientSocketId;

    if (targetId) {
      io.to(targetId).emit('ice-candidate', { candidate: data.candidate });
    }
  });

  // ── Control flow messages ──
  socket.on('control-request', (data: { sessionCode: string; technicianName: string }) => {
    const code = data.sessionCode.toUpperCase();
    const sigSession = getSignalingSession(code);
    if (!sigSession || !sigSession.clientSocketId) return;

    io.to(sigSession.clientSocketId).emit('control-request', { technicianName: data.technicianName });
    logAudit({ sessionId: sigSession.sessionId, actor: 'technician', action: 'control_requested' });
  });

  socket.on('control-response', (data: { sessionCode: string; granted: boolean }) => {
    const code = data.sessionCode.toUpperCase();
    const sigSession = getSignalingSession(code);
    if (!sigSession || !sigSession.techSocketId) return;

    io.to(sigSession.techSocketId).emit('control-response', { granted: data.granted });
    if (data.granted) {
      updateSessionStatus(code, 'control_active');
    }
    logAudit({
      sessionId: sigSession.sessionId,
      actor: 'client',
      action: data.granted ? 'control_granted' : 'control_denied',
    });
  });

  socket.on('control-revoke', (data: { sessionCode: string; reason?: string }) => {
    const code = data.sessionCode.toUpperCase();
    const sigSession = getSignalingSession(code);
    if (!sigSession || !sigSession.techSocketId) return;

    io.to(sigSession.techSocketId).emit('control-revoke', { reason: data.reason || 'client_initiated' });
    updateSessionStatus(code, 'view_only');
    logAudit({ sessionId: sigSession.sessionId, actor: 'client', action: 'control_revoked' });
  });

  socket.on('disconnect', () => {
    const found = findSessionBySocketId(socket.id);
    if (!found) return;

    const { code, role } = found;
    const sigSession = getSignalingSession(code);
    if (!sigSession) return;

    if (role === 'client') {
      sigSession.clientSocketId = null;
    } else {
      sigSession.techSocketId = null;
    }

    // Notify the remaining peer
    io.to(code).emit('peer-left', { role });

    if (!sigSession.clientSocketId && !sigSession.techSocketId) {
      removeSignalingSession(code);
      updateSessionStatus(code, 'ended');
    } else {
      setSignalingSession(code, sigSession);
    }
  });
}

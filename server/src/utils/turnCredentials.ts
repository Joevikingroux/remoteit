import crypto from 'crypto';
import { config } from '../config/env';

export function getTurnCredentials(sessionId: string) {
  if (!config.turnSecret || !config.turnServer) {
    return null;
  }
  const timestamp = Math.floor(Date.now() / 1000) + 3600;
  const username = `${timestamp}:${sessionId}`;
  const hmac = crypto.createHmac('sha1', config.turnSecret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  return { username, credential };
}

export function getIceServers(sessionId: string) {
  const servers: RTCIceServer[] = [];

  if (config.stunServer) {
    servers.push({ urls: config.stunServer });
  }

  const turnCreds = getTurnCredentials(sessionId);
  if (turnCreds && config.turnServer) {
    servers.push({
      urls: config.turnServer,
      username: turnCreds.username,
      credential: turnCreds.credential,
    });
  }

  return servers;
}

interface RTCIceServer {
  urls: string;
  username?: string;
  credential?: string;
}

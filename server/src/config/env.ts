import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiry: process.env.JWT_EXPIRY || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  sessionCodeExpiryMinutes: parseInt(process.env.SESSION_CODE_EXPIRY_MINUTES || '10', 10),
  maxCodesPerIpPerHour: parseInt(process.env.MAX_CODES_PER_IP_PER_HOUR || '5', 10),

  turnServer: process.env.TURN_SERVER || '',
  turnSecret: process.env.TURN_SECRET || '',
  stunServer: process.env.STUN_SERVER || '',

  dbPath: path.resolve(__dirname, '../../data/remoteit.db'),
};

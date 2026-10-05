import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { telegramId } from './identity.mjs';

export const DEFAULT_FLOCK_DIR = fileURLToPath(new URL('../../public/flock/', import.meta.url));
export const DEFAULT_GAME_URL = 'https://sergei-ai-lab.github.io/grok-rpg-game/flock/';

export function readConfig(env = process.env) {
  if (!env.BOT_TOKEN || !/^\d+:[A-Za-z0-9_-]+$/.test(env.BOT_TOKEN)) throw new Error('BOT_TOKEN is required');
  if (!env.OWNER_TELEGRAM_ID) throw new Error('OWNER_TELEGRAM_ID is required');
  if (!env.DATA_DIR || !isAbsolute(env.DATA_DIR)) throw new Error('DATA_DIR must be an absolute mounted-volume path');
  const gameUrl = new URL(env.GAME_URL || DEFAULT_GAME_URL);
  if (gameUrl.protocol !== 'https:' || gameUrl.username || gameUrl.password) throw new Error('GAME_URL must use HTTPS');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return {
    token: env.BOT_TOKEN, ownerId: telegramId(env.OWNER_TELEGRAM_ID), dataDir: resolve(env.DATA_DIR),
    flockDir: resolve(env.FLOCK_DIR || DEFAULT_FLOCK_DIR), gameUrl: gameUrl.href, port,
  };
}

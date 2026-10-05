import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { DAY, telegramId, hatchDragon, attribution, stageForFeedings } from './identity.mjs';

export class IncubatorStore {
  constructor(dataDir) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.path = join(dataDir, 'incubator.sqlite');
    this.db = new DatabaseSync(this.path);
    chmodSync(this.path, 0o600);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, first_name TEXT NOT NULL,
        source TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
        dragon TEXT NOT NULL, feedings INTEGER NOT NULL DEFAULT 0 CHECK(feedings >= 0),
        last_fed_at INTEGER, bonus_food INTEGER NOT NULL DEFAULT 0 CHECK(bonus_food >= 0),
        glow INTEGER NOT NULL DEFAULT 0, reminders INTEGER NOT NULL DEFAULT 1,
        last_reminder_at INTEGER, blocked INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS referrals (
        invitee_id TEXT PRIMARY KEY REFERENCES players(id),
        referrer_id TEXT NOT NULL REFERENCES players(id), created_at INTEGER NOT NULL,
        CHECK(invitee_id != referrer_id)
      );
      CREATE TABLE IF NOT EXISTS activity (
        player_id TEXT NOT NULL REFERENCES players(id), day_age INTEGER NOT NULL,
        PRIMARY KEY(player_id, day_age)
      );
      CREATE TABLE IF NOT EXISTS events (
        key TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
        type TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_type_time ON events(type, created_at);
      CREATE TABLE IF NOT EXISTS operations (key TEXT PRIMARY KEY, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS photos (
        player_id TEXT PRIMARY KEY REFERENCES players(id), signature TEXT NOT NULL, file_id TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  }

  close() { this.db.close(); }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  getPlayer(id) {
    const row = this.db.prepare('SELECT * FROM players WHERE id = ?').get(telegramId(id));
    return row ? { ...row, dragon: JSON.parse(row.dragon), stage: stageForFeedings(row.feedings) } : null;
  }

  once(key, fn) {
    if (!key) throw new Error('An operation key is required');
    return this.transaction(() => {
      const previous = this.db.prepare('SELECT result FROM operations WHERE key = ?').get(key);
      if (previous) return { ...JSON.parse(previous.result), replayed: true };
      const result = fn();
      this.db.prepare('INSERT INTO operations VALUES (?, ?)').run(key, JSON.stringify(result));
      return { ...result, replayed: false };
    });
  }

  visit(id, now = Date.now()) {
    const player = this.getPlayer(id);
    if (!player) return;
    const age = Math.max(0, Math.floor((now - player.created_at) / DAY));
    this.db.prepare('INSERT OR IGNORE INTO activity VALUES (?, ?)').run(player.id, age);
    this.db.prepare('UPDATE players SET last_seen_at = ?, blocked = 0 WHERE id = ?').run(now, player.id);
  }

  event(key, id, type, now) {
    return this.db.prepare('INSERT OR IGNORE INTO events VALUES (?, ?, ?, ?)').run(key, telegramId(id), type, now).changes > 0;
  }

  start({ id, firstName = '', payload = '', catalog, key, now = Date.now() }) {
    id = telegramId(id);
    return this.once(key, () => {
      const existing = this.getPlayer(id);
      if (existing) { this.visit(id, now); return { id, created: false, rewardedReferrer: null }; }
      const origin = attribution(payload, id);
      const referrer = origin.referrerId && this.getPlayer(origin.referrerId);
      const dragon = hatchDragon(id, catalog);
      this.db.prepare(`INSERT INTO players
        (id, chat_id, first_name, source, created_at, last_seen_at, dragon)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, id, String(firstName).slice(0, 100), origin.source, now, now, JSON.stringify(dragon));
      let rewardedReferrer = null;
      if (referrer) {
        this.db.prepare('INSERT INTO referrals VALUES (?, ?, ?)').run(id, referrer.id, now);
        this.db.prepare('UPDATE players SET bonus_food = bonus_food + 1 WHERE id = ?').run(referrer.id);
        this.event(`ref:${id}`, referrer.id, 'referral', now);
        rewardedReferrer = referrer.id;
      }
      this.visit(id, now);
      this.event(`hatch:${id}`, id, 'hatch', now);
      return { id, created: true, rewardedReferrer };
    });
  }

  feed(id, key, now = Date.now()) {
    id = telegramId(id);
    return this.once(key, () => {
      const player = this.getPlayer(id);
      if (!player) return { ok: false, reason: 'missing' };
      this.visit(id, now);
      if (player.stage === 3) return { ok: false, reason: 'grown' };
      if (player.last_fed_at !== null && now - player.last_fed_at < DAY) {
        return { ok: false, reason: 'cooldown', nextAt: player.last_fed_at + DAY };
      }
      const count = player.feedings + 1;
      const stage = stageForFeedings(count);
      const bonus = player.bonus_food > 0 ? 1 : 0;
      this.db.prepare(`UPDATE players SET feedings = ?, last_fed_at = ?,
        bonus_food = bonus_food - ?, glow = glow + ? WHERE id = ?`).run(count, now, bonus, bonus, id);
      this.event(`feed:${key}`, id, 'feed', now);
      if (stage > player.stage) this.event(`evolve:${id}:${stage}`, id, `evolution_${stage}`, now);
      return { ok: true, feedings: count, stage, evolved: stage > player.stage, usedBonus: !!bonus };
    });
  }

  setReminders(id, enabled) {
    this.db.prepare('UPDATE players SET reminders = ? WHERE id = ?').run(enabled ? 1 : 0, telegramId(id));
  }

  setBlocked(id, blocked) {
    this.db.prepare('UPDATE players SET blocked = ? WHERE id = ?').run(blocked ? 1 : 0, telegramId(id));
  }

  dueReminderIds(now = Date.now(), limit = 100) {
    return this.db.prepare(`SELECT id FROM players WHERE reminders = 1 AND blocked = 0 AND feedings < 7
      AND COALESCE(last_fed_at, created_at) <= ? AND COALESCE(last_reminder_at, 0) <= ?
      ORDER BY COALESCE(last_reminder_at, 0), created_at LIMIT ?`).all(now - DAY, now - DAY, limit).map((row) => row.id);
  }

  claimReminder(id, now = Date.now()) {
    // Persist BEFORE sending: network ambiguity or restart cannot send two reminders in 24h.
    return this.db.prepare(`UPDATE players SET last_reminder_at = ? WHERE id = ?
      AND reminders = 1 AND blocked = 0 AND feedings < 7
      AND COALESCE(last_fed_at, created_at) <= ? AND COALESCE(last_reminder_at, 0) <= ?`)
      .run(now, telegramId(id), now - DAY, now - DAY).changes > 0;
  }

  getPhoto(id, signature) {
    return this.db.prepare('SELECT file_id FROM photos WHERE player_id = ? AND signature = ?').get(telegramId(id), signature)?.file_id;
  }

  savePhoto(id, signature, fileId) {
    this.db.prepare(`INSERT INTO photos VALUES (?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET signature = excluded.signature, file_id = excluded.file_id`)
      .run(telegramId(id), signature, fileId);
  }

  stats(now = Date.now()) {
    const total = this.db.prepare('SELECT COUNT(*) AS n FROM players').get().n;
    const sources = this.db.prepare(`SELECT source, COUNT(*) AS total,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new24h FROM players GROUP BY source ORDER BY source`).all(now - DAY);
    const retention = [1, 3, 7].map((day) => {
      // Only cohorts whose whole Dn window has elapsed are included in the rate.
      const matureBefore = now - (day + 1) * DAY;
      const eligible = this.db.prepare('SELECT COUNT(*) AS n FROM players WHERE created_at <= ?').get(matureBefore).n;
      const returned = this.db.prepare(`SELECT COUNT(*) AS n FROM activity a JOIN players p ON p.id = a.player_id
        WHERE a.day_age = ? AND p.created_at <= ?`).get(day, matureBefore).n;
      return { day, eligible, returned, percent: eligible ? +(100 * returned / eligible).toFixed(1) : null };
    });
    const events = Object.fromEntries(this.db.prepare('SELECT type, COUNT(*) AS n FROM events GROUP BY type').all().map((row) => [row.type, row.n]));
    return { total, sources, retention, events };
  }
}

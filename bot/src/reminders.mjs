import { setTimeout as delay } from 'node:timers/promises';

export async function sendDueReminders({ store, api, gameUrl, now = Date.now(), log = () => {}, signal }) {
  for (const id of store.dueReminderIds(now)) {
    if (signal?.aborted) break;
    if (!store.claimReminder(id, now)) continue;
    const player = store.getPlayer(id);
    try {
      await api.sendMessage(id, `🐉 ${player.dragon.name} ждёт тебя. Пора покормить и стать сильнее!\n/quiet — отключить напоминания.`, {
        reply_markup: { inline_keyboard: [
          [{ text: '🍖 Покормить', callback_data: 'feed' }],
          [{ text: '🎮 Играть', web_app: { url: gameUrl } }],
          [{ text: '🔕 Не напоминать', callback_data: 'quiet' }],
        ] },
      });
    } catch (error) {
      if (error.error_code === 403) store.setBlocked(id, true);
      log({ event: 'reminder_failed', code: error.error_code || 'network' });
      if (error.error_code === 429) break; // Leave other players unclaimed until next pass.
    }
    // Telegram's free broadcast limit is respected; no paid broadcasting.
    await delay(50, undefined, { signal }).catch(() => {});
  }
}

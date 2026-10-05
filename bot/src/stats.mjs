export function formatStats(stats, inlineEnabled) {
  const sources = ['direct', 'tiktok', 'insta', 'ref'].map((source) => {
    const row = stats.sources.find((item) => item.source === source);
    return `${source}: ${row?.total || 0} всего · ${row?.new24h || 0} за 24 ч`;
  });
  const retention = stats.retention.map((row) => `D${row.day}: ${row.returned}/${row.eligible}${row.percent === null ? ' · ещё нет зрелой когорты' : ` · ${row.percent}%`}`);
  return [
    '🐉 Инкубатор · статистика', `Игроков: ${stats.total}`, '', 'Новые игроки по первому источнику:', ...sources,
    '', 'Возвраты (завершённые окна 24 ч от регистрации):', ...retention,
    '', `Вылуплений: ${stats.events.hatch || 0}`,
    `Открыли «Показать друзьям»: ${stats.events.share_intent || 0}`,
    `Карточек отправлено через inline: ${stats.events.share_sent || 0}`,
    `Пришли по рефералу: ${stats.events.referral || 0}`,
    `Эволюций → взрослый: ${stats.events.evolution_2 || 0}`,
    `Эволюций → титан: ${stats.events.evolution_3 || 0}`,
    '', inlineEnabled ? 'Inline включён. Для точного счёта нужен /setinlinefeedback 100% в BotFather.' : 'Inline выключен в BotFather; подтверждённые пересылки пока недоступны.',
    'Обычные ручные пересылки Telegram боту не сообщает.',
  ].join('\n');
}

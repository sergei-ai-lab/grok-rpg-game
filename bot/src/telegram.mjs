import { Bot, InputFile } from 'grammy';
import { setTimeout as delay } from 'node:timers/promises';
import { DAY, RARITIES, STAGE_LABELS, referralUrl, telegramId } from './identity.mjs';
import { cardDescriptor, renderCard, renderEgg } from './cards.mjs';
import { formatStats } from './stats.mjs';

export function playerKeyboard(config) {
  return { inline_keyboard: [
    [{ text: '🍖 Покормить', callback_data: 'feed' }],
    [{ text: '💫 Показать друзьям', callback_data: 'share' }],
    [{ text: '🎮 Играть', web_app: { url: config.gameUrl } }],
  ] };
}

export function cardCaption(player, username) {
  const rarity = RARITIES.find((item) => item.id === player.dragon.rarity);
  return [
    `🐉 ${player.dragon.name} · ${rarity.label}`, `${STAGE_LABELS[player.stage - 1]} · рост ${player.feedings}/7`,
    '', ...player.dragon.legend, '', `🍖 Бонусная еда: ${player.bonus_food}${player.glow ? ` · сияние: ${player.glow}` : ''}`,
    'Вылупи своего дракона:', referralUrl(username, player.id),
  ].join('\n');
}

export function createIncubatorBot({ config, store, catalog, clock = Date.now, eggDelayMs = 700, botInfo, log = () => {} }) {
  const bot = new Bot(config.token, botInfo ? { botInfo } : undefined);
  let egg;
  const username = () => bot.botInfo.username;

  async function sendCard(id, { caption, replyMarkup = playerKeyboard(config), quiet = false } = {}) {
    const player = store.getPlayer(id);
    const descriptor = cardDescriptor(config.flockDir, player, catalog());
    const cached = store.getPhoto(id, descriptor.signature);
    const params = { caption: caption || cardCaption(player, username()), reply_markup: replyMarkup, disable_notification: quiet };
    let message;
    try {
      const photo = cached || new InputFile(await renderCard(player, descriptor, username()), 'dragon.jpg');
      message = await bot.api.sendPhoto(id, photo, params);
    } catch (error) {
      if (!cached || error.error_code !== 400) throw error;
      message = await bot.api.sendPhoto(id, new InputFile(await renderCard(player, descriptor, username()), 'dragon.jpg'), params);
    }
    const fileId = message.photo?.at(-1)?.file_id;
    if (fileId) store.savePhoto(id, descriptor.signature, fileId);
    return { player, descriptor, fileId };
  }

  bot.use(async (ctx, next) => {
    if (ctx.from?.is_bot) return;
    if (ctx.chat && ctx.chat.type !== 'private') return;
    // Reply and mutations are limited to the authenticated Telegram sender's private chat.
    if (ctx.chat && ctx.from && String(ctx.chat.id) !== String(ctx.from.id)) return;
    if (ctx.from && !ctx.myChatMember && store.getPlayer(ctx.from.id)) store.visit(ctx.from.id, clock());
    await next();
  });

  bot.command('start', async (ctx) => {
    const result = store.start({ id: ctx.from.id, firstName: ctx.from.first_name,
      payload: ctx.match.trim(), catalog: catalog(), key: `start:${ctx.update.update_id}`, now: clock() });
    if (result.created && !result.replayed) {
      egg ||= await renderEgg();
      await ctx.replyWithPhoto(new InputFile(egg, 'egg.jpg'), { caption: '🥚 Твоё яйцо треснуло… Сейчас вылупится личный дракон.' });
      await delay(eggDelayMs);
      const player = store.getPlayer(ctx.from.id);
      await sendCard(player.id, { caption: `✨ Он выбрал тебя!\n\n${cardCaption(player, username())}\n\nКормление — раз в 24 часа. Напоминания: максимум раз в 24 часа; /quiet — выключить.` });
    } else await sendCard(String(ctx.from.id));
  });

  async function feed(ctx) {
    const result = store.feed(ctx.from.id, `feed:${ctx.update.update_id}`, clock());
    const answer = async (text) => ctx.callbackQuery ? ctx.answerCallbackQuery({ text }) : ctx.reply(text);
    if (result.replayed) { await answer('Это действие уже учтено.'); return; }
    if (!result.ok) {
      const text = result.reason === 'missing' ? 'Сначала вылупи дракона: /start' : result.reason === 'grown'
        ? 'Твой дракон уже стал титаном! Открой FLOCK и играй.'
        : `Дракон ещё сыт. До кормления: ${Math.ceil((result.nextAt - clock()) / 3_600_000)} ч.`;
      await answer(text); return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Дракон накормлен!' });
    const player = store.getPlayer(ctx.from.id);
    const header = result.evolved ? result.stage === 2
      ? `🌟 Эволюция! ${player.dragon.name} расправляет взрослые крылья.`
      : `👑 Эволюция! ${player.dragon.name} стал титаном вашей стаи.`
      : `🍖 ${player.dragon.name} доволен. До ${player.stage === 1 ? 'взрослой стадии' : 'титана'}: ${(player.stage === 1 ? 3 : 7) - player.feedings} кормл.`;
    await sendCard(player.id, { caption: `${header}${result.usedBonus ? '\n✨ Бонусная еда усилила его сияние +1.' : ''}\n\n${cardCaption(player, username())}` });
  }
  bot.command('feed', feed);
  bot.callbackQuery('feed', feed);

  bot.command('dragon', async (ctx) => {
    if (!store.getPlayer(ctx.from.id)) return ctx.reply('Твоё яйцо ждёт: /start');
    await sendCard(String(ctx.from.id));
  });

  bot.callbackQuery('share', async (ctx) => {
    const player = store.getPlayer(ctx.from.id);
    if (!player) return ctx.answerCallbackQuery({ text: 'Сначала /start' });
    store.event(`share-intent:${ctx.update.update_id}`, player.id, 'share_intent', clock());
    await ctx.answerCallbackQuery();
    const url = referralUrl(username(), player.id);
    const inline = bot.botInfo.supports_inline_queries;
    const keyboard = { inline_keyboard: [
      inline ? [{ text: '💫 Выбрать друга и отправить карточку', switch_inline_query: `dragon_${player.id}` }]
        : [{ text: '💌 Поделиться приглашением', url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Вылупи личного дракона!')}` }],
      [{ text: '🥚 Вылупить своего', url }],
    ] };
    await sendCard(player.id, { caption: `${inline ? 'Выбери чат кнопкой ниже, затем нажми на карточку.' : 'Зажми эту карточку и выбери «Переслать». Ссылка на твоё приглашение уже в подписи.'}\nЗа нового друга — +1 бонусная еда.\n\n${cardCaption(player, username())}`, replyMarkup: keyboard });
  });

  bot.on('inline_query', async (ctx) => {
    const id = telegramId(ctx.from.id);
    const query = ctx.inlineQuery.query.trim();
    const player = store.getPlayer(id);
    if (!player || (query && query !== `dragon_${id}`)) {
      return ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
    }
    const descriptor = cardDescriptor(config.flockDir, player, catalog());
    let fileId = store.getPhoto(id, descriptor.signature);
    if (!fileId) fileId = (await sendCard(id, { quiet: true })).fileId;
    if (!fileId) return ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
    const url = referralUrl(username(), id);
    await ctx.answerInlineQuery([{
      type: 'photo', id: `dragon:${id}:${player.stage}`, photo_file_id: fileId,
      title: `${player.dragon.name} · ${STAGE_LABELS[player.stage - 1]}`,
      caption: cardCaption(player, username()),
      reply_markup: { inline_keyboard: [[{ text: '🥚 Вылупить своего дракона', url }]] },
    }], { cache_time: 0, is_personal: true });
  });

  bot.on('chosen_inline_result', (ctx) => {
    const result = ctx.chosenInlineResult;
    const match = /^dragon:([1-9]\d{0,15}):[123]$/.exec(result.result_id);
    if (!match || match[1] !== String(ctx.from.id) || !store.getPlayer(ctx.from.id)) return;
    const unique = result.inline_message_id || `update-${ctx.update.update_id}`;
    store.event(`share-sent:${unique}`, ctx.from.id, 'share_sent', clock());
  });

  bot.command('stats', (ctx) => {
    if (String(ctx.from.id) !== config.ownerId) return ctx.reply('Статистика доступна только владельцу.');
    return ctx.reply(formatStats(store.stats(clock()), !!bot.botInfo.supports_inline_queries));
  });

  async function setReminders(ctx, enabled) {
    if (!store.getPlayer(ctx.from.id)) return ctx.reply('Сначала вылупи дракона: /start');
    store.setReminders(ctx.from.id, enabled);
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Напоминания выключены' });
    return ctx.reply(enabled ? '🔔 Напоминания включены: максимум раз в 24 часа.' : '🔕 Напоминания выключены. Включить: /remind');
  }
  bot.command('quiet', (ctx) => setReminders(ctx, false));
  bot.callbackQuery('quiet', (ctx) => setReminders(ctx, false));
  bot.command('remind', (ctx) => setReminders(ctx, true));
  bot.command('play', (ctx) => ctx.reply('🎮 Твоя стая ждёт в FLOCK.', {
    reply_markup: { inline_keyboard: [[{ text: '🎮 Играть', web_app: { url: config.gameUrl } }]] },
  }));
  bot.on('my_chat_member', (ctx) => {
    if (!store.getPlayer(ctx.chat.id)) return;
    store.setBlocked(ctx.chat.id, ['kicked', 'left'].includes(ctx.myChatMember.new_chat_member.status));
  });
  bot.on('message:text', (ctx) => ctx.reply('🥚 /start — яйцо\n🐉 /dragon — твой дракон\n🍖 /feed — покормить\n🎮 /play — FLOCK\n🔕 /quiet — без напоминаний', {
    reply_markup: playerKeyboard(config),
  }));

  bot.catch((error) => {
    // Never log the error object or request URL: they may contain BOT_TOKEN.
    log({ event: 'telegram_handler_failed', updateId: error.ctx.update.update_id,
      code: error.error?.error_code || 'internal' });
  });
  return bot;
}

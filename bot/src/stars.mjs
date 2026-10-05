// Product extension point only. No invoices, purchase callbacks or payment provider.
// Future implementation must validate Telegram successful_payment server-side and
// grant each charge once in a transaction. Neither offer is enabled in this release.
export const FUTURE_STARS_OFFERS = Object.freeze({
  accelerateEvolution: { enabled: false },
  secondEgg: { enabled: false },
});

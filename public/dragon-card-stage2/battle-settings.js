// Stage 2 can import Stage 1 progress once without writing to its save keys.
// The profile format and reward/progression rules remain unchanged in Stage A.
export const stageStorage = {
  getItem(key) {
    return localStorage.getItem(`stage2:${key}`) ?? localStorage.getItem(key);
  },
  setItem(key, value) { localStorage.setItem(`stage2:${key}`, value); },
};

export const battleSettings = { mode: 'charge', difficulty: 'normal' };
try {
  const mode = stageStorage.getItem('dragon-prototype-mode');
  if (['charge', 'dragon-charge', 'energy'].includes(mode)) battleSettings.mode = mode;
  const difficulty = stageStorage.getItem('dragon-ai-difficulty');
  if (['easy', 'normal', 'hard'].includes(difficulty)) battleSettings.difficulty = difficulty;
} catch { /* A phone with storage disabled can still play. */ }

export function saveBattleSettings(mode, difficulty) {
  battleSettings.mode = mode; battleSettings.difficulty = difficulty;
  try {
    stageStorage.setItem('dragon-prototype-mode', mode);
    stageStorage.setItem('dragon-ai-difficulty', difficulty);
  } catch { /* Optional preferences. */ }
}

import { stageStorage } from './battle-settings.js?v=5c6e62ac7cc8';
let audioContext;
export const feel = { sound: false, vibration: false, motion: true };
try { const saved = JSON.parse(stageStorage.getItem('dragon-feel')); for (const key of Object.keys(feel)) if (typeof saved?.[key] === 'boolean') feel[key] = saved[key]; } catch { /* Optional preferences. */ }
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function setFeel(key, value) {
  if (!(key in feel)) return;
  feel[key] = !!value;
  try { stageStorage.setItem('dragon-feel', JSON.stringify(feel)); } catch { /* Optional preferences. */ }
  if (key === 'sound' && value) unlockAudio();
}
export function unlockAudio() {
  if (!feel.sound) return;
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext; if (!Audio) return;
    audioContext ||= new Audio(); void audioContext.resume().catch(() => {});
  } catch { /* Audio unavailable; the battle continues. */ }
}
function tone(type) {
  if (!feel.sound || audioContext?.state !== 'running') return;
  const pitch = { strike: 180, power: 290, burst: 90, fuse: 360, switch: 220, attach: 480, victory: 660, defeat: 120, evolution: 520 }[type] || 280;
  const notes = ['victory', 'evolution', 'fuse'].includes(type) ? 3 : 1;
  for (let i = 0; i < notes; i++) {
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), time = audioContext.currentTime + i * .09;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(pitch * (1 + i * .25), time);
    gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(.035, time + .012); gain.gain.exponentialRampToValueAtTime(.0001, time + .15);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(time); oscillator.stop(time + .16);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
export function transition(element) {
  if (feel.motion && !reduced()) element.animate([{ opacity: .3, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
}
export function feedbackEffect(type, target) {
  tone(type);
  if (feel.vibration && typeof navigator.vibrate === 'function') navigator.vibrate(type === 'burst' ? [20, 30, 20] : 12);
  if (!feel.motion || reduced() || !target) return;
  target.animate([{ opacity: .6, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  if (['attach', 'switch'].includes(type)) return;
  const rect = target.getBoundingClientRect(), layer = document.createElement('div'); layer.className = 'impact-layer'; layer.setAttribute('aria-hidden', 'true');
  layer.style.left = `${rect.x + rect.width / 2}px`; layer.style.top = `${rect.y + rect.height / 2}px`;
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement('i'), angle = i * Math.PI / 4; dot.style.setProperty('--x', `${Math.cos(angle) * 60}px`); dot.style.setProperty('--y', `${Math.sin(angle) * 60}px`); layer.append(dot);
  }
  document.body.append(layer); setTimeout(() => layer.remove(), 650);
}

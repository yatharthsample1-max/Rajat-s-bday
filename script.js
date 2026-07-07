// Shared helpers for RAJAT.SYS site

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STORAGE_KEYS = {
  musicEnabled: 'rajat_sys_music_enabled',
  musicUnlocked: 'rajat_sys_music_unlocked'
};

let audioElement = null;
let synthEngine = null;
let clickAudioCooldown = false;

function safeGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

function countUp(el, target, duration = 1400) {
  if (!el) return;
  if (prefersReducedMotion) { el.textContent = target; return; }
  const start = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(frame);
    else el.textContent = target;
  }
  requestAnimationFrame(frame);
}

function launchConfetti(count = 50) {
  const emojis = ["🎉", "🎈", "🎂", "✨", "🥳", "🎮", "🌸", "🔥"];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.animationDuration = (Math.random() * 2 + 2.5) + "s";
    piece.style.fontSize = (Math.random() * 1.4 + 1) + "em";
    piece.style.transform = `translateY(-20px) rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 5000);
  }
}

function ensureMusicUI() {
  if (document.querySelector('.music-control')) return;

  const button = document.createElement('button');
  button.className = 'music-control';
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<span class="music-control__dot"></span><span class="music-control__label">PLAY MUSIC</span>';
  button.addEventListener('click', () => toggleMusic());
  document.body.appendChild(button);
}

function ensureCelebrationOverlay() {
  if (document.querySelector('.celebration-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'celebration-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="celebration-panel" role="dialog" aria-modal="true" aria-label="Birthday celebration">
      <div class="celebration-kicker">SYSTEM ALERT · BIRTHDAY MODE</div>
      <h2 class="celebration-title">HAPPY BIRTHDAY, RAJAT 🎉</h2>
      <p class="celebration-text">Level up unlocked. Chaos, Ws, and cake are now officially active.</p>
      <button class="celebration-close" type="button">CLOSE</button>
    </div>
  `;
  overlay.querySelector('.celebration-close').addEventListener('click', hideCelebrationOverlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideCelebrationOverlay();
  });
  document.body.appendChild(overlay);
}

function showCelebrationOverlay() {
  ensureCelebrationOverlay();
  const overlay = document.querySelector('.celebration-overlay');
  if (!overlay) return;
  overlay.classList.add('is-visible');
  overlay.setAttribute('aria-hidden', 'false');
}

function hideCelebrationOverlay() {
  const overlay = document.querySelector('.celebration-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.setAttribute('aria-hidden', 'true');
}

function playClickSound() {
  if (prefersReducedMotion || clickAudioCooldown) return;
  clickAudioCooldown = true;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = 520;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.start(now);
    osc.stop(now + 0.16);

    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    // ignore audio failures
  }

  setTimeout(() => { clickAudioCooldown = false; }, 80);
}

function noteToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createSynthEngine() {
  if (synthEngine) return synthEngine;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  const ctx = new AudioCtx();
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const delay = ctx.createDelay(1.0);
  const delayGain = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();

  master.gain.value = 0.0001;
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  delay.delayTime.value = 0.23;
  delayGain.gain.value = 0.18;

  delay.connect(delayGain);
  delayGain.connect(filter);
  filter.connect(compressor);
  compressor.connect(master);
  master.connect(ctx.destination);

  const pattern = [
    { note: 69, bass: 45 },
    { note: 72, bass: 45 },
    { note: 76, bass: 47 },
    { note: 74, bass: 45 },
    { note: 72, bass: 43 },
    { note: 76, bass: 45 },
    { note: 79, bass: 47 },
    { note: 76, bass: 45 },
  ];

  let isPlaying = false;
  let timer = null;
  let step = 0;

  function pluck(freq, when, duration, type, velocity, destination = master) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const localFilter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);

    localFilter.type = 'lowpass';
    localFilter.frequency.setValueAtTime(2400, when);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(velocity, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.connect(localFilter);
    localFilter.connect(gain);
    gain.connect(destination);

    osc.start(when);
    osc.stop(when + duration + 0.03);
  }

  function scheduleTick() {
    const now = ctx.currentTime;
    const slot = pattern[step % pattern.length];
    const nextStep = (step + 1) % pattern.length;

    pluck(noteToFreq(slot.bass), now, 0.32, 'square', 0.035, delay);
    pluck(noteToFreq(slot.bass + 12), now + 0.01, 0.12, 'triangle', 0.02, delay);

    pluck(noteToFreq(slot.note), now + 0.005, 0.18, 'triangle', 0.05);
    if (step % 2 === 0) {
      pluck(noteToFreq(pattern[nextStep].note + 12), now + 0.06, 0.10, 'sine', 0.02);
    }

    const hat = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    hat.buffer = buffer;
    const hatFilter = ctx.createBiquadFilter();
    hatFilter.type = 'highpass';
    hatFilter.frequency.value = 7000;
    const hatGain = ctx.createGain();
    hatGain.gain.value = 0.0001;
    hatGain.gain.exponentialRampToValueAtTime(0.01, now + 0.002);
    hatGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    hat.connect(hatFilter);
    hatFilter.connect(hatGain);
    hatGain.connect(master);
    hat.start(now + 0.03);
    hat.stop(now + 0.06);

    step = (step + 1) % pattern.length;
  }

  function start() {
    if (isPlaying) return;
    isPlaying = true;
    ctx.resume().catch(() => {});
    master.gain.setTargetAtTime(0.07, ctx.currentTime, 0.03);
    scheduleTick();
    timer = setInterval(scheduleTick, 260);
  }

  function stop() {
    isPlaying = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    try {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
    } catch {
      master.gain.value = 0.0001;
    }
  }

  synthEngine = { ctx, master, start, stop, get isPlaying() { return isPlaying; } };
  return synthEngine;
}

function ensureAudioElement() {
  if (audioElement) return audioElement;
  audioElement = document.getElementById('bgMusic');
  return audioElement;
}

function updateMusicButtonState(enabled, mode = 'audio') {
  const button = document.querySelector('.music-control');
  if (!button) return;
  button.classList.toggle('is-on', enabled);
  button.setAttribute('aria-pressed', String(enabled));
  const label = button.querySelector('.music-control__label');
  if (!label) return;
  if (enabled) {
    label.textContent = mode === 'audio' ? 'ABOUT YOU ON' : 'MUSIC ON';
  } else {
    label.textContent = mode === 'audio' ? 'ABOUT YOU OFF' : 'MUSIC OFF';
  }
}

function startMusic() {
  ensureMusicUI();
  const audio = ensureAudioElement();

  safeSet(STORAGE_KEYS.musicUnlocked, '1');
  safeSet(STORAGE_KEYS.musicEnabled, '1');

  if (audio) {
    audio.volume = 0.68;
    audio.loop = true;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        const synth = createSynthEngine();
        if (synth) synth.start();
        updateMusicButtonState(true, 'synth');
      });
    }
    updateMusicButtonState(true, 'audio');
    return true;
  }

  const synth = createSynthEngine();
  if (synth) {
    synth.start();
    updateMusicButtonState(true, 'synth');
    return true;
  }
  return false;
}

function stopMusic() {
  const audio = ensureAudioElement();
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  const synth = createSynthEngine();
  if (synth) synth.stop();
  safeSet(STORAGE_KEYS.musicEnabled, '0');
  updateMusicButtonState(false, audio ? 'audio' : 'synth');
}

function toggleMusic() {
  ensureMusicUI();
  const enabled = safeGet(STORAGE_KEYS.musicEnabled, '0') === '1';
  playClickSound();
  if (enabled) stopMusic();
  else startMusic();
}

function maybeResumeMusicOnGesture() {
  const enabled = safeGet(STORAGE_KEYS.musicEnabled, '0') === '1';
  const unlocked = safeGet(STORAGE_KEYS.musicUnlocked, '0') === '1';
  if (!enabled || !unlocked) return;
  startMusic();
}

function bindSoundEffects() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.music-control')) return;
    if (target.closest('.celebration-close')) return;
    if (target.closest('a, button')) playClickSound();
  }, { capture: true });

  document.addEventListener('pointerdown', () => {
    safeSet(STORAGE_KEYS.musicUnlocked, '1');
  }, { once: true, capture: true });
}

function launchBirthdayMode() {
  launchConfetti(prefersReducedMotion ? 12 : 80);
  showCelebrationOverlay();

  const messageStatus = document.getElementById('msgStatus');
  if (messageStatus) messageStatus.textContent = 'Seen 👀';

  const bubble = document.getElementById('msgBubble');
  if (bubble) bubble.style.transform = 'translateY(0) scale(1.01)';

  if (!prefersReducedMotion) {
    setTimeout(() => hideCelebrationOverlay(), 4300);
  }
}

window.countUp = countUp;
window.launchConfetti = launchConfetti;
window.startBirthdayCelebration = launchBirthdayMode;
window.toggleMusic = toggleMusic;
window.startMusic = startMusic;
window.stopMusic = stopMusic;
window.prefersReducedMotion = prefersReducedMotion;

window.addEventListener('DOMContentLoaded', () => {
  ensureMusicUI();
  bindSoundEffects();
  updateMusicButtonState(safeGet(STORAGE_KEYS.musicEnabled, '0') === '1', 'audio');

  const enabled = safeGet(STORAGE_KEYS.musicEnabled, '0') === '1';
  const unlocked = safeGet(STORAGE_KEYS.musicUnlocked, '0') === '1';

  if (enabled && unlocked) {
    startMusic();
  } else if (enabled) {
    document.addEventListener('pointerdown', maybeResumeMusicOnGesture, { once: true });
  }
});

import { audioManager } from './audio.js';
import { loadSettings, saveSettings } from './storage.js';

const settings = loadSettings();
audioManager.setMusicOn(settings.musicOn);

const btnStart = document.getElementById('btnStart');
const btnGame2 = document.getElementById('btnGame2');
const btnGame3 = document.getElementById('btnGame3');
const btnGame4 = document.getElementById('btnGame4');
const btnGame5 = document.getElementById('btnGame5');
const btnSettings = document.getElementById('btnSettings');
const btnExit = document.getElementById('btnExit');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const musicToggle = document.getElementById('musicToggle');

musicToggle.checked = settings.musicOn;

btnStart.addEventListener('click', () => {
  window.location.href = 'game.html';
});

btnGame2.addEventListener('click', () => {
  window.location.href = 'game2.html';
});

btnGame3.addEventListener('click', () => {
  window.location.href = 'game3.html';
});

btnGame4.addEventListener('click', () => {
  window.location.href = 'game4.html';
});

btnGame5.addEventListener('click', () => {
  window.location.href = 'game5.html';
});

btnSettings.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});

closeSettings.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

musicToggle.addEventListener('change', () => {
  settings.musicOn = musicToggle.checked;
  saveSettings(settings);
  audioManager.setMusicOn(settings.musicOn);
});

btnExit.addEventListener('click', () => {
  if (!confirm('Bạn có chắc muốn thoát game không?')) return;
  window.close();
  // Fallback for browsers that block window.close() on tabs not opened by script.
  document.body.innerHTML =
    '<div class="menu-screen"><h1 class="game-logo">👋 Hẹn gặp lại!</h1><p class="game-subtitle">Bạn có thể đóng tab này.</p></div>';
});

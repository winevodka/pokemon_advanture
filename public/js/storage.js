const STORAGE_KEY = 'pla_game_state_v1';
const SETTINGS_KEY = 'pla_settings_v1';
const COLORLAB_KEY = 'pla_colorlab_v1';

export function loadGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGameState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage unavailable (e.g. private mode) — progress just won't persist */
  }
}

export function clearGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { musicOn: true };
  } catch {
    return { musicOn: true };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function loadColorLabState() {
  const defaults = {
    colorBook: [],
    achievements: {},
    stats: { missionsCompleted: 0, perfectCount: 0 },
    tier: 1,
  };
  try {
    const raw = localStorage.getItem(COLORLAB_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveColorLabState(state) {
  try {
    localStorage.setItem(COLORLAB_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

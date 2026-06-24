const GOAL_MS = 15 * 60 * 1000;

export function getSessionSlot() {
  const h = new Date().getHours();
  return h < 13 ? 'am' : 'pm';
}

export function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function loadDayProgress() {
  try {
    const raw = localStorage.getItem('charlemos_day_' + getTodayKey());
    return raw ? JSON.parse(raw) : { am: 0, pm: 0 };
  } catch { return { am: 0, pm: 0 }; }
}

export function saveDayProgress(progress) {
  localStorage.setItem('charlemos_day_' + getTodayKey(), JSON.stringify(progress));
}

export function createTimer({ onTick, onGoalReached }) {
  let startTs = null;
  let accumulated = 0;
  let intervalId = null;
  let goalFired = false;

  function tick() {
    const elapsed = accumulated + (Date.now() - startTs);
    const pct = Math.min(elapsed / GOAL_MS * 100, 100);
    const mins = Math.floor(elapsed / 60000);
    onTick({ elapsed, pct, mins });
    if (!goalFired && elapsed >= GOAL_MS) {
      goalFired = true;
      onGoalReached();
    }
  }

  return {
    start() {
      startTs = Date.now();
      intervalId = setInterval(tick, 1000);
    },
    pause() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (startTs) { accumulated += Date.now() - startTs; startTs = null; }
      return accumulated;
    },
    resume(savedMs = 0) {
      accumulated = savedMs;
      startTs = Date.now();
      intervalId = setInterval(tick, 1000);
    },
    stop() {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      return accumulated + (startTs ? Date.now() - startTs : 0);
    },
    getElapsed() {
      return accumulated + (startTs ? Date.now() - startTs : 0);
    },
  };
}

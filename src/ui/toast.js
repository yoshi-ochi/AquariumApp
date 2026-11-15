const container = () => document.getElementById('toast');

export function toast(message, { error = false, duration = 2400 } = {}) {
  const el = document.createElement('div');
  el.className = `msg${error ? ' error' : ''}`;
  el.textContent = message;
  container().appendChild(el);
  setTimeout(() => el.remove(), duration);
}

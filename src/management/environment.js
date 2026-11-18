/** 館の外の環境。日付と時刻から決まるので、同じ時間帯は全員同じ天候になる */
const MONTH_TEMP = [6, 7, 10, 15, 20, 23, 27, 28, 25, 19, 13, 8];
const WEATHERS = [
  { id: 'sun', label: '晴れ' },
  { id: 'sun', label: '晴れ' },
  { id: 'cloud', label: 'くもり' },
  { id: 'cloud', label: 'くもり' },
  { id: 'rain', label: '雨' },
];

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function currentEnvironment(date = new Date()) {
  const slot = Math.floor(date.getTime() / (3 * 3600 * 1000)); // 3時間ごとに変わる
  const hour = date.getHours() + date.getMinutes() / 60;
  const daily = Math.cos(((hour - 14) / 24) * Math.PI * 2) * 4; // 14時頃が最高
  const temp = Math.round(MONTH_TEMP[date.getMonth()] + daily + (hash(slot + 9) - 0.5) * 3);
  let weather = WEATHERS[Math.floor(hash(slot) * WEATHERS.length)];
  if (weather.id === 'rain' && temp <= 2) weather = { id: 'snow', label: '雪' };
  return { weather, temp };
}

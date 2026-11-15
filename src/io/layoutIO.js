export const LAYOUT_VERSION = 1;

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readLayoutFile(file) {
  const data = JSON.parse(await file.text());
  if (!data || data.version !== LAYOUT_VERSION || !Array.isArray(data.objects)) {
    throw new Error('対応していないレイアウトファイルです');
  }
  return data;
}

// ==================== FORMATTING HELPERS ====================
// Helper functions for formatting strings, numbers, durations, etc.

export const sanitize = str => str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-]/g, "");

export const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "?:??";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }
  return `${mins}:${secs.toString().padStart(2,'0')}`;
};

export function fallbackDurationParser(arrayBuffer) {
  const fileSize = arrayBuffer.byteLength;
  return Math.floor(fileSize / (128 * 125)); // 128kbps estimate
}
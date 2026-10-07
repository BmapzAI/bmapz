/**
 * The file name to send with a recording, named after what the browser actually recorded.
 *
 * MediaRecorder gives WebM on Chrome/Firefox/Android but MP4 (AAC) on iPhones, and the speech-to-text server decides how to decode from
 * the name, so "recording.webm" on an iPhone recording was a lie that could make the transcription fail.
 */
export function audioFileNameFor(mimeType) {
  const type = String(mimeType || '').toLowerCase();
  if (type.includes('mp4') || type.includes('aac') || type.includes('m4a')) return 'recording.m4a';
  if (type.includes('ogg')) return 'recording.ogg';
  if (type.includes('wav')) return 'recording.wav';
  return 'recording.webm';
}

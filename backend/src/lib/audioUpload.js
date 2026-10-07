// What to call and how to label an uploaded voice recording before it goes to the speech-to-text API.
//
// The web app always sent the name "recording.webm", and the server always labelled the bytes audio/webm, whatever the browser had
// really recorded. Chrome and Firefox do record WebM, but iPhones (Safari and the iOS app's WebView) record MP4/AAC; the API picks the
// decoder from the file's name and type, so an iPhone recording could be rejected as "unsupported file format". The browser now names
// the file after what it recorded and this decides the label from that name, falling back to webm for anything unknown.
const TYPES = {
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpeg',
  flac: 'audio/flac',
};

export function audioUploadFor(filename) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  if (Object.prototype.hasOwnProperty.call(TYPES, ext)) return { name: `audio.${ext}`, type: TYPES[ext] };
  return { name: 'audio.webm', type: TYPES.webm };
}

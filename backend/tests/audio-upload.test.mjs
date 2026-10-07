// Behaviour test: voice recordings are named and labelled after what the browser really recorded. iPhones record MP4/AAC, not WebM;
// the speech-to-text API chooses the decoder from the file's name and type. Run all: node backend/tests/run.mjs. Pure logic.
import { audioUploadFor } from '../src/lib/audioUpload.js';
import { audioFileNameFor } from '../../frontend-src/lib/audio.js';

let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the browser side: name the file after the recorder's MIME type
t('Chrome/Firefox/Android record webm (with or without codecs) -> recording.webm', audioFileNameFor('audio/webm;codecs=opus') === 'recording.webm' && audioFileNameFor('audio/webm') === 'recording.webm');
t('an iPhone records audio/mp4 -> recording.m4a (NOT .webm)', audioFileNameFor('audio/mp4') === 'recording.m4a' && audioFileNameFor('audio/mp4;codecs=mp4a.40.2') === 'recording.m4a' && audioFileNameFor('audio/aac') === 'recording.m4a');
t('ogg and wav keep their own names', audioFileNameFor('audio/ogg;codecs=opus') === 'recording.ogg' && audioFileNameFor('audio/wav') === 'recording.wav');
t('an unknown or missing type falls back to webm, as before', audioFileNameFor('') === 'recording.webm' && audioFileNameFor(undefined) === 'recording.webm' && audioFileNameFor('video/x-weird') === 'recording.webm');

// the server side: label from the name, never trust an arbitrary file name
t('recording.m4a is labelled audio/mp4', eq(audioUploadFor('recording.m4a'), { name: 'audio.m4a', type: 'audio/mp4' }));
t('recording.webm is labelled audio/webm (unchanged behaviour)', eq(audioUploadFor('recording.webm'), { name: 'audio.webm', type: 'audio/webm' }));
t('mp3, wav, ogg, flac are recognised', ['mp3', 'wav', 'ogg', 'flac'].every((e) => audioUploadFor('x.' + e).name === 'audio.' + e));
t('upper-case extensions work', eq(audioUploadFor('REC.M4A'), { name: 'audio.m4a', type: 'audio/mp4' }));
t('no extension / unknown extension / nothing -> webm, as before', eq(audioUploadFor('recording'), { name: 'audio.webm', type: 'audio/webm' }) && eq(audioUploadFor('x.exe'), { name: 'audio.webm', type: 'audio/webm' }) && eq(audioUploadFor(undefined), { name: 'audio.webm', type: 'audio/webm' }));
t('a path or odd characters in the name never reach the upload (the name is rebuilt)', audioUploadFor('../../etc/passwd.m4a').name === 'audio.m4a' && audioUploadFor('a b;c.mp3').name === 'audio.mp3');
t('"constructor" and other prototype names are not treated as extensions', eq(audioUploadFor('x.constructor'), { name: 'audio.webm', type: 'audio/webm' }));

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);

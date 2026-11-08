import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectStreamEngine,
  resolveLanguageName,
  formatAudioTrackLabel,
  mapHlsAudioTracks,
  mapShakaVariantTracks,
  mapNativeAudioTracks,
} from './audioTracks';

test('detectStreamEngine identifies HLS, DASH, and native formats', () => {
  assert.equal(detectStreamEngine('https://example.com/master.m3u8'), 'hls');
  assert.equal(detectStreamEngine('https://example.com/stream.m3u8?token=abc'), 'hls');
  assert.equal(detectStreamEngine('https://example.com/manifest.mpd'), 'dash');
  assert.equal(detectStreamEngine('https://example.com/movie.mp4'), 'native');
});

test('resolveLanguageName and formatAudioTrackLabel format language names and Track N fallbacks', () => {
  assert.equal(resolveLanguageName('en'), 'English');
  assert.equal(resolveLanguageName('hi'), 'Hindi');
  assert.equal(resolveLanguageName('ja'), 'Japanese');
  assert.equal(resolveLanguageName('und'), null);

  assert.equal(formatAudioTrackLabel('English', 'en', 0), 'English');
  assert.equal(formatAudioTrackLabel('Hindi', 'hi', 1), 'Hindi');
  assert.equal(formatAudioTrackLabel('Original Mix', 'ja', 2), 'Japanese (Original Mix)');
  assert.equal(formatAudioTrackLabel('', '', 0), 'Track 1');
  assert.equal(formatAudioTrackLabel('audio_1', 'und', 1), 'Track 2');
});

test('mapHlsAudioTracks maps hls.js audioTracks and marks active track', () => {
  const raw = [
    { id: 0, name: 'English', lang: 'en' },
    { id: 1, name: 'Hindi', lang: 'hi' },
    { id: 2, name: 'Japanese', lang: 'ja' },
  ];
  const mapped = mapHlsAudioTracks(raw, 1);
  assert.equal(mapped.length, 3);
  assert.equal(mapped[0].label, 'English');
  assert.equal(mapped[0].active, false);
  assert.equal(mapped[1].label, 'Hindi');
  assert.equal(mapped[1].active, true);
  assert.equal(mapped[2].label, 'Japanese');
});

test('mapShakaVariantTracks deduplicates video bitrates per audio language', () => {
  const variants = [
    { id: 10, language: 'en', label: 'English', active: false },
    { id: 11, language: 'en', label: 'English', active: true }, // 1080p variant of same audio
    { id: 20, language: 'hi', label: 'Hindi', active: false },
    { id: 30, language: 'ja', label: 'Japanese', active: false },
  ];
  const mapped = mapShakaVariantTracks(variants);
  assert.equal(mapped.length, 3);
  assert.equal(mapped[0].label, 'English');
  assert.equal(mapped[0].active, true);
  assert.equal(mapped[1].label, 'Hindi');
  assert.equal(mapped[2].label, 'Japanese');
});

test('mapNativeAudioTracks normalizes HTMLMediaElement.audioTracks', () => {
  const mockNativeList = {
    length: 2,
    0: { id: '1', label: '', language: 'en', enabled: true },
    1: { id: '2', label: '', language: '', enabled: false },
  };
  const mapped = mapNativeAudioTracks(mockNativeList);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].label, 'English');
  assert.equal(mapped[0].active, true);
  assert.equal(mapped[1].label, 'Track 2');
  assert.equal(mapped[1].active, false);
});

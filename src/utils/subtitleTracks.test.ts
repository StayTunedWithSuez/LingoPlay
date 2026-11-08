import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapHlsSubtitleTracks,
  mapShakaTextTracks,
  mapNativeTextTracks,
  extractActiveCuesFromTextTracks,
} from './subtitleTracks';

test('mapHlsSubtitleTracks maps HLS subtitle tracks and marks active track', () => {
  const tracks = [
    { id: 0, name: 'English', lang: 'en', default: true },
    { id: 1, name: 'Spanish', lang: 'es', default: false },
  ];
  const mapped = mapHlsSubtitleTracks(tracks, 0);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].label, 'English');
  assert.equal(mapped[0].active, true);
  assert.equal(mapped[1].label, 'Spanish');
  assert.equal(mapped[1].active, false);
});

test('mapShakaTextTracks maps DASH subtitle tracks accurately', () => {
  const tracks = [
    { id: 101, language: 'en', label: 'English CC', active: true },
    { id: 102, language: 'ja', label: 'Japanese', active: false },
  ];
  const mapped = mapShakaTextTracks(tracks);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].label, 'English (English CC)');
  assert.equal(mapped[0].active, true);
  assert.equal(mapped[1].label, 'Japanese');
});

test('mapNativeTextTracks filters for subtitles/captions and extracts active cues safely', () => {
  const mockTextTracks = {
    length: 2,
    0: {
      id: 'sub-1',
      kind: 'subtitles',
      label: 'English',
      language: 'en',
      mode: 'hidden',
      activeCues: {
        length: 1,
        0: {
          id: 'cue-1',
          startTime: 1.0,
          endTime: 4.5,
          text: '<i>Embedded stream</i>\nsubtitle line.',
        },
      },
    },
    1: {
      id: 'meta-1',
      kind: 'metadata',
      label: 'Metadata',
      language: '',
      mode: 'hidden',
      activeCues: null,
    },
  };

  const mapped = mapNativeTextTracks(mockTextTracks);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].label, 'English');
  assert.equal(mapped[0].active, true);

  const cues = extractActiveCuesFromTextTracks(mockTextTracks);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, 'Embedded stream\nsubtitle line.');
  assert.equal(cues[0].startTime, 1.0);
  assert.equal(cues[0].endTime, 4.5);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimestamp,
  parseSubtitles,
  getActiveSubtitles,
  getSubtitleReplayTime,
  formatTime,
  computeSeekTime,
  sanitizeSubtitleLine,
} from './subtitleParser';

test('parseTimestamp parses SRT and VTT timestamps accurately', () => {
  assert.equal(parseTimestamp('00:00:01,500'), 1.5);
  assert.equal(parseTimestamp('00:01:05.250'), 65.25);
  assert.equal(parseTimestamp('01:00:00,000'), 3600);
  assert.equal(parseTimestamp('02:30.5'), 150.5);
  assert.equal(parseTimestamp('invalid'), null);
});

test('parseSubtitles handles UTF-8 BOM, multiline SRT, and strips HTML tags safely', () => {
  const rawSrt = `\uFEFF1
00:00:01,000 --> 00:00:04,500
<i>Hello there!</i>
Welcome to our English lesson.

2
00:00:05,000 --> 00:00:08,200
{\\an8}<font color="#ffff00">Let's practice</font> selecting words &amp; phrases.
`;

  const cues = parseSubtitles(rawSrt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startTime, 1.0);
  assert.equal(cues[0].endTime, 4.5);
  assert.equal(cues[0].text, 'Hello there!\nWelcome to our English lesson.');
  assert.equal(cues[1].text, "Let's practice selecting words & phrases.");
});

test('parseSubtitles parses WebVTT with cue settings and NOTE blocks', () => {
  const rawVtt = `WEBVTT

NOTE This is a comment

00:00:02.000 --> 00:00:06.000 line:85% position:50%
Could you repeat that sentence, please?

00:00:07.000 --> 00:00:10.000
Certainly, let's break it down word by word.
`;

  const cues = parseSubtitles(rawVtt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].startTime, 2.0);
  assert.equal(cues[0].endTime, 6.0);
  assert.equal(cues[0].text, 'Could you repeat that sentence, please?');
});

test('getActiveSubtitles respects positive and negative delay offsets', () => {
  const cues = parseSubtitles(`1
00:00:10,000 --> 00:00:14,000
The train departs at midnight.
`);

  // With 0s offset, visible at 10.5s
  assert.equal(getActiveSubtitles(cues, 10.5, 0).length, 1);
  // With +1.0s delay (subtitles appear 1s later, i.e. 11.0s to 15.0s), not visible at 10.5s
  assert.equal(getActiveSubtitles(cues, 10.5, 1.0).length, 0);
  // Visible at 11.2s when delay is +1.0s
  assert.equal(getActiveSubtitles(cues, 11.2, 1.0).length, 1);
  // With -1.0s delay (subtitles appear 1s earlier, i.e. 9.0s to 13.0s), visible at 9.2s
  assert.equal(getActiveSubtitles(cues, 9.2, -1.0).length, 1);
});

test('getSubtitleReplayTime seeks to 0.5 seconds before subtitle start plus offset', () => {
  const cue = {
    id: 'cue-1',
    index: 1,
    startTime: 10.0,
    endTime: 14.0,
    text: 'Test dialogue',
  };
  assert.equal(getSubtitleReplayTime(cue, 0), 9.5);
  assert.equal(getSubtitleReplayTime(cue, 1.0), 10.5);
  assert.equal(getSubtitleReplayTime({ ...cue, startTime: 0.2 }, 0), 0);
});

test('computeSeekTime and formatTime work accurately for 5s jumps', () => {
  assert.equal(computeSeekTime(12, -5, 100), 7);
  assert.equal(computeSeekTime(3, -5, 100), 0);
  assert.equal(computeSeekTime(98, 5, 100), 100);
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3661), '1:01:01');
});

test('sanitizeSubtitleLine strips script/HTML tags safely', () => {
  assert.equal(
    sanitizeSubtitleLine('<script>alert(1)</script><b>Unfamiliar</b> vocabulary'),
    'alert(1)Unfamiliar vocabulary'
  );
});

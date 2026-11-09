export const SAMPLE_SRT_CONTENT = `1
00:00:00,000 --> 00:00:04,950
Welcome to Bingo Play. Pause at any time with Space,
and double-click any unfamiliar word to select it.

2
00:00:05,000 --> 00:00:09,950
The weather in London was extraordinarily unpredictable
throughout the entire autumn season.

3
00:00:10,000 --> 00:00:14,950
Could you elaborate on how this intriguing mechanism
actually operates under pressure?

4
00:00:15,000 --> 00:00:19,950
Use the Left and Right arrow keys, or the center buttons,
to jump backward and forward by five seconds.

5
00:00:20,000 --> 00:00:24,950
Whenever a sentence moves too quickly, click Replay
near the subtitle to hear the dialogue again.

6
00:00:25,000 --> 00:00:29,950
Notice how clicking or dragging across these words
never accidentally pauses or fullscreens the video.

7
00:00:30,000 --> 00:00:34,950
Open the settings gear to fine-tune subtitle timing,
font size, vertical position, or playback speed.

8
00:00:35,000 --> 00:00:40,000
Click Open Video anytime to load movies or episodes
directly from your computer's local storage.
`;

/**
 * Generates a valid, seekable PCM WAV Blob URL in memory (duration = 40 seconds)
 * with gentle ambient harmonic tones timed to the subtitle cues so HTMLVideoElement
 * and HTMLAudioElement have a real, 100% offline, instant-seeking media stream.
 */
export function createSynthesizedMediaBlobUrl(
  durationSeconds: number = 40,
  baseFreq: number = 220
): string {
  const sampleRate = 8000;
  const numSamples = durationSeconds * sampleRate;
  const bytesPerSample = 2; // 16-bit mono
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format = 1
  view.setUint16(22, 1, true);  // Mono = 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // 16 bits per sample
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Fill samples with soft pleasant chord pulses every 5 seconds matching dialogue cues
  const chordRatios = [1, 1.25, 1.5, 1.125];
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const cueIndex = Math.floor(t / 5);
    const tInCue = t % 5;
    // Active during 0.5s .. 4.8s of each 5s segment
    let sample = 0;
    if (tInCue >= 0.5 && tInCue <= 4.8) {
      const ratio = chordRatios[cueIndex % chordRatios.length];
      const freq = baseFreq * ratio;
      // Syllabic envelope modulation (simulates gentle cadence)
      const cadence = 0.6 + 0.4 * Math.sin(2 * Math.PI * 3.2 * t);
      const fade =
        tInCue < 0.8
          ? (tInCue - 0.5) / 0.3
          : tInCue > 4.4
          ? (4.8 - tInCue) / 0.4
          : 1;
      sample =
        Math.sin(2 * Math.PI * freq * t) * 0.12 * cadence * fade +
        Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.05 * cadence * fade;
    }
    const pcmValue = Math.max(-1, Math.min(1, sample)) * 32767;
    view.setInt16(offset, pcmValue, true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

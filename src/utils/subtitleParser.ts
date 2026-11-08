import { SubtitleCue } from '../types/player';

/**
 * Strips UTF-8 BOM and normalizes line endings to \n
 */
export function normalizeSubtitleText(raw: string): string {
  const withoutBom = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return withoutBom.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Safely strips HTML/formatting tags from subtitle lines so timed subtitles
 * are never rendered as untrusted raw HTML, while decoding basic entities.
 */
export function sanitizeSubtitleLine(text: string): string {
  // Remove ASS/SSA override tags like {\an8} or {\pos(x,y)}
  let cleaned = text.replace(/\{\\[^}]*\}/g, '');
  // Remove HTML tags like <i>, </i>, <b>, <font color="...">, <c.yellow>, etc.
  cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  // Decode common HTML entities safely into plain text characters
  cleaned = cleaned
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
  return cleaned.trim();
}

/**
 * Parses a timestamp string in SRT or WebVTT format into seconds.
 * Supports:
 * - HH:MM:SS,mmm or HH:MM:SS.mmm
 * - MM:SS,mmm or MM:SS.mmm
 * - HH:MM:SS or MM:SS
 */
export function parseTimestamp(timestampStr: string): number | null {
  const cleaned = timestampStr.trim();
  // Match optional hours, minutes, seconds, and optional milliseconds (1-3 digits)
  const match = cleaned.match(
    /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[,.](\d{1,3}))?$/
  );
  if (!match) {
    return null;
  }

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const msRaw = match[4] || '0';
  const milliseconds = parseInt(msRaw.padEnd(3, '0'), 10);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    Number.isNaN(milliseconds) ||
    minutes >= 60 ||
    seconds >= 60
  ) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Parses SRT (.srt) or WebVTT (.vtt) content into sorted SubtitleCue objects.
 */
export function parseSubtitles(rawContent: string): SubtitleCue[] {
  const normalized = normalizeSubtitleText(rawContent);
  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];

  let i = 0;
  const totalLines = lines.length;

  // Skip WEBVTT header and any header metadata blocks if present
  if (totalLines > 0 && lines[0].trim().toUpperCase().startsWith('WEBVTT')) {
    i = 1;
    while (i < totalLines && lines[i].trim() !== '') {
      i++;
    }
  }

  while (i < totalLines) {
    // Skip blank lines
    while (i < totalLines && lines[i].trim() === '') {
      i++;
    }
    if (i >= totalLines) break;

    const currentLine = lines[i].trim();

    // Skip WebVTT NOTE or STYLE or REGION blocks
    if (
      currentLine.startsWith('NOTE') ||
      currentLine === 'STYLE' ||
      currentLine.startsWith('STYLE ') ||
      currentLine === 'REGION' ||
      currentLine.startsWith('REGION ')
    ) {
      while (i < totalLines && lines[i].trim() !== '') {
        i++;
      }
      continue;
    }

    // Check if current line is a timing line or an index/identifier line followed by a timing line
    let timingLine = '';
    if (currentLine.includes('-->')) {
      timingLine = currentLine;
      i++;
    } else if (i + 1 < totalLines && lines[i + 1].includes('-->')) {
      timingLine = lines[i + 1].trim();
      i += 2;
    } else {
      // Unrecognized line, advance
      i++;
      continue;
    }

    // Parse timing line: "00:00:01,000 --> 00:00:04,000 [optional VTT settings]"
    const arrowParts = timingLine.split('-->');
    if (arrowParts.length < 2) {
      continue;
    }

    const startRaw = arrowParts[0].trim();
    // WebVTT may have cue settings after the end timestamp separated by space/tab
    const endRaw = arrowParts[1].trim().split(/[\s\t]+/)[0];

    const startTime = parseTimestamp(startRaw);
    const endTime = parseTimestamp(endRaw);

    // Collect text lines until the next blank line
    const textLines: string[] = [];
    while (i < totalLines && lines[i].trim() !== '') {
      const sanitized = sanitizeSubtitleLine(lines[i]);
      if (sanitized.length > 0) {
        textLines.push(sanitized);
      }
      i++;
    }

    if (
      startTime !== null &&
      endTime !== null &&
      endTime >= startTime &&
      textLines.length > 0
    ) {
      cues.push({
        id: `cue-${cues.length + 1}-${Math.round(startTime * 1000)}`,
        index: cues.length + 1,
        startTime,
        endTime,
        text: textLines.join('\n'),
      });
    }
  }

  return cues.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Finds the active subtitle cue(s) for a given video currentTime and subtitle delay offset.
 *
 * Delay semantics (Requirement 5):
 * "Clearly explain that a positive delay makes subtitles appear later."
 * If a subtitle normally appears at startTime = 10.0s, and delayOffset = +1.0s,
 * it should now appear when videoTime = 11.0s.
 * That means effectiveCueStart = cue.startTime + delayOffset,
 * or equivalently we look up `effectiveTime = videoTime - delayOffset` against cue.startTime..cue.endTime.
 */
export function getActiveSubtitles(
  cues: SubtitleCue[],
  videoTime: number,
  delayOffsetSeconds: number = 0
): SubtitleCue[] {
  if (!cues || cues.length === 0) return [];
  const effectiveTime = videoTime - delayOffsetSeconds;

  // Binary search to find the first possible cue or filter quickly
  const active: SubtitleCue[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.startTime > effectiveTime) {
      // Since cues are sorted by startTime, no subsequent cue can start <= effectiveTime
      break;
    }
    if (effectiveTime >= cue.startTime && effectiveTime <= cue.endTime) {
      active.push(cue);
    }
  }
  return active;
}

/**
 * Computes the target replay timestamp for a subtitle cue:
 * "Clicking it should seek to approximately 0.5 seconds before the start of the currently displayed subtitle"
 * Takes into account the current subtitle delay offset so it seeks to the right video timestamp.
 */
export function getSubtitleReplayTime(
  cue: SubtitleCue,
  delayOffsetSeconds: number = 0
): number {
  const actualVideoStartTime = cue.startTime + delayOffsetSeconds;
  return Math.max(0, Number((actualVideoStartTime - 0.5).toFixed(3)));
}

/**
 * Formats seconds into M:SS or H:MM:SS for player display
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Clamps a seek operation to [0, duration]
 */
export function computeSeekTime(
  currentTime: number,
  deltaSeconds: number,
  duration: number
): number {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  return Math.min(safeDuration, Math.max(0, currentTime + deltaSeconds));
}

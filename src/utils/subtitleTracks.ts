import { SubtitleCue } from '../types/player';
import { formatAudioTrackLabel } from './audioTracks';
import { getActiveSubtitles, sanitizeSubtitleLine } from './subtitleParser';

export interface DiscoveredSubtitleTrack {
  id: string;
  index: number;
  rawId?: number | string;
  label: string;
  language?: string;
  engine: 'hls' | 'dash' | 'native';
  active: boolean;
}

/**
 * Maps hls.js subtitleTracks into DiscoveredSubtitleTrack[]
 */
export function mapHlsSubtitleTracks(
  hlsSubTracks: Array<{
    id?: number;
    name?: string;
    lang?: string;
    default?: boolean;
  }>,
  activeTrackId: number
): DiscoveredSubtitleTrack[] {
  if (!Array.isArray(hlsSubTracks) || hlsSubTracks.length === 0) return [];

  return hlsSubTracks.map((track, idx) => {
    const trackId = typeof track.id === 'number' ? track.id : idx;
    return {
      id: `hls-sub-${trackId}-${idx}`,
      index: trackId,
      rawId: trackId,
      label: formatAudioTrackLabel(track.name, track.lang, idx),
      language: track.lang,
      engine: 'hls',
      active: trackId === activeTrackId,
    };
  });
}

/**
 * Maps Shaka Player text tracks into DiscoveredSubtitleTrack[]
 */
export function mapShakaTextTracks(
  shakaTracks: Array<{
    id: number;
    language?: string;
    label?: string | null;
    active?: boolean;
  }>
): DiscoveredSubtitleTrack[] {
  if (!Array.isArray(shakaTracks) || shakaTracks.length === 0) return [];

  return shakaTracks.map((t, idx) => ({
    id: `dash-sub-${t.id}-${idx}`,
    index: idx,
    rawId: t.id,
    label: formatAudioTrackLabel(t.label, t.language, idx),
    language: t.language,
    engine: 'dash',
    active: Boolean(t.active),
  }));
}

/**
 * Maps native HTMLMediaElement.textTracks into DiscoveredSubtitleTrack[]
 */
export function mapNativeTextTracks(
  textTracksLike:
    | {
        length: number;
        [index: number]: {
          id?: string;
          kind?: string;
          label?: string;
          language?: string;
          mode?: TextTrackMode | string;
        };
      }
    | null
    | undefined
): DiscoveredSubtitleTrack[] {
  if (!textTracksLike || typeof textTracksLike.length !== 'number') return [];

  const result: DiscoveredSubtitleTrack[] = [];
  for (let i = 0; i < textTracksLike.length; i++) {
    const t = textTracksLike[i];
    if (!t) continue;
    if (t.kind && t.kind !== 'subtitles' && t.kind !== 'captions') continue;
    result.push({
      id: `native-sub-${t.id || i}`,
      index: i,
      rawId: t.id || i,
      label: formatAudioTrackLabel(t.label, t.language, result.length),
      language: t.language,
      engine: 'native',
      active: t.mode === 'showing' || t.mode === 'hidden',
    });
  }
  return result;
}

interface CueListLike {
  length: number;
  [cueIndex: number]: {
    id?: string;
    startTime?: number;
    endTime?: number;
    text?: string;
  };
}

function cueListToSubtitleCues(cuesList: CueListLike, trackIdx: number): SubtitleCue[] {
  const result: SubtitleCue[] = [];
  for (let j = 0; j < cuesList.length; j++) {
    const rawCue = cuesList[j];
    if (!rawCue || typeof rawCue.text !== 'string') continue;

    const cleanedLines = rawCue.text
      .split(/\r?\n/)
      .map((line) => sanitizeSubtitleLine(line))
      .filter((line) => line.length > 0);

    if (cleanedLines.length > 0) {
      const startTime = typeof rawCue.startTime === 'number' ? rawCue.startTime : 0;
      const endTime = typeof rawCue.endTime === 'number' ? rawCue.endTime : startTime + 3;
      result.push({
        id: rawCue.id || `embedded-cue-${trackIdx}-${j}-${Math.round(startTime * 1000)}`,
        index: result.length + 1,
        startTime,
        endTime,
        text: cleanedLines.join('\n'),
      });
    }
  }
  return result;
}

/**
 * Extracts currently active cues from HTMLMediaElement.textTracks so embedded
 * stream/video subtitles can be rendered as selectable HTML text in SubtitleOverlay.
 * Supports subtitleDelay offset when `track.cues` is available, with automatic fallback
 * to `track.activeCues`.
 */
export function extractActiveCuesFromTextTracks(
  textTracksLike:
    | {
        length: number;
        [index: number]: {
          kind?: string;
          mode?: TextTrackMode | string;
          cues?: CueListLike | null;
          activeCues?: CueListLike | null;
        };
      }
    | null
    | undefined,
  currentTime?: number,
  subtitleDelay: number = 0
): SubtitleCue[] {
  if (!textTracksLike || typeof textTracksLike.length !== 'number') return [];

  const activeCues: SubtitleCue[] = [];
  for (let i = 0; i < textTracksLike.length; i++) {
    const track = textTracksLike[i];
    if (!track) continue;
    if (track.kind && track.kind !== 'subtitles' && track.kind !== 'captions') {
      continue;
    }
    if (track.mode !== 'showing' && track.mode !== 'hidden') {
      continue;
    }

    // If full cues list and currentTime are available, apply subtitleDelay offset lookup
    if (
      typeof currentTime === 'number' &&
      track.cues &&
      typeof track.cues.length === 'number' &&
      track.cues.length > 0
    ) {
      const allTrackCues = cueListToSubtitleCues(track.cues, i);
      const matched = getActiveSubtitles(allTrackCues, currentTime, subtitleDelay);
      if (matched.length > 0) {
        activeCues.push(...matched);
        continue;
      }
      if (Math.abs(subtitleDelay) >= 0.05) {
        continue;
      }
    }

    // Fallback to browser-computed activeCues
    if (track.activeCues && typeof track.activeCues.length === 'number') {
      activeCues.push(...cueListToSubtitleCues(track.activeCues, i));
    }
  }

  return activeCues;
}

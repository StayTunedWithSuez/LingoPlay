export type PlaybackEngineType = 'hls' | 'dash' | 'native';

export interface DiscoveredAudioTrack {
  id: string;
  index: number;          // engine-specific index or track id
  rawId?: number | string;
  label: string;          // e.g. "English", "Hindi", "Japanese", or "Track 1"
  language?: string;      // raw ISO code e.g. "en", "hi", "ja"
  roles?: string[];
  channels?: number;
  active: boolean;
  engine: PlaybackEngineType;
}

/**
 * Determines the playback engine for a given URL or MIME type so HLS, DASH, and native
 * HTML5 playback never conflict.
 */
export function detectStreamEngine(
  url: string,
  mimeType?: string
): PlaybackEngineType {
  const lowerUrl = url.toLowerCase().split('?')[0].split('#')[0];
  const lowerMime = (mimeType || '').toLowerCase();

  if (
    lowerUrl.endsWith('.m3u8') ||
    lowerUrl.includes('.m3u8/') ||
    lowerMime === 'application/vnd.apple.mpegurl' ||
    lowerMime === 'application/x-mpegurl'
  ) {
    return 'hls';
  }

  if (
    lowerUrl.endsWith('.mpd') ||
    lowerUrl.includes('.mpd/') ||
    lowerMime === 'application/dash+xml'
  ) {
    return 'dash';
  }

  return 'native';
}

/**
 * Resolves an ISO-639 language code (e.g. "en", "hi", "ja", "en-US") into a clear
 * English language name ("English", "Hindi", "Japanese").
 */
export function resolveLanguageName(langCode?: string | null): string | null {
  if (!langCode) return null;
  const trimmed = langCode.trim();
  if (!trimmed || trimmed.toLowerCase() === 'und' || trimmed.toLowerCase() === 'unknown') {
    return null;
  }

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    // Normalize underscores to hyphens (e.g. en_US -> en-US)
    const normalized = trimmed.replace(/_/g, '-');
    const resolved = displayNames.of(normalized);
    if (resolved && resolved.toLowerCase() !== normalized.toLowerCase()) {
      return resolved;
    }
    // Try primary subtag if full tag didn't resolve
    const primary = normalized.split('-')[0];
    const primaryResolved = displayNames.of(primary);
    if (primaryResolved && primaryResolved.toLowerCase() !== primary.toLowerCase()) {
      return primaryResolved;
    }
  } catch {
    // Fallback if Intl.DisplayNames rejects a non-standard tag
  }

  return null;
}

/**
 * Formats a clean, human-readable audio track label:
 * - Uses clear language names when available (e.g., "English", "Hindi", "Japanese")
 * - Appends distinct track name if helpful (e.g., "English (Commentary)")
 * - Falls back to "Track 1", "Track 2", etc. when language and label metadata are missing.
 */
export function formatAudioTrackLabel(
  rawName?: string | null,
  rawLang?: string | null,
  zeroBasedIndex: number = 0
): string {
  const cleanName = (rawName || '').trim();
  const resolvedLang = resolveLanguageName(rawLang);

  // Check if cleanName is just a generic placeholder like "audio_0" or a raw 2-letter code
  const isGenericPlaceholder =
    !cleanName ||
    /^audio[_-\s]?\d+$/i.test(cleanName) ||
    /^track[_-\s]?\d+$/i.test(cleanName) ||
    cleanName.toLowerCase() === 'und' ||
    cleanName.toLowerCase() === 'unknown';

  const nameResolvedAsLang = !isGenericPlaceholder ? resolveLanguageName(cleanName) : null;

  if (resolvedLang) {
    if (
      !isGenericPlaceholder &&
      cleanName.toLowerCase() !== resolvedLang.toLowerCase() &&
      (!rawLang || cleanName.toLowerCase() !== rawLang.trim().toLowerCase()) &&
      (!nameResolvedAsLang || nameResolvedAsLang.toLowerCase() !== resolvedLang.toLowerCase())
    ) {
      return `${resolvedLang} (${cleanName})`;
    }
    return resolvedLang;
  }

  if (nameResolvedAsLang && cleanName.length <= 3) {
    return nameResolvedAsLang;
  }

  if (!isGenericPlaceholder) {
    return cleanName;
  }

  return `Track ${zeroBasedIndex + 1}`;
}

/**
 * Normalizes hls.js audioTracks list into DiscoveredAudioTrack[]
 */
export function mapHlsAudioTracks(
  hlsTracks: Array<{
    id?: number;
    name?: string;
    lang?: string;
    channels?: string;
  }>,
  activeTrackId: number
): DiscoveredAudioTrack[] {
  if (!Array.isArray(hlsTracks) || hlsTracks.length === 0) return [];

  return hlsTracks.map((track, idx) => {
    const trackId = typeof track.id === 'number' ? track.id : idx;
    const label = formatAudioTrackLabel(track.name, track.lang, idx);
    return {
      id: `hls-audio-${trackId}-${idx}`,
      index: trackId,
      rawId: trackId,
      label,
      language: track.lang,
      active: trackId === activeTrackId,
      engine: 'hls',
    };
  });
}

/**
 * Normalizes Shaka Player variant tracks into unique selectable audio tracks
 * grouped by language + label + roles so multiple video bitrates don't duplicate audio options.
 */
export function mapShakaVariantTracks(
  variantTracks: Array<{
    id: number;
    language?: string;
    label?: string | null;
    audioId?: number | null;
    channelsCount?: number | null;
    roles?: string[];
    active?: boolean;
  }>
): DiscoveredAudioTrack[] {
  if (!Array.isArray(variantTracks) || variantTracks.length === 0) return [];

  const groups = new Map<
    string,
    {
      representativeId: number;
      language: string;
      label: string | null;
      roles: string[];
      channelsCount: number | null;
      active: boolean;
    }
  >();

  for (const vt of variantTracks) {
    const lang = (vt.language || 'und').trim();
    const label = vt.label ? vt.label.trim() : null;
    const roleKey = Array.isArray(vt.roles) && vt.roles.length > 0 ? vt.roles.join(',') : '';
    const key = `${lang}::${label || ''}::${roleKey}`;

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        representativeId: vt.id,
        language: lang,
        label,
        roles: vt.roles || [],
        channelsCount: vt.channelsCount ?? null,
        active: Boolean(vt.active),
      });
    } else if (vt.active) {
      existing.active = true;
      existing.representativeId = vt.id;
    }
  }

  const result: DiscoveredAudioTrack[] = [];
  let idx = 0;
  for (const [, group] of groups) {
    const formattedLabel = formatAudioTrackLabel(group.label, group.language, idx);
    result.push({
      id: `dash-audio-${group.language}-${idx}`,
      index: idx,
      rawId: group.representativeId,
      label: formattedLabel,
      language: group.language,
      roles: group.roles,
      channels: group.channelsCount ?? undefined,
      active: group.active,
      engine: 'dash',
    });
    idx++;
  }

  return result;
}

/**
 * Normalizes native HTMLMediaElement.audioTracks (when supported/exposed by browser)
 */
export function mapNativeAudioTracks(
  nativeTracksLike:
    | {
        length: number;
        [index: number]: {
          id?: string;
          label?: string;
          language?: string;
          enabled?: boolean;
        };
      }
    | null
    | undefined
): DiscoveredAudioTrack[] {
  if (!nativeTracksLike || typeof nativeTracksLike.length !== 'number') {
    return [];
  }

  const tracks: DiscoveredAudioTrack[] = [];
  for (let i = 0; i < nativeTracksLike.length; i++) {
    const t = nativeTracksLike[i];
    if (!t) continue;
    tracks.push({
      id: `native-audio-${t.id || i}`,
      index: i,
      rawId: t.id || i,
      label: formatAudioTrackLabel(t.label, t.language, i),
      language: t.language,
      active: Boolean(t.enabled),
      engine: 'native',
    });
  }
  return tracks;
}

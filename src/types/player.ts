export interface SubtitleCue {
  id: string;
  index: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;      // sanitized plain text (multiline preserved via \n)
}

export interface PlaylistItem {
  id: string;
  name: string;
  url: string;
  isObjectUrl: boolean;
  type: 'local' | 'url' | 'demo';
  mimeType?: string;
}

export interface PlayerPreferences {
  volume: number;
  audioBoost: number;           // 1.0 (100%) to 4.0 (400%), default 1.8 (180% loudness boost)
  isMuted: boolean;
  playbackSpeed: number;
  seekStepSeconds: number;      // custom forward/backward skip seconds (1 to 60, default 5)
  subtitlesVisible: boolean;
  subtitleFontSize: number;     // 16 to 42, default 26
  subtitleBottomOffset: number; // percentage from bottom (5% to 75%, default 12%)
  subtitleBgEnabled: boolean;   // default true
  autoPauseOnSelect: boolean;   // default false
  concentrationMode: boolean;   // default false
}

export const DEFAULT_PREFERENCES: PlayerPreferences = {
  volume: 1,
  audioBoost: 1.8,
  isMuted: false,
  playbackSpeed: 1,
  seekStepSeconds: 5,
  subtitlesVisible: true,
  subtitleFontSize: 26,
  subtitleBottomOffset: 12,
  subtitleBgEnabled: true,
  autoPauseOnSelect: false,
  concentrationMode: false,
};

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export const SEEK_STEP_PRESETS = [2, 3, 5, 10, 15] as const;


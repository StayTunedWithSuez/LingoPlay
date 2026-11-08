import React, { useState } from 'react';
import {
  Gauge,
  Subtitles,
  Volume2,
  Film,
  Upload,
  Link2,
  RotateCcw,
  Minus,
  Plus,
  Check,
} from 'lucide-react';
import { PLAYBACK_SPEEDS, SEEK_STEP_PRESETS, PlayerPreferences } from '../types/player';
import { DiscoveredAudioTrack, PlaybackEngineType } from '../utils/audioTracks';
import { DiscoveredSubtitleTrack } from '../utils/subtitleTracks';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: PlayerPreferences;
  onUpdatePreferences: (partial: Partial<PlayerPreferences>) => void;
  subtitleDelay: number;
  onChangeSubtitleDelay: (newDelay: number) => void;
  subtitleFileName: string | null;
  subtitleCount: number;
  discoveredSubtitleTracks: DiscoveredSubtitleTrack[];
  useEmbeddedSubtitles: boolean;
  onSelectEmbeddedSubtitleTrack: (track: DiscoveredSubtitleTrack) => void;
  onSelectExternalSubtitleSource: () => void;
  onTriggerOpenSubtitle: () => void;
  onTriggerOpenVideo: () => void;
  onTriggerOpenUrlModal: () => void;
  discoveredAudioTracks: DiscoveredAudioTrack[];
  activeEngine: PlaybackEngineType;
  isStreamSource: boolean;
  onSelectAudioTrack: (track: DiscoveredAudioTrack) => void;
  externalAudioName: string | null;
  useExternalAudio: boolean;
  onToggleExternalAudio: (useExternal: boolean) => void;
  audioOffset: number;
  onChangeAudioOffset: (newOffset: number) => void;
  onTriggerOpenAudio: () => void;
  onLoadSeparateAudioUrl: (url: string) => void;
  onResetSubtitles: () => void;
  onResetAudio: () => void;
  onToggleConcentrationMode: () => void;
}

type SettingsTab = 'subtitles' | 'playback' | 'audio' | 'video';

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  isOpen,
  preferences,
  onUpdatePreferences,
  subtitleDelay,
  onChangeSubtitleDelay,
  subtitleFileName,
  subtitleCount,
  discoveredSubtitleTracks,
  useEmbeddedSubtitles,
  onSelectEmbeddedSubtitleTrack,
  onSelectExternalSubtitleSource,
  onTriggerOpenSubtitle,
  onTriggerOpenVideo,
  onTriggerOpenUrlModal,
  discoveredAudioTracks,
  activeEngine,
  isStreamSource,
  onSelectAudioTrack,
  externalAudioName,
  useExternalAudio,
  onToggleExternalAudio,
  audioOffset,
  onChangeAudioOffset,
  onTriggerOpenAudio,
  onLoadSeparateAudioUrl,
  onResetSubtitles,
  onResetAudio,
  onToggleConcentrationMode,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('subtitles');
  const [audioStreamUrlInput, setAudioStreamUrlInput] = useState('');
  const [showAudioUrlInput, setShowAudioUrlInput] = useState(false);

  if (!isOpen) return null;

  const stopProp = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const adjustSubtitleDelay = (delta: number) => {
    const next = Math.round((subtitleDelay + delta) * 10) / 10;
    onChangeSubtitleDelay(next);
  };

  const adjustAudioOffset = (delta: number) => {
    const next = Math.round((audioOffset + delta) * 10) / 10;
    onChangeAudioOffset(next);
  };

  const formatOffset = (val: number) => {
    if (Math.abs(val) < 0.01) return '0.0s';
    return `${val > 0 ? '+' : ''}${val.toFixed(1)}s`;
  };

  const activeDiscoveredTrack = discoveredAudioTracks.find((t) => t.active);
  const currentAudioTrackSummary = useExternalAudio && externalAudioName
    ? `External (${externalAudioName})`
    : activeDiscoveredTrack
    ? activeDiscoveredTrack.label
    : 'Default';

  const activeEmbeddedSubTrack = discoveredSubtitleTracks.find((t) => t.active);

  const handleApplyAudioUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = audioStreamUrlInput.trim();
    if (!trimmed) return;
    onLoadSeparateAudioUrl(trimmed);
    setAudioStreamUrlInput('');
    setShowAudioUrlInput(false);
  };

  return (
    <div
      data-testid="settings-menu-popover"
      onMouseDown={stopProp}
      onTouchStart={stopProp}
      onTouchMove={stopProp}
      onClick={stopProp}
      onDoubleClick={stopProp}
      className="fixed inset-x-3 bottom-3 z-50 w-auto max-h-[72vh] sm:absolute sm:inset-x-auto sm:bottom-[72px] sm:right-4 sm:z-40 sm:w-80 sm:max-h-[min(410px,calc(100%-128px))] flex flex-col rounded-xl bg-[#212121]/95 border border-[#383838] text-[#F1F1F1] shadow-2xl backdrop-blur-md select-none overflow-hidden"
    >
      {/* Top category switcher */}
      <div className="shrink-0 grid grid-cols-4 border-b border-[#383838] bg-[#181818] p-1 gap-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('subtitles')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === 'subtitles'
              ? 'bg-[#303030] text-[#F1F1F1]'
              : 'text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#212121]'
          }`}
        >
          <Subtitles className="w-3.5 h-3.5" />
          <span>Subtitles</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('playback')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === 'playback'
              ? 'bg-[#303030] text-[#F1F1F1]'
              : 'text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#212121]'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>Speed</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audio')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === 'audio'
              ? 'bg-[#303030] text-[#F1F1F1]'
              : 'text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#212121]'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Audio</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('video')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === 'video'
              ? 'bg-[#303030] text-[#F1F1F1]'
              : 'text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#212121]'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Video</span>
        </button>
      </div>

      {/* Tab Content */}
      <div
        data-testid="settings-menu-scroll-body"
        className="custom-scrollbar flex-1 min-h-0 p-3 pr-2.5 overflow-y-auto space-y-2.5 text-xs"
      >
        {activeTab === 'subtitles' && (
          <div className="space-y-2.5">
            {/* Load Subtitle & Visibility */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-[#F1F1F1] truncate">
                  {useEmbeddedSubtitles && activeEmbeddedSubTrack
                    ? `Embedded: ${activeEmbeddedSubTrack.label}`
                    : subtitleFileName || 'No subtitle file loaded'}
                </div>
                <div className="text-[11px] text-[#AAAAAA]">
                  {useEmbeddedSubtitles && activeEmbeddedSubTrack
                    ? 'Active stream/video subtitle track'
                    : subtitleCount > 0
                    ? `${subtitleCount} lines loaded`
                    : 'Supports .srt, .vtt, and stream captions'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onTriggerOpenSubtitle}
                  className="flex items-center gap-1.5 rounded-lg bg-[#303030] hover:bg-[#383838] px-2.5 py-1.5 font-medium text-[#F1F1F1] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load Subtitle</span>
                </button>
                <button
                  type="button"
                  data-testid="reset-subtitle-btn"
                  onClick={onResetSubtitles}
                  aria-label="Reset or turn off subtitles"
                  title="Reset / turn off subtitles"
                  className="p-1.5 rounded-lg bg-[#303030] hover:bg-[#383838] text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Discovered Embedded / External Subtitle Track Selector */}
            {discoveredSubtitleTracks.length > 0 && (
              <div className="space-y-1 pt-0.5">
                <div className="text-[11px] text-[#AAAAAA]">Subtitle Track</div>
                <div
                  data-testid="discovered-subtitle-track-list"
                  className="grid grid-cols-1 gap-1"
                >
                  {discoveredSubtitleTracks.map((track) => {
                    const isSelected = useEmbeddedSubtitles && track.active;
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => onSelectEmbeddedSubtitleTrack(track)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#303030] text-[#F1F1F1] font-semibold'
                            : 'bg-[#181818] text-[#AAAAAA] hover:bg-[#303030]/60 hover:text-[#F1F1F1]'
                        }`}
                      >
                        <span className="truncate">{track.label} (Stream/Embedded)</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#FF0033] shrink-0" />}
                      </button>
                    );
                  })}
                  {subtitleFileName && (
                    <button
                      type="button"
                      onClick={onSelectExternalSubtitleSource}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        !useEmbeddedSubtitles
                          ? 'bg-[#303030] text-[#F1F1F1] font-semibold'
                          : 'bg-[#181818] text-[#AAAAAA] hover:bg-[#303030]/60 hover:text-[#F1F1F1]'
                      }`}
                    >
                      <span className="truncate">{subtitleFileName}</span>
                      {!useEmbeddedSubtitles && (
                        <Check className="w-3.5 h-3.5 text-[#FF0033] shrink-0" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="h-px bg-[#383838]" />

            {/* Visibility toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[#F1F1F1]">Show Subtitles (S)</span>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.subtitlesVisible}
                aria-label="Toggle subtitle visibility"
                onClick={() =>
                  onUpdatePreferences({
                    subtitlesVisible: !preferences.subtitlesVisible,
                  })
                }
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  preferences.subtitlesVisible
                    ? 'bg-[#FF0033] text-white'
                    : 'bg-[#303030] text-[#AAAAAA] hover:text-[#F1F1F1]'
                }`}
              >
                {preferences.subtitlesVisible ? 'Shown' : 'Hidden'}
              </button>
            </div>

            {/* Subtitle Synchronization */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#F1F1F1] font-medium">Sync Delay Offset</span>
                <div className="flex items-center gap-1.5">
                  <span
                    data-testid="subtitle-delay-value"
                    className="font-mono tabular-nums text-[#F1F1F1] bg-[#141414] px-2 py-0.5 rounded border border-[#383838]"
                  >
                    {formatOffset(subtitleDelay)}
                  </span>
                  {Math.abs(subtitleDelay) >= 0.05 && (
                    <button
                      type="button"
                      onClick={() => onChangeSubtitleDelay(0)}
                      aria-label="Reset subtitle delay to zero"
                      title="Reset delay to 0.0s"
                      className="p-1 rounded bg-[#303030] hover:bg-[#383838] text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustSubtitleDelay(-0.5)}
                  className="py-1.5 rounded-md bg-[#303030] hover:bg-[#383838] font-mono tabular-nums text-[#F1F1F1] transition-colors cursor-pointer"
                >
                  -0.5s
                </button>
                <button
                  type="button"
                  onClick={() => adjustSubtitleDelay(-0.1)}
                  className="py-1.5 rounded-md bg-[#303030] hover:bg-[#383838] font-mono tabular-nums text-[#F1F1F1] transition-colors cursor-pointer"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustSubtitleDelay(0.1)}
                  className="py-1.5 rounded-md bg-[#303030] hover:bg-[#383838] font-mono tabular-nums text-[#F1F1F1] transition-colors cursor-pointer"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustSubtitleDelay(0.5)}
                  className="py-1.5 rounded-md bg-[#303030] hover:bg-[#383838] font-mono tabular-nums text-[#F1F1F1] transition-colors cursor-pointer"
                >
                  +0.5s
                </button>
              </div>
              <p className="text-[11px] text-[#AAAAAA] leading-snug">
                Positive delay (+) makes subtitles appear later. Negative (-) makes them appear earlier.
              </p>
            </div>

            {/* Font Size (16px to 42px, default 26px) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="subtitle-font-size-slider" className="text-[#F1F1F1]">
                  Font Size
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Decrease subtitle font size"
                    onClick={() =>
                      onUpdatePreferences({
                        subtitleFontSize: Math.max(16, preferences.subtitleFontSize - 2),
                      })
                    }
                    className="p-1 rounded bg-[#303030] hover:bg-[#383838] text-[#F1F1F1] cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-10 text-center font-mono tabular-nums text-[#F1F1F1]">
                    {preferences.subtitleFontSize}px
                  </span>
                  <button
                    type="button"
                    aria-label="Increase subtitle font size"
                    onClick={() =>
                      onUpdatePreferences({
                        subtitleFontSize: Math.min(42, preferences.subtitleFontSize + 2),
                      })
                    }
                    className="p-1 rounded bg-[#303030] hover:bg-[#383838] text-[#F1F1F1] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <input
                id="subtitle-font-size-slider"
                type="range"
                min={16}
                max={42}
                step={1}
                value={preferences.subtitleFontSize}
                onChange={(e) =>
                  onUpdatePreferences({
                    subtitleFontSize: Number(e.target.value),
                  })
                }
                className="w-full accent-[#FF0033] cursor-pointer h-1.5 bg-[#383838] rounded-lg"
              />
            </div>

            {/* Vertical Position */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="subtitle-pos-slider" className="text-[#F1F1F1]">
                  Vertical Position
                </label>
                <span className="font-mono tabular-nums text-[#AAAAAA]">
                  {preferences.subtitleBottomOffset}% from bottom
                </span>
              </div>
              <input
                id="subtitle-pos-slider"
                type="range"
                min={6}
                max={75}
                step={1}
                value={preferences.subtitleBottomOffset}
                onChange={(e) =>
                  onUpdatePreferences({
                    subtitleBottomOffset: Number(e.target.value),
                  })
                }
                className="w-full accent-[#FF0033] cursor-pointer h-1.5 bg-[#383838] rounded-lg"
              />
            </div>

            {/* Translucent Background Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[#F1F1F1]">Translucent Background</span>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.subtitleBgEnabled}
                aria-label="Toggle subtitle background"
                onClick={() =>
                  onUpdatePreferences({
                    subtitleBgEnabled: !preferences.subtitleBgEnabled,
                  })
                }
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  preferences.subtitleBgEnabled
                    ? 'bg-[#303030] text-[#F1F1F1] border border-[#F1F1F1]/30'
                    : 'bg-[#181818] text-[#AAAAAA] border border-[#383838]'
                }`}
              >
                {preferences.subtitleBgEnabled ? 'On' : 'Off'}
              </button>
            </div>

            {/* Auto-pause on subtitle selection */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[#F1F1F1]">Auto-Pause on Selection</div>
                <div className="text-[11px] text-[#AAAAAA]">
                  Pause video when selecting subtitle text
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.autoPauseOnSelect}
                aria-label="Toggle automatic pause on subtitle selection"
                onClick={() =>
                  onUpdatePreferences({
                    autoPauseOnSelect: !preferences.autoPauseOnSelect,
                  })
                }
                className={`shrink-0 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  preferences.autoPauseOnSelect
                    ? 'bg-[#FF0033] text-white'
                    : 'bg-[#181818] text-[#AAAAAA] border border-[#383838]'
                }`}
              >
                {preferences.autoPauseOnSelect ? 'On' : 'Off'}
              </button>
            </div>

            <div className="h-px bg-[#383838]" />

            {/* Concentration Mode Toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[#F1F1F1]">Concentration Mode</div>
                <div className="text-[11px] text-[#AAAAAA] leading-snug">
                  <div>
                    Hide all UI except subtitles &amp; {preferences.seekStepSeconds ?? 5}s skip
                  </div>
                  <div>(Shortcut: C)</div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                data-testid="concentration-mode-toggle"
                aria-checked={preferences.concentrationMode}
                aria-label="Toggle Concentration Mode"
                onClick={onToggleConcentrationMode}
                className={`shrink-0 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  preferences.concentrationMode
                    ? 'bg-[#FF0033] text-white'
                    : 'bg-[#181818] text-[#AAAAAA] border border-[#383838]'
                }`}
              >
                {preferences.concentrationMode ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'playback' && (
          <div className="space-y-2.5">
            {/* Concentration Mode Toggle in Speed/Playback tab as well */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#383838]">
              <div className="min-w-0">
                <div className="text-[#F1F1F1]">Concentration Mode</div>
                <div className="text-[11px] text-[#AAAAAA]">
                  Hide titles &amp; bars; press C anytime to exit
                </div>
              </div>
              <button
                type="button"
                role="switch"
                data-testid="concentration-mode-playback-toggle"
                aria-checked={preferences.concentrationMode}
                aria-label="Toggle Concentration Mode"
                onClick={onToggleConcentrationMode}
                className={`shrink-0 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  preferences.concentrationMode
                    ? 'bg-[#FF0033] text-white'
                    : 'bg-[#181818] text-[#AAAAAA] border border-[#383838]'
                }`}
              >
                {preferences.concentrationMode ? 'On' : 'Off'}
              </button>
            </div>

            <div className="text-[#AAAAAA] font-medium mb-1">Playback Speed</div>
            <div className="grid grid-cols-1 gap-1">
              {PLAYBACK_SPEEDS.map((speed) => {
                const isSelected = preferences.playbackSpeed === speed;
                return (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => onUpdatePreferences({ playbackSpeed: speed })}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#303030] text-[#F1F1F1] font-semibold'
                        : 'text-[#AAAAAA] hover:bg-[#303030]/60 hover:text-[#F1F1F1]'
                    }`}
                  >
                    <span className="font-mono tabular-nums">
                      {speed === 1 ? '1× (Normal)' : `${speed}×`}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-[#FF0033]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-3" data-testid="audio-settings-section">
            {/* Audio Track (Embedded / Stream Multi-Language Selector) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[#F1F1F1]">Audio Track</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    data-testid="current-audio-track-label"
                    className="text-[11px] text-[#AAAAAA] truncate max-w-[140px]"
                  >
                    {currentAudioTrackSummary}
                  </span>
                  <button
                    type="button"
                    data-testid="reset-audio-btn"
                    onClick={onResetAudio}
                    aria-label="Reset audio to default"
                    title="Reset audio to default"
                    className="p-1 rounded-md bg-[#303030] hover:bg-[#383838] text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {discoveredAudioTracks.length > 0 ? (
                <div
                  data-testid="discovered-audio-track-list"
                  className="grid grid-cols-1 gap-1"
                >
                  {discoveredAudioTracks.map((track) => {
                    const isSelected = !useExternalAudio && track.active;
                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => onSelectAudioTrack(track)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#303030] text-[#F1F1F1] font-semibold'
                            : 'bg-[#181818] text-[#AAAAAA] hover:bg-[#303030]/60 hover:text-[#F1F1F1]'
                        }`}
                      >
                        <span className="truncate">{track.label}</span>
                        {isSelected && (
                          <Check
                            aria-label="Selected audio track"
                            className="w-4 h-4 text-[#FF0033] shrink-0"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  data-testid="audio-track-limitation-note"
                  className="rounded-lg bg-[#181818] border border-[#383838] p-2.5 text-[11px] text-[#AAAAAA] leading-relaxed"
                >
                  {activeEngine === 'native' ? (
                    <span>
                      Standard MP4/WebM playback uses the default embedded audio. Chrome and Edge do not expose multiple embedded MP4/MKV tracks unless streamed via an HLS (.m3u8) or MPEG-DASH (.mpd) manifest.
                    </span>
                  ) : (
                    <span>
                      No additional selectable audio tracks were exposed by this stream manifest.
                    </span>
                  )}
                </div>
              )}

              {discoveredAudioTracks.length === 1 && (
                <p
                  data-testid="single-audio-track-explanation"
                  className="text-[11px] text-[#AAAAAA] leading-snug"
                >
                  Only 1 audio track was exposed by this URL. Other language tracks may belong to a different stream or master manifest (.m3u8 / .mpd), or a separate audio URL.
                </p>
              )}
            </div>

            <div className="h-px bg-[#383838]" />

            {/* Audio Loudness Boost (100% to 400%, default 180%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="audio-boost-slider" className="font-medium text-[#F1F1F1]">
                  Loudness Boost
                </label>
                <span
                  data-testid="audio-boost-value"
                  className="font-mono tabular-nums text-[#F1F1F1] bg-[#141414] px-2 py-0.5 rounded border border-[#383838]"
                >
                  {Math.round((preferences.audioBoost ?? 1.8) * 100)}%
                </span>
              </div>
              <input
                id="audio-boost-slider"
                data-testid="audio-boost-slider"
                type="range"
                min={1}
                max={4}
                step={0.1}
                value={preferences.audioBoost ?? 1.8}
                onChange={(e) =>
                  onUpdatePreferences({ audioBoost: Number(e.target.value) })
                }
                className="w-full accent-[#FF0033] cursor-pointer h-1.5 bg-[#383838] rounded-lg"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 1.8, 2.5, 4].map((boostVal) => {
                  const isActiveBoost =
                    Math.abs((preferences.audioBoost ?? 1.8) - boostVal) < 0.05;
                  return (
                    <button
                      key={boostVal}
                      type="button"
                      onClick={() => onUpdatePreferences({ audioBoost: boostVal })}
                      className={`py-1 rounded-md font-mono tabular-nums transition-colors cursor-pointer ${
                        isActiveBoost
                          ? 'bg-[#FF0033] text-white font-semibold'
                          : 'bg-[#303030] hover:bg-[#383838] text-[#F1F1F1]'
                      }`}
                    >
                      {Math.round(boostVal * 100)}%
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-[#383838]" />

            {/* External Audio File or Separate Audio Stream URL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-[#F1F1F1] truncate">
                    {externalAudioName || 'Separate Audio Source'}
                  </div>
                  <div className="text-[11px] text-[#AAAAAA]">
                    {isStreamSource
                      ? 'Local file or separate audio stream URL'
                      : 'MP3, WAV, M4A, OGG, or stream URL'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onTriggerOpenAudio}
                    className="flex items-center gap-1 rounded-lg bg-[#303030] hover:bg-[#383838] px-2 py-1.5 font-medium text-[#F1F1F1] transition-colors whitespace-nowrap cursor-pointer"
                    title="Load local audio file"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAudioUrlInput((prev) => !prev)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      showAudioUrlInput
                        ? 'bg-[#FF0033] text-white'
                        : 'bg-[#303030] hover:bg-[#383838] text-[#F1F1F1]'
                    }`}
                    title="Provide a separate audio stream URL"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>URL</span>
                  </button>
                  <button
                    type="button"
                    data-testid="reset-external-audio-btn"
                    onClick={onResetAudio}
                    aria-label="Reset external audio"
                    title="Reset external audio"
                    className="p-1.5 rounded-lg bg-[#303030] hover:bg-[#383838] text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {showAudioUrlInput && (
                <form onSubmit={handleApplyAudioUrl} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={audioStreamUrlInput}
                    onChange={(e) => setAudioStreamUrlInput(e.target.value)}
                    placeholder="https://.../audio-hi.m3u8 or .m4a"
                    aria-label="Separate audio stream URL"
                    className="flex-1 min-w-0 rounded-lg bg-[#141414] border border-[#383838] px-2.5 py-1.5 text-xs text-[#F1F1F1] placeholder-[#AAAAAA]/50 focus:outline-none focus:border-[#F1F1F1]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#FF0033] hover:bg-[#FF0033]/90 px-2.5 py-1.5 font-medium text-white transition-colors shrink-0 cursor-pointer"
                  >
                    Load
                  </button>
                </form>
              )}

              {/* Switch between embedded video audio and loaded external audio */}
              {externalAudioName && (
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onToggleExternalAudio(false)}
                    className={`py-1.5 px-2.5 rounded-lg font-medium text-center transition-colors cursor-pointer ${
                      !useExternalAudio
                        ? 'bg-[#303030] text-[#F1F1F1] border border-[#F1F1F1]/30'
                        : 'bg-[#181818] text-[#AAAAAA] hover:text-[#F1F1F1]'
                    }`}
                  >
                    Video Audio
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleExternalAudio(true)}
                    className={`py-1.5 px-2.5 rounded-lg font-medium text-center transition-colors cursor-pointer ${
                      useExternalAudio
                        ? 'bg-[#FF0033] text-white'
                        : 'bg-[#181818] text-[#AAAAAA] hover:text-[#F1F1F1]'
                    }`}
                  >
                    External Audio
                  </button>
                </div>
              )}
            </div>

            {/* External Audio Offset */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#F1F1F1]">External Audio Offset</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono tabular-nums text-[#F1F1F1] bg-[#141414] px-2 py-0.5 rounded border border-[#383838]">
                    {formatOffset(audioOffset)}
                  </span>
                  {Math.abs(audioOffset) >= 0.05 && (
                    <button
                      type="button"
                      onClick={() => onChangeAudioOffset(0)}
                      aria-label="Reset audio offset"
                      className="p-1 rounded bg-[#303030] hover:bg-[#383838] text-[#AAAAAA] hover:text-[#F1F1F1] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustAudioOffset(-0.5)}
                  className="py-1.5 rounded-md bg-[#303030] hover:bg-[#383838] font-mono tabular-nums text-[#F1F1F1] cursor-pointer"
                >
                  -0.5s
                </button>
                <button
                  type="button"
                  onClick={() => adjustAudioOffset(-0.1)}
                  className="py-1.5 rounded-md bg-[#303030] hover:bg-[#383838] font-mono tabular-nums text-[#F1F1F1] cursor-pointer"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustAudioOffset(0.1)}
                  className="py-1.5 rounded-md bg-[#303030] hover:bg-[#383838] font-mono tabular-nums text-[#F1F1F1] cursor-pointer"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  onClick={() => adjustAudioOffset(0.5)}
                  className="py-1.5 rounded-md bg-[#303030] hover:bg-[#383838] font-mono tabular-nums text-[#F1F1F1] cursor-pointer"
                >
                  +0.5s
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="space-y-3" data-testid="video-settings-section">
            {/* Forward / Backward Skip Time Customization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-[#F1F1F1]">Forward / Backward Skip</div>
                  <div className="text-[11px] text-[#AAAAAA]">
                    Center buttons &amp; Left/Right arrow keys (Default: 5s)
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="decrease-seek-step-btn"
                    aria-label="Decrease skip seconds"
                    onClick={() =>
                      onUpdatePreferences({
                        seekStepSeconds: Math.max(1, (preferences.seekStepSeconds ?? 5) - 1),
                      })
                    }
                    className="p-1.5 rounded-md bg-[#303030] hover:bg-[#383838] text-[#F1F1F1] transition-colors cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <div className="relative flex items-center">
                    <input
                      type="number"
                      data-testid="custom-seek-step-input"
                      aria-label="Custom skip time in seconds"
                      min={1}
                      max={60}
                      step={1}
                      value={preferences.seekStepSeconds ?? 5}
                      onChange={(e) => {
                        const raw = parseInt(e.target.value, 10);
                        if (!Number.isNaN(raw)) {
                          onUpdatePreferences({
                            seekStepSeconds: Math.min(60, Math.max(1, raw)),
                          });
                        }
                      }}
                      className="w-14 rounded-md bg-[#141414] border border-[#383838] px-1.5 py-1 text-center font-mono tabular-nums text-xs text-[#F1F1F1] focus:outline-none focus:border-[#FF0033]"
                    />
                  </div>

                  <button
                    type="button"
                    data-testid="increase-seek-step-btn"
                    aria-label="Increase skip seconds"
                    onClick={() =>
                      onUpdatePreferences({
                        seekStepSeconds: Math.min(60, (preferences.seekStepSeconds ?? 5) + 1),
                      })
                    }
                    className="p-1.5 rounded-md bg-[#303030] hover:bg-[#383838] text-[#F1F1F1] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  {(preferences.seekStepSeconds ?? 5) !== 5 && (
                    <button
                      type="button"
                      data-testid="reset-seek-step-btn"
                      onClick={() => onUpdatePreferences({ seekStepSeconds: 5 })}
                      aria-label="Reset skip time to 5 seconds"
                      title="Reset to 5s"
                      className="p-1.5 rounded-md bg-[#303030] hover:bg-[#383838] text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick preset buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {SEEK_STEP_PRESETS.map((sec) => {
                  const isSelected = (preferences.seekStepSeconds ?? 5) === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      data-testid={`seek-step-preset-${sec}`}
                      onClick={() => onUpdatePreferences({ seekStepSeconds: sec })}
                      className={`py-1.5 rounded-md font-mono tabular-nums transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF0033] text-white font-semibold'
                          : 'bg-[#303030] hover:bg-[#383838] text-[#F1F1F1]'
                      }`}
                    >
                      {sec}s
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-[#383838]" />

            <button
              type="button"
              onClick={onTriggerOpenVideo}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#303030] hover:bg-[#383838] text-[#F1F1F1] font-medium transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#AAAAAA] shrink-0" />
              <div className="text-left min-w-0">
                <div>Open Local Video File</div>
                <div className="text-[11px] text-[#AAAAAA] font-normal">
                  Select MP4, WebM, or compatible MKV from PC
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onTriggerOpenUrlModal}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#303030] hover:bg-[#383838] text-[#F1F1F1] font-medium transition-colors cursor-pointer"
            >
              <Link2 className="w-4 h-4 text-[#AAAAAA] shrink-0" />
              <div className="text-left min-w-0">
                <div>Open Stream URL</div>
                <div className="text-[11px] text-[#AAAAAA] font-normal">
                  Direct MP4, WebM, HLS (.m3u8), or DASH (.mpd)
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

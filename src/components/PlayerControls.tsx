import React, { useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Subtitles,
  Settings,
  Maximize,
  Minimize,
  FileText,
  FolderOpen,
  Eye,
} from 'lucide-react';
import { formatTime } from '../utils/subtitleParser';

interface PlayerControlsProps {
  visible: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  seekStepSeconds?: number;
  subtitlesVisible: boolean;
  hasSubtitles: boolean;
  isSettingsOpen: boolean;
  isFullscreen: boolean;
  isMobileLandscape?: boolean;
  concentrationMode?: boolean;
  hasMultiplePlaylistItems: boolean;
  canPlayPrev: boolean;
  canPlayNext: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleSubtitles: () => void;
  onToggleSettings: () => void;
  onToggleFullscreen: () => void;
  onToggleMobileLandscape?: () => void;
  onToggleConcentrationMode?: () => void;
  onOpenSubtitleFile: () => void;
  onOpenVideoFile: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  visible,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackSpeed,
  seekStepSeconds = 5,
  subtitlesVisible,
  hasSubtitles,
  isSettingsOpen,
  isFullscreen,
  isMobileLandscape = false,
  concentrationMode = false,
  hasMultiplePlaylistItems,
  canPlayPrev,
  canPlayNext,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleSubtitles,
  onToggleSettings,
  onToggleFullscreen,
  onToggleMobileLandscape,
  onToggleConcentrationMode,
  onOpenSubtitleFile,
  onOpenVideoFile,
  onPrevTrack,
  onNextTrack,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progressPercent =
    safeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / safeDuration) * 100)) : 0;

  const stopProp = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const calculateTimeFromPointer = (
    clientX: number,
    clientY?: number
  ): { time: number; percent: number } | null => {
    if (!progressBarRef.current || safeDuration <= 0) return null;
    const rect = progressBarRef.current.getBoundingClientRect();
    const isRotated90 = rect.height > rect.width * 2 && typeof clientY === 'number';
    const ratio = isRotated90
      ? Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
      : Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return {
      time: ratio * safeDuration,
      percent: ratio * 100,
    };
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const res = calculateTimeFromPointer(e.clientX, e.clientY);
    if (res) {
      setHoverTime(res.time);
      setHoverPercent(res.percent);
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const res = calculateTimeFromPointer(e.clientX, e.clientY);
    if (res) {
      onSeek(res.time);
    }

    const handleWindowMouseMove = (moveEvt: MouseEvent) => {
      const moveRes = calculateTimeFromPointer(moveEvt.clientX, moveEvt.clientY);
      if (moveRes) {
        onSeek(moveRes.time);
      }
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;
    const res = calculateTimeFromPointer(touch.clientX, touch.clientY);
    if (res) {
      onSeek(res.time);
    }

    const handleWindowTouchMove = (moveEvt: TouchEvent) => {
      const moveTouch = moveEvt.touches[0];
      if (!moveTouch) return;
      const moveRes = calculateTimeFromPointer(moveTouch.clientX, moveTouch.clientY);
      if (moveRes) {
        onSeek(moveRes.time);
      }
    };

    const handleWindowTouchEnd = () => {
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };

    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', handleWindowTouchEnd);
  };

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div
      data-testid="player-bottom-controls"
      onMouseDown={stopProp}
      onClick={stopProp}
      onDoubleClick={stopProp}
      className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-3 sm:pt-8 pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-2.5 px-3 sm:px-4 select-none transition-opacity duration-200 ${
        visible || isSettingsOpen
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Slim Red YouTube-Inspired Progress Bar with Generous Mobile Touch Hit Area */}
      <div
        ref={progressBarRef}
        role="slider"
        aria-label="Seek timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(safeDuration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        onMouseMove={handleProgressMouseMove}
        onMouseLeave={() => setHoverTime(null)}
        onMouseDown={handleProgressMouseDown}
        onTouchStart={handleProgressTouchStart}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(Math.max(0, currentTime - seekStepSeconds));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(Math.min(safeDuration, currentTime + seekStepSeconds));
          }
        }}
        className="group relative flex items-center h-6 sm:h-4 w-full cursor-pointer mb-1 sm:mb-1 touch-none"
      >
        {/* Hover timestamp tooltip */}
        {hoverTime !== null && safeDuration > 0 && (
          <div
            style={{ left: `${Math.min(96, Math.max(4, hoverPercent))}%` }}
            className="absolute -top-7 -translate-x-1/2 rounded bg-[#212121] border border-[#383838] px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-[#F1F1F1] pointer-events-none shadow"
          >
            {formatTime(hoverTime)}
          </div>
        )}

        {/* Track background */}
        <div className="relative w-full h-1 group-hover:h-1.5 bg-white/25 rounded-full overflow-visible transition-all duration-150">
          {/* Hover preview bar */}
          {hoverTime !== null && (
            <div
              style={{ width: `${hoverPercent}%` }}
              className="absolute inset-y-0 left-0 bg-white/40 rounded-full"
            />
          )}
          {/* Played red bar */}
          <div
            style={{ width: `${progressPercent}%` }}
            className="absolute inset-y-0 left-0 bg-[#FF0033] rounded-full"
          />
          {/* Scrub thumb */}
          <div
            style={{ left: `${progressPercent}%` }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#FF0033] scale-0 group-hover:scale-100 transition-transform duration-150 shadow"
          />
        </div>
      </div>

      {/* Bottom Controls Row */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-4 text-[#F1F1F1]">
        {/* Left side: Play/Pause, Next/Prev, Volume, Time */}
        <div className="flex items-center gap-0.5 sm:gap-2 min-w-0">
          {hasMultiplePlaylistItems && (
            <button
              type="button"
              disabled={!canPlayPrev}
              onClick={onPrevTrack}
              aria-label="Previous video"
              title="Previous video"
              className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 p-2 sm:p-2 rounded-lg text-[#F1F1F1] hover:bg-[#303030]/80 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer flex items-center justify-center active:scale-95"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 p-2 sm:p-2 rounded-lg text-[#F1F1F1] hover:bg-[#303030]/80 transition-colors cursor-pointer flex items-center justify-center active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          {hasMultiplePlaylistItems && (
            <button
              type="button"
              disabled={!canPlayNext}
              onClick={onNextTrack}
              aria-label="Next video"
              title="Next video"
              className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 p-2 sm:p-2 rounded-lg text-[#F1F1F1] hover:bg-[#303030]/80 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer flex items-center justify-center active:scale-95"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          {/* Volume icon + slider (slider hidden on mobile viewports to prevent crowding) */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 group/vol">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted || effectiveVolume === 0 ? 'Unmute' : 'Mute'}
              title="Mute / Unmute (M)"
              className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 p-2 sm:p-2 rounded-lg text-[#F1F1F1] hover:bg-[#303030]/80 transition-colors cursor-pointer flex items-center justify-center active:scale-95"
            >
              {effectiveVolume === 0 ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-[#F1F1F1]" />
              ) : effectiveVolume < 0.5 ? (
                <Volume1 className="w-4 h-4 sm:w-5 sm:h-5 text-[#F1F1F1]" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#F1F1F1]" />
              )}
            </button>
            <input
              type="range"
              aria-label="Volume"
              title="Volume (Up/Down Arrow)"
              min={0}
              max={1}
              step={0.05}
              value={effectiveVolume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="hidden sm:block w-16 sm:w-20 h-1 accent-[#F1F1F1] bg-white/30 rounded-lg cursor-pointer"
            />
          </div>

          {/* Current time / duration */}
          <div
            data-testid="player-time-display"
            className="ml-1 sm:ml-2 text-[11px] sm:text-xs font-mono tabular-nums text-[#F1F1F1] whitespace-nowrap"
          >
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1 text-[#AAAAAA]">/</span>
            <span className="text-[#AAAAAA]">{formatTime(safeDuration)}</span>
          </div>
        </div>

        {/* Right side: Subtitle Toggle, Settings, Mobile Landscape, Fullscreen (Open Video & Open Subtitle hidden on mobile playback bar) */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          {/* Open Video button (desktop only) */}
          <button
            type="button"
            onClick={onOpenVideoFile}
            aria-label="Open Video"
            title="Open local video file"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#F1F1F1] hover:bg-[#303030]/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FolderOpen className="w-4 h-4 text-[#AAAAAA]" />
            <span>Open Video</span>
          </button>

          {/* Open Subtitle button (desktop only; on mobile, open via main view or settings) */}
          <button
            type="button"
            onClick={onOpenSubtitleFile}
            aria-label="Open Subtitle"
            title="Open local subtitle file (.srt or .vtt)"
            className="hidden sm:inline-flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-[#F1F1F1] hover:bg-[#303030]/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-[#AAAAAA]" />
            <span>Open Subtitle</span>
          </button>

          {/* Subtitle visibility toggle (S) */}
          <button
            type="button"
            onClick={onToggleSubtitles}
            aria-label={subtitlesVisible ? 'Hide subtitles' : 'Show subtitles'}
            aria-pressed={subtitlesVisible}
            title="Subtitles On/Off (S)"
            className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 relative p-2 sm:p-2 rounded-lg text-[#F1F1F1] hover:bg-[#303030]/80 transition-colors cursor-pointer flex items-center justify-center active:scale-95"
          >
            <Subtitles
              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                subtitlesVisible && hasSubtitles ? 'text-[#F1F1F1]' : 'text-[#AAAAAA]'
              }`}
            />
            {subtitlesVisible && (
              <span className="absolute bottom-1 left-2.5 right-2.5 h-0.5 rounded-full bg-[#FF0033]" />
            )}
          </button>

          {/* Settings Gear (with speed indicator when != 1x) */}
          <button
            type="button"
            onClick={onToggleSettings}
            aria-label="Settings"
            aria-expanded={isSettingsOpen}
            title="Settings (Playback Speed, Subtitle Sync, Audio)"
            className={`min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 inline-flex items-center justify-center gap-1 p-2 sm:p-2 rounded-lg text-[#F1F1F1] hover:bg-[#303030]/80 transition-colors cursor-pointer active:scale-95 ${
              isSettingsOpen ? 'bg-[#303030]/90' : ''
            }`}
          >
            {playbackSpeed !== 1 && (
              <span className="text-[10px] sm:text-[11px] font-mono tabular-nums text-[#FF0033] font-semibold">
                {playbackSpeed}×
              </span>
            )}
            <Settings
              className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${
                isSettingsOpen ? 'rotate-45' : ''
              }`}
            />
          </button>

          {/* Concentration Mode Eye Toggle (mobile & tablet only; desktop uses 'C' shortcut or settings menu, strictly preserving desktop layout) */}
          {onToggleConcentrationMode && (
            <button
              type="button"
              data-testid="mobile-concentration-btn"
              onClick={onToggleConcentrationMode}
              aria-label={concentrationMode ? 'Exit Concentration Mode' : 'Concentration Mode'}
              aria-pressed={concentrationMode}
              title="Concentration Mode (C)"
              className={`min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 inline-flex lg:hidden [@media(pointer:coarse)]:inline-flex p-2 sm:p-2 rounded-lg ${
                concentrationMode
                  ? 'bg-[#303030]/90 text-[#FF0033]'
                  : 'text-[#F1F1F1] hover:bg-[#303030]/80'
              } transition-colors cursor-pointer items-center justify-center active:scale-95`}
            >
              <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Fullscreen Toggle (F) */}
          <button
            type="button"
            data-testid="player-fullscreen-btn"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title="Fullscreen (F)"
            className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 p-2 sm:p-2 rounded-lg text-[#F1F1F1] hover:bg-[#303030]/80 transition-colors cursor-pointer flex items-center justify-center active:scale-95"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

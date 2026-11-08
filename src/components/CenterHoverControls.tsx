import React from 'react';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';

interface CenterHoverControlsProps {
  visible: boolean;
  isPlaying: boolean;
  seekStepSeconds?: number;
  onSeekBackward: () => void;
  onTogglePlay: () => void;
  onSeekForward: () => void;
}

export const CenterHoverControls: React.FC<CenterHoverControlsProps> = ({
  visible,
  isPlaying,
  seekStepSeconds = 5,
  onSeekBackward,
  onTogglePlay,
  onSeekForward,
}) => {
  const stopProp = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      data-testid="center-hover-controls"
      className={`absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center gap-5 sm:gap-7 pointer-events-none transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backward N seconds */}
      <button
        type="button"
        data-testid="center-seek-backward-btn"
        onMouseDown={stopProp}
        onTouchStart={stopProp}
        onClick={(e) => {
          e.stopPropagation();
          onSeekBackward();
        }}
        aria-label={`Backward ${seekStepSeconds} seconds`}
        title={`Backward ${seekStepSeconds} seconds (Left Arrow)`}
        className={`relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/65 hover:bg-[#303030]/90 border border-white/15 text-[#F1F1F1] backdrop-blur-xs transition-all duration-150 hover:scale-105 active:scale-90 shadow-lg cursor-pointer select-none ${
          visible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <RotateCcw className="w-5 h-5 sm:w-7 sm:h-7 stroke-[1.75]" />
        <span
          data-testid="center-seek-backward-value"
          className="absolute text-[9px] sm:text-[10px] font-bold tracking-tighter text-[#F1F1F1] mt-0.5 tabular-nums"
        >
          {seekStepSeconds}
        </span>
      </button>

      {/* Play / Pause */}
      <button
        type="button"
        onMouseDown={stopProp}
        onTouchStart={stopProp}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        className={`flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/70 hover:bg-[#303030]/90 border border-white/20 text-[#F1F1F1] backdrop-blur-xs transition-all duration-150 hover:scale-105 active:scale-90 shadow-xl cursor-pointer select-none ${
          visible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.75] fill-current" />
        ) : (
          <Play className="w-7 h-7 sm:w-8 sm:h-8 stroke-[1.75] fill-current ml-0.5" />
        )}
      </button>

      {/* Forward N seconds */}
      <button
        type="button"
        data-testid="center-seek-forward-btn"
        onMouseDown={stopProp}
        onTouchStart={stopProp}
        onClick={(e) => {
          e.stopPropagation();
          onSeekForward();
        }}
        aria-label={`Forward ${seekStepSeconds} seconds`}
        title={`Forward ${seekStepSeconds} seconds (Right Arrow)`}
        className={`relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/65 hover:bg-[#303030]/90 border border-white/15 text-[#F1F1F1] backdrop-blur-xs transition-all duration-150 hover:scale-105 active:scale-90 shadow-lg cursor-pointer select-none ${
          visible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <RotateCw className="w-5 h-5 sm:w-7 sm:h-7 stroke-[1.75]" />
        <span
          data-testid="center-seek-forward-value"
          className="absolute text-[9px] sm:text-[10px] font-bold tracking-tighter text-[#F1F1F1] mt-0.5 tabular-nums"
        >
          {seekStepSeconds}
        </span>
      </button>
    </div>
  );
};

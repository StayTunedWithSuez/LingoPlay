import React from 'react';
import { Play } from 'lucide-react';

interface LingoPlayLogoProps {
  onClick?: () => void;
  size?: 'sm' | 'md';
  testId?: string;
}

export const LingoPlayLogo: React.FC<LingoPlayLogoProps> = ({
  onClick,
  size = 'md',
  testId = 'lingo-play-logo',
}) => {
  const iconBoxSize = size === 'sm' ? 'w-6 h-6 rounded-md' : 'w-7 h-7 rounded-lg';
  const playIconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const textSize = size === 'sm' ? 'text-sm' : 'text-base sm:text-[17px]';

  const content = (
    <>
      <span
        className={`inline-flex items-center justify-center ${iconBoxSize} bg-[#212121] border border-[#383838] shrink-0 transition-colors group-hover:border-[#FF0033]/60`}
        aria-hidden="true"
      >
        <Play className={`${playIconSize} text-[#FF0033] fill-[#FF0033] translate-x-[0.5px]`} />
      </span>
      <span className={`${textSize} font-semibold tracking-tight whitespace-nowrap`}>
        <span className="text-[#F1F1F1]">Lingo</span>{' '}
        <span className="text-[#FF0033]">Play</span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={onClick}
        aria-label="Lingo Play Home"
        title="Lingo Play — Return to Video Player"
        className="group inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg py-1 px-1.5 -ml-1.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0033] cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-testid={testId}
      className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0"
    >
      {content}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Link2, X, AlertCircle } from 'lucide-react';

interface UrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadUrl: (videoUrl: string, separateAudioUrl?: string) => void;
}

export const UrlModal: React.FC<UrlModalProps> = ({
  isOpen,
  onClose,
  onLoadUrl,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [audioUrlInput, setAudioUrlInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stopProp = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const validateHttpUrl = (raw: string, label: string): string | null => {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return `${label} must start with http:// or https://`;
      }
      if (
        parsed.hostname.includes('youtube.com') ||
        parsed.hostname.includes('youtu.be') ||
        parsed.hostname.includes('netflix.com')
      ) {
        return 'Webpage URLs (such as YouTube or DRM streaming sites) cannot be played directly. Please provide a direct .mp4, .webm, .m3u8 (HLS), or .mpd (MPEG-DASH) media stream URL.';
      }
      return null;
    } catch {
      return `Please enter a valid ${label} starting with https:// or http://`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedVideo = urlInput.trim();
    const trimmedAudio = audioUrlInput.trim();

    if (!trimmedVideo) {
      setValidationError('Please enter a direct video or stream URL.');
      return;
    }

    const videoErr = validateHttpUrl(trimmedVideo, 'Video URL');
    if (videoErr) {
      setValidationError(videoErr);
      return;
    }

    if (trimmedAudio) {
      const audioErr = validateHttpUrl(trimmedAudio, 'Separate audio URL');
      if (audioErr) {
        setValidationError(audioErr);
        return;
      }
    }

    setValidationError(null);
    onLoadUrl(trimmedVideo, trimmedAudio || undefined);
    setUrlInput('');
    setAudioUrlInput('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-url-dialog-title"
      onMouseDown={stopProp}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
    >
      <div
        onClick={stopProp}
        className="w-full max-w-md rounded-xl bg-[#212121] border border-[#383838] p-5 text-[#F1F1F1] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#FF0033]" />
            <h2 id="open-url-dialog-title" className="text-sm font-semibold">
              Open Direct Video or Stream URL
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Open URL dialog"
            className="p-1 rounded-lg text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="stream-url-input"
              className="block text-xs text-[#AAAAAA] mb-1.5"
            >
              Video or Manifest URL (.mp4, .webm, HLS .m3u8, DASH .mpd)
            </label>
            <input
              id="stream-url-input"
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="https://example.com/master.m3u8 or manifest.mpd"
              autoFocus
              className="w-full rounded-lg bg-[#0F0F0F] border border-[#383838] px-3 py-2 text-xs text-[#F1F1F1] placeholder-[#AAAAAA]/50 focus:outline-none focus:border-[#F1F1F1]"
            />
          </div>

          <div>
            <label
              htmlFor="separate-audio-url-input"
              className="block text-xs text-[#AAAAAA] mb-1.5"
            >
              Separate Audio Stream URL (Optional — if language audio is a separate URL)
            </label>
            <input
              id="separate-audio-url-input"
              type="text"
              value={audioUrlInput}
              onChange={(e) => {
                setAudioUrlInput(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="https://example.com/audio-en.m3u8 or audio.m4a (optional)"
              className="w-full rounded-lg bg-[#0F0F0F] border border-[#383838] px-3 py-2 text-xs text-[#F1F1F1] placeholder-[#AAAAAA]/50 focus:outline-none focus:border-[#F1F1F1]"
            />
          </div>

          {validationError && (
            <div className="flex items-start gap-2 rounded-lg bg-[#FF0033]/15 border border-[#FF0033]/40 p-2.5 text-xs text-[#F1F1F1]">
              <AlertCircle className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          <p className="text-[11px] text-[#AAAAAA] leading-relaxed">
            Multi-language audio tracks in HLS (.m3u8) and MPEG-DASH (.mpd) manifests are detected automatically in Settings &rarr; Audio.
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#FF0033] hover:bg-[#FF0033]/90 text-white transition-colors cursor-pointer"
            >
              Load Stream
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

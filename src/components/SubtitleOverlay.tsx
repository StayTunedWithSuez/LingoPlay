import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RotateCcw,
  Repeat,
  Languages,
  Copy,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { SubtitleCue } from '../types/player';
import { requestBengaliTranslation } from '../utils/translationClient';

interface SubtitleOverlayProps {
  activeCues: SubtitleCue[];
  visible: boolean;
  fontSize: number;
  bottomOffset: number;
  backgroundEnabled: boolean;
  autoPauseOnSelect: boolean;
  isPlaying: boolean;
  controlsVisible?: boolean;
  loopingCue: SubtitleCue | null;
  videoTrackId?: string;
  onPauseForSelection: () => void;
  onReplayCue: (cue: SubtitleCue) => void;
  onToggleLoopCue: (cue: SubtitleCue) => void;
  onPopupOpenChange?: (isOpen: boolean) => void;
  onSubtitleInteractionChange?: (isActive: boolean) => void;
}

interface TranslationPopupState {
  originalText: string;
  subtitleContext: string;
  bengaliTranslation: string;
  contextualNote: string;
  loading: boolean;
  error: string | null;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  activeCues,
  visible,
  fontSize,
  bottomOffset,
  backgroundEnabled,
  autoPauseOnSelect,
  isPlaying,
  controlsVisible = false,
  loopingCue,
  videoTrackId,
  onPauseForSelection,
  onReplayCue,
  onToggleLoopCue,
  onPopupOpenChange,
  onSubtitleInteractionChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const subtitleTextRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const preservedSelectionRef = useRef<string>('');

  const [isHovered, setIsHovered] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [copiedToolbar, setCopiedToolbar] = useState(false);
  const [copiedTranslation, setCopiedTranslation] = useState(false);
  const [translationPopup, setTranslationPopup] =
    useState<TranslationPopupState | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    cue: SubtitleCue;
  } | null>(null);
  const [isCompactMobile, setIsCompactMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const isTouchSelectionInteractionRef = useRef<boolean>(false);
  const toolbarTouchGuardRef = useRef<boolean>(false);
  const toolbarTouchGuardTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const updateViewportMode = () => {
      setIsCompactMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', updateViewportMode);
    window.addEventListener('orientationchange', updateViewportMode);
    return () => {
      window.removeEventListener('resize', updateViewportMode);
      window.removeEventListener('orientationchange', updateViewportMode);
    };
  }, []);

  // Notify parent when popup open state changes so clicking video surface can dismiss without toggling playback
  useEffect(() => {
    onPopupOpenChange?.(translationPopup !== null);
  }, [translationPopup, onPopupOpenChange]);

  // Notify parent when user is hovering over subtitles, selecting subtitle text, or reading translation popup (only while paused)
  useEffect(() => {
    const active =
      !isPlaying &&
      (isHovered || Boolean(selectedText) || translationPopup !== null);
    onSubtitleInteractionChange?.(active);
  }, [
    isPlaying,
    isHovered,
    selectedText,
    translationPopup,
    onSubtitleInteractionChange,
  ]);

  // When the video starts or resumes playing, close any open translation box, context menu, and active selection
  useEffect(() => {
    if (!isPlaying) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestIdRef.current += 1;
    setTranslationPopup(null);
    setContextMenu(null);
    setSelectedText('');
    preservedSelectionRef.current = '';
    try {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        sel.removeAllRanges();
      }
    } catch {
      // Ignore selection clear errors
    }
  }, [isPlaying]);

  // Clear in-flight translation and popup when switching to a different video track
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestIdRef.current += 1;
    setTranslationPopup(null);
    setSelectedText('');
    preservedSelectionRef.current = '';
  }, [videoTrackId]);

  // Clean up timers and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
      if (toolbarTouchGuardTimerRef.current) {
        window.clearTimeout(toolbarTouchGuardTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const checkSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      if (!toolbarTouchGuardRef.current) {
        setSelectedText('');
        preservedSelectionRef.current = '';
      }
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      if (!toolbarTouchGuardRef.current) {
        setSelectedText('');
        preservedSelectionRef.current = '';
      }
      return;
    }
    if (
      subtitleTextRef.current &&
      selection.anchorNode &&
      subtitleTextRef.current.contains(selection.anchorNode)
    ) {
      setSelectedText(text);
      preservedSelectionRef.current = text;
      setIsHovered(true);
    } else if (
      popupRef.current &&
      selection.anchorNode &&
      popupRef.current.contains(selection.anchorNode)
    ) {
      // Allow selecting text inside the translation popup without clearing subtitle state
      return;
    } else if (!toolbarTouchGuardRef.current) {
      setSelectedText('');
      preservedSelectionRef.current = '';
    }
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      checkSelection();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [checkSelection]);

  // Close custom right-click context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [contextMenu]);

  // Close translation popup on Escape or outside click without toggling playback
  useEffect(() => {
    if (!translationPopup) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        requestIdRef.current += 1;
        setTranslationPopup(null);
      }
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popupRef.current && popupRef.current.contains(target)) {
        return;
      }
      if (containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      requestIdRef.current += 1;
      setTranslationPopup(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [translationPopup]);

  const handleMouseEnterArea = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeaveArea = useCallback(() => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 140);
  }, []);

  const stopAllPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  // Prevent mousedown/touchstart on toolbar buttons from collapsing the browser's active text selection
  const preserveSelectionOnMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const preserveSelectionOnTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const liveSel = window.getSelection();
    if (
      liveSel &&
      !liveSel.isCollapsed &&
      subtitleTextRef.current &&
      liveSel.anchorNode &&
      subtitleTextRef.current.contains(liveSel.anchorNode)
    ) {
      const txt = liveSel.toString().trim();
      if (txt) {
        preservedSelectionRef.current = txt;
        setSelectedText(txt);
      }
    }
    toolbarTouchGuardRef.current = true;
    if (toolbarTouchGuardTimerRef.current) {
      window.clearTimeout(toolbarTouchGuardTimerRef.current);
    }
    toolbarTouchGuardTimerRef.current = window.setTimeout(() => {
      toolbarTouchGuardRef.current = false;
      toolbarTouchGuardTimerRef.current = null;
    }, 500);
  };

  const handleSubtitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTouchSelectionInteractionRef.current) {
      isTouchSelectionInteractionRef.current = false;
      return;
    }
    if (autoPauseOnSelect && isPlaying) {
      onPauseForSelection();
    }
  };

  const handleSubtitleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    isTouchSelectionInteractionRef.current = true;
    if (!isPlaying) {
      setIsHovered(true);
    }
  };

  const displayCues =
    activeCues.length > 0 ? activeCues : loopingCue ? [loopingCue] : [];
  const primaryCue = displayCues[0];
  const fullVisibleSubtitleText = displayCues
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');

  const handleCopyToolbarText = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const liveSelection = window.getSelection()?.toString().trim() || '';
    const textToCopy =
      selectedText ||
      preservedSelectionRef.current ||
      liveSelection ||
      fullVisibleSubtitleText;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedToolbar(true);
      window.setTimeout(() => setCopiedToolbar(false), 1500);
    } catch {
      document.execCommand('copy');
      setCopiedToolbar(true);
      window.setTimeout(() => setCopiedToolbar(false), 1500);
    }
  };

  const handleCopyBengaliTranslation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!translationPopup?.bengaliTranslation) return;
    try {
      await navigator.clipboard.writeText(translationPopup.bengaliTranslation);
      setCopiedTranslation(true);
      window.setTimeout(() => setCopiedTranslation(false), 1500);
    } catch {
      document.execCommand('copy');
      setCopiedTranslation(true);
      window.setTimeout(() => setCopiedTranslation(false), 1500);
    }
  };

  const triggerTranslation = useCallback(
    async (
      overrideText?: string,
      overrideContext?: string,
      forceRefresh: boolean = false
    ) => {
      if (isPlaying) return;
      const liveSelection =
        subtitleTextRef.current &&
        window.getSelection()?.anchorNode &&
        subtitleTextRef.current.contains(window.getSelection()!.anchorNode!)
          ? window.getSelection()?.toString().trim() || ''
          : '';

      const targetText = (
        overrideText ??
        (selectedText ||
          preservedSelectionRef.current ||
          liveSelection ||
          fullVisibleSubtitleText)
      ).trim();

      const contextText = (
        overrideContext ?? (fullVisibleSubtitleText || targetText)
      ).trim();

      if (!targetText) return;

      // Cancel any previous in-flight translation request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentReqId = ++requestIdRef.current;

      setCopiedTranslation(false);
      setTranslationPopup({
        originalText: targetText,
        subtitleContext: contextText,
        bengaliTranslation: '',
        contextualNote: '',
        loading: true,
        error: null,
      });

      try {
        const result = await requestBengaliTranslation(
          targetText,
          contextText,
          controller.signal,
          forceRefresh
        );
        if (requestIdRef.current !== currentReqId) return;

        setTranslationPopup({
          originalText: targetText,
          subtitleContext: contextText,
          bengaliTranslation: result.bengaliTranslation,
          contextualNote: result.contextualNote || '',
          loading: false,
          error: null,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (requestIdRef.current !== currentReqId) return;

        const message =
          err instanceof Error
            ? err.message
            : 'Unable to translate selection. Please try again.';
        setTranslationPopup({
          originalText: targetText,
          subtitleContext: contextText,
          bengaliTranslation: '',
          contextualNote: '',
          loading: false,
          error: message,
        });
      }
    },
    [isPlaying, selectedText, fullVisibleSubtitleText]
  );

  const handleClosePopup = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestIdRef.current += 1;
    setTranslationPopup(null);
  };

  const handleContextMenu = (e: React.MouseEvent, cue: SubtitleCue) => {
    if (isPlaying) return;
    // Only show custom context menu if no text is currently selected,
    // so native browser context menu works unimpeded on selected text
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      cue,
    });
  };

  if (
    !visible ||
    (activeCues.length === 0 && !loopingCue && (isPlaying || !translationPopup))
  ) {
    return null;
  }

  const isLoopingCurrent =
    loopingCue !== null &&
    primaryCue !== undefined &&
    loopingCue.id === primaryCue.id;

  const clampedBottom = Math.min(78, Math.max(6, bottomOffset));
  // If subtitles are positioned high up in the player (>52% from bottom on desktop/tablet, or >36% on compact mobile portrait), render the popup below the subtitle so it stays inside the player boundaries
  const placePopupBelow = isCompactMobile ? clampedBottom > 36 : clampedBottom > 52;

  // Action buttons are completely hidden while the video is playing; when paused, they appear on hover, while text is selected, or while translation popup is open
  const isToolbarVisible =
    !isPlaying && (isHovered || Boolean(selectedText) || translationPopup !== null);

  // On compact mobile screens (<640px), keep subtitles above the bottom control bar when controls are visible; desktop stays at `${clampedBottom}%`
  const containerBottomStyle = isCompactMobile
    ? translationPopup && !placePopupBelow
      ? controlsVisible
        ? '38px'
        : `${Math.min(clampedBottom, 10)}%`
      : controlsVisible
      ? `max(${clampedBottom}%, 52px)`
      : `${clampedBottom}%`
    : `${clampedBottom}%`;

  const effectiveFontSizePx = isCompactMobile
    ? Math.max(11, Math.min(15, Math.round(fontSize * 0.48)))
    : fontSize;

  return (
    <div
      ref={containerRef}
      data-testid="subtitle-overlay-container"
      style={{ bottom: containerBottomStyle }}
      className="absolute left-0 right-0 z-30 flex flex-col items-center px-2.5 sm:px-6 pointer-events-none"
    >
      <div
        data-testid="subtitle-interactive-group"
        onMouseEnter={handleMouseEnterArea}
        onMouseLeave={handleMouseLeaveArea}
        onMouseMove={!isPlaying ? stopAllPropagation : undefined}
        onMouseDown={stopAllPropagation}
        onTouchStart={stopAllPropagation}
        onTouchMove={stopAllPropagation}
        onClick={stopAllPropagation}
        onDoubleClick={stopAllPropagation}
        className="relative flex flex-col items-center max-w-[92%] sm:max-w-[90%] pointer-events-auto"
      >
        {/* Minimal Inline Gemini Translation Popup (positioned directly above subtitle toolbar unless near top of player) */}
        {!isPlaying && translationPopup && !placePopupBelow && (
          <div
            ref={popupRef}
            data-testid="translation-popup"
            role="dialog"
            aria-label="Bengali translation"
            onMouseDown={stopAllPropagation}
            onTouchStart={stopAllPropagation}
            onTouchMove={stopAllPropagation}
            onClick={stopAllPropagation}
            onDoubleClick={stopAllPropagation}
            className="custom-scrollbar mb-1 sm:mb-2 w-[min(320px,86vw)] sm:w-[min(400px,88vw)] max-h-[96px] sm:max-h-[210px] lg:max-h-none overflow-y-auto rounded-[11px] bg-[#212121] border border-[#383838] p-2 sm:p-3 text-left text-[#F1F1F1] shadow-2xl transition-all duration-150 select-text cursor-auto"
          >
            {/* Popup Header: Original English Text + Copy & Close */}
            <div className="flex items-start justify-between gap-2 pb-1.5 sm:pb-2 border-b border-[#383838]/80">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#AAAAAA] select-none">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF0033]" />
                  <span>English</span>
                </div>
                <p
                  data-testid="translation-original-text"
                  className="mt-0.5 text-xs sm:text-[13px] font-medium text-[#F1F1F1] leading-snug break-words select-text cursor-text"
                >
                  &ldquo;{translationPopup.originalText}&rdquo;
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0 select-none">
                {!translationPopup.loading &&
                  !translationPopup.error &&
                  translationPopup.bengaliTranslation && (
                    <>
                      <button
                        type="button"
                        data-testid="translation-retranslate-btn"
                        onMouseDown={preserveSelectionOnMouseDown}
                        onTouchStart={preserveSelectionOnTouchStart}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerTranslation(
                            translationPopup.originalText,
                            translationPopup.subtitleContext,
                            true
                          );
                        }}
                        title="Retranslate text"
                        aria-label="Retranslate text"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retranslate</span>
                      </button>
                      <button
                        type="button"
                        data-testid="translation-copy-btn"
                        onMouseDown={preserveSelectionOnMouseDown}
                        onTouchStart={preserveSelectionOnTouchStart}
                        onClick={handleCopyBengaliTranslation}
                        title="Copy Bengali translation"
                        aria-label="Copy Bengali translation"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
                      >
                        {copiedTranslation ? (
                          <>
                            <Check className="w-3 h-3 text-[#FF0033]" />
                            <span className="text-[#F1F1F1]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                <button
                  type="button"
                  data-testid="translation-popup-close"
                  onMouseDown={preserveSelectionOnMouseDown}
                  onClick={handleClosePopup}
                  title="Close (Esc)"
                  aria-label="Close translation popup"
                  className="p-1 rounded-md text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Popup Body: Bengali Meaning (বাংলা অর্থ) */}
            <div className="pt-2">
              <div className="text-[11px] font-medium text-[#AAAAAA] select-none mb-1">
                বাংলা অর্থ
              </div>

              {translationPopup.loading && (
                <div
                  data-testid="translation-loading"
                  className="flex items-center gap-2 py-1.5 text-xs text-[#AAAAAA] select-none"
                >
                  <Loader2 className="w-3.5 h-3.5 text-[#FF0033] animate-spin shrink-0" />
                  <span>Translating into Bengali...</span>
                </div>
              )}

              {!translationPopup.loading && translationPopup.error && (
                <div
                  data-testid="translation-error-text"
                  className="flex items-start justify-between gap-2 rounded-lg bg-[#181818] border border-[#FF0033]/50 p-2 text-xs text-[#F1F1F1]"
                >
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#FF0033] shrink-0 mt-0.5" />
                    <span className="text-[#AAAAAA] leading-relaxed">
                      {translationPopup.error}
                    </span>
                  </div>
                  <button
                    type="button"
                    onMouseDown={preserveSelectionOnMouseDown}
                    onClick={() =>
                      triggerTranslation(
                        translationPopup.originalText,
                        translationPopup.subtitleContext
                      )
                    }
                    className="shrink-0 rounded bg-[#303030] hover:bg-[#383838] px-2 py-0.5 text-[11px] font-medium text-[#F1F1F1] transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!translationPopup.loading &&
                !translationPopup.error &&
                translationPopup.bengaliTranslation && (
                  <div className="space-y-1.5">
                    <p
                      data-testid="translation-bengali-text"
                      className="text-sm sm:text-[15px] font-medium text-[#F1F1F1] leading-relaxed break-words select-text cursor-text"
                    >
                      {translationPopup.bengaliTranslation}
                    </p>
                    {translationPopup.contextualNote && (
                      <p
                        data-testid="translation-context-note"
                        className="text-[11px] text-[#AAAAAA] leading-snug border-l-2 border-[#FF0033]/70 pl-2 select-text cursor-text"
                      >
                        {translationPopup.contextualNote}
                      </p>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Hover-Only Floating Subtitle Action Toolbar (just above subtitle text) */}
        {primaryCue && (
          <div
            data-testid="subtitle-hover-toolbar"
            aria-hidden={!isToolbarVisible}
            onMouseDown={preserveSelectionOnMouseDown}
            onTouchStart={preserveSelectionOnTouchStart}
            onClick={stopAllPropagation}
            onDoubleClick={stopAllPropagation}
            className={`pb-1 sm:pb-1.5 flex items-center justify-center transition-all duration-175 ease-out select-none ${
              isToolbarVisible
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'hidden opacity-0 translate-y-1 pointer-events-none'
            }`}
          >
            <div className="inline-flex items-center gap-1 rounded-lg bg-[#212121]/92 border border-[#383838] px-1.5 py-1 text-xs text-[#F1F1F1] shadow-lg backdrop-blur-xs">
              {/* Replay button */}
              <button
                type="button"
                data-testid="subtitle-replay-btn"
                onMouseDown={preserveSelectionOnMouseDown}
                onTouchStart={preserveSelectionOnTouchStart}
                onClick={(e) => {
                  e.stopPropagation();
                  onReplayCue(primaryCue);
                }}
                aria-label="Replay current subtitle"
                title="Replay current subtitle (-0.5s)"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#AAAAAA]" />
                <span className="text-[11px] font-medium">Replay</span>
              </button>

              {/* Repeat / Loop button */}
              <button
                type="button"
                data-testid="subtitle-repeat-btn"
                onMouseDown={preserveSelectionOnMouseDown}
                onTouchStart={preserveSelectionOnTouchStart}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLoopCue(primaryCue);
                }}
                aria-label={
                  isLoopingCurrent
                    ? 'Stop repeating current subtitle'
                    : 'Repeat current subtitle'
                }
                title={
                  isLoopingCurrent
                    ? 'Repeating subtitle (click to turn off)'
                    : 'Repeat / loop current subtitle'
                }
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors cursor-pointer ${
                  isLoopingCurrent
                    ? 'bg-[#FF0033] text-white'
                    : 'text-[#F1F1F1] hover:bg-[#303030]'
                }`}
              >
                <Repeat
                  className={`w-3.5 h-3.5 ${
                    isLoopingCurrent ? 'text-white' : 'text-[#AAAAAA]'
                  }`}
                />
                <span className="text-[11px] font-medium">Repeat</span>
              </button>

              <div className="w-px h-3.5 bg-[#383838] mx-0.5" />

              {/* Translate to Bengali (Gemini AI) button */}
              <button
                type="button"
                data-testid="subtitle-translate-btn"
                onMouseDown={preserveSelectionOnMouseDown}
                onTouchStart={preserveSelectionOnTouchStart}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerTranslation();
                }}
                aria-label="Translate subtitle to Bengali"
                title={
                  selectedText
                    ? `Translate "${selectedText}" to Bengali (বাংলা)`
                    : 'Translate current subtitle to Bengali (বাংলা)'
                }
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[#F1F1F1] hover:bg-[#FF0033] hover:text-white transition-colors cursor-pointer group/tr"
              >
                <Languages className="w-3.5 h-3.5 text-[#FF0033] group-hover/tr:text-white transition-colors" />
                <span className="text-[11px] font-medium">Translate</span>
              </button>

              {/* Copy button */}
              <button
                type="button"
                data-testid="subtitle-copy-btn"
                onMouseDown={preserveSelectionOnMouseDown}
                onTouchStart={preserveSelectionOnTouchStart}
                onClick={handleCopyToolbarText}
                aria-label="Copy subtitle text"
                title={
                  selectedText
                    ? 'Copy selected text (Ctrl+C)'
                    : 'Copy current subtitle text'
                }
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
              >
                {copiedToolbar ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#FF0033]" />
                    <span className="text-[11px] font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#AAAAAA]" />
                    <span className="text-[11px] font-medium">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Main Selectable Subtitle Text Box (clean and distraction-free during playback) */}
        {displayCues.length > 0 && (
          <div
            ref={subtitleTextRef}
            data-testid="subtitle-text-box"
            onMouseDown={handleSubtitleMouseDown}
            onTouchStart={handleSubtitleTouchStart}
            onTouchMove={stopAllPropagation}
            onMouseUp={(e) => {
              e.stopPropagation();
              checkSelection();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              checkSelection();
            }}
            onClick={stopAllPropagation}
            onDoubleClick={(e) => {
              e.stopPropagation();
              checkSelection();
            }}
            onContextMenu={(e) => primaryCue && handleContextMenu(e, primaryCue)}
            style={{
              fontSize: `${effectiveFontSizePx}px`,
              lineHeight: isCompactMobile ? 1.3 : 1.38,
              textShadow: backgroundEnabled
                ? '0 1px 2px rgba(0, 0, 0, 0.9)'
                : '0 0 4px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,0.95), 1px 1px 2px rgba(0,0,0,0.95), -1px -1px 2px rgba(0,0,0,0.95)',
            }}
            className={`select-text cursor-text text-center font-medium tracking-wide text-[#F1F1F1] rounded-md px-2.5 py-1 sm:px-3.5 sm:py-1.5 transition-colors ${
              backgroundEnabled
                ? 'bg-[#181818]/85 border border-white/10 shadow-md'
                : 'bg-transparent'
            } ${isLoopingCurrent ? 'ring-1 ring-[#FF0033]/80' : ''}`}
          >
            {displayCues.map((cue, idx) => (
              <div key={cue.id} className={idx > 0 ? 'mt-1' : ''}>
                {cue.text.split('\n').map((line, lineIdx) => (
                  <p key={lineIdx} className="select-text whitespace-pre-wrap">
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Minimal Inline Gemini Translation Popup (positioned below subtitle if subtitle is near top of player) */}
        {!isPlaying && translationPopup && placePopupBelow && (
          <div
            ref={popupRef}
            data-testid="translation-popup"
            role="dialog"
            aria-label="Bengali translation"
            onMouseDown={stopAllPropagation}
            onTouchStart={stopAllPropagation}
            onTouchMove={stopAllPropagation}
            onClick={stopAllPropagation}
            onDoubleClick={stopAllPropagation}
            className="custom-scrollbar mt-1.5 sm:mt-2 w-[min(320px,86vw)] sm:w-[min(400px,88vw)] max-h-[115px] sm:max-h-[210px] lg:max-h-none overflow-y-auto rounded-[11px] bg-[#212121] border border-[#383838] p-2.5 sm:p-3 text-left text-[#F1F1F1] shadow-2xl transition-all duration-150 select-text cursor-auto"
          >
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#383838]/80">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#AAAAAA] select-none">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF0033]" />
                  <span>English</span>
                </div>
                <p
                  data-testid="translation-original-text"
                  className="mt-0.5 text-xs sm:text-[13px] font-medium text-[#F1F1F1] leading-snug break-words select-text cursor-text"
                >
                  &ldquo;{translationPopup.originalText}&rdquo;
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0 select-none">
                {!translationPopup.loading &&
                  !translationPopup.error &&
                  translationPopup.bengaliTranslation && (
                    <>
                      <button
                        type="button"
                        data-testid="translation-retranslate-btn"
                        onMouseDown={preserveSelectionOnMouseDown}
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerTranslation(
                            translationPopup.originalText,
                            translationPopup.subtitleContext,
                            true
                          );
                        }}
                        title="Retranslate text"
                        aria-label="Retranslate text"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retranslate</span>
                      </button>
                      <button
                        type="button"
                        data-testid="translation-copy-btn"
                        onMouseDown={preserveSelectionOnMouseDown}
                        onClick={handleCopyBengaliTranslation}
                        title="Copy Bengali translation"
                        aria-label="Copy Bengali translation"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
                      >
                        {copiedTranslation ? (
                          <>
                            <Check className="w-3 h-3 text-[#FF0033]" />
                            <span className="text-[#F1F1F1]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                <button
                  type="button"
                  data-testid="translation-popup-close"
                  onMouseDown={preserveSelectionOnMouseDown}
                  onClick={handleClosePopup}
                  title="Close (Esc)"
                  aria-label="Close translation popup"
                  className="p-1 rounded-md text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-[11px] font-medium text-[#AAAAAA] select-none mb-1">
                বাংলা অর্থ
              </div>

              {translationPopup.loading && (
                <div
                  data-testid="translation-loading"
                  className="flex items-center gap-2 py-1.5 text-xs text-[#AAAAAA] select-none"
                >
                  <Loader2 className="w-3.5 h-3.5 text-[#FF0033] animate-spin shrink-0" />
                  <span>Translating into Bengali...</span>
                </div>
              )}

              {!translationPopup.loading && translationPopup.error && (
                <div
                  data-testid="translation-error-text"
                  className="flex items-start justify-between gap-2 rounded-lg bg-[#181818] border border-[#FF0033]/50 p-2 text-xs text-[#F1F1F1]"
                >
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#FF0033] shrink-0 mt-0.5" />
                    <span className="text-[#AAAAAA] leading-relaxed">
                      {translationPopup.error}
                    </span>
                  </div>
                  <button
                    type="button"
                    onMouseDown={preserveSelectionOnMouseDown}
                    onClick={() =>
                      triggerTranslation(
                        translationPopup.originalText,
                        translationPopup.subtitleContext
                      )
                    }
                    className="shrink-0 rounded bg-[#303030] hover:bg-[#383838] px-2 py-0.5 text-[11px] font-medium text-[#F1F1F1] transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!translationPopup.loading &&
                !translationPopup.error &&
                translationPopup.bengaliTranslation && (
                  <div className="space-y-1.5">
                    <p
                      data-testid="translation-bengali-text"
                      className="text-sm sm:text-[15px] font-medium text-[#F1F1F1] leading-relaxed break-words select-text cursor-text"
                    >
                      {translationPopup.bengaliTranslation}
                    </p>
                    {translationPopup.contextualNote && (
                      <p
                        data-testid="translation-context-note"
                        className="text-[11px] text-[#AAAAAA] leading-snug border-l-2 border-[#FF0033]/70 pl-2 select-text cursor-text"
                      >
                        {translationPopup.contextualNote}
                      </p>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Contextual menu on right-click when no text is selected */}
      {!isPlaying && contextMenu && (
        <div
          onMouseDown={stopAllPropagation}
          onClick={stopAllPropagation}
          style={{
            position: 'fixed',
            left: Math.min(window.innerWidth - 220, contextMenu.x),
            top: Math.min(window.innerHeight - 140, contextMenu.y),
          }}
          className="pointer-events-auto z-50 w-52 rounded-lg bg-[#212121] border border-[#383838] py-1.5 shadow-xl text-xs text-[#F1F1F1] select-none"
        >
          <button
            type="button"
            onClick={() => {
              onReplayCue(contextMenu.cue);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#303030] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#AAAAAA]" />
            <span>Replay current subtitle</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleLoopCue(contextMenu.cue);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#303030] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Repeat className="w-3.5 h-3.5 text-[#AAAAAA]" />
              <span>Repeat current subtitle</span>
            </span>
            {isLoopingCurrent && (
              <span className="text-[11px] font-medium text-[#FF0033]">On</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerTranslation(contextMenu.cue.text, contextMenu.cue.text);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#303030] transition-colors cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-[#FF0033]" />
            <span>Translate to Bengali</span>
          </button>
        </div>
      )}
    </div>
  );
};

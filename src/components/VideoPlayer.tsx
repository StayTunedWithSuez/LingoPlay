import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import shaka from 'shaka-player';
import {
  FolderOpen,
  FileText,
  Link2,
  AlertTriangle,
  Sparkles,
  Repeat,
  X,
  EyeOff,
  Minimize,
} from 'lucide-react';
import {
  SubtitleCue,
  PlaylistItem,
  PlayerPreferences,
  DEFAULT_PREFERENCES,
} from '../types/player';
import {
  parseSubtitles,
  getActiveSubtitles,
  getSubtitleReplayTime,
  computeSeekTime,
  sanitizeSubtitleLine,
} from '../utils/subtitleParser';
import {
  DiscoveredAudioTrack,
  PlaybackEngineType,
  detectStreamEngine,
  mapHlsAudioTracks,
  mapShakaVariantTracks,
  mapNativeAudioTracks,
} from '../utils/audioTracks';
import {
  DiscoveredSubtitleTrack,
  mapHlsSubtitleTracks,
  mapShakaTextTracks,
  mapNativeTextTracks,
  extractActiveCuesFromTextTracks,
} from '../utils/subtitleTracks';
import {
  SAMPLE_SRT_CONTENT,
  createSynthesizedMediaBlobUrl,
} from '../utils/sampleMedia';
import { SubtitleOverlay } from './SubtitleOverlay';
import { CenterHoverControls } from './CenterHoverControls';
import { PlayerControls } from './PlayerControls';
import { SettingsMenu } from './SettingsMenu';
import { UrlModal } from './UrlModal';
import { LingoPlayLogo } from './LingoPlayLogo';
import { AboutPage } from './AboutPage';

const STORAGE_KEY = 'lingoplay_user_preferences_v1';

function loadPreferences(): PlayerPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      volume:
        typeof parsed.volume === 'number'
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_PREFERENCES.volume,
      audioBoost:
        typeof parsed.audioBoost === 'number'
          ? Math.min(4, Math.max(1, parsed.audioBoost))
          : DEFAULT_PREFERENCES.audioBoost,
      isMuted:
        typeof parsed.isMuted === 'boolean'
          ? parsed.isMuted
          : DEFAULT_PREFERENCES.isMuted,
      playbackSpeed:
        typeof parsed.playbackSpeed === 'number'
          ? parsed.playbackSpeed
          : DEFAULT_PREFERENCES.playbackSpeed,
      seekStepSeconds:
        typeof parsed.seekStepSeconds === 'number'
          ? Math.min(60, Math.max(1, Math.round(parsed.seekStepSeconds)))
          : DEFAULT_PREFERENCES.seekStepSeconds,
      subtitlesVisible:
        typeof parsed.subtitlesVisible === 'boolean'
          ? parsed.subtitlesVisible
          : DEFAULT_PREFERENCES.subtitlesVisible,
      subtitleFontSize:
        typeof parsed.subtitleFontSize === 'number'
          ? Math.min(42, Math.max(16, parsed.subtitleFontSize))
          : DEFAULT_PREFERENCES.subtitleFontSize,
      subtitleBottomOffset:
        typeof parsed.subtitleBottomOffset === 'number'
          ? Math.min(75, Math.max(6, parsed.subtitleBottomOffset))
          : DEFAULT_PREFERENCES.subtitleBottomOffset,
      subtitleBgEnabled:
        typeof parsed.subtitleBgEnabled === 'boolean'
          ? parsed.subtitleBgEnabled
          : DEFAULT_PREFERENCES.subtitleBgEnabled,
      autoPauseOnSelect:
        typeof parsed.autoPauseOnSelect === 'boolean'
          ? parsed.autoPauseOnSelect
          : DEFAULT_PREFERENCES.autoPauseOnSelect,
      concentrationMode:
        typeof parsed.concentrationMode === 'boolean'
          ? parsed.concentrationMode
          : DEFAULT_PREFERENCES.concentrationMode,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export const VideoPlayer: React.FC = () => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const externalAudioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const shakaRef = useRef<shaka.Player | null>(null);
  const externalAudioHlsRef = useRef<Hls | null>(null);

  // Web Audio API loudness normalization & dialogue boost nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const boundVideoElRef = useRef<HTMLVideoElement | null>(null);
  const boundExtAudioElRef = useRef<HTMLAudioElement | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // User persisted preferences
  const [preferences, setPreferences] = useState<PlayerPreferences>(loadPreferences);

  const updatePreferences = useCallback((partial: Partial<PlayerPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota errors
      }
      return updated;
    });
  }, []);

  // Playlist & current media state
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const currentTrack = playlist[currentTrackIndex] || null;
  const currentTrackEngine: PlaybackEngineType = currentTrack
    ? currentTrack.type === 'url'
      ? detectStreamEngine(currentTrack.url, currentTrack.mimeType)
      : 'native'
    : 'native';

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Discovered embedded/stream audio tracks
  const [activeEngine, setActiveEngine] = useState<PlaybackEngineType>('native');
  const [discoveredAudioTracks, setDiscoveredAudioTracks] = useState<DiscoveredAudioTrack[]>([]);

  // Discovered embedded/stream subtitle tracks & parsed cues
  const [discoveredSubtitleTracks, setDiscoveredSubtitleTracks] = useState<DiscoveredSubtitleTrack[]>([]);
  const [useEmbeddedSubtitles, setUseEmbeddedSubtitles] = useState<boolean>(false);
  const [embeddedStreamCues, setEmbeddedStreamCues] = useState<SubtitleCue[]>([]);
  const [nativeTextTrackCues, setNativeTextTrackCues] = useState<SubtitleCue[]>([]);

  // Subtitles state (external .srt / .vtt or sample subtitles)
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [subtitleFileName, setSubtitleFileName] = useState<string | null>(null);
  const [subtitleDelay, setSubtitleDelay] = useState<number>(0);
  const [loopingCue, setLoopingCue] = useState<SubtitleCue | null>(null);

  // External audio state
  const [externalAudioUrl, setExternalAudioUrl] = useState<string | null>(null);
  const [externalAudioIsObjectUrl, setExternalAudioIsObjectUrl] = useState<boolean>(false);
  const [externalAudioName, setExternalAudioName] = useState<string | null>(null);
  const [useExternalAudio, setUseExternalAudio] = useState<boolean>(false);
  const [audioOffset, setAudioOffset] = useState<number>(0);

  // UI visibility & modals
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(() => {
    try {
      return window.location.hash === '#about';
    } catch {
      return false;
    }
  });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [isPortraitViewport, setIsPortraitViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [forceInlineInLandscape, setForceInlineInLandscape] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isSubtitleInteracting, setIsSubtitleInteracting] = useState(false);
  const [viewportDimensions, setViewportDimensions] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 375,
    height: typeof window !== 'undefined' ? window.innerHeight : 667,
  }));

  const hideControlsTimeoutRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const translationPopupGuardRef = useRef<boolean>(false);
  const translationPopupGuardTimerRef = useRef<number | null>(null);
  const touchRevealedControlsRef = useRef<boolean>(false);
  const lastTouchTimeRef = useRef<number>(0);
  const unplayableVideoCheckCountRef = useRef<number>(0);
  const latestPlaylistRef = useRef<PlaylistItem[]>([]);
  const latestExtAudioRef = useRef<{ url: string | null; isObjectUrl: boolean }>({
    url: null,
    isObjectUrl: false,
  });

  useEffect(() => {
    latestPlaylistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    latestExtAudioRef.current = {
      url: externalAudioUrl,
      isObjectUrl: externalAudioIsObjectUrl,
    };
  }, [externalAudioUrl, externalAudioIsObjectUrl]);

  const handleTranslationPopupOpenChange = useCallback((isOpen: boolean) => {
    if (translationPopupGuardTimerRef.current) {
      window.clearTimeout(translationPopupGuardTimerRef.current);
      translationPopupGuardTimerRef.current = null;
    }
    if (isOpen) {
      translationPopupGuardRef.current = true;
    } else if (translationPopupGuardRef.current) {
      translationPopupGuardTimerRef.current = window.setTimeout(() => {
        translationPopupGuardRef.current = false;
      }, 260);
    }
  }, []);

  const showTransientNotice = useCallback(
    (msg: string, durationMs: number = 2400, showInConcentration: boolean = false) => {
      if (preferences.concentrationMode && !showInConcentration) {
        return;
      }
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
      setStatusNotice(msg);
      noticeTimeoutRef.current = window.setTimeout(() => {
        setStatusNotice((prev) => (prev === msg ? null : prev));
        noticeTimeoutRef.current = null;
      }, durationMs);
    },
    [preferences.concentrationMode]
  );

  const toggleConcentrationMode = useCallback(() => {
    const nextMode = !preferences.concentrationMode;
    updatePreferences({ concentrationMode: nextMode });
    if (nextMode) {
      setIsSettingsOpen(false);
      setControlsVisible(false);
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
    } else {
      setControlsVisible(true);
    }
    showTransientNotice(
      nextMode ? 'Concentration Mode On' : 'Concentration Mode Off',
      1000,
      true
    );
  }, [preferences.concentrationMode, updatePreferences, showTransientNotice]);

  // Reset inactivity fade timer when mouse moves over the player
  const handlePlayerMouseMove = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimeoutRef.current) {
      window.clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = window.setTimeout(() => {
      if (preferences.concentrationMode) {
        setControlsVisible(false);
      } else if (videoRef.current && !videoRef.current.paused && !isSettingsOpen) {
        setControlsVisible(false);
      }
    }, 2200);
  }, [isSettingsOpen, preferences.concentrationMode]);

  useEffect(() => {
    if (preferences.concentrationMode) {
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
      hideControlsTimeoutRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2200);
      return;
    }
    if (!isPlaying || isSettingsOpen) {
      setControlsVisible(true);
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
    } else {
      handlePlayerMouseMove();
    }
  }, [isPlaying, isSettingsOpen, preferences.concentrationMode, handlePlayerMouseMove]);

  // Clean up engines, timers, AudioContext, and object URLs on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
      if (translationPopupGuardTimerRef.current) {
        window.clearTimeout(translationPopupGuardTimerRef.current);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (shakaRef.current) {
        shakaRef.current.destroy().catch(() => {});
      }
      if (externalAudioHlsRef.current) {
        externalAudioHlsRef.current.destroy();
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
      latestPlaylistRef.current.forEach((item) => {
        if (item.isObjectUrl) {
          URL.revokeObjectURL(item.url);
        }
      });
      if (
        latestExtAudioRef.current.url &&
        latestExtAudioRef.current.isObjectUrl
      ) {
        URL.revokeObjectURL(latestExtAudioRef.current.url);
      }
    };
  }, []);

  // Helper to inspect native HTMLMediaElement.audioTracks if exposed by the browser
  const syncNativeAudioTracks = useCallback(() => {
    const video = videoRef.current as (HTMLVideoElement & {
      audioTracks?: {
        length: number;
        [index: number]: {
          id?: string;
          label?: string;
          language?: string;
          enabled?: boolean;
        };
      };
    }) | null;
    if (!video || !video.audioTracks) {
      setDiscoveredAudioTracks([]);
      return;
    }
    setDiscoveredAudioTracks(mapNativeAudioTracks(video.audioTracks));
  }, []);

  // Helper to inspect native HTMLMediaElement.textTracks and extract active cues into our custom overlay
  const refreshNativeTextTrackCues = useCallback(
    (timeOverride?: number) => {
      const video = videoRef.current;
      if (!video || !video.textTracks) {
        setNativeTextTrackCues([]);
        return;
      }
      const time = typeof timeOverride === 'number' ? timeOverride : video.currentTime;
      const extracted = extractActiveCuesFromTextTracks(
        video.textTracks,
        time,
        subtitleDelay
      );
      setNativeTextTrackCues(extracted);
    },
    [subtitleDelay]
  );

  // Sync native textTracks list when using native playback
  const syncNativeSubtitleTracks = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) {
      setDiscoveredSubtitleTracks([]);
      return;
    }
    const tracks = video.textTracks;
    let hasShowing = false;
    let firstValidIdx = -1;

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (!t || (t.kind && t.kind !== 'subtitles' && t.kind !== 'captions')) continue;
      if (firstValidIdx === -1) firstValidIdx = i;
      if (t.mode === 'showing') hasShowing = true;
    }

    // Auto-enable first embedded subtitle track if none is showing
    if (!hasShowing && firstValidIdx >= 0) {
      try {
        tracks[firstValidIdx].mode = 'showing';
        hasShowing = true;
      } catch {
        // Ignore browser errors
      }
    }

    const mapped = mapNativeTextTracks(tracks);
    setDiscoveredSubtitleTracks(mapped);
    if (mapped.length > 0 && hasShowing) {
      setUseEmbeddedSubtitles(true);
      updatePreferences({ subtitlesVisible: true });
    }
    refreshNativeTextTrackCues();
  }, [refreshNativeTextTrackCues, updatePreferences]);

  // Load current track into video element using the appropriate non-conflicting engine (HLS, DASH, or Native)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentTrack) return;

    let isCancelled = false;

    setMediaError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoopingCue(null);
    setDiscoveredAudioTracks([]);
    setDiscoveredSubtitleTracks([]);
    setEmbeddedStreamCues([]);
    setNativeTextTrackCues([]);
    unplayableVideoCheckCountRef.current = 0;

    // Tear down any previous streaming engines before starting a new one
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const prevShaka = shakaRef.current;
    shakaRef.current = null;

    const engine: PlaybackEngineType =
      currentTrack.type === 'url'
        ? detectStreamEngine(currentTrack.url, currentTrack.mimeType)
        : 'native';
    setActiveEngine(engine);

    const initPlayback = async () => {
      if (prevShaka) {
        try {
          await prevShaka.destroy();
        } catch {
          // Ignore teardown errors
        }
      }
      if (isCancelled) return;

      if (engine === 'hls') {
        // Prefer hls.js on Chrome/Edge so multi-audio & embedded subtitle track discovery/switching APIs are available
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            enableWebVTT: true,
            enableIMSC1: true,
            enableCEA708Captions: true,
          });
          hls.subtitleDisplay = true;
          hlsRef.current = hls;

          const updateHlsAudioTracks = () => {
            if (isCancelled) return;
            const mapped = mapHlsAudioTracks(hls.audioTracks || [], hls.audioTrack);
            setDiscoveredAudioTracks(mapped);
          };

          const updateHlsSubtitleTracks = () => {
            if (isCancelled) return;
            const subTracks = hls.subtitleTracks || [];
            if (subTracks.length > 0) {
              if (hls.subtitleTrack === -1) {
                const preferredIdx = subTracks.findIndex(
                  (t) =>
                    t.default ||
                    (t.lang && t.lang.toLowerCase().startsWith('en')) ||
                    (t.name && t.name.toLowerCase().includes('english'))
                );
                const targetIdx = preferredIdx >= 0 ? preferredIdx : 0;
                hls.subtitleDisplay = true;
                hls.subtitleTrack = targetIdx;
              }
              const mappedSubs = mapHlsSubtitleTracks(subTracks, hls.subtitleTrack);
              setDiscoveredSubtitleTracks(mappedSubs);
              setUseEmbeddedSubtitles(true);
              updatePreferences({ subtitlesVisible: true });
            } else {
              setDiscoveredSubtitleTracks([]);
            }
          };

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            updateHlsAudioTracks();
            updateHlsSubtitleTracks();
          });
          hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, updateHlsAudioTracks);
          hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, (_evt, data) => {
            if (isCancelled) return;
            const mapped = mapHlsAudioTracks(hls.audioTracks || [], data.id);
            setDiscoveredAudioTracks(mapped);
          });
          hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => {
            updateHlsAudioTracks();
            // Ensure active subtitle track remains enabled after switching audio tracks
            if (hls.subtitleTracks && hls.subtitleTracks.length > 0 && hls.subtitleTrack === -1) {
              updateHlsSubtitleTracks();
            }
          });

          hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateHlsSubtitleTracks);
          hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_evt, data) => {
            if (isCancelled) return;
            const mappedSubs = mapHlsSubtitleTracks(hls.subtitleTracks || [], data.id);
            setDiscoveredSubtitleTracks(mappedSubs);
            refreshNativeTextTrackCues();
          });

          hls.on(Hls.Events.SUBTITLE_TRACK_LOADED, (_evt, data) => {
            if (isCancelled || !data?.details?.fragments) return;
            const frags = data.details.fragments.slice(0, 12);
            frags.forEach((frag) => {
              const fragUrl = frag.url;
              if (!fragUrl) return;
              fetch(fragUrl)
                .then((res) => (res.ok ? res.text() : ''))
                .then((vttText) => {
                  if (isCancelled || !vttText.trim()) return;
                  const parsed = parseSubtitles(vttText);
                  if (parsed.length === 0) return;
                  setEmbeddedStreamCues((prev) => {
                    const seen = new Set(
                      prev.map(
                        (c) =>
                          `${Math.round(c.startTime * 100)}-${Math.round(c.endTime * 100)}-${c.text}`
                      )
                    );
                    const merged = [...prev];
                    for (const cue of parsed) {
                      const key = `${Math.round(cue.startTime * 100)}-${Math.round(cue.endTime * 100)}-${cue.text}`;
                      if (!seen.has(key)) {
                        seen.add(key);
                        merged.push({
                          ...cue,
                          id: `hls-cue-${merged.length + 1}`,
                          index: merged.length + 1,
                        });
                      }
                    }
                    merged.sort((a, b) => a.startTime - b.startTime);
                    return merged;
                  });
                  setUseEmbeddedSubtitles(true);
                })
                .catch(() => {
                  // Ignore individual subtitle fragment fetch errors
                });
            });
          });

          hls.on(Hls.Events.CUES_PARSED, (_evt, data) => {
            if (isCancelled || !data || !Array.isArray(data.cues)) return;
            const newCues: SubtitleCue[] = [];
            for (let i = 0; i < data.cues.length; i++) {
              const rawCue = data.cues[i] as {
                startTime?: number;
                endTime?: number;
                text?: string;
              };
              const startTime = Number(rawCue.startTime);
              const endTime = Number(rawCue.endTime);
              const rawText = typeof rawCue.text === 'string' ? rawCue.text : '';
              if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || !rawText.trim()) {
                continue;
              }
              const lines = rawText
                .split(/\r?\n/)
                .map((l) => sanitizeSubtitleLine(l))
                .filter(Boolean);
              if (lines.length === 0) continue;
              const text = lines.join('\n');
              newCues.push({
                id: `hls-cue-${i + 1}`,
                index: i + 1,
                startTime,
                endTime,
                text,
              });
            }

            if (newCues.length > 0) {
              setEmbeddedStreamCues((prev) => {
                const seen = new Set(
                  prev.map(
                    (c) =>
                      `${Math.round(c.startTime * 100)}-${Math.round(c.endTime * 100)}-${c.text}`
                  )
                );
                const merged = [...prev];
                for (const cue of newCues) {
                  const key = `${Math.round(cue.startTime * 100)}-${Math.round(cue.endTime * 100)}-${cue.text}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    merged.push({
                      ...cue,
                      id: `hls-cue-${merged.length + 1}`,
                      index: merged.length + 1,
                    });
                  }
                }
                merged.sort((a, b) => a.startTime - b.startTime);
                return merged;
              });
              setUseEmbeddedSubtitles(true);
            }
            refreshNativeTextTrackCues();
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal && !isCancelled) {
              setMediaError(
                'Unable to load HLS stream (.m3u8). This stream may be blocked by CORS policy, require authorization, or use an unsupported codec.'
              );
            }
          });

          hls.loadSource(currentTrack.url);
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = currentTrack.url;
          video.load();
        } else {
          setMediaError('HLS streaming (.m3u8) is not supported in this browser.');
        }
      } else if (engine === 'dash') {
        try {
          shaka.polyfill.installAll();
          if (!shaka.Player.isBrowserSupported()) {
            setMediaError('MPEG-DASH (.mpd) streaming is not supported in this browser.');
            return;
          }
          const player = new shaka.Player();
          player.configure('streaming.alwaysStreamText', true);
          await player.attach(video);
          if (isCancelled) {
            await player.destroy();
            return;
          }
          shakaRef.current = player;

          const updateDashTracks = () => {
            if (isCancelled || !shakaRef.current) return;
            const variants = shakaRef.current.getVariantTracks();
            setDiscoveredAudioTracks(mapShakaVariantTracks(variants));

            const textTracks = shakaRef.current.getTextTracks();
            if (textTracks && textTracks.length > 0) {
              if (!textTracks.some((t) => t.active)) {
                const preferred =
                  textTracks.find(
                    (t) =>
                      t.language &&
                      t.language.toLowerCase().startsWith('en')
                  ) || textTracks[0];
                if (preferred) {
                  shakaRef.current.selectTextTrack(preferred);
                }
              }
              const refreshedTextTracks = shakaRef.current.getTextTracks();
              setDiscoveredSubtitleTracks(mapShakaTextTracks(refreshedTextTracks));
              setUseEmbeddedSubtitles(true);
              updatePreferences({ subtitlesVisible: true });
              refreshNativeTextTrackCues();
            } else {
              setDiscoveredSubtitleTracks([]);
            }
          };

          player.addEventListener('trackschanged', updateDashTracks);
          player.addEventListener('variantchanged', updateDashTracks);
          player.addEventListener('textchanged', updateDashTracks);
          player.addEventListener('adaptation', updateDashTracks);
          player.addEventListener('error', () => {
            if (!isCancelled) {
              setMediaError(
                'Unable to play MPEG-DASH (.mpd) stream. It may be blocked by CORS, DRM-protected, or unreachable.'
              );
            }
          });

          await player.load(currentTrack.url);
          updateDashTracks();
        } catch {
          if (!isCancelled) {
            setMediaError(
              'Unable to load MPEG-DASH (.mpd) manifest. The stream may be blocked by CORS policy, DRM-protected, or unreachable.'
            );
          }
        }
      } else {
        video.src = currentTrack.url;
        video.load();
      }

      // Apply saved playback speed and volume
      video.playbackRate = preferences.playbackSpeed;
      video.defaultPlaybackRate = preferences.playbackSpeed;
      if ('preservesPitch' in video) {
        video.preservesPitch = true;
      }
    };

    initPlayback();

    return () => {
      isCancelled = true;
    };
  }, [currentTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach native HTMLMediaElement.audioTracks listeners when using native playback
  useEffect(() => {
    if (activeEngine !== 'native') return;
    const video = videoRef.current as (HTMLVideoElement & {
      audioTracks?: EventTarget & {
        length: number;
        [index: number]: {
          id?: string;
          label?: string;
          language?: string;
          enabled?: boolean;
        };
      };
    }) | null;
    if (!video || !video.audioTracks) return;

    const audioTracksList = video.audioTracks;
    const handleTrackChange = () => syncNativeAudioTracks();

    if (typeof audioTracksList.addEventListener === 'function') {
      audioTracksList.addEventListener('change', handleTrackChange);
      audioTracksList.addEventListener('addtrack', handleTrackChange);
      audioTracksList.addEventListener('removetrack', handleTrackChange);
      return () => {
        audioTracksList.removeEventListener('change', handleTrackChange);
        audioTracksList.removeEventListener('addtrack', handleTrackChange);
        audioTracksList.removeEventListener('removetrack', handleTrackChange);
      };
    }
  }, [activeEngine, currentTrack, syncNativeAudioTracks]);

  // Listen to video.textTracks events (cuechange, addtrack, change) across all engines so embedded subtitles stay reactive
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;

    const textTracksList = video.textTracks;

    const handleCueChange = () => {
      refreshNativeTextTrackCues();
    };

    const bindCueListeners = () => {
      for (let i = 0; i < textTracksList.length; i++) {
        const track = textTracksList[i];
        if (!track) continue;
        // Ensure showing mode on active tracks so cues fire cuechange (native rendering is hidden via CSS video::cue)
        if (
          activeEngine === 'hls' &&
          hlsRef.current &&
          hlsRef.current.subtitleTrack === i &&
          track.mode === 'disabled'
        ) {
          try {
            track.mode = 'showing';
          } catch {
            // Ignore
          }
        }
        track.removeEventListener('cuechange', handleCueChange);
        track.addEventListener('cuechange', handleCueChange);
      }
      if (activeEngine === 'native') {
        syncNativeSubtitleTracks();
      } else {
        refreshNativeTextTrackCues();
      }
    };

    bindCueListeners();
    textTracksList.addEventListener('addtrack', bindCueListeners);
    textTracksList.addEventListener('change', bindCueListeners);
    textTracksList.addEventListener('removetrack', bindCueListeners);

    return () => {
      textTracksList.removeEventListener('addtrack', bindCueListeners);
      textTracksList.removeEventListener('change', bindCueListeners);
      textTracksList.removeEventListener('removetrack', bindCueListeners);
      for (let i = 0; i < textTracksList.length; i++) {
        const track = textTracksList[i];
        if (track) {
          track.removeEventListener('cuechange', handleCueChange);
        }
      }
    };
  }, [activeEngine, currentTrack, refreshNativeTextTrackCues, syncNativeSubtitleTracks]);

  // Switch between discovered embedded/stream audio tracks while preserving playback state AND active subtitles
  const handleSelectDiscoveredAudioTrack = useCallback(
    (track: DiscoveredAudioTrack) => {
      const video = videoRef.current;
      if (!video) return;

      const savedTime = video.currentTime;
      const wasPlaying = !video.paused;
      const savedSpeed = preferences.playbackSpeed;

      // Turn off external audio if it was active so two tracks never play simultaneously
      if (useExternalAudio) {
        setUseExternalAudio(false);
        if (externalAudioRef.current && !externalAudioRef.current.paused) {
          externalAudioRef.current.pause();
        }
      }

      if (track.engine === 'hls' && hlsRef.current) {
        const hls = hlsRef.current;
        const savedSubTrack = hls.subtitleTrack;
        hls.audioTrack = track.index;
        if (savedSubTrack >= 0 && hls.subtitleTrack !== savedSubTrack) {
          hls.subtitleDisplay = true;
          hls.subtitleTrack = savedSubTrack;
        }
        setDiscoveredAudioTracks(mapHlsAudioTracks(hls.audioTracks || [], track.index));
      } else if (track.engine === 'dash' && shakaRef.current) {
        const player = shakaRef.current;
        const variants = player.getVariantTracks();
        const matchingVariant =
          variants.find((v) => v.id === track.rawId) ||
          variants.find((v) => v.language === track.language);
        if (matchingVariant) {
          player.selectVariantTrack(matchingVariant, true);
        }
        setDiscoveredAudioTracks(mapShakaVariantTracks(player.getVariantTracks()));
      } else if (track.engine === 'native') {
        const nativeTracks = (video as HTMLVideoElement & {
          audioTracks?: {
            length: number;
            [index: number]: { enabled?: boolean };
          };
        }).audioTracks;
        if (nativeTracks) {
          for (let i = 0; i < nativeTracks.length; i++) {
            if (nativeTracks[i]) {
              nativeTracks[i].enabled = i === track.index;
            }
          }
          syncNativeAudioTracks();
        }
      }

      // Preserve position, speed, and play/pause state
      if (Math.abs(video.currentTime - savedTime) > 0.5) {
        try {
          video.currentTime = savedTime;
        } catch {
          // Ignore if seek not needed
        }
      }
      video.playbackRate = savedSpeed;
      if (wasPlaying && video.paused) {
        video.play().catch(() => {});
      }

      showTransientNotice(`Audio track: ${track.label}`);
    },
    [preferences.playbackSpeed, useExternalAudio, syncNativeAudioTracks, showTransientNotice]
  );

  // Switch between discovered embedded/stream subtitle tracks
  const handleSelectEmbeddedSubtitleTrack = useCallback(
    (track: DiscoveredSubtitleTrack) => {
      const video = videoRef.current;
      setUseEmbeddedSubtitles(true);
      updatePreferences({ subtitlesVisible: true });

      if (track.engine === 'hls' && hlsRef.current) {
        const hls = hlsRef.current;
        if (hls.subtitleTrack !== track.index) {
          setEmbeddedStreamCues([]);
          hls.subtitleDisplay = true;
          hls.subtitleTrack = track.index;
        }
        setDiscoveredSubtitleTracks(
          mapHlsSubtitleTracks(hls.subtitleTracks || [], track.index)
        );
      } else if (track.engine === 'dash' && shakaRef.current) {
        const player = shakaRef.current;
        const textTracks = player.getTextTracks();
        const matching =
          textTracks.find((t) => t.id === track.rawId) ||
          textTracks[track.index];
        if (matching) {
          player.selectTextTrack(matching);
        }
        setDiscoveredSubtitleTracks(mapShakaTextTracks(player.getTextTracks()));
      } else if (track.engine === 'native' && video && video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const t = video.textTracks[i];
          if (t) {
            t.mode = i === track.index ? 'showing' : 'disabled';
          }
        }
        setDiscoveredSubtitleTracks(mapNativeTextTracks(video.textTracks));
      }

      refreshNativeTextTrackCues();
      showTransientNotice(`Subtitle track: ${track.label}`);
    },
    [refreshNativeTextTrackCues, showTransientNotice, updatePreferences]
  );

  const handleSelectExternalSubtitleSource = useCallback(() => {
    setUseEmbeddedSubtitles(false);
    updatePreferences({ subtitlesVisible: true });
    if (subtitleFileName) {
      showTransientNotice(`Subtitle track: ${subtitleFileName}`);
    }
  }, [subtitleFileName, showTransientNotice, updatePreferences]);

  // Attach external audio URL (supports both direct audio files/URLs and HLS .m3u8 audio streams)
  useEffect(() => {
    const extAudio = externalAudioRef.current;
    if (!extAudio) return;

    if (externalAudioHlsRef.current) {
      externalAudioHlsRef.current.destroy();
      externalAudioHlsRef.current = null;
    }

    if (!externalAudioUrl) {
      extAudio.removeAttribute('src');
      return;
    }

    const isHlsAudio =
      !externalAudioIsObjectUrl &&
      detectStreamEngine(externalAudioUrl) === 'hls';

    if (isHlsAudio && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      externalAudioHlsRef.current = hls;
      hls.loadSource(externalAudioUrl);
      hls.attachMedia(extAudio);
    } else {
      extAudio.src = externalAudioUrl;
      extAudio.load();
    }
  }, [externalAudioUrl, externalAudioIsObjectUrl]);

  // Initialize or update Web Audio API loudness & dialogue booster for MSE streams (HLS/DASH) and local/blob media
  const syncWebAudioBoost = useCallback(
    (resumeContext: boolean = false) => {
      const boostFactor = Math.min(4, Math.max(1, preferences.audioBoost ?? 1.8));
      const canBoostVideo =
        Boolean(currentTrack?.isObjectUrl) ||
        currentTrackEngine === 'hls' ||
        currentTrackEngine === 'dash';
      const canBoostExtAudio =
        Boolean(externalAudioUrl) &&
        (externalAudioIsObjectUrl ||
          detectStreamEngine(externalAudioUrl || '') === 'hls');

      if (!canBoostVideo && !canBoostExtAudio) {
        return;
      }

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;

        if (!audioCtxRef.current) {
          const ctx = new AudioCtx();
          const preGain = ctx.createGain();
          preGain.gain.value = boostFactor;

          // Brickwall peak limiter at -1.0 dB so pre-gain amplifies quiet/normal dialogue cleanly without clipping above 0 dBFS
          const limiter = ctx.createDynamicsCompressor();
          limiter.threshold.value = -1.0;
          limiter.knee.value = 0;
          limiter.ratio.value = 20;
          limiter.attack.value = 0.001;
          limiter.release.value = 0.05;

          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;

          preGain.connect(limiter);
          limiter.connect(analyser);
          analyser.connect(ctx.destination);

          audioCtxRef.current = ctx;
          gainNodeRef.current = preGain;
          compressorNodeRef.current = limiter;
          analyserNodeRef.current = analyser;
        }

        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = boostFactor;
        }

        const ctx = audioCtxRef.current;
        const preGain = gainNodeRef.current;

        if (
          ctx &&
          preGain &&
          canBoostVideo &&
          videoRef.current &&
          boundVideoElRef.current !== videoRef.current
        ) {
          const srcNode = ctx.createMediaElementSource(videoRef.current);
          srcNode.connect(preGain);
          boundVideoElRef.current = videoRef.current;
        }

        if (
          ctx &&
          preGain &&
          canBoostExtAudio &&
          externalAudioRef.current &&
          boundExtAudioElRef.current !== externalAudioRef.current
        ) {
          const extSrcNode = ctx.createMediaElementSource(externalAudioRef.current);
          extSrcNode.connect(preGain);
          boundExtAudioElRef.current = externalAudioRef.current;
        }

        if (resumeContext && ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        (
          window as unknown as {
            __measureAudioBoost?: () => {
              ctxState: string;
              gainValue: number;
              rms: number;
              peak: number;
            };
          }
        ).__measureAudioBoost = () => {
          const analyser = analyserNodeRef.current;
          const activeCtx = audioCtxRef.current;
          const activeGain = gainNodeRef.current;
          if (!analyser || !activeCtx || !activeGain) {
            return { ctxState: 'none', gainValue: 1, rms: 0, peak: 0 };
          }
          const buf = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(buf);
          let sumSq = 0;
          let peak = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = Math.abs(buf[i]);
            sumSq += v * v;
            if (v > peak) peak = v;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          return {
            ctxState: activeCtx.state,
            gainValue: activeGain.gain.value,
            rms,
            peak,
          };
        };
      } catch {
        // Fallback gracefully to native HTMLMediaElement volume if Web Audio API is unavailable
      }
    },
    [
      preferences.audioBoost,
      currentTrack?.isObjectUrl,
      currentTrackEngine,
      externalAudioUrl,
      externalAudioIsObjectUrl,
    ]
  );

  // Ensure AudioContext resumes on any user interaction so boosted stream audio never stays suspended
  useEffect(() => {
    const resumeAudioCtx = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', resumeAudioCtx, { passive: true });
    window.addEventListener('keydown', resumeAudioCtx, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', resumeAudioCtx);
      window.removeEventListener('keydown', resumeAudioCtx);
    };
  }, []);

  // Keep volume, mute, audioBoost, and playbackSpeed synced with video and external audio elements
  useEffect(() => {
    const video = videoRef.current;
    const extAudio = externalAudioRef.current;
    const isExtActive = Boolean(useExternalAudio && externalAudioUrl);

    if (video) {
      // Never play two audio tracks at the same time
      video.muted = isExtActive ? true : preferences.isMuted;
      video.volume = preferences.volume;
      if (video.playbackRate !== preferences.playbackSpeed) {
        video.playbackRate = preferences.playbackSpeed;
      }
      if ('preservesPitch' in video) {
        video.preservesPitch = true;
      }
    }

    if (extAudio) {
      extAudio.muted = !isExtActive || preferences.isMuted;
      extAudio.volume = preferences.volume;
      if (extAudio.playbackRate !== preferences.playbackSpeed) {
        extAudio.playbackRate = preferences.playbackSpeed;
      }
      if ('preservesPitch' in extAudio) {
        extAudio.preservesPitch = true;
      }
    }

    syncWebAudioBoost(false);
  }, [
    preferences.volume,
    preferences.audioBoost,
    preferences.isMuted,
    preferences.playbackSpeed,
    useExternalAudio,
    externalAudioUrl,
    syncWebAudioBoost,
  ]);

  // Synchronize external audio with video time & playback state
  const syncExternalAudio = useCallback(
    (forceSeek: boolean = false) => {
      const video = videoRef.current;
      const extAudio = externalAudioRef.current;
      if (!video || !extAudio || !useExternalAudio || !externalAudioUrl) return;

      const targetAudioTime = Math.max(0, video.currentTime - audioOffset);
      const drift = Math.abs(extAudio.currentTime - targetAudioTime);

      if (forceSeek || drift > 0.22) {
        try {
          extAudio.currentTime = targetAudioTime;
        } catch {
          // Ignore if audio metadata not ready yet
        }
      }

      if (!video.paused && extAudio.paused) {
        extAudio.play().catch(() => {});
      } else if (video.paused && !extAudio.paused) {
        extAudio.pause();
      }
    },
    [useExternalAudio, externalAudioUrl, audioOffset]
  );

  useEffect(() => {
    syncExternalAudio(true);
  }, [useExternalAudio, audioOffset, syncExternalAudio]);

  // Compute active subtitles for current time and delay offset (supports both external SRT/VTT and embedded stream subtitles)
  const activeCues = useMemo(() => {
    const externalActive = getActiveSubtitles(subtitles, currentTime, subtitleDelay);
    const hlsParsedActive = getActiveSubtitles(embeddedStreamCues, currentTime, subtitleDelay);
    const embeddedActive =
      hlsParsedActive.length > 0 ? hlsParsedActive : nativeTextTrackCues;

    if (useEmbeddedSubtitles) {
      if (embeddedActive.length > 0) return embeddedActive;
      if (
        embeddedStreamCues.length === 0 &&
        nativeTextTrackCues.length === 0 &&
        externalActive.length > 0
      ) {
        return externalActive;
      }
      return embeddedActive;
    }

    if (subtitles.length > 0) {
      return externalActive;
    }

    return embeddedActive;
  }, [
    subtitles,
    embeddedStreamCues,
    nativeTextTrackCues,
    useEmbeddedSubtitles,
    currentTime,
    subtitleDelay,
  ]);

  // Handle subtitle repeat/looping if active
  useEffect(() => {
    if (!loopingCue || !videoRef.current) return;
    const video = videoRef.current;
    if (video.paused || video.seeking) return;

    const effectiveCueStart = Math.max(0, loopingCue.startTime + subtitleDelay);
    const effectiveCueEnd = loopingCue.endTime + subtitleDelay;

    if (
      currentTime >= effectiveCueEnd &&
      currentTime <= effectiveCueEnd + 1.5
    ) {
      video.currentTime = effectiveCueStart;
      setCurrentTime(effectiveCueStart);
      syncExternalAudio(true);
    }
  }, [currentTime, loopingCue, subtitleDelay, syncExternalAudio]);

  // Core playback actions
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !currentTrack) return;

    if (video.paused) {
      video.play().catch((err) => {
        console.warn('Playback prevented:', err);
      });
    } else {
      video.pause();
    }
  }, [currentTrack]);

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
  }, []);

  const seekTo = useCallback(
    (targetTime: number) => {
      const video = videoRef.current;
      if (!video || !currentTrack) return;
      const clamped = computeSeekTime(targetTime, 0, video.duration || duration);
      if (loopingCue) {
        const effectiveStart = Math.max(0, loopingCue.startTime + subtitleDelay);
        const effectiveEnd = loopingCue.endTime + subtitleDelay;
        if (clamped < effectiveStart - 1.0 || clamped > effectiveEnd + 0.5) {
          setLoopingCue(null);
        }
      }
      video.currentTime = clamped;
      setCurrentTime(clamped);
      syncExternalAudio(true);
    },
    [currentTrack, duration, loopingCue, subtitleDelay, syncExternalAudio]
  );

  const seekByDelta = useCallback(
    (deltaSeconds: number) => {
      const video = videoRef.current;
      if (!video || !currentTrack) return;
      const nextTime = computeSeekTime(
        video.currentTime,
        deltaSeconds,
        video.duration || duration
      );
      if (loopingCue) {
        const effectiveStart = Math.max(0, loopingCue.startTime + subtitleDelay);
        const effectiveEnd = loopingCue.endTime + subtitleDelay;
        if (nextTime < effectiveStart - 1.0 || nextTime > effectiveEnd + 0.5) {
          setLoopingCue(null);
        }
      }
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
      syncExternalAudio(true);
    },
    [currentTrack, duration, loopingCue, subtitleDelay, syncExternalAudio]
  );

  const handleReplayCue = useCallback(
    (cue: SubtitleCue) => {
      const video = videoRef.current;
      if (!video) return;
      const targetTime = getSubtitleReplayTime(cue, subtitleDelay);
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
      syncExternalAudio(true);
      if (video.paused) {
        video.play().catch(() => {});
      }
      showTransientNotice('Replaying current subtitle (-0.5s)');
    },
    [subtitleDelay, syncExternalAudio, showTransientNotice]
  );

  const handleToggleLoopCue = useCallback(
    (cue: SubtitleCue) => {
      setLoopingCue((prev) => {
        if (prev && prev.id === cue.id) {
          showTransientNotice('Subtitle loop off');
          return null;
        }
        showTransientNotice('Repeating current subtitle');
        return cue;
      });
    },
    [showTransientNotice]
  );

  // Cleanly exit both fullscreen and landscape modes back to the standard inline layout
  const handleExitFullscreenAndLandscape = useCallback(async () => {
    setIsFullscreen(false);
    setIsMobileLandscape(false);
    setForceInlineInLandscape(true);

    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      mozCancelFullScreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
    };

    const hasNativeFull = Boolean(
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (hasNativeFull) {
      if (document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {
          // Ignore
        }
      } else if (doc.webkitExitFullscreen) {
        try {
          await doc.webkitExitFullscreen();
        } catch {
          // Ignore
        }
      }
    }

    const orientationApi = (
      window.screen as Screen & {
        orientation?: {
          unlock?: () => void;
        };
        unlockOrientation?: () => boolean;
        webkitUnlockOrientation?: () => boolean;
      }
    );
    if (orientationApi.orientation?.unlock) {
      try {
        orientationApi.orientation.unlock();
      } catch {
        // Ignore
      }
    } else if (orientationApi.unlockOrientation) {
      try {
        orientationApi.unlockOrientation();
      } catch {
        // Ignore
      }
    }

    showTransientNotice('Exited fullscreen view');
  }, [showTransientNotice]);

  // Check if current device is a desktop (wide screen + fine pointer / non-touch)
  const checkIsDesktop = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const ua = (navigator.userAgent || navigator.vendor || '').toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const hasTouch = (navigator.maxTouchPoints !== undefined && navigator.maxTouchPoints > 0) || 'ontouchstart' in window;
    const isCoarsePointer = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const isNarrow = window.innerWidth < 1024;
    const isShortLandscape = window.innerHeight <= 600;

    const isMobileOrTablet = isMobileUA || isIPadOS || hasTouch || isCoarsePointer || isNarrow || isShortLandscape;
    return !isMobileOrTablet;
  }, []);

  // Request native hardware fullscreen to hide browser address bar on mobile & tablet
  const requestNativeFullscreen = useCallback(async (container: HTMLElement) => {
    const c = container as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      mozRequestFullScreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };

    if (c.requestFullscreen) {
      try {
        await c.requestFullscreen({ navigationUI: 'hide' });
        return true;
      } catch {
        try {
          await c.requestFullscreen();
          return true;
        } catch {
          // Fall through
        }
      }
    }

    if (c.webkitRequestFullscreen) {
      try {
        await c.webkitRequestFullscreen();
        return true;
      } catch {
        // Fall through
      }
    }

    // On iPhone iOS Safari, <div> requestFullscreen is not supported, but <video>.webkitEnterFullscreen() is the standard way to hide address bar
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (v && typeof v.webkitEnterFullscreen === 'function') {
      try {
        v.webkitEnterFullscreen();
        return true;
      } catch {
        // Fall through
      }
    }

    return false;
  }, []);

  // Lock orientation to landscape on mobile & tablet devices
  const lockOrientationLandscape = useCallback(async () => {
    try {
      const orientationApi = (
        window.screen as Screen & {
          orientation?: {
            lock?: (orientation: string) => Promise<void>;
          };
          lockOrientation?: (orientation: string) => boolean;
          webkitLockOrientation?: (orientation: string) => boolean;
        }
      );
      if (orientationApi.orientation?.lock) {
        await orientationApi.orientation.lock('landscape');
      } else if (orientationApi.lockOrientation) {
        orientationApi.lockOrientation('landscape');
      } else if (orientationApi.webkitLockOrientation) {
        orientationApi.webkitLockOrientation('landscape');
      }
    } catch {
      // Ignore if orientation lock is rejected by browser permissions
    }
  }, []);

  // Fullscreen API:
  // Engages true native hardware fullscreen to hide browser address bar across mobile, tablet, and desktop.
  // Also activates seamless in-page fallback to guarantee full viewport coverage.
  const toggleFullscreen = useCallback(async () => {
    const container = playerContainerRef.current;

    setForceInlineInLandscape(false);

    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
    };
    const isCurrentlyNativeFull = Boolean(
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    // If currently in fullscreen, exit both native and in-page fullscreen
    if (isFullscreen || isCurrentlyNativeFull) {
      await handleExitFullscreenAndLandscape();
      return;
    }

    // Entering fullscreen: invoke native fullscreen to hide browser address bar
    if (container) {
      await requestNativeFullscreen(container);
    }
    await lockOrientationLandscape();

    if (typeof window !== 'undefined') {
      try {
        window.scrollTo(0, 1);
      } catch {
        // Ignore
      }
    }

    setIsFullscreen(true);
    showTransientNotice('Fullscreen view enabled');
  }, [
    isFullscreen,
    handleExitFullscreenAndLandscape,
    requestNativeFullscreen,
    lockOrientationLandscape,
    showTransientNotice,
  ]);

  // Mobile Landscape Mode (triggers orientation lock, address bar hiding, and full screen)
  const toggleMobileLandscape = useCallback(async () => {
    setForceInlineInLandscape(false);
    if (isMobileLandscape) {
      await handleExitFullscreenAndLandscape();
      return;
    }

    setIsMobileLandscape(true);
    setIsFullscreen(true);

    const container = playerContainerRef.current;
    if (container) {
      await requestNativeFullscreen(container);
    }
    await lockOrientationLandscape();

    if (typeof window !== 'undefined') {
      try {
        window.scrollTo(0, 1);
      } catch {
        // Ignore
      }
    }

    showTransientNotice('Landscape view enabled');
  }, [
    isMobileLandscape,
    handleExitFullscreenAndLandscape,
    requestNativeFullscreen,
    lockOrientationLandscape,
    showTransientNotice,
  ]);

  useEffect(() => {
    const handleViewportChange = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setViewportDimensions({ width: w, height: h });
      const isPortrait = h > w;
      setIsPortraitViewport(isPortrait);
      if (isPortrait) {
        setForceInlineInLandscape(false);
      } else {
        try {
          window.scrollTo(0, 1);
        } catch {
          // Ignore
        }
      }
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  useEffect(() => {
    const handleNativeFullscreenChange = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      const nativeFull = Boolean(
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      if (nativeFull) {
        setIsFullscreen(true);
      }
    };

    document.addEventListener('fullscreenchange', handleNativeFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleNativeFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleNativeFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleNativeFullscreenChange);

    const videoEl = videoRef.current as (HTMLVideoElement & {
      addEventListener: (type: string, listener: EventListener) => void;
      removeEventListener: (type: string, listener: EventListener) => void;
    }) | null;

    const onVideoBeginFullscreen = () => setIsFullscreen(true);
    const onVideoEndFullscreen = () => {
      if (!isMobileLandscape) {
        setIsFullscreen(false);
      }
    };

    if (videoEl) {
      videoEl.addEventListener('webkitbeginfullscreen', onVideoBeginFullscreen);
      videoEl.addEventListener('webkitendfullscreen', onVideoEndFullscreen);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleNativeFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleNativeFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleNativeFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleNativeFullscreenChange);
      if (videoEl) {
        videoEl.removeEventListener('webkitbeginfullscreen', onVideoBeginFullscreen);
        videoEl.removeEventListener('webkitendfullscreen', onVideoEndFullscreen);
      }
    };
  }, [isMobileLandscape]);

  // Reset previous subtitles and external audio when loading or switching to a new video
  const resetPreviousSubtitlesAndExternalAudio = useCallback(
    (options?: { keepSubtitles?: boolean; keepExternalAudio?: boolean }) => {
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = null;
      }
      setStatusNotice(null);

      if (!options?.keepSubtitles) {
        setSubtitles([]);
        setSubtitleFileName(null);
        setUseEmbeddedSubtitles(false);
        setSubtitleDelay(0);
        setLoopingCue(null);
        setDiscoveredSubtitleTracks([]);
        setEmbeddedStreamCues([]);
        setNativeTextTrackCues([]);
      } else {
        setSubtitleDelay(0);
        setLoopingCue(null);
      }

      if (!options?.keepExternalAudio) {
        if (externalAudioRef.current && !externalAudioRef.current.paused) {
          externalAudioRef.current.pause();
        }
        if (externalAudioHlsRef.current) {
          externalAudioHlsRef.current.destroy();
          externalAudioHlsRef.current = null;
        }
        if (externalAudioUrl && externalAudioIsObjectUrl) {
          URL.revokeObjectURL(externalAudioUrl);
        }
        setExternalAudioUrl(null);
        setExternalAudioIsObjectUrl(false);
        setExternalAudioName(null);
        setUseExternalAudio(false);
        setAudioOffset(0);
      } else {
        setAudioOffset(0);
      }
    },
    [externalAudioUrl, externalAudioIsObjectUrl]
  );

  // Manually reset / turn off subtitles via the reset icon button
  const handleResetSubtitles = useCallback(() => {
    setSubtitles([]);
    setSubtitleFileName(null);
    setUseEmbeddedSubtitles(false);
    setSubtitleDelay(0);
    setLoopingCue(null);
    setEmbeddedStreamCues([]);
    setNativeTextTrackCues([]);

    if (hlsRef.current) {
      hlsRef.current.subtitleDisplay = false;
      hlsRef.current.subtitleTrack = -1;
      setDiscoveredSubtitleTracks(
        mapHlsSubtitleTracks(hlsRef.current.subtitleTracks || [], -1)
      );
    }
    if (videoRef.current?.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        const track = videoRef.current.textTracks[i];
        if (track) {
          try {
            track.mode = 'disabled';
          } catch {
            // Ignore browser errors
          }
        }
      }
      if (activeEngine === 'native') {
        setDiscoveredSubtitleTracks(
          mapNativeTextTracks(videoRef.current.textTracks)
        );
      }
    }

    updatePreferences({ subtitlesVisible: false });
    showTransientNotice('Subtitles reset');
  }, [activeEngine, updatePreferences, showTransientNotice]);

  // Manually reset audio (external audio, offset, and stream audio track) to default via the reset icon button
  const handleResetAudio = useCallback(() => {
    if (externalAudioRef.current && !externalAudioRef.current.paused) {
      externalAudioRef.current.pause();
    }
    if (externalAudioHlsRef.current) {
      externalAudioHlsRef.current.destroy();
      externalAudioHlsRef.current = null;
    }
    if (externalAudioUrl && externalAudioIsObjectUrl) {
      URL.revokeObjectURL(externalAudioUrl);
    }
    setExternalAudioUrl(null);
    setExternalAudioIsObjectUrl(false);
    setExternalAudioName(null);
    setUseExternalAudio(false);
    setAudioOffset(0);

    if (hlsRef.current && hlsRef.current.audioTracks?.length > 0) {
      hlsRef.current.audioTrack = 0;
      setDiscoveredAudioTracks(
        mapHlsAudioTracks(hlsRef.current.audioTracks, 0)
      );
    } else if (shakaRef.current) {
      const variants = shakaRef.current.getVariantTracks();
      if (variants.length > 0) {
        shakaRef.current.selectVariantTrack(variants[0], true);
        setDiscoveredAudioTracks(
          mapShakaVariantTracks(shakaRef.current.getVariantTracks())
        );
      }
    } else if (videoRef.current) {
      const nativeTracks = (
        videoRef.current as HTMLVideoElement & {
          audioTracks?: {
            length: number;
            [index: number]: { enabled?: boolean };
          };
        }
      ).audioTracks;
      if (nativeTracks && nativeTracks.length > 0) {
        for (let i = 0; i < nativeTracks.length; i++) {
          if (nativeTracks[i]) {
            nativeTracks[i].enabled = i === 0;
          }
        }
        syncNativeAudioTracks();
      }
    }

    updatePreferences({ audioBoost: DEFAULT_PREFERENCES.audioBoost });
    showTransientNotice('Audio reset to default');
  }, [
    externalAudioUrl,
    externalAudioIsObjectUrl,
    syncNativeAudioTracks,
    updatePreferences,
    showTransientNotice,
  ]);

  // File loading handlers
  const handleLoadVideoFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const videoFiles: File[] = [];
      let subtitleFile: File | null = null;

      for (const file of fileArray) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.srt') || lower.endsWith('.vtt')) {
          subtitleFile = file;
        } else if (
          file.type.startsWith('video/') ||
          lower.endsWith('.mp4') ||
          lower.endsWith('.webm') ||
          lower.endsWith('.mkv') ||
          lower.endsWith('.mov') ||
          lower.endsWith('.ogv')
        ) {
          videoFiles.push(file);
        }
      }

      if (videoFiles.length > 0) {
        // Reset previous subtitles (unless a new subtitle file was dropped together with the video) and previous external audio
        resetPreviousSubtitlesAndExternalAudio({
          keepSubtitles: Boolean(subtitleFile),
          keepExternalAudio: false,
        });
      }

      if (subtitleFile) {
        const reader = new FileReader();
        const subName = subtitleFile.name;
        reader.onload = (e) => {
          const text = typeof e.target?.result === 'string' ? e.target.result : '';
          const parsedCues = parseSubtitles(text);
          setSubtitles(parsedCues);
          setSubtitleFileName(subName);
          setUseEmbeddedSubtitles(false);
          setLoopingCue(null);
          updatePreferences({ subtitlesVisible: true });
          showTransientNotice(`Loaded ${parsedCues.length} subtitles from ${subName}`);
        };
        reader.readAsText(subtitleFile, 'utf-8');
      }

      if (videoFiles.length === 0) {
        if (!subtitleFile) {
          setMediaError(
            'Unsupported file format. Please select an MP4, WebM, or MKV video file, or an SRT/VTT subtitle file.'
          );
        }
        return;
      }

      // Revoke old object URLs from previous playlist
      setPlaylist((prev) => {
        prev.forEach((item) => {
          if (item.isObjectUrl) {
            URL.revokeObjectURL(item.url);
          }
        });
        return videoFiles.map((file, idx) => ({
          id: `local-${Date.now()}-${idx}`,
          name: file.name,
          url: URL.createObjectURL(file),
          isObjectUrl: true,
          type: 'local',
          mimeType: file.type,
        }));
      });
      setCurrentTrackIndex(0);
      setIsSettingsOpen(false);
    },
    [
      resetPreviousSubtitlesAndExternalAudio,
      updatePreferences,
      showTransientNotice,
    ]
  );

  const handleLoadSubtitleFile = useCallback(
    (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.srt') && !lower.endsWith('.vtt')) {
        showTransientNotice('Please select a valid .srt or .vtt subtitle file');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = typeof e.target?.result === 'string' ? e.target.result : '';
        const parsed = parseSubtitles(content);
        setSubtitles(parsed);
        setSubtitleFileName(file.name);
        setUseEmbeddedSubtitles(false);
        setLoopingCue(null);
        updatePreferences({ subtitlesVisible: true });
        showTransientNotice(`Loaded ${parsed.length} subtitles`);
      };
      reader.readAsText(file, 'utf-8');
    },
    [updatePreferences, showTransientNotice]
  );

  const handleLoadExternalAudioFile = useCallback(
    (file: File) => {
      if (externalAudioUrl && externalAudioIsObjectUrl) {
        URL.revokeObjectURL(externalAudioUrl);
      }
      const url = URL.createObjectURL(file);
      setExternalAudioUrl(url);
      setExternalAudioIsObjectUrl(true);
      setExternalAudioName(file.name);
      setUseExternalAudio(true);
      showTransientNotice(`External audio loaded: ${file.name}`);
    },
    [externalAudioUrl, externalAudioIsObjectUrl, showTransientNotice]
  );

  const handleLoadSeparateAudioUrl = useCallback(
    (audioUrl: string) => {
      if (externalAudioUrl && externalAudioIsObjectUrl) {
        URL.revokeObjectURL(externalAudioUrl);
      }
      const nameFromUrl = audioUrl.split('/').pop()?.split('?')[0] || 'Audio Stream URL';
      setExternalAudioUrl(audioUrl);
      setExternalAudioIsObjectUrl(false);
      setExternalAudioName(nameFromUrl);
      setUseExternalAudio(true);
      showTransientNotice(`Separate audio stream loaded: ${nameFromUrl}`);
    },
    [externalAudioUrl, externalAudioIsObjectUrl, showTransientNotice]
  );

  const handleLoadStreamUrl = useCallback(
    (url: string, separateAudioUrl?: string) => {
      resetPreviousSubtitlesAndExternalAudio({
        keepSubtitles: false,
        keepExternalAudio: Boolean(separateAudioUrl),
      });
      setPlaylist((prev) => {
        prev.forEach((item) => {
          if (item.isObjectUrl) URL.revokeObjectURL(item.url);
        });
        const urlName = url.split('/').pop()?.split('?')[0] || 'Stream URL';
        return [
          {
            id: `url-${Date.now()}`,
            name: urlName,
            url,
            isObjectUrl: false,
            type: 'url',
          },
        ];
      });
      setCurrentTrackIndex(0);
      if (separateAudioUrl) {
        handleLoadSeparateAudioUrl(separateAudioUrl);
      }
      setIsSettingsOpen(false);
    },
    [resetPreviousSubtitlesAndExternalAudio, handleLoadSeparateAudioUrl]
  );

  // Load built-in offline English learning sample video & SRT subtitles
  const handleLoadSampleLesson = useCallback(() => {
    resetPreviousSubtitlesAndExternalAudio({
      keepSubtitles: true,
      keepExternalAudio: false,
    });
    const sampleUrl = createSynthesizedMediaBlobUrl(40, 220);
    const parsedCues = parseSubtitles(SAMPLE_SRT_CONTENT);

    setPlaylist((prev) => {
      prev.forEach((item) => {
        if (item.isObjectUrl) URL.revokeObjectURL(item.url);
      });
      return [
        {
          id: `demo-${Date.now()}`,
          name: 'English Dialogue Practice (Sample Lesson)',
          url: sampleUrl,
          isObjectUrl: true,
          type: 'demo',
        },
      ];
    });
    setCurrentTrackIndex(0);
    setSubtitles(parsedCues);
    setSubtitleFileName('english_dialogue_sample.srt');
    setUseEmbeddedSubtitles(false);
    setSubtitleDelay(0);
    setLoopingCue(null);
    updatePreferences({ subtitlesVisible: true });
    showTransientNotice('Sample lesson & selectable English subtitles loaded');
  }, [
    resetPreviousSubtitlesAndExternalAudio,
    updatePreferences,
    showTransientNotice,
  ]);

  // Support ?autostart=1 or ?demo=1 query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' || params.get('demo') === '1') {
      handleLoadSampleLesson();
    }
  }, [handleLoadSampleLesson]);

  // Global keyboard shortcuts (Requirement 6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not interfere with inputs, textareas, selects, or modifier combos (e.g. Ctrl+C)
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isUrlModalOpen || isAboutOpen) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'Spacebar': {
          if (!currentTrack) return;
          e.preventDefault();
          togglePlay();
          break;
        }
        case 'ArrowLeft': {
          if (!currentTrack) return;
          e.preventDefault();
          const step = preferences.seekStepSeconds ?? 5;
          seekByDelta(-step);
          showTransientNotice(`-${step} seconds`);
          break;
        }
        case 'ArrowRight': {
          if (!currentTrack) return;
          e.preventDefault();
          const step = preferences.seekStepSeconds ?? 5;
          seekByDelta(step);
          showTransientNotice(`+${step} seconds`);
          break;
        }
        case 'ArrowUp': {
          if (!currentTrack) return;
          e.preventDefault();
          const nextVol = Math.min(1, Math.round((preferences.volume + 0.05) * 100) / 100);
          updatePreferences({ volume: nextVol, isMuted: false });
          showTransientNotice(`Volume ${Math.round(nextVol * 100)}%`);
          break;
        }
        case 'ArrowDown': {
          if (!currentTrack) return;
          e.preventDefault();
          const nextVol = Math.max(0, Math.round((preferences.volume - 0.05) * 100) / 100);
          updatePreferences({ volume: nextVol, isMuted: nextVol === 0 });
          showTransientNotice(`Volume ${Math.round(nextVol * 100)}%`);
          break;
        }
        case 'f':
        case 'F': {
          e.preventDefault();
          toggleFullscreen();
          break;
        }
        case 'm':
        case 'M': {
          e.preventDefault();
          updatePreferences({ isMuted: !preferences.isMuted });
          showTransientNotice(preferences.isMuted ? 'Unmuted' : 'Muted');
          break;
        }
        case 's':
        case 'S': {
          e.preventDefault();
          const nextVis = !preferences.subtitlesVisible;
          updatePreferences({ subtitlesVisible: nextVis });
          showTransientNotice(nextVis ? 'Subtitles shown' : 'Subtitles hidden');
          break;
        }
        case 'c':
        case 'C': {
          e.preventDefault();
          toggleConcentrationMode();
          break;
        }
        case 'Escape': {
          if (isSettingsOpen) {
            setIsSettingsOpen(false);
          } else if (isFullscreen || isMobileLandscape) {
            handleExitFullscreenAndLandscape();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentTrack,
    isUrlModalOpen,
    isAboutOpen,
    isSettingsOpen,
    isFullscreen,
    isMobileLandscape,
    preferences.volume,
    preferences.isMuted,
    preferences.seekStepSeconds,
    preferences.subtitlesVisible,
    togglePlay,
    seekByDelta,
    toggleFullscreen,
    toggleConcentrationMode,
    handleExitFullscreenAndLandscape,
    updatePreferences,
    showTransientNotice,
  ]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleLoadVideoFiles(e.dataTransfer.files);
    }
  };

  const settingsClosedOnPointerDownRef = useRef<boolean>(false);

  // Close Settings popup when clicking anywhere outside of it
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handlePointerDownOutsideSettings = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-testid="settings-menu-popover"]')) {
        return;
      }

      if (target.closest('button[aria-label="Settings"]')) {
        return;
      }

      settingsClosedOnPointerDownRef.current = true;
      window.setTimeout(() => {
        settingsClosedOnPointerDownRef.current = false;
      }, 250);
      setIsSettingsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDownOutsideSettings, true);
    document.addEventListener('touchstart', handlePointerDownOutsideSettings, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutsideSettings, true);
      document.removeEventListener('touchstart', handlePointerDownOutsideSettings, true);
    };
  }, [isSettingsOpen]);

  // Touchstart on player container: on touchscreen, tapping when controls are hidden reveals them without pausing playback
  const handlePlayerTouchStart = useCallback(() => {
    lastTouchTimeRef.current = Date.now();
    if (!controlsVisible) {
      touchRevealedControlsRef.current = true;
      setControlsVisible(true);
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
      hideControlsTimeoutRef.current = window.setTimeout(() => {
        if (preferences.concentrationMode) {
          setControlsVisible(false);
        } else if (videoRef.current && !videoRef.current.paused && !isSettingsOpen) {
          setControlsVisible(false);
        }
      }, 3000);
      window.setTimeout(() => {
        touchRevealedControlsRef.current = false;
      }, 450);
      return;
    }
    handlePlayerMouseMove();
  }, [controlsVisible, isSettingsOpen, preferences.concentrationMode, handlePlayerMouseMove]);

  // Click on video surface: on mobile, tapping empty background when controls are visible hides them (YouTube mobile style); on desktop, toggles play/pause
  const handleVideoSurfaceClick = () => {
    if (isSettingsOpen || settingsClosedOnPointerDownRef.current) {
      settingsClosedOnPointerDownRef.current = false;
      setIsSettingsOpen(false);
      return;
    }
    if (touchRevealedControlsRef.current) {
      touchRevealedControlsRef.current = false;
      return;
    }
    const isRecentTouch = Date.now() - lastTouchTimeRef.current < 450;
    if (isRecentTouch) {
      if (controlsVisible && !preferences.concentrationMode) {
        setControlsVisible(false);
        if (hideControlsTimeoutRef.current) {
          window.clearTimeout(hideControlsTimeoutRef.current);
        }
      }
      return;
    }
    togglePlay();
  };

  const handleOpenAboutPage = useCallback(() => {
    pauseVideo();
    setIsSettingsOpen(false);
    setIsAboutOpen(true);
    try {
      if (window.location.hash !== '#about') {
        window.history.pushState(null, '', '#about');
      }
    } catch {
      // Ignore history API restrictions in sandboxed frames
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pauseVideo]);

  const handleCloseAboutPage = useCallback(() => {
    setIsAboutOpen(false);
    try {
      if (window.location.hash === '#about') {
        window.history.pushState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }
    } catch {
      // Ignore history API restrictions
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const syncHashNavigation = () => {
      const shouldShowAbout = window.location.hash === '#about';
      if (shouldShowAbout) {
        pauseVideo();
        setIsSettingsOpen(false);
      }
      setIsAboutOpen(shouldShowAbout);
    };
    window.addEventListener('hashchange', syncHashNavigation);
    window.addEventListener('popstate', syncHashNavigation);
    return () => {
      window.removeEventListener('hashchange', syncHashNavigation);
      window.removeEventListener('popstate', syncHashNavigation);
    };
  }, [pauseVideo]);

  const isDesktop = checkIsDesktop();
  const isMobileOrTablet = !isDesktop;
  const isLandscapeViewport = !isPortraitViewport;
  const isMobileOrTabletLandscape = isMobileOrTablet && isLandscapeViewport && !forceInlineInLandscape;
  const isEdgeToEdgeActive = isFullscreen || isMobileLandscape || isMobileOrTabletLandscape;

  return (
    <>
      {isAboutOpen && <AboutPage onBackToPlayer={handleCloseAboutPage} />}

      <main
        data-testid="player-main-view"
        data-force-inline={forceInlineInLandscape ? 'true' : 'false'}
        data-fullscreen-active={isFullscreen || isMobileLandscape ? 'true' : 'false'}
        className={
          isAboutOpen
            ? 'hidden'
            : `min-h-screen w-full bg-[#0F0F0F] text-[#F1F1F1] flex flex-col items-center justify-center select-none ${
                isEdgeToEdgeActive
                  ? 'p-0 m-0 overflow-hidden'
                  : 'p-2 sm:p-4 md:p-6'
              }`
        }
      >
        {/* Hidden file inputs */}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/x-matroska,.mp4,.webm,.mkv,.mov"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleLoadVideoFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <input
          ref={subtitleInputRef}
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleLoadSubtitleFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleLoadExternalAudioFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        {/* Hidden external audio element */}
        <audio ref={externalAudioRef} preload="auto" />

        {/* Application Brand & Navigation Header (hidden in Concentration Mode, Fullscreen, & Mobile/Tablet Landscape) */}
        {!isEdgeToEdgeActive && !preferences.concentrationMode && (
          <header
            data-testid="app-brand-header"
            className="w-full max-w-[1280px] mb-2.5 flex items-center justify-between gap-8 px-1"
          >
            <LingoPlayLogo onClick={handleCloseAboutPage} testId="player-header-logo" />

            <nav aria-label="Application navigation" className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                data-testid="open-about-btn"
                onClick={handleOpenAboutPage}
                className="text-xs sm:text-sm font-medium text-[#AAAAAA] hover:text-[#F1F1F1] underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 px-1.5"
              >
                About
              </button>
            </nav>
          </header>
        )}

        {/* Main Centered Player Container */}
        <div
          ref={playerContainerRef}
          data-testid="video-player-container"
          data-mobile-landscape={isMobileLandscape ? 'true' : 'false'}
          data-fullscreen={isFullscreen ? 'true' : 'false'}
          onMouseMove={handlePlayerMouseMove}
          onTouchStart={handlePlayerTouchStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-[#000000] overflow-hidden shadow-2xl flex items-center justify-center ${
            isMobileLandscape && isPortraitViewport
              ? 'fixed inset-0 w-screen h-[100dvh] max-w-none z-50 rounded-none border-none m-0 p-0 left-0 right-0 top-0 bottom-0'
              : isEdgeToEdgeActive
              ? 'fixed inset-0 w-full w-screen h-full h-[100dvh] max-w-none z-50 rounded-none border-none m-0 p-0 left-0 right-0 top-0 bottom-0'
              : 'relative w-full max-w-[1280px] aspect-video min-h-[240px] sm:min-h-0 rounded-xl border border-[#383838]/80'
          }`}
        >
          {/* Inner Stage (handles seamless 90-degree landscape rotation when held in portrait without screen gaps) */}
          <div
            data-testid="player-inner-stage"
            style={
              isMobileLandscape && isPortraitViewport
                ? {
                    width: `${viewportDimensions.height}px`,
                    height: `${viewportDimensions.width}px`,
                    transform: 'rotate(90deg)',
                    transformOrigin: 'center center',
                  }
                : undefined
            }
            className="relative w-full h-full flex items-center justify-center overflow-hidden select-none"
          >
            {/* Discreet Touchscreen Exit Concentration Mode Button (mobile & tablet only; appears with temporary controls) */}
            {preferences.concentrationMode && (
              <button
                type="button"
                data-testid="exit-concentration-mode-btn"
                aria-label="Exit Concentration Mode"
                title="Exit Concentration Mode"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleConcentrationMode();
                }}
                className={`flex lg:hidden [@media(pointer:coarse)]:flex absolute top-[max(env(safe-area-inset-top),12px)] right-3 z-40 w-10 h-10 rounded-full bg-black/65 hover:bg-[#303030]/90 active:scale-95 border border-white/15 text-[#F1F1F1] items-center justify-center backdrop-blur-xs shadow-lg transition-all duration-200 cursor-pointer select-none ${
                  controlsVisible
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none'
                }`}
              >
                <EyeOff className="w-4 h-4 text-[#FF0033]" />
              </button>
            )}

            {/* Top subtle bar when a video is loaded, controls are visible, and Concentration Mode is OFF */}
            {currentTrack && !preferences.concentrationMode && (
              <div
                data-testid="top-video-header"
                className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),8px)] pb-2 sm:px-4 sm:py-3 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-none transition-opacity duration-200 ${
                  controlsVisible ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    data-testid="active-video-title"
                    className="text-xs sm:text-sm font-medium text-[#F1F1F1] truncate"
                  >
                    {currentTrack.name}
                  </span>
                  {playlist.length > 1 && (
                    <span className="text-xs font-mono tabular-nums text-[#AAAAAA] shrink-0">
                      · {currentTrackIndex + 1} / {playlist.length}
                    </span>
                  )}
                  {(useEmbeddedSubtitles && discoveredSubtitleTracks.length > 0
                    ? discoveredSubtitleTracks.find((t) => t.active)?.label ||
                      discoveredSubtitleTracks[0]?.label
                    : subtitleFileName) && (
                    <span className="hidden md:inline-block text-xs text-[#AAAAAA] truncate">
                      · CC:{' '}
                      {useEmbeddedSubtitles && discoveredSubtitleTracks.length > 0
                        ? discoveredSubtitleTracks.find((t) => t.active)?.label ||
                          discoveredSubtitleTracks[0]?.label
                        : subtitleFileName}
                    </span>
                  )}
                </div>

                {/* Top-right actions: Active subtitle loop indicator badge & Mobile Exit Fullscreen/Landscape button */}
                <div className="flex items-center gap-2 shrink-0">
                  {loopingCue && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLoopingCue(null);
                      }}
                      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md bg-[#212121]/90 border border-[#FF0033]/60 px-2.5 py-1 text-xs text-[#F1F1F1] hover:bg-[#303030] transition-colors cursor-pointer"
                      title="Click to stop repeating current subtitle"
                    >
                      <Repeat className="w-3.5 h-3.5 text-[#FF0033]" />
                      <span>Looping subtitle</span>
                      <X className="w-3 h-3 text-[#AAAAAA]" />
                    </button>
                  )}

                  {/* Mobile Exit Fullscreen / Landscape button */}
                  {(isFullscreen || isMobileLandscape || isMobileOrTabletLandscape) && (
                    <button
                      type="button"
                      data-testid="mobile-exit-fullscreen-btn"
                      aria-label="Exit fullscreen"
                      title="Exit fullscreen"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExitFullscreenAndLandscape();
                      }}
                      className="pointer-events-auto flex lg:hidden [@media(pointer:coarse)]:flex items-center justify-center w-8 h-8 rounded-full bg-black/65 hover:bg-[#303030]/90 active:scale-95 text-[#F1F1F1] border border-white/20 backdrop-blur-xs transition-all cursor-pointer ml-1"
                    >
                      <Minimize className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

        {/* Transient status toast (top-center) */}
        {statusNotice && (
          <div
            data-testid="player-status-notice"
            className="absolute top-12 left-1/2 -translate-x-1/2 z-40 rounded-lg bg-[#212121]/95 border border-[#383838] px-3 py-1.5 text-xs font-medium text-[#F1F1F1] pointer-events-none shadow-lg transition-opacity duration-150"
          >
            {statusNotice}
          </div>
        )}

        {/* Drag-and-drop overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-black/80 border-2 border-dashed border-[#FF0033] rounded-xl flex flex-col items-center justify-center gap-2 pointer-events-none">
            <FolderOpen className="w-10 h-10 text-[#FF0033]" />
            <p className="text-sm font-medium text-[#F1F1F1]">
              Drop video (.mp4, .webm, .mkv) or subtitle (.srt, .vtt) file here
            </p>
          </div>
        )}

        {/* Empty State when no video is loaded */}
        {!currentTrack && (
          <div
            data-testid="empty-player-state"
            className="relative z-10 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-3 max-w-md"
          >
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="inline-flex items-center gap-2 sm:gap-2.5 rounded-lg bg-[#FF0033] hover:bg-[#FF0033]/90 active:scale-[0.99] px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-lg transition-all duration-150 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Open Video</span>
            </button>

            <p className="mt-2.5 sm:mt-3 text-[11px] sm:text-xs text-[#AAAAAA]">
              Or drag and drop a local video (.mp4, .webm, .mkv) and subtitle (.srt, .vtt) file here.
              Files stay 100% on your computer.
            </p>

            <div className="mt-3.5 sm:mt-5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => subtitleInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#212121] hover:bg-[#303030] border border-[#383838] px-3.5 py-2 text-xs font-medium text-[#F1F1F1] transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#AAAAAA]" />
                <span>Open Subtitle</span>
              </button>

              <button
                type="button"
                onClick={() => setIsUrlModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#212121] hover:bg-[#303030] border border-[#383838] px-3.5 py-2 text-xs font-medium text-[#F1F1F1] transition-colors cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-[#AAAAAA]" />
                <span>Open URL</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSampleLesson}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#212121] hover:bg-[#303030] border border-[#383838] px-3.5 py-2 text-xs font-medium text-[#F1F1F1] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#AAAAAA]" />
                <span>Load Sample Video &amp; SRT</span>
              </button>
            </div>
          </div>
        )}

        {/* Active Video Surface */}
        {currentTrack && (
          <>
            {/* Subtle cinema backdrop for synthesized audio-video demo track */}
            {currentTrack.type === 'demo' && (
              <div
                onClick={handleVideoSurfaceClick}
                className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,#1a1a1a_0%,#080808_60%,#000000_100%)] select-none cursor-pointer"
              />
            )}

            <video
              key={
                currentTrack.isObjectUrl ||
                currentTrackEngine === 'hls' ||
                currentTrackEngine === 'dash'
                  ? 'boosted-media-element'
                  : 'direct-remote-media-element'
              }
              ref={videoRef}
              data-testid="html5-video-element"
              data-audio-boost={preferences.audioBoost ?? 1.8}
              playsInline
              onClick={handleVideoSurfaceClick}
              onPlay={() => {
                setIsPlaying(true);
                syncWebAudioBoost(true);
                syncExternalAudio(false);
              }}
              onPause={() => {
                setIsPlaying(false);
                syncExternalAudio(false);
              }}
              onTimeUpdate={(e) => {
                const vid = e.currentTarget;
                const time = vid.currentTime;
                setCurrentTime(time);
                syncExternalAudio(false);
                refreshNativeTextTrackCues(time);

                // Detect audio-playing-with-black-screen when a video file's video codec is unsupported by the browser
                if (
                  currentTrack &&
                  currentTrack.type !== 'demo' &&
                  !currentTrack.mimeType?.startsWith('audio/') &&
                  !/\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(currentTrack.name) &&
                  !vid.paused &&
                  !vid.seeking &&
                  vid.readyState >= 2 &&
                  time > 1.5
                ) {
                  if (vid.videoWidth === 0 && vid.videoHeight === 0) {
                    unplayableVideoCheckCountRef.current += 1;
                    if (unplayableVideoCheckCountRef.current >= 4 && !mediaError) {
                      setMediaError(
                        `Audio is playing, but the video track in "${currentTrack.name}" could not be decoded (unsupported video codec such as HEVC/H.265). Try an H.264/VP9 MP4 or WebM video.`
                      );
                    }
                  } else {
                    unplayableVideoCheckCountRef.current = 0;
                  }
                }
              }}
              onDurationChange={(e) => {
                const dur = e.currentTarget.duration;
                if (Number.isFinite(dur) && dur > 0) {
                  setDuration(dur);
                }
              }}
              onLoadedMetadata={(e) => {
                const vid = e.currentTarget;
                if (Number.isFinite(vid.duration) && vid.duration > 0) {
                  setDuration(vid.duration);
                }
                vid.playbackRate = preferences.playbackSpeed;
                vid.volume = preferences.volume;
                if (activeEngine === 'native') {
                  syncNativeAudioTracks();
                  syncNativeSubtitleTracks();
                } else {
                  refreshNativeTextTrackCues(vid.currentTime);
                }
              }}
              onSeeking={() => syncExternalAudio(true)}
              onSeeked={(e) => {
                syncExternalAudio(true);
                refreshNativeTextTrackCues(e.currentTarget.currentTime);
              }}
              onEnded={() => {
                setIsPlaying(false);
                if (currentTrackIndex + 1 < playlist.length) {
                  resetPreviousSubtitlesAndExternalAudio();
                  setCurrentTrackIndex((idx) => idx + 1);
                }
              }}
              onError={() => {
                const isMkv = currentTrack.name.toLowerCase().endsWith('.mkv');
                if (isMkv) {
                  setMediaError(
                    `Unable to play "${currentTrack.name}". This MKV container uses a video or audio codec (such as HEVC, AC3, or DTS) not natively supported by your browser. Try an MP4/WebM file or load a compatible external audio track.`
                  );
                } else if (currentTrack.type === 'url') {
                  setMediaError(
                    'Unable to play stream URL. The remote server may block cross-origin (CORS) playback, require authentication, or use an unsupported media format.'
                  );
                } else {
                  setMediaError(
                    `Unable to play "${currentTrack.name}". The file format or codec is not supported by your browser.`
                  );
                }
              }}
              className={`w-full h-full object-contain cursor-pointer ${
                currentTrack.type === 'demo' ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Helpful Error Overlay */}
            {mediaError && (
              <div
                data-testid="media-error-banner"
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-x-6 top-16 z-40 mx-auto max-w-lg rounded-xl bg-[#212121] border border-[#FF0033]/60 p-4 text-xs text-[#F1F1F1] shadow-2xl"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#FF0033] shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <div className="font-semibold text-sm">Playback Error</div>
                    <p className="text-[#AAAAAA] leading-relaxed">{mediaError}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-[#FF0033] text-white font-medium hover:bg-[#FF0033]/90 transition-colors cursor-pointer"
                      >
                        Choose Another Video
                      </button>
                      <button
                        type="button"
                        onClick={() => setMediaError(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#303030] text-[#F1F1F1] hover:bg-[#383838] transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Center Skip & Play/Pause Hover Controls */}
            <CenterHoverControls
              visible={controlsVisible && !mediaError && !isSubtitleInteracting && !isSettingsOpen}
              isPlaying={isPlaying}
              seekStepSeconds={preferences.seekStepSeconds ?? 5}
              onSeekBackward={() => seekByDelta(-(preferences.seekStepSeconds ?? 5))}
              onTogglePlay={togglePlay}
              onSeekForward={() => seekByDelta(preferences.seekStepSeconds ?? 5)}
            />

            {/* Real Selectable HTML Subtitle Overlay */}
            <SubtitleOverlay
              activeCues={activeCues}
              visible={preferences.subtitlesVisible}
              fontSize={preferences.subtitleFontSize}
              bottomOffset={preferences.subtitleBottomOffset}
              backgroundEnabled={preferences.subtitleBgEnabled}
              autoPauseOnSelect={preferences.autoPauseOnSelect}
              isPlaying={isPlaying}
              controlsVisible={controlsVisible && !preferences.concentrationMode}
              loopingCue={loopingCue}
              videoTrackId={currentTrack.id}
              onPauseForSelection={pauseVideo}
              onReplayCue={handleReplayCue}
              onToggleLoopCue={handleToggleLoopCue}
              onPopupOpenChange={handleTranslationPopupOpenChange}
              onSubtitleInteractionChange={setIsSubtitleInteracting}
            />

            {/* Compact Settings Menu Popover (hidden in Concentration Mode) */}
            {!preferences.concentrationMode && (
              <SettingsMenu
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                preferences={preferences}
                onUpdatePreferences={updatePreferences}
                subtitleDelay={subtitleDelay}
                onChangeSubtitleDelay={setSubtitleDelay}
                subtitleFileName={subtitleFileName}
                subtitleCount={subtitles.length}
                discoveredSubtitleTracks={discoveredSubtitleTracks}
                useEmbeddedSubtitles={useEmbeddedSubtitles}
                onSelectEmbeddedSubtitleTrack={handleSelectEmbeddedSubtitleTrack}
                onSelectExternalSubtitleSource={handleSelectExternalSubtitleSource}
                onTriggerOpenSubtitle={() => subtitleInputRef.current?.click()}
                onTriggerOpenVideo={() => videoInputRef.current?.click()}
                onTriggerOpenUrlModal={() => {
                  setIsSettingsOpen(false);
                  setIsUrlModalOpen(true);
                }}
                discoveredAudioTracks={discoveredAudioTracks}
                activeEngine={activeEngine}
                isStreamSource={currentTrack.type === 'url'}
                onSelectAudioTrack={handleSelectDiscoveredAudioTrack}
                externalAudioName={externalAudioName}
                useExternalAudio={useExternalAudio}
                onToggleExternalAudio={setUseExternalAudio}
                audioOffset={audioOffset}
                onChangeAudioOffset={setAudioOffset}
                onTriggerOpenAudio={() => audioInputRef.current?.click()}
                onLoadSeparateAudioUrl={handleLoadSeparateAudioUrl}
                onResetSubtitles={handleResetSubtitles}
                onResetAudio={handleResetAudio}
                onToggleConcentrationMode={toggleConcentrationMode}
              />
            )}

            {/* Bottom YouTube-Inspired Control Bar (hidden in Concentration Mode) */}
            {!preferences.concentrationMode && (
              <PlayerControls
                visible={controlsVisible}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={preferences.volume}
                isMuted={preferences.isMuted}
                playbackSpeed={preferences.playbackSpeed}
                seekStepSeconds={preferences.seekStepSeconds ?? 5}
                subtitlesVisible={preferences.subtitlesVisible}
                hasSubtitles={
                  subtitles.length > 0 ||
                  discoveredSubtitleTracks.length > 0 ||
                  embeddedStreamCues.length > 0 ||
                  nativeTextTrackCues.length > 0
                }
                isSettingsOpen={isSettingsOpen}
                isFullscreen={isFullscreen}
                isMobileLandscape={isMobileLandscape}
                concentrationMode={preferences.concentrationMode}
                hasMultiplePlaylistItems={playlist.length > 1}
                canPlayPrev={currentTrackIndex > 0}
                canPlayNext={currentTrackIndex + 1 < playlist.length}
                onTogglePlay={togglePlay}
                onSeek={seekTo}
                onVolumeChange={(vol) =>
                  updatePreferences({ volume: vol, isMuted: vol === 0 })
                }
                onToggleMute={() =>
                  updatePreferences({ isMuted: !preferences.isMuted })
                }
                onToggleSubtitles={() =>
                  updatePreferences({
                    subtitlesVisible: !preferences.subtitlesVisible,
                  })
                }
                onToggleSettings={() => setIsSettingsOpen((prev) => !prev)}
                onToggleFullscreen={toggleFullscreen}
                onToggleMobileLandscape={toggleMobileLandscape}
                onToggleConcentrationMode={toggleConcentrationMode}
                onOpenSubtitleFile={() => subtitleInputRef.current?.click()}
                onOpenVideoFile={() => videoInputRef.current?.click()}
                onPrevTrack={() => {
                  resetPreviousSubtitlesAndExternalAudio();
                  setCurrentTrackIndex((idx) => Math.max(0, idx - 1));
                }}
                onNextTrack={() => {
                  resetPreviousSubtitlesAndExternalAudio();
                  setCurrentTrackIndex((idx) =>
                    Math.min(playlist.length - 1, idx + 1)
                  );
                }}
              />
            )}
          </>
        )}
          </div>
        </div>

      {/* Subtle Single-Line Keyboard Shortcuts Hint Bar below player (desktop only; hidden on mobile/tablet, Concentration Mode & Fullscreen) */}
      {!isEdgeToEdgeActive && !preferences.concentrationMode && (
        <div
          data-testid="keyboard-shortcuts-bar"
          className="mt-3 hidden lg:flex [@media(pointer:coarse)]:!hidden flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[#AAAAAA]"
        >
          <span>Space: Play/Pause</span>
          <span aria-hidden="true">·</span>
          <span>Left/Right: Seek {preferences.seekStepSeconds ?? 5}s</span>
          <span aria-hidden="true">·</span>
          <span>Double-click subtitle word: Select &amp; Translate</span>
          <span aria-hidden="true">·</span>
          <span>S: Subtitles</span>
          <span aria-hidden="true">·</span>
          <span>C: Concentration Mode</span>
          <span aria-hidden="true">·</span>
          <span>F: Fullscreen</span>
        </div>
      )}

      {/* Open Direct URL Modal */}
      <UrlModal
        isOpen={isUrlModalOpen}
        onClose={() => setIsUrlModalOpen(false)}
        onLoadUrl={handleLoadStreamUrl}
      />
      </main>
    </>
  );
};

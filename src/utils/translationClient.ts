export interface TranslationResult {
  selectedText: string;
  bengaliTranslation: string;
  contextualNote?: string;
  cached?: boolean;
}

const sessionTranslationCache = new Map<string, TranslationResult>();
const MAX_CLIENT_CACHE = 300;

export function buildTranslationCacheKey(
  selectedText: string,
  subtitleContext: string
): string {
  return `${selectedText.trim().toLowerCase()}||${subtitleContext.trim().toLowerCase()}`;
}

export function getCachedTranslation(
  selectedText: string,
  subtitleContext: string
): TranslationResult | null {
  const key = buildTranslationCacheKey(selectedText, subtitleContext);
  return sessionTranslationCache.get(key) || null;
}

export function setCachedTranslation(
  selectedText: string,
  subtitleContext: string,
  result: TranslationResult
): void {
  const key = buildTranslationCacheKey(selectedText, subtitleContext);
  if (sessionTranslationCache.size >= MAX_CLIENT_CACHE) {
    const firstKey = sessionTranslationCache.keys().next().value;
    if (firstKey !== undefined) {
      sessionTranslationCache.delete(firstKey);
    }
  }
  sessionTranslationCache.set(key, result);
}

export async function requestBengaliTranslation(
  selectedText: string,
  subtitleContext: string,
  signal?: AbortSignal,
  forceRefresh: boolean = false
): Promise<TranslationResult> {
  const cleanSelected = selectedText.trim();
  const cleanContext = subtitleContext.trim();

  if (!cleanSelected) {
    throw new Error('Please select a word or subtitle to translate.');
  }

  if (!forceRefresh) {
    const cached = getCachedTranslation(cleanSelected, cleanContext);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, 20000);

  const onCallerAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) {
      window.clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selectedText: cleanSelected,
        subtitleContext: cleanContext,
        forceRefresh,
      }),
      signal: timeoutController.signal,
    });
  } catch (err: unknown) {
    window.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onCallerAbort);
    }
    if (timedOut) {
      throw new Error('Translation request timed out. Please try again.');
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new Error('Network error while contacting translation service.');
  } finally {
    window.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onCallerAbort);
    }
  }

  let data: {
    selectedText?: string;
    bengaliTranslation?: string;
    contextualNote?: string;
    error?: string;
  } = {};

  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response received from translation service.');
  }

  if (!response.ok || !data.bengaliTranslation) {
    throw new Error(
      data.error || 'Unable to translate selection right now. Please try again.'
    );
  }

  const result: TranslationResult = {
    selectedText: data.selectedText || cleanSelected,
    bengaliTranslation: data.bengaliTranslation,
    contextualNote: data.contextualNote || '',
  };

  setCachedTranslation(cleanSelected, cleanContext, result);
  return result;
}

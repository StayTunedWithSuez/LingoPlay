import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const TRANSLATION_SYSTEM_INSTRUCTION = `You are an expert English-to-Bengali translator helping a Bengali-speaking learner understand English movies and television dialogue.

Translate the requested English word, phrase, or sentence into natural, accurate, everyday Bengali.

Use the surrounding subtitle sentence to understand the context, especially for idioms, slang, phrasal verbs, informal expressions, and conversational English.

If a single word is selected, explain its meaning as used in that particular sentence, not just its generic dictionary meaning.

If a complete sentence is selected, provide a natural Bengali translation that preserves the intended meaning, tone, and context.

Avoid overly formal, literary, or unnecessarily complicated Bengali.

Keep translations concise and easy to understand.

Do not invent context that is not provided.

Return only the information needed by a language learner, without lengthy explanations.`;

interface CachedTranslation {
  bengaliTranslation: string;
  contextualNote?: string;
}

const serverTranslationCache = new Map<string, CachedTranslation>();
const MAX_CACHE_ENTRIES = 500;

function getCacheKey(selectedText: string, subtitleContext: string): string {
  return `${selectedText.trim().toLowerCase()}||${subtitleContext.trim().toLowerCase()}`;
}

function setCacheEntry(key: string, value: CachedTranslation): void {
  if (serverTranslationCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = serverTranslationCache.keys().next().value;
    if (oldestKey !== undefined) {
      serverTranslationCache.delete(oldestKey);
    }
  }
  serverTranslationCache.set(key, value);
}

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    const rawSelected = typeof body?.selectedText === 'string' ? body.selectedText : '';
    const rawContext = typeof body?.subtitleContext === 'string' ? body.subtitleContext : '';
    const forceRefresh = Boolean(body?.forceRefresh);

    const selectedText = rawSelected.trim().slice(0, 600);
    const subtitleContext = rawContext.trim().slice(0, 1000);

    if (!selectedText) {
      return res.status(400).json({
        error: 'Please select a word, phrase, or subtitle sentence to translate.',
      });
    }

    const cacheKey = getCacheKey(selectedText, subtitleContext);
    if (!forceRefresh) {
      const cached = serverTranslationCache.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          selectedText,
          bengaliTranslation: cached.bengaliTranslation,
          contextualNote: cached.contextualNote || '',
          cached: true,
        });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error:
          'Gemini API key is not configured. Please set your GEMINI_API_KEY environment variable in your Vercel Project Settings.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const hasDistinctContext =
      subtitleContext.length > 0 &&
      subtitleContext.toLowerCase() !== selectedText.toLowerCase();

    const prompt = hasDistinctContext
      ? `Selected English text: "${selectedText}"\nSurrounding subtitle sentence: "${subtitleContext}"\n\nProvide the natural Bengali meaning (বাংলা অর্থ) of the selected English text as used in this subtitle sentence. Include a brief one-sentence contextual note only if the selection is an idiom, phrasal verb, slang expression, or has a special contextual meaning in this dialogue.`
      : `Selected English subtitle text: "${selectedText}"\n\nProvide a natural, everyday Bengali translation (বাংলা অর্থ) that preserves the tone and meaning of this movie/TV dialogue. Include a brief one-sentence contextual note only if it contains an idiom, phrasal verb, or slang expression.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        bengaliTranslation: {
          type: Type.STRING,
          description:
            'Natural, everyday Bengali translation or contextual meaning in Bengali script (বাংলা).',
        },
        contextualNote: {
          type: Type.STRING,
          description:
            'Optional brief one-sentence note in Bengali explaining idiomatic, phrasal verb, or conversational usage when helpful. Leave empty string if not needed.',
        },
      },
      required: ['bengaliTranslation'],
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
    } catch {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: TRANSLATION_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
    }

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      return res.status(502).json({
        error: 'Received an empty translation response from Gemini. Please try again.',
      });
    }

    let parsed: { bengaliTranslation?: string; contextualNote?: string } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { bengaliTranslation: rawText };
    }

    const bengaliTranslation = (parsed.bengaliTranslation || rawText).trim();
    const contextualNote = (parsed.contextualNote || '').trim();

    if (!bengaliTranslation) {
      return res.status(502).json({
        error: 'Could not extract Bengali translation from response. Please try again.',
      });
    }

    setCacheEntry(cacheKey, { bengaliTranslation, contextualNote });

    return res.status(200).json({
      selectedText,
      bengaliTranslation,
      contextualNote,
      cached: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const statusMatch =
      message.includes('403') || message.includes('PERMISSION_DENIED')
        ? 403
        : message.includes('400') || message.includes('API_KEY_INVALID')
        ? 400
        : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
        ? 429
        : 500;

    if (statusMatch === 403 || statusMatch === 400) {
      return res.status(statusMatch).json({
        error:
          'Unable to authenticate with Gemini API. Please check your GEMINI_API_KEY environment variable in Vercel settings.',
      });
    }

    if (statusMatch === 429) {
      return res.status(429).json({
        error:
          'Translation rate limit reached. Please wait a moment and try again, or check your API key quota.',
      });
    }

    return res.status(500).json({
      error: 'Translation request failed. Please check your connection and try again.',
    });
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
} from './translationClient';

test('buildTranslationCacheKey normalizes whitespace and casing for selected text and context', () => {
  const k1 = buildTranslationCacheKey('  Wondering ', 'I was wondering if you could help me.');
  const k2 = buildTranslationCacheKey('wondering', 'i was wondering if you could help me.');
  assert.equal(k1, k2);
});

test('setCachedTranslation and getCachedTranslation store and retrieve Bengali translations', () => {
  setCachedTranslation('give me a break', 'Come on, give me a break!', {
    selectedText: 'give me a break',
    bengaliTranslation: 'আমাকে একটু রেহাই দাও / থামো তো!',
    contextualNote: 'এটি একটি কথ্য বাগধারা (idiom), যার অর্থ বিরক্ত না করতে বা বিশ্বাস করতে বলা।',
  });

  const cached = getCachedTranslation('Give me a break', 'Come on, give me a break!');
  assert.ok(cached);
  assert.equal(cached.bengaliTranslation, 'আমাকে একটু রেহাই দাও / থামো তো!');
  assert.ok(cached.contextualNote?.includes('idiom'));
});

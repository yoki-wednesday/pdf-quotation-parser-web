import { describe, it, expect } from 'vitest';
import {
  toFullWidthKana,
  toHalfWidthKana,
  kanaToHiragana,
  toHalfWidthAlphanumeric,
  getSearchVariants,
  splitSearchKeywords,
} from '../lib/search';

describe('TEST-009-SEARCH-FUZZY: カナ・英数表記揺れ吸収', () => {
  it('半角カタカナが全角カタカナに正しく変換されること', () => {
    expect(toFullWidthKana('ｶﾌﾟﾗ')).toBe('カプラ');
    expect(toFullWidthKana('ﾘﾚｰ')).toBe('リレー');
    expect(toFullWidthKana('ｾﾝｻ')).toBe('センサ');
  });

  it('全角カタカナが半角カタカナに正しく変換されること', () => {
    expect(toHalfWidthKana('オムロン')).toBe('ｵﾑﾛﾝ');
    expect(toHalfWidthKana('カプラ')).toBe('ｶﾌﾟﾗ');
    expect(toHalfWidthKana('リレー')).toBe('ﾘﾚｰ');
  });

  it('全角カタカナがひらがなに変換されること', () => {
    expect(kanaToHiragana('カプラ')).toBe('かぷら');
    expect(kanaToHiragana('オムロン')).toBe('おむろん');
  });

  it('全角英数が半角英数に変換されること', () => {
    expect(toHalfWidthAlphanumeric('ＭＹ４Ｎ－Ｄ２')).toBe('MY4N-D2');
  });

  it('検索バリアントが多角的に生成されること（全角・半角・ひらがなの相互吸収）', () => {
    const variantsFromHalf = getSearchVariants('ｶﾌﾟﾗ');
    expect(variantsFromHalf).toContain('ｶﾌﾟﾗ');
    expect(variantsFromHalf).toContain('カプラ');
    expect(variantsFromHalf).toContain('かぷら');

    const variantsFromFull = getSearchVariants('オムロン');
    expect(variantsFromFull).toContain('オムロン');
    expect(variantsFromFull).toContain('ｵﾑﾛﾝ');
    expect(variantsFromFull).toContain('おむろん');

    const variantsFromHira = getSearchVariants('おむろん');
    expect(variantsFromHira).toContain('おむろん');
    expect(variantsFromHira).toContain('オムロン');
    expect(variantsFromHira).toContain('ｵﾑﾛﾝ');
  });

  it('スペースやカンマ（全角/半角/読点）でキーワードが正しく分割されること', () => {
    expect(splitSearchKeywords('オムロン リレー')).toEqual(['オムロン', 'リレー']);
    expect(splitSearchKeywords('オムロン,リレー、MY4N　ケーブル')).toEqual(['オムロン', 'リレー', 'MY4N', 'ケーブル']);
    expect(splitSearchKeywords('   ')).toEqual([]);
    expect(splitSearchKeywords('')).toEqual([]);
  });
});

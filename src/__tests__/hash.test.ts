import { describe, it, expect } from 'vitest';
import { calculateFileHash } from '../lib/hash';

describe('TEST-005-HASH-DUP: ファイルハッシュ計算', () => {
  it('同一ファイル内容から常に同一のSHA-256ハッシュが生成されること', async () => {
    const fileContent = 'dummy pdf content for hash testing';
    const blob1 = new Blob([fileContent], { type: 'application/pdf' });
    const file1 = new File([blob1], 'test1.pdf', { type: 'application/pdf' });

    const blob2 = new Blob([fileContent], { type: 'application/pdf' });
    const file2 = new File([blob2], 'test2.pdf', { type: 'application/pdf' });

    const hash1 = await calculateFileHash(file1);
    const hash2 = await calculateFileHash(file2);

    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64); // SHA-256 is 64 hex characters
    expect(hash1).toBe(hash2);
  });
});

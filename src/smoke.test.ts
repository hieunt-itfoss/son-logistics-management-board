import { describe, expect, it } from 'vitest';
import { DM_GROUP_LABEL } from './types';

describe('project smoke', () => {
  it('loads shared constants', () => {
    expect(DM_GROUP_LABEL.phap).toBe('Vận tải Pháp');
  });
});

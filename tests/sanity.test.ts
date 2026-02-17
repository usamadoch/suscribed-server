
import { describe, it, expect } from '@jest/globals';
import User from '../src/models/User.js';
import * as authService from '../src/services/authService.js';

describe('Sanity Check', () => {
    it('should always pass', () => {
        expect(true).toBe(true);
    });
});

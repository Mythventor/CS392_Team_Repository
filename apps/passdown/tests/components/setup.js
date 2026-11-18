import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// jsdom does not implement the browser's local file-preview APIs.
if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:item-preview');
if (!URL.revokeObjectURL) URL.revokeObjectURL = vi.fn();

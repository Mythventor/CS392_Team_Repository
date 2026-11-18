import { screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { BrowsePage } from '../../src/pages/BrowsePage';
import { useAvailableItems } from '../../src/items/useAvailableItems';
import { currentRoute, item, renderFlow } from './helpers';

vi.mock('../../src/items/useAvailableItems', () => ({ useAvailableItems: vi.fn() }));
const items = [
  item,
  { ...item, id: 'book', title: 'Calculus textbook', category: 'books', school: 'depaul' },
  { ...item, id: 'lamp-2', title: 'Reading lamp', school: 'depaul' },
];
beforeEach(() => useAvailableItems.mockReturnValue({ items, loading: false, error: '' }));

test('combines search, school, and category filters in the URL and opens an item', async () => {
  const { actor } = renderFlow(<BrowsePage />, { route: '/browse', path: '/browse' });
  await actor.type(screen.getByRole('searchbox', { name: 'Search items' }), 'lamp');
  await actor.selectOptions(screen.getByRole('combobox', { name: 'School' }), 'northwestern');
  await actor.click(screen.getByRole('button', { name: 'Dorm & home', exact: true }));
  expect(screen.getByRole('status')).toHaveTextContent('1 item available');
  expect(screen.queryByRole('heading', { name: 'Reading lamp' })).not.toBeInTheDocument();
  const params = new URLSearchParams(currentRoute().split('?')[1]);
  expect(Object.fromEntries(params)).toEqual({ q: 'lamp', school: 'northwestern', category: 'dorm' });
  await actor.click(screen.getByRole('link', { name: /Desk lamp/ }));
  expect(currentRoute()).toBe('/items/lamp');
});

test('restores shared URL filters and clears an empty search back to all items', async () => {
  const { actor } = renderFlow(<BrowsePage />, { route: '/browse?q=missing&school=depaul&category=books' });
  expect(screen.getByRole('searchbox')).toHaveValue('missing');
  expect(screen.getByRole('combobox')).toHaveValue('depaul');
  expect(screen.getByRole('button', { name: 'Books', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'No items match' })).toBeVisible();
  await actor.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByRole('status')).toHaveTextContent('3 items available');
  expect(currentRoute()).toBe('/browse');
});

test('invites the first seller to create a listing when inventory is empty', async () => {
  useAvailableItems.mockReturnValue({ items: [], loading: false, error: '' });
  const { actor } = renderFlow(<BrowsePage />, { route: '/browse', path: '/browse' });
  expect(screen.getByRole('heading', { name: 'Nothing listed yet' })).toBeVisible();
  await actor.click(screen.getByRole('link', { name: 'List an item' }));
  expect(currentRoute()).toBe('/list');
});

test('shows data-loading failures without misleading empty-inventory messaging', () => {
  useAvailableItems.mockReturnValue({ items: [], loading: false, error: 'Could not load items.' });
  renderFlow(<BrowsePage />);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load items.');
  expect(screen.queryByText('Nothing listed yet')).not.toBeInTheDocument();
});

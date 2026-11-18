import { screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { OfferPanel } from '../../src/deals/OfferPanel';
import { createOffer } from '../../src/deals/offers';
import { useMyOffersForItem } from '../../src/deals/useDeals';
import { currentRoute, deal, item, renderFlow } from './helpers';

vi.mock('../../src/deals/offers', () => ({ createOffer: vi.fn() }));
vi.mock('../../src/deals/useDeals', () => ({ useMyOffersForItem: vi.fn() }));
beforeEach(() => {
  createOffer.mockReset().mockResolvedValue('new-offer');
  useMyOffersForItem.mockReturnValue({ data: [], loading: false, error: '' });
});

test('sends a signed-out buyer to sign-in with the current item as the return path', async () => {
  const { actor } = renderFlow(<OfferPanel item={item} />, { route: '/items/lamp', path: '/items/:id', auth: { user: null } });
  await actor.click(screen.getByRole('link', { name: 'Sign in to buy' }));
  expect(currentRoute()).toBe('/signin?next=%2Fitems%2Flamp');
  expect(createOffer).not.toHaveBeenCalled();
});

test('submits the asking price and opens the resulting deal', async () => {
  const { actor, session } = renderFlow(<OfferPanel item={item} />, { route: '/items/lamp', path: '/items/:id' });
  await actor.click(screen.getByRole('button', { name: 'Buy for $25' }));
  await waitFor(() => expect(currentRoute()).toBe('/deals/new-offer'));
  expect(createOffer).toHaveBeenCalledWith({ item, values: { offerPrice: 25, message: '' }, user: session.user, profile: session.profile });
});

test('rejects an excessive offer, then sends a valid lower offer and message', async () => {
  const { actor } = renderFlow(<OfferPanel item={item} />, { route: '/items/lamp', path: '/items/:id' });
  await actor.click(screen.getByRole('radio', { name: 'Make an offer' }));
  const price = screen.getByRole('textbox', { name: 'Your offer' });
  await actor.type(price, '30');
  await actor.click(screen.getByRole('button', { name: 'Send offer' }));
  expect(price).toBeInvalid();
  expect(createOffer).not.toHaveBeenCalled();
  await actor.clear(price);
  await actor.type(price, '20');
  await actor.type(screen.getByRole('textbox', { name: /Message to Sam/ }), 'Can collect tomorrow');
  await actor.click(screen.getByRole('button', { name: 'Send offer' }));
  await waitFor(() => expect(currentRoute()).toBe('/deals/new-offer'));
  expect(createOffer).toHaveBeenCalledWith(expect.objectContaining({ values: { offerPrice: 20, message: 'Can collect tomorrow' } }));
});

test('requests a free item without requiring a price', async () => {
  const freeItem = { ...item, price: 0 };
  const { actor } = renderFlow(<OfferPanel item={freeItem} />, { route: '/items/lamp', path: '/items/:id' });
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  await actor.click(screen.getByRole('button', { name: 'Ask for it' }));
  await waitFor(() => expect(currentRoute()).toBe('/deals/new-offer'));
  expect(createOffer).toHaveBeenCalledWith(expect.objectContaining({ values: { offerPrice: 0, message: '' } }));
});

test('links to an existing pending offer instead of offering again', async () => {
  useMyOffersForItem.mockReturnValue({ data: [deal], loading: false, error: '' });
  const { actor } = renderFlow(<OfferPanel item={item} />, { route: '/items/lamp', path: '/items/:id' });
  expect(screen.queryByRole('button', { name: 'Buy for $25' })).not.toBeInTheDocument();
  await actor.click(screen.getByRole('link', { name: 'View deal' }));
  expect(currentRoute()).toBe('/deals/offer-1');
});

test('blocks buying an item reserved for another buyer', () => {
  renderFlow(<OfferPanel item={{ ...item, status: 'reserved' }} />);
  expect(screen.getByText(/Reserved for another buyer/)).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('shows a stale-item failure and allows the buyer to retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  createOffer.mockRejectedValueOnce(new Error('reserved'));
  const { actor } = renderFlow(<OfferPanel item={item} />, { route: '/items/lamp', path: '/items/:id' });
  await actor.click(screen.getByRole('button', { name: 'Buy for $25' }));
  expect(await screen.findByRole('alert')).toHaveTextContent("Your offer couldn't be sent");
  expect(currentRoute()).toBe('/items/lamp');
  await actor.click(screen.getByRole('button', { name: 'Buy for $25' }));
  await waitFor(() => expect(currentRoute()).toBe('/deals/new-offer'));
});

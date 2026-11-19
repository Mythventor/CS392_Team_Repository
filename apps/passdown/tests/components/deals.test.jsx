import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { DealDetailPage, DealsPage } from '../../src/pages/DealPages';
import * as actions from '../../src/deals/offers';
import * as live from '../../src/deals/useDeals';
import { currentRoute, deal, item, renderFlow } from './helpers';

vi.mock('../../src/deals/offers', () => ({
  acceptOffer: vi.fn(), cancelOffer: vi.fn(), confirmPickup: vi.fn(),
  declineOffer: vi.fn(), markSold: vi.fn(), proposePickup: vi.fn(), sendMessage: vi.fn(),
}));
vi.mock('../../src/deals/useDeals', () => ({
  useLiveItem: vi.fn(), useMessages: vi.fn(), useMyDeals: vi.fn(),
  useOffer: vi.fn(), useMyOffersForItem: vi.fn(),
}));

beforeEach(() => {
  Object.values(actions).forEach((action) => action.mockReset().mockResolvedValue(undefined));
  live.useOffer.mockReturnValue({ data: deal, loading: false, error: '' });
  live.useLiveItem.mockReturnValue({ data: item, loading: false, error: '' });
  live.useMessages.mockReturnValue({ data: [], loading: false, error: '' });
  live.useMyDeals.mockReturnValue({ data: [deal], loading: false, error: '' });
});

function openDeal(changes = {}, uid = 'sam') {
  live.useOffer.mockReturnValue({ data: { ...deal, ...changes }, loading: false, error: '' });
  return renderFlow(<DealDetailPage />, {
    route: '/deals/offer-1', path: '/deals/:id',
    auth: { user: { uid, displayName: uid === 'sam' ? 'Sam' : 'Alex' } },
  });
}

test('switches buying and selling dashboards and opens a deal', async () => {
  live.useMyDeals.mockReturnValue({ data: [deal, { ...deal, id: 'sale-1', itemTitle: 'Calculator', sellerId: 'alex', buyerId: 'jo', buyerName: 'Jo' }], loading: false, error: '' });
  const { actor } = renderFlow(<DealsPage />, { route: '/deals', path: '/deals' });
  expect(screen.getByRole('heading', { name: 'Desk lamp' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Calculator' })).not.toBeInTheDocument();
  await actor.click(screen.getByRole('tab', { name: /Selling/ }));
  expect(screen.getByRole('tab', { name: /Selling/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('heading', { name: /Needs your answer/ })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Desk lamp' })).not.toBeInTheDocument();
  expect(currentRoute()).toBe('/deals?tab=selling');
  await actor.click(screen.getByRole('link', { name: /Calculator/ }));
  expect(currentRoute()).toBe('/deals/sale-1');
});

test('accepts an offer, then supports completing the sale after the live update', async () => {
  const view = openDeal();
  await view.actor.click(screen.getByRole('button', { name: 'Accept offer' }));
  expect(await screen.findByRole('status')).toHaveTextContent('The item is now reserved for this buyer.');
  expect(actions.acceptOffer).toHaveBeenCalledWith(deal);
  const accepted = { ...deal, status: 'accepted', acceptedAt: 1700000001000 };
  live.useOffer.mockReturnValue({ data: accepted, loading: false, error: '' });
  view.updateAuth({});
  expect(screen.queryByRole('button', { name: 'Accept offer' })).not.toBeInTheDocument();
  actions.markSold.mockResolvedValue(2);
  await view.actor.click(screen.getByRole('button', { name: 'Mark as sold' }));
  expect(await screen.findByRole('status')).toHaveTextContent('2 other offers were declined automatically.');
  expect(actions.markSold).toHaveBeenCalledWith(accepted, 'sam');
});

test('blocks accepting an item that is no longer available', () => {
  live.useLiveItem.mockReturnValue({ data: { ...item, status: 'sold' }, loading: false, error: '' });
  openDeal();
  expect(screen.getByRole('button', { name: 'Accept offer' })).toBeDisabled();
  expect(actions.acceptOffer).not.toHaveBeenCalled();
});

test('lets a seller decline with a reason after confirmation', async () => {
  const { actor } = openDeal();
  await actor.click(screen.getByRole('button', { name: 'Decline', exact: true }));
  expect(actions.declineOffer).not.toHaveBeenCalled();
  await actor.type(screen.getByRole('textbox', { name: /Reason/ }), 'I can accept $23');
  await actor.click(screen.getByRole('button', { name: 'Decline offer' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Offer declined.');
  expect(actions.declineOffer).toHaveBeenCalledWith(deal, 'I can accept $23');
});

test('lets a buyer withdraw an offer only after confirming', async () => {
  const { actor } = openDeal({}, 'alex');
  expect(screen.queryByRole('button', { name: 'Accept offer' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark as sold' })).not.toBeInTheDocument();
  await actor.click(screen.getByRole('button', { name: 'Withdraw offer' }));
  expect(screen.getByText('Withdraw this offer?')).toBeVisible();
  expect(actions.cancelOffer).not.toHaveBeenCalled();
  await actor.click(screen.getByRole('button', { name: 'Keep it' }));
  expect(actions.cancelOffer).not.toHaveBeenCalled();
  await actor.click(screen.getByRole('button', { name: 'Withdraw offer' }));
  await actor.click(screen.getByRole('button', { name: 'Withdraw offer' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Cancelled.');
  expect(actions.cancelOffer).toHaveBeenCalledWith(deal, 'alex');
});

test('validates pickup details and sends a valid proposal', async () => {
  const { actor } = openDeal({ status: 'accepted' }, 'alex');
  const pickup = within(screen.getByRole('region', { name: 'Pickup plan' }));
  await actor.click(pickup.getByRole('button', { name: 'Suggest plan' }));
  expect(pickup.getByRole('textbox', { name: 'Where' })).toBeInvalid();
  expect(actions.proposePickup).not.toHaveBeenCalled();
  await actor.type(pickup.getByRole('textbox', { name: 'Where' }), 'Main library entrance');
  // Set the browser's normalized datetime-local value directly.
  fireEvent.change(pickup.getByLabelText('When'), { target: { value: '2099-06-01T15:00' } });
  await actor.type(pickup.getByRole('textbox', { name: /Note/ }), 'Red jacket');
  await actor.click(pickup.getByRole('button', { name: 'Suggest plan' }));
  await waitFor(() => expect(actions.proposePickup).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'accepted' }), 'alex',
    { place: 'Main library entrance', time: '2099-06-01T15:00', note: 'Red jacket' },
  ));
});

test('lets the other participant confirm a proposed pickup', async () => {
  const pickup = { place: 'Library', time: '2099-06-01T15:00', note: '', proposedBy: 'alex', confirmedBy: null };
  const { actor } = openDeal({ status: 'accepted', pickup });
  await actor.click(screen.getByRole('button', { name: 'Confirm plan' }));
  await waitFor(() => expect(actions.confirmPickup).toHaveBeenCalledWith(expect.objectContaining({ pickup }), 'sam'));
});

test('does not let a buyer confirm their own pickup proposal', () => {
  openDeal({ status: 'accepted', pickup: { place: 'Library', time: '2099-06-01T15:00', proposedBy: 'alex' } }, 'alex');
  expect(screen.getByText('Waiting for Sam to confirm.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Confirm plan' })).not.toBeInTheDocument();
});

test('sends a message, clears the input on success, and refuses whitespace-only messages', async () => {
  const { actor } = openDeal({}, 'alex');
  const input = screen.getByRole('textbox', { name: 'Message to Sam' });
  expect(screen.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await actor.type(input, '   ');
  expect(screen.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await actor.clear(input);
  await actor.type(input, 'Does 3 pm work?');
  await actor.click(screen.getByRole('button', { name: 'Send', exact: true }));
  await waitFor(() => expect(input).toHaveValue(''));
  expect(actions.sendMessage).toHaveBeenCalledWith('offer-1', { uid: 'alex', name: 'Alex', text: 'Does 3 pm work?' });
});

test('keeps an unsent message after failure and supports retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  actions.sendMessage.mockRejectedValueOnce(new Error('offline'));
  const { actor } = openDeal({}, 'alex');
  const input = screen.getByRole('textbox', { name: 'Message to Sam' });
  await actor.type(input, 'Can we meet at the library?');
  await actor.click(screen.getByRole('button', { name: 'Send', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent("Your message wasn't sent");
  expect(input).toHaveValue('Can we meet at the library?');
  await actor.click(screen.getByRole('button', { name: 'Send', exact: true }));
  await waitFor(() => expect(input).toHaveValue(''));
});

test('shows an unavailable-deal error instead of actions or private detail', () => {
  live.useOffer.mockReturnValue({ data: null, loading: false, error: '' });
  renderFlow(<DealDetailPage />, { route: '/deals/missing', path: '/deals/:id' });
  expect(screen.getByRole('alert')).toHaveTextContent("This deal doesn't exist, or it isn't one of yours.");
  expect(screen.queryByRole('button', { name: 'Accept offer' })).not.toBeInTheDocument();
});

import { screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CreateListingPage, EditListingPage } from '../../src/pages/ListingPages';
import { saveListing, watchItem } from '../../src/items/listings';
import { currentRoute, deferred, item, renderFlow } from './helpers';

vi.mock('../../src/items/listings', () => ({
  saveListing: vi.fn(), watchItem: vi.fn(), watchMyItems: vi.fn(), archiveListing: vi.fn(),
}));
vi.mock('../../src/deals/offers', () => ({ createOffer: vi.fn() }));
vi.mock('../../src/deals/useDeals', () => ({ useMyOffersForItem: vi.fn() }));

beforeEach(() => {
  saveListing.mockReset();
  watchItem.mockImplementation((id, next) => { next({ ...item, id, ownerId: 'alex' }); return vi.fn(); });
});

async function completeListing(actor) {
  const photo = new File(['photo'], 'lamp.png', { type: 'image/png' });
  await actor.upload(screen.getByLabelText('Item photo'), photo);
  await actor.type(screen.getByRole('textbox', { name: 'Title', exact: true }), 'Desk lamp');
  await actor.type(screen.getByRole('textbox', { name: 'Description' }), 'Adjustable study lamp');
  await actor.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'dorm');
  await actor.type(screen.getByRole('textbox', { name: 'General pickup area' }), 'Main library');
  await actor.type(screen.getByRole('textbox', { name: 'Price in dollars' }), '25');
  return photo;
}

test('requires sign-in before creating a listing and keeps the intended destination', async () => {
  renderFlow(<CreateListingPage />, { route: '/list', path: '/list', auth: { user: null } });
  await waitFor(() => expect(currentRoute()).toBe('/signin?next=%2Flist'));
  expect(saveListing).not.toHaveBeenCalled();
});

test('shows accessible field errors and does not submit an incomplete listing', async () => {
  const { actor } = renderFlow(<CreateListingPage />);
  await actor.click(screen.getByRole('button', { name: 'Publish listing' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please check the highlighted fields.');
  expect(screen.getByRole('textbox', { name: 'Title', exact: true })).toBeInvalid();
  expect(screen.getByLabelText('Item photo')).toHaveAccessibleDescription('Add a photo of your item.');
  expect(saveListing).not.toHaveBeenCalled();
});

test('publishes a photo listing and navigates to its detail screen', async () => {
  saveListing.mockResolvedValue('new-lamp');
  const { actor, session } = renderFlow(<CreateListingPage />, { route: '/list', path: '/list' });
  const photo = await completeListing(actor);
  expect(screen.getByRole('img', { name: 'Your item preview' })).toBeVisible();
  await actor.click(screen.getByRole('button', { name: 'Publish listing' }));
  await waitFor(() => expect(currentRoute()).toBe('/items/new-lamp'));
  expect(saveListing).toHaveBeenCalledWith({
    item: undefined, file: photo, user: session.user, profile: session.profile,
    values: { title: 'Desk lamp', description: 'Adjustable study lamp', category: 'dorm',
      condition: 'Good', school: 'northwestern', pickupArea: 'Main library', price: '25', availableTo: '' },
  });
});

test('blocks repeat submissions while a listing is saving', async () => {
  const request = deferred();
  saveListing.mockReturnValue(request.promise);
  const { actor } = renderFlow(<CreateListingPage />, { route: '/list', path: '/list' });
  await completeListing(actor);
  await actor.click(screen.getByRole('button', { name: 'Publish listing' }));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'Title', exact: true })).toBeDisabled();
  await actor.click(screen.getByRole('button', { name: 'Saving…' }));
  expect(saveListing).toHaveBeenCalledTimes(1);
  request.resolve('new-lamp');
  await waitFor(() => expect(currentRoute()).toBe('/items/new-lamp'));
});

test('preserves a listing after an upload failure so the seller can retry', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  saveListing.mockRejectedValueOnce({ code: 'photo/upload', message: 'Photo upload interrupted.' }).mockResolvedValueOnce('new-lamp');
  const { actor } = renderFlow(<CreateListingPage />, { route: '/list', path: '/list' });
  await completeListing(actor);
  await actor.click(screen.getByRole('button', { name: 'Publish listing' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Photo upload interrupted.');
  expect(screen.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Desk lamp');
  expect(screen.getByRole('img', { name: 'Your item preview' })).toBeVisible();
  await actor.click(screen.getByRole('button', { name: 'Publish listing' }));
  await waitFor(() => expect(currentRoute()).toBe('/items/new-lamp'));
});

test('edits an owned listing using its existing photo', async () => {
  saveListing.mockResolvedValue('lamp');
  const { actor } = renderFlow(<EditListingPage />, { route: '/items/lamp/edit', path: '/items/:id/edit' });
  await screen.findByRole('heading', { name: 'Edit your listing' });
  const price = screen.getByRole('textbox', { name: 'Price in dollars' });
  await actor.clear(price);
  await actor.type(price, '0');
  await actor.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(currentRoute()).toBe('/items/lamp'));
  expect(saveListing).toHaveBeenCalledWith(expect.objectContaining({
    item: expect.objectContaining({ id: 'lamp', ownerId: 'alex' }), file: null,
    values: expect.objectContaining({ price: '0' }),
  }));
});

test('prevents editing another student’s listing', async () => {
  watchItem.mockImplementation((id, next) => { next(item); return vi.fn(); });
  renderFlow(<EditListingPage />, { route: '/items/lamp/edit', path: '/items/:id/edit' });
  expect(await screen.findByRole('heading', { name: 'This listing belongs to another student.' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  expect(saveListing).not.toHaveBeenCalled();
});

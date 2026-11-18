import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../../src/auth/useAuth';

export const user = { uid: 'alex', displayName: 'Alex', email: 'alex@example.test' };
export const profile = { displayName: 'Alex', school: 'northwestern', bio: '' };
export const item = {
  id: 'lamp', title: 'Desk lamp', description: 'Adjustable study lamp',
  price: 25, category: 'dorm', school: 'northwestern', condition: 'Good',
  pickupArea: 'Main library', ownerId: 'sam', ownerName: 'Sam', status: 'available',
  photoURL: 'https://example.test/lamp.jpg',
};
export const deal = {
  id: 'offer-1', itemId: item.id, itemTitle: item.title,
  sellerId: 'sam', sellerName: 'Sam', buyerId: user.uid, buyerName: 'Alex',
  listPrice: 25, offerPrice: 20, status: 'pending', createdAt: 1700000000000,
};

function LocationProbe() {
  const location = useLocation();
  return <div role="note" aria-label="Current route">{location.pathname}{location.search}</div>;
}

export function renderFlow(ui, { route = '/', path = '*', auth = {} } = {}) {
  let session = {
    user, profile, loading: false, error: '', signIn: vi.fn(),
    signOut: vi.fn(), saveProfile: vi.fn(), ...auth,
  };
  function tree() {
    return (
      <AuthContext.Provider value={session}>
        <MemoryRouter initialEntries={[route]}>
          <LocationProbe />
          <Routes>
            <Route path={path} element={ui} />
            {path !== '*' && <Route path="*" element={<p>Destination reached</p>} />}
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
  }
  const view = render(tree());
  return {
    ...view, session, actor: userEvent.setup(),
    updateAuth(changes) {
      session = { ...session, ...changes };
      view.rerender(tree());
    },
  };
}

export function currentRoute() {
  return screen.getByLabelText('Current route').textContent;
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

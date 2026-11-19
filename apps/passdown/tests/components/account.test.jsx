import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SignInPage } from '../../src/pages/SignInPage';
import { ProfilePage } from '../../src/pages/ProfilePage';
import { currentRoute, deferred, renderFlow } from './helpers';

describe('sign-in and profile', () => {
  test('starts Google sign-in, prevents duplicate clicks, and returns to the requested screen', async () => {
    const request = deferred();
    const signIn = vi.fn(() => request.promise);
    const view = renderFlow(<SignInPage />, {
      route: '/signin?next=%2Flist', path: '/signin', auth: { user: null, signIn },
    });
    await view.actor.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    await act(async () => { request.resolve(); await request.promise; });
    view.updateAuth({ user: { uid: 'alex' } });
    await waitFor(() => expect(currentRoute()).toBe('/list'));
  });

  test('never redirects a signed-in user to an external next URL', async () => {
    renderFlow(<SignInPage />, { route: '/signin?next=https%3A%2F%2Fevil.test', path: '/signin' });
    await waitFor(() => expect(currentRoute()).toBe('/'));
  });

  test('shows a sign-in failure and lets the user retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const signIn = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce();
    const { actor } = renderFlow(<SignInPage />, { auth: { user: null, signIn } });
    await actor.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't sign you in");
    await actor.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('does not show an error when the user closes the sign-in popup', async () => {
    const signIn = vi.fn().mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    const { actor } = renderFlow(<SignInPage />, { auth: { user: null, signIn } });
    await actor.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('sends a signed-out profile visitor to sign-in with a return path', async () => {
    renderFlow(<ProfilePage />, { route: '/profile', path: '/profile', auth: { user: null } });
    await waitFor(() => expect(currentRoute()).toBe('/signin?next=%2Fprofile'));
  });

  test('validates profile edits, saves them, and supports sign-out', async () => {
    const { actor, session } = renderFlow(<ProfilePage />);
    await actor.clear(screen.getByRole('textbox', { name: 'Name', exact: true }));
    await actor.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('textbox', { name: 'Name', exact: true })).toBeInvalid();
    expect(session.saveProfile).not.toHaveBeenCalled();
    await actor.type(screen.getByRole('textbox', { name: 'Name', exact: true }), 'Alex Chen');
    await actor.selectOptions(screen.getByRole('combobox', { name: 'School' }), 'depaul');
    await actor.type(screen.getByRole('textbox', { name: /Bio/ }), 'Moving out soon');
    await actor.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your profile is saved.');
    expect(session.saveProfile).toHaveBeenCalledWith({ displayName: 'Alex Chen', school: 'depaul', bio: 'Moving out soon' });
    await actor.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(session.signOut).toHaveBeenCalledTimes(1);
  });

  test('retains profile edits after a save fails and allows retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const saveProfile = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce();
    const { actor } = renderFlow(<ProfilePage />, { auth: { saveProfile } });
    await actor.type(screen.getByRole('textbox', { name: /Bio/ }), 'Selling books');
    await actor.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save your changes");
    expect(screen.getByRole('textbox', { name: /Bio/ })).toHaveValue('Selling books');
    await actor.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your profile is saved.');
  });
});

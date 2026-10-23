import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../../src/screens/LoginScreen';
import { ProfileScreen } from '../../src/screens/ProfileScreen';
import { useApp } from '../../src/context/AppContext';
import { confirmAction } from '../../src/utils/confirmAction';

jest.mock('../../src/context/AppContext', () => ({ useApp: jest.fn() }));
jest.mock('../../src/utils/confirmAction', () => ({ confirmAction: jest.fn() }));

let app;
beforeEach(() => {
  app = { login: jest.fn().mockResolvedValue(), logout: jest.fn().mockResolvedValue(), refreshData: jest.fn().mockResolvedValue(), currentUser: 'operator', sessionMessage: '' };
  useApp.mockReturnValue(app);
});

test('login validates empty credentials before making a request', async () => {
  await render(<LoginScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByText('Enter your username.')).toBeOnTheScreen();
  expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
  expect(app.login).not.toHaveBeenCalled();
});

test('login submits credentials and shows backend authentication errors', async () => {
  app.login.mockRejectedValue({ response: { data: { error: 'Invalid username or password' } } });
  await render(<LoginScreen />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Username'), 'operator');
  await user.type(screen.getByLabelText('Password'), 'wrong');
  await user.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(app.login).toHaveBeenCalledWith('operator', 'wrong');
  expect(await screen.findByText('Invalid username or password')).toBeOnTheScreen();
});

test('profile refreshes records and sign-out requires confirmation', async () => {
  await render(<ProfileScreen />);
  await userEvent.press(screen.getByRole('button', { name: 'Refresh records' }));
  await waitFor(() => expect(app.refreshData).toHaveBeenCalledTimes(1));
  expect(app.logout).not.toHaveBeenCalled();
  await userEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sign out?' }));
  expect(app.logout).not.toHaveBeenCalled();
});

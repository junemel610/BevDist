import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { FeedbackToast } from '../../src/components/FeedbackToast';

test('stock notifications announce the message and expose View stock and dismiss actions', async () => {
  const onDismiss = jest.fn(), onViewStock = jest.fn();
  await render(<FeedbackToast message="Cola A: 0.5 cases left" onDismiss={onDismiss} onViewStock={onViewStock} />);
  expect(screen.getByRole('alert')).toBeOnTheScreen();
  expect(screen.getByText('Cola A: 0.5 cases left')).toBeOnTheScreen();
  await userEvent.press(screen.getByRole('button', { name: 'View stock' }));
  await userEvent.press(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(onViewStock).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('empty feedback does not render an announcement or action', async () => {
  await render(<FeedbackToast message="" onDismiss={jest.fn()} />);
  expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
});

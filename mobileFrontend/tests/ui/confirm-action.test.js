import { Alert, Platform } from 'react-native';
import { confirmAction } from '../../src/utils/confirmAction';

afterEach(() => { jest.restoreAllMocks(); delete globalThis.confirm; delete globalThis.alert; });

test('native destructive actions run only when the confirmation button is chosen', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const onConfirm = jest.fn();
  confirmAction({ title: 'Delete?', message: 'Archive product', destructive: true, onConfirm });
  const buttons = alert.mock.calls[0][2];
  expect(buttons[0]).toEqual({ text: 'Go back', style: 'cancel' });
  expect(buttons[1].style).toBe('destructive');
  expect(onConfirm).not.toHaveBeenCalled();
  await buttons[1].onPress();
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('native save failures display the safe API error', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  confirmAction({ title: 'Save?', message: '', onConfirm: async () => { throw { response: { data: { error: 'Stock changed. Refresh records.' } } }; } });
  await alert.mock.calls[0][2][1].onPress();
  expect(alert).toHaveBeenLastCalledWith('Could not save', 'Stock changed. Refresh records.');
});

test('web cancellation and missing confirmation support never submit a change', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const onConfirm = jest.fn();
  globalThis.confirm = jest.fn(() => false);
  confirmAction({ title: 'Save?', message: '', onConfirm });
  delete globalThis.confirm;
  confirmAction({ title: 'Save?', message: '', onConfirm });
  expect(onConfirm).not.toHaveBeenCalled();
});

test('web confirmation runs once and reports rejected saves', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  globalThis.confirm = jest.fn(() => true);
  globalThis.alert = jest.fn();
  const onConfirm = jest.fn().mockRejectedValue(new Error('Offline'));
  confirmAction({ title: 'Save?', message: '', onConfirm });
  await Promise.resolve();
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(globalThis.alert).toHaveBeenCalledWith('Offline');
});

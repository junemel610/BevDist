jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000001') }));
// Chart drawing is mocked here; Node tests exercise chart geometry and totals.
jest.mock('../../src/components/dashboard/SalesChart', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { SalesChart: ({ title }) => React.createElement(Text, null, title) };
});

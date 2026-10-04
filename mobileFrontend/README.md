# BevDist POS — Mobile Frontend

React Native mobile application for the Jojo's Coke Beverage Distribution POS system, built with Expo.

## Setup

```bash
npm install
npm start
```

Then press:
- `i` to open iOS simulator
- `a` to open Android emulator
- `w` to open web preview

## Project Structure

```
src/
├── api/              # API service layer (axios client + endpoints)
├── context/          # React Context for global state
├── screens/          # Screen components (Dashboard, Orders, etc.)
├── components/       # Reusable UI components
├── types/            # TypeScript types and constants
└── hooks/            # Custom React hooks
```

## Development

Follow the `bevdist-stack` skill in the parent `.claude/skills/` directory for guidance on:
- Component patterns
- API integration
- State management
- Error handling

## Environment

Create a `.env` file in the root:

```
EXPO_PUBLIC_API_URL=http://localhost:5000
```

Or use Expo's `.env.local` for sensitive values.

# Hooks

This directory contains custom React hooks to encapsulate and reuse stateful logic across different components.

## useLocalStorage.ts

The `useLocalStorage` hook provides a `useState`-like interface that automatically persists its state to the browser's `localStorage`. This is crucial for remembering user settings, session data, and preferences between visits.

### Features:

- **Persistence**: State is saved to `localStorage` whenever it changes and is rehydrated when the component mounts.
- **Type Safety**: It is a generic hook that works with any JSON-serializable type.
- **SSR Safe**: It checks for the existence of the `window` object, preventing crashes in server-side rendering environments.
- **Identical API**: It returns a state value and a setter function, just like `useState`, making it a seamless replacement for local state that needs to be persisted.

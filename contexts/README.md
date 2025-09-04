# Contexts

This directory holds React Context providers for managing global state across the application.

## AppContext.tsx

`AppContext` is the primary global state manager for the application. It provides a single, centralized place to manage and access shared data, preventing the need for "prop drilling" (passing props down through many levels of components).

### State Provided:

- **`activeView`**: The currently displayed main view (e.g., Tutor, Planner).
- **`activeSubject`**: The subject selected in the 'Subjects' view.
- **`isSettingsOpen`**: A boolean to control the visibility of the settings modal.
- **`theme`**: The current visual theme of the application.
- **`profile`**: User profile information.
- **`apiKeys`**: User-provided API keys for services like Gemini and OpenAI.

All state managed by `AppContext` is persisted to `localStorage` via the `useLocalStorage` hook to maintain user preferences and settings across sessions.

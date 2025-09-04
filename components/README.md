# Components

This directory contains all the React components that make up the user interface of the EASYWAY Tutor application.

## Structure

- **Root Components**: Major UI views like `ChatInterface.tsx`, `TopicExplainer.tsx`, etc., are at the top level. These represent the main features of the application.
- **/common**: Contains reusable, generic components like `Card.tsx`, `LoadingSpinner.tsx`, and `Marquee.tsx` that are used across multiple features.
- **/icons**: A collection of SVG icon components used throughout the app for a consistent visual language.
- **/layout**: Components responsible for the main application layout, such as the `Header.tsx`, `Sidebar.tsx`, and `UserProfile.tsx`.
- **/planner**: Components specific to the Study Planner feature.
- **/subjects**: Components for the Subjects view, including subject-specific chat and tests.

## State Management

Components primarily manage their own local UI state using `useState` and `useRef`. For global state (like the active view, API keys, and theme), they connect to the `AppContext` via the `useAppContext` hook, ensuring a clean and centralized state management pattern.

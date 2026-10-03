# Navigation & Modal Back Interceptor Standards

## Core Requirement
Every AI agent and engineer creating, editing, or refactoring pages, sub-views, or modals on the Catavor platform must adhere to the following rules without exception:

### 1. Smart Back on Navigation ("Kembali" Button)
- **Do not hardcode destinations** on Back buttons (e.g., avoid `setActiveTab('overview')`, `navigate('/')`).
- Always use `smartBack(fallbackUrl)`:
  - If internal history exists (`window.history.length > 1` and within same origin), invoke `window.history.back()`.
  - Fallback strictly to the semantic parent URL/view if opened directly.

### 2. Modal Back Gesture Interception
- Every Modal, Dialog, Bottom Sheet, or Drawer component MUST register with the back-stack interceptor when opened.
- Hardware back, browser back, and swipe-back gestures MUST close the active modal instead of leaving the page.
- Nested modals must close according to LIFO order.
- Closing via UI button (✕ / backdrop) must cleanly pop the modal's history entry.

# Catavor Platform Engineering Standards & Guidelines

This document defines the core architecture, navigation principles, and engineering standards for the Catavor platform (Desktop & Mobile). All agents and developers working on this codebase must adhere strictly to these rules.

---

## 1. Smart Back Navigation & History Stack Standard (MANDATORY)

### Rule: Never Hardcode Back Button Destinations
When implementing or modifying any view, page, sub-menu, or dialog that contains a **"Kembali" / "Back"** button or gesture navigation:
1. **Never hardcode static destinations** (e.g. DO NOT do `onClick={() => setActiveTab('overview')}` or `onClick={() => navigate('/admin')}`). Hardcoding breaks the user's actual navigation journey when coming from search, sub-tabs, or filtered views.
2. **Use the Smart Back Navigation pattern**:
   - Check if there is valid internal history (`window.history.length > 1` within the same origin).
   - If history exists, execute `window.history.back()`.
   - If the user reached the page directly (e.g. direct link, WhatsApp share, page reload), fall back to the **Semantic Parent**:
     - *Product Edit Form* $\rightarrow$ Product Management list (`/admin?tab=products`)
     - *Helpdesk Ticket Detail* $\rightarrow$ Helpdesk Ticket List (`/admin/help`)
     - *Store Settings Sub-tab* $\rightarrow$ Store Dashboard (`/admin`)
     - *Public Product Detail* $\rightarrow$ Storefront Catalog (`/:slug`)

---

## 2. Modal, Drawer, & Sheet Back Interceptor (MANDATORY)

### Rule: Back Action While a Modal is Open MUST Close the Modal
When any Modal, Bottom Sheet, Drawer, or Dialog is open (in Desktop or Mobile):
1. **Intercept Hardware, Browser, & Gesture Back**:
   - The user pressing the browser Back button, Android hardware Back button, or executing a mobile swipe-back gesture **MUST close the topmost open modal/drawer**.
   - It **MUST NOT** navigate away from the page or unmount the parent view.
2. **LIFO (Last-In, First-Out) for Nested Overlays**:
   - If Modal A opens Modal B (e.g., Product Form opens Image Picker):
     - 1st Back: closes Modal B (Image Picker).
     - 2nd Back: closes Modal A (Product Form).
     - 3rd Back: navigates back to previous page/tab.
3. **Clean Up on Direct Close**:
   - When a user closes the modal via the UI (e.g., clicking "✕", "Batal", or backdrop), the dummy history entry must be safely popped (`window.history.back()`) without triggering duplicate close callbacks or breaking the stack.
4. **Standard Utility**:
   - Use `useModalBackHandler` or `setupModalBackInterceptor` located in `src/utils/navigation.ts`.

---

## 3. URL State Synchronization for Tabs & Filters
- Tab switches in Admin Panel and Platform Role Portal should reflect in URL search params (e.g., `?tab=finance&sub=reports`).
- Use `window.history.pushState` on significant sub-view transitions so that native browser back returns to the prior view rather than exiting the admin interface.

---

## 4. Multi-Tenant & Safe Storage Deletion Standards
- Merchant media files are isolated under `public/storage/stores/<storeID>/`.
- Deleting an entity or removing photos must hard-delete physical files from disk (`os.Remove` of file and `.fiber.gz`) if not referenced by other active records.
- `storage_used_bytes` must be recalculated or synchronized immediately upon file addition/deletion.

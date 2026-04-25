# Customer App AI Guide

## Purpose

This is the customer-facing VasBazaar web/mobile app. It supports recharge, bill payment, wallet, KYC, complaints, coupons, notifications, travel, QR sticker, chatbot, and callback flows.

## Stack

- React 19
- Create React App (`react-scripts`)
- React Router 7
- Capacitor 8
- Axios
- PWA/service worker support

## Main Folders

| Path | Use |
| --- | --- |
| `src/App.js` | App entry and provider composition |
| `src/index.js` | React bootstrap |
| `src/customer/CustomerModernRoutes.jsx` | Customer route definitions |
| `src/customer/pages/` | Screen-level pages |
| `src/customer/components/` | Shared customer components |
| `src/customer/context/` | Customer, theme, toast, chatbot state |
| `src/customer/services/` | API and platform service layer |
| `src/customer/utils/` | Customer utilities |
| `src/customer/theme.js` | Customer theme tokens |
| `src/customer/customerModern.css` | Main customer styling |
| `api/` | Vercel callback handlers |
| `public/sw.js` | Service worker |

## Patterns

- Add customer screens in `src/customer/pages/`.
- Register or change routes in `src/customer/CustomerModernRoutes.jsx`.
- Add API calls in the matching `src/customer/services/*Service.js` file.
- Use `src/customer/services/apiClient.js` for HTTP behavior.
- Use `storageService.js` for persistent app/customer state.
- Keep UI styling aligned with `theme.js` and `customerModern.css`.
- Use existing guards/components such as `AuthGuard`, `AppLockGuard`, `ProtectedShell`, `DataState`, and `ErrorBoundary`.

## Commands

```bash
npm start
npm run build
npm test
```

## Avoid

- Do not read or edit `node_modules/`.
- Do not open `keystore/` or password/certificate files.
- Do not modify `package-lock.json` unless dependency changes require it.
- Do not edit generated Android/iOS Capacitor output unless the request is platform-build specific.


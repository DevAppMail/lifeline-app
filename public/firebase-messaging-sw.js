// ── Firebase Cloud Messaging Service Worker ─────────────────────────
// Phase 2 — Stub for push notification handling.
// When FCM is integrated:
//   importScripts('https://www.gstatic.com/firebasejs/10.x/firebase-app-compat.js');
//   importScripts('https://www.gstatic.com/firebasejs/10.x/firebase-messaging-compat.js');
//
//   firebase.initializeApp({ messagingSenderId: "..." });
//   const messaging = firebase.messaging();
//
//   messaging.onBackgroundMessage((payload) => {
//     self.registration.showNotification(payload.notification.title, {
//       body: payload.notification.body,
//       icon: "/favicon.svg",
//       data: payload.data,
//     });
//   });

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());

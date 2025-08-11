# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Backend API

A minimal Express + SQLite API is included under `server/`.

- Start API: `npm run server`
- Default port: 8080
- Demo users are seeded on first start:
  - admin@clinic.local / admin12345 (admin)
  - doctor@clinic.local / doctor12345 (doctor)
  - receptionist@clinic.local / receptionist123 (receptionist)
  - patient@clinic.local / patient12345 (patient)

Frontend expects the API mounted under `/api/*` at the same origin. If you run the frontend dev server, add a Vite proxy.

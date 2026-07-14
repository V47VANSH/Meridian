# Meridian — Apartment Complex Management System (Frontend)

Frontend-only UI for Milestone 2. Built with **React 18 + TypeScript + Vite + Tailwind CSS + React Router**, matching the team's Frontend Architecture doc. There is **no backend integration** — all data comes from a mock layer at `src/api/mockData.ts`, and "login" is a role switcher (`src/store/authStore.ts`) so every role's pages can be reviewed without a server.

## Requirements
- Node.js 18+ and npm

## Install & Run

```bash
cd frontend
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

To create a production build:
```bash
npm run build
npm run preview
```

## Using the app
There's no real authentication yet. On the **Sign In** page, enter any email/password and pick a role from the **"Sign in as (demo role switch)"** dropdown — this logs you into that role's dashboard and sidebar. Each role only sees its own routes (route guards redirect otherwise).

Roles available: Resident / Flat Owner, Society Official, Non-Resident Owner, Security Guard, Maintenance/Cleaning Staff.

## Adding your own logo
A placeholder `logo.svg` (orange square) is used everywhere the logo appears. Replace these **two files** with your own artwork (keep the same filename so nothing else needs to change):

- `frontend/src/assets/logo.svg` — used in the sidebar, login, and register pages
- `frontend/public/logo.svg` — used as the browser favicon

## Project structure
```
frontend/
  src/
    app/App.tsx          # router, role-based routes
    api/mockData.ts       # mock data standing in for the future API client
    store/authStore.ts    # mock auth (role switch), Zustand
    lib/constants.ts      # role types, labels, home routes
    lib/nav.ts             # per-role sidebar navigation
    components/            # shared UI: AppShell, PageHeader, StatusBadge, etc.
    features/
      auth/                 # login, register
      dashboard/            # resident/official/non-resident dashboards, directory, property status
      maintenance/          # invoices, pay now, payment history, invoice management
      complaints/           # raise, list + status timeline, triage queue
      bookings/             # facility calendar, my bookings, schedule management
      visitors/             # guest pass generate/history, SOS button, SOS inbox, verify pass
      announcements/        # feed, composer
      staff/                 # assigned tasks
    styles/index.css        # Tailwind + the blueprint/architectural design tokens
```

## Design direction
Dark navy "blueprint" theme with a single orange accent (`#FFA200`, matching the product logo) — drafting-paper grid backdrop, dimension-line dividers, and corner-tick card details, since the product manages a physical building.

## Notes for Milestone 2 report
- This covers the **Design of Components / UI pages** deliverable only.
- Class diagram, database design, sprint schedule, Gantt chart, and scrum meeting minutes are separate deliverables — ask if you'd like help with those next.
- No backend calls are made anywhere in this code; every "submit" or "pay" action simulates a result locally so the flow can be demoed and screenshotted.

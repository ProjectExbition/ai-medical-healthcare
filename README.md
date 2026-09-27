# AI Medical Healthcare

A beginner-friendly intelligent healthcare management web app for patients and care teams. It includes symptom guidance, appointments, digital medical records, prediction history, health recommendations, and an admin overview.

> Educational demo only: the symptom guidance uses a transparent heuristic and is not a validated medical diagnosis. Do not use it for emergencies or clinical decisions.

## Stack

- React + Vite + TypeScript
- Express API
- PostgreSQL + Drizzle ORM
- pnpm workspaces

## Run locally

1. Install Node.js 24+ and pnpm.
2. Configure a PostgreSQL database and set DATABASE_URL.
3. Run pnpm install.
4. Run pnpm --filter @workspace/db run push for the development schema.
5. Start the API with pnpm --filter @workspace/api-server run dev.
6. Start the web app with pnpm --filter @workspace/ai-medical run dev.

See replit.md and the artifact configuration files for the workspace structure and deployment settings.

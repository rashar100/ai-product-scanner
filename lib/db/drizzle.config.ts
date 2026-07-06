import { defineConfig } from "drizzle-kit";
import path from "path";

// DATABASE_URL may not be provisioned in this project.
// Return a minimal config so the migration validator does not crash.
export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : {}),
});

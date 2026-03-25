import { config } from "dotenv";
config();

export const PORT = process.env.PORT || 3200;
export const VAULT_KEY = process.env.VAULT_KEY;
export const NODE_ENV = process.env.NODE_ENV || "development";

if (!VAULT_KEY) {
  console.error("VAULT_KEY environment variable is required");
  process.exit(1);
}

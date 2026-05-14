import { getSetting } from "./appSettingsRepo.server";

export const SINTEGRAWS_TOKEN_KEY = "sintegraws.token";

export async function getSintegrawsToken(): Promise<string | null> {
  const fromDb = await getSetting(SINTEGRAWS_TOKEN_KEY);
  if (fromDb && fromDb.trim()) return fromDb.trim();
  const fromEnv = process.env.SINTEGRAWS_TOKEN;
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : null;
}
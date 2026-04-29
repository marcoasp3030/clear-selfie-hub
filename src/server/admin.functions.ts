import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  assertAdminAccess,
  checkIsAdminByAccessToken,
  deleteRegistrationById,
  getPhotoSignedUrlForPath,
  getRegistrationStatsData,
  listRegistrationRows,
} from "./admin.server";

const accessTokenSchema = z.string().trim().min(1);

export { assertAdminAccess } from "./admin.server";

export const listRegistrations = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; search?: string; limit?: number; offset?: number }) => {
      const parsed = z
        .object({
          accessToken: accessTokenSchema,
          search: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .parse(input);

      return {
        accessToken: parsed.accessToken,
        search: parsed.search?.trim() || "",
        limit: Math.min(Math.max(parsed.limit ?? 50, 1), 200),
        offset: Math.max(parsed.offset ?? 0, 0),
      };
    }
  )
  .handler(async ({ data }) => {
    return listRegistrationRows(data);
  });

export const getRegistrationStats = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data }) => {
    return getRegistrationStatsData(data.accessToken);
  });

export const getPhotoSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; path: string }) =>
    z
      .object({
        accessToken: accessTokenSchema,
        path: z.string().trim().min(1).max(512),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    return getPhotoSignedUrlForPath(data.accessToken, data.path);
  });

export const deleteRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; id: string }) =>
    z
      .object({
        accessToken: accessTokenSchema,
        id: z.string().uuid(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    return deleteRegistrationById(data.accessToken, data.id);
  });

export const checkAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input)
  )
  .handler(async ({ data: payload }) => {
    return { isAdmin: await checkIsAdminByAccessToken(payload.accessToken) };
  });

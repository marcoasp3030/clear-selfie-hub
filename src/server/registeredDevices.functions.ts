import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminAccess } from "./admin.server";
import {
  listRegisteredDeviceGroups,
  deleteRegistrationsForDevice,
} from "./registeredDevices.server";

const accessTokenSchema = z.string().trim().min(1);

export const listRegisteredDevices = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) =>
    z.object({ accessToken: accessTokenSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const devices = await listRegisteredDeviceGroups();
    return { devices };
  });

export const releaseRegisteredDevice = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      accessToken: string;
      deviceFingerprint: string;
      deviceId: string | null;
    }) =>
      z
        .object({
          accessToken: accessTokenSchema,
          deviceFingerprint: z.string().trim().min(1),
          deviceId: z.string().trim().min(1).nullable(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    await assertAdminAccess(data.accessToken);
    const result = await deleteRegistrationsForDevice(
      data.deviceFingerprint,
      data.deviceId,
    );
    return { success: true as const, ...result };
  });

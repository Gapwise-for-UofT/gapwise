import { DEFAULT_GAP_PREFERENCES } from "@/features/gaps/preferences";
import { deriveAvailabilityCapsule } from "@/features/security/availability-capsule";
import { CRYPTO_VERSION, KEY_VERSION } from "@/features/security/crypto-context";
import { generateDataEncryptionKey } from "@/features/security/envelope-crypto";
import {
  openPrivateData,
  sealAvailabilityCapsule,
  sealPrivateData,
} from "@/features/security/local-records";
import { createPrivateDataPayload } from "@/features/security/private-data";
import type { StoredDataKeys } from "@/features/security/security-store";
import { securityStore } from "@/features/sync/encrypted-sync-service";
import { DEFAULT_USER_PREFERENCES } from "@/features/sync/preferences";
import type { Meeting } from "@/lib/timetable-types";
import { activeUniversity } from "@/universities/registry";

function guestDeviceId(): string {
  const universityId = activeUniversity()?.id ?? "uoft";
  return universityId === "uoft" ? "gapwise-guest-device" : `gapwise-guest-device:${universityId}`;
}
let guestWriteQueue: Promise<unknown> = Promise.resolve();

function enqueueGuestWrite(action: () => Promise<void>): Promise<void> {
  const next = guestWriteQueue.catch(() => undefined).then(action);
  guestWriteQueue = next;
  return next;
}

function validGuestKeys(value: StoredDataKeys | null): value is StoredDataKeys {
  return Boolean(
    value &&
    value.userId === guestDeviceId() &&
    value.cryptoVersion === CRYPTO_VERSION &&
    value.privateData.keyVersion === KEY_VERSION &&
    value.privateData.key.type === "secret" &&
    !value.privateData.key.extractable &&
    value.friendAvailability.keyVersion === KEY_VERSION &&
    value.friendAvailability.key.type === "secret" &&
    !value.friendAvailability.key.extractable,
  );
}

async function guestKeys(): Promise<StoredDataKeys> {
  const selection = await securityStore();
  if (!selection.persistent)
    throw new Error("Secure device storage is unavailable in this browser.");
  const current = await selection.store.getDataKeys(guestDeviceId());
  if (validGuestKeys(current)) return current;

  const [privateDataKey, availabilityKey] = await Promise.all([
    generateDataEncryptionKey(),
    generateDataEncryptionKey(),
  ]);
  const keys: StoredDataKeys = {
    userId: guestDeviceId(),
    cryptoVersion: CRYPTO_VERSION,
    subjectId: crypto.randomUUID(),
    cloudSyncEnabled: false,
    privateData: {
      keyId: crypto.randomUUID(),
      keyVersion: KEY_VERSION,
      key: privateDataKey,
    },
    friendAvailability: {
      keyId: crypto.randomUUID(),
      keyVersion: KEY_VERSION,
      key: availabilityKey,
    },
    createdAt: new Date().toISOString(),
  };
  await selection.store.putDataKeys(keys);
  return keys;
}

export type GuestTimetableRestoration = {
  remember: boolean;
  meetings: Meeting[] | null;
  updatedAt: string | null;
};

export async function loadGuestTimetable(): Promise<GuestTimetableRestoration> {
  const selection = await securityStore();
  if (!selection.persistent) return { remember: false, meetings: null, updatedAt: null };
  const [keys, record] = await Promise.all([
    selection.store.getDataKeys(guestDeviceId()),
    selection.store.getPrivateRecord(guestDeviceId()),
  ]);
  if (!validGuestKeys(keys)) {
    if (keys || record) await selection.store.clearUser(guestDeviceId());
    return { remember: false, meetings: null, updatedAt: null };
  }
  if (!record) return { remember: true, meetings: null, updatedAt: null };
  try {
    const payload = await openPrivateData(keys, record);
    return { remember: true, meetings: payload.schedule, updatedAt: record.updatedAt };
  } catch {
    await selection.store.clearUser(guestDeviceId());
    return { remember: false, meetings: null, updatedAt: null };
  }
}

export function saveGuestTimetable(meetings: Meeting[] | null): Promise<void> {
  return enqueueGuestWrite(async () => {
    const keys = await guestKeys();
    if (!meetings) return;
    const timetableMeetings = meetings.filter(
      (meeting) => meeting.sectionCode !== "STUDY" && meeting.sectionCode !== "PERSONAL",
    );
    const selection = await securityStore();
    const [previousPrivate, previousCapsule] = await Promise.all([
      selection.store.getPrivateRecord(guestDeviceId()),
      selection.store.getCapsuleRecord(guestDeviceId()),
    ]);
    const updatedAt = new Date().toISOString();
    const payload = createPrivateDataPayload({
      schedule: timetableMeetings,
      personalItems: [],
      preferences: DEFAULT_USER_PREFERENCES,
      gapPreferences: DEFAULT_GAP_PREFERENCES,
    });
    const [privateRecord, capsuleRecord] = await Promise.all([
      sealPrivateData({
        userId: guestDeviceId(),
        keys,
        payload,
        revision: (previousPrivate?.revision ?? 0) + 1,
        ...(previousPrivate ? { recordId: previousPrivate.recordId } : {}),
        updatedAt,
      }),
      sealAvailabilityCapsule({
        userId: guestDeviceId(),
        keys,
        capsule: deriveAvailabilityCapsule([]),
        revision: (previousCapsule?.revision ?? 0) + 1,
        ...(previousCapsule ? { recordId: previousCapsule.recordId } : {}),
        updatedAt,
      }),
    ]);
    await selection.store.putEncryptedRecords(privateRecord, capsuleRecord);
  });
}

export function clearGuestTimetable(): Promise<void> {
  return enqueueGuestWrite(async () => {
    const selection = await securityStore();
    await selection.store.clearUser(guestDeviceId());
  });
}

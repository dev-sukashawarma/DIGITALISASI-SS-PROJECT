import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "vitest";
import {
  clearQueue,
  countQueued,
  enqueueAttendance,
  listQueued,
  removeQueued,
  type QueuedAttendance,
} from "./attendance-queue";

function makeItem(overrides: Partial<QueuedAttendance> = {}): QueuedAttendance {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    outletStaffId: "staff-1",
    type: "in",
    gpsLat: -6.2,
    gpsLng: 106.84,
    matchDistance: 0.38,
    selfiePath: "selfies/outlet-1/abc.jpg",
    tsClient: "2026-06-09T09:03:00+07:00",
    ...overrides,
  };
}

describe("attendance-queue", () => {
  beforeEach(async () => {
    await clearQueue();
  });

  test("starts empty", async () => {
    expect(await countQueued()).toBe(0);
    expect(await listQueued()).toEqual([]);
  });

  test("enqueues an item and lists it back", async () => {
    const item = makeItem();
    await enqueueAttendance(item);

    expect(await countQueued()).toBe(1);
    expect(await listQueued()).toEqual([item]);
  });

  test("is idempotent: enqueueing the same id twice keeps one entry", async () => {
    await enqueueAttendance(makeItem());
    await enqueueAttendance(makeItem({ matchDistance: 0.41 }));

    expect(await countQueued()).toBe(1);
    // last write wins for the same id
    expect((await listQueued())[0]!.matchDistance).toBe(0.41);
  });

  test("keeps distinct ids as separate entries", async () => {
    await enqueueAttendance(makeItem({ id: "id-a" }));
    await enqueueAttendance(makeItem({ id: "id-b" }));

    expect(await countQueued()).toBe(2);
  });

  test("removes an item by id after successful sync", async () => {
    await enqueueAttendance(makeItem({ id: "id-a" }));
    await enqueueAttendance(makeItem({ id: "id-b" }));

    await removeQueued("id-a");

    expect(await countQueued()).toBe(1);
    expect((await listQueued())[0]!.id).toBe("id-b");
  });

  test("removing a non-existent id is a no-op", async () => {
    await enqueueAttendance(makeItem({ id: "id-a" }));
    await removeQueued("does-not-exist");
    expect(await countQueued()).toBe(1);
  });
});

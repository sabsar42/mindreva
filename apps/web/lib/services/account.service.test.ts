import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const deleteUser = vi.fn();
const lists: Record<
  string,
  Record<string, { name: string; id: string | null }[]>
> = {};
const removed: Record<string, string[]> = {};
const order: string[] = [];

const admin = {
  storage: {
    from: (bucket: string) => ({
      list: vi.fn(async (prefix: string) => ({
        data: lists[bucket]?.[prefix] ?? [],
        error: null,
      })),
      remove: vi.fn(async (paths: string[]) => {
        order.push(`remove:${bucket}`);
        (removed[bucket] ??= []).push(...paths);
        return { error: null };
      }),
    }),
  },
  auth: {
    admin: {
      deleteUser: vi.fn(async (id: string) => {
        order.push("deleteUser");
        return deleteUser(id);
      }),
    },
  },
};
let adminAvailable = true;

vi.mock("@mindreva/auth/server", () => ({ getUser }));
const disconnectCalendarForUser = vi.fn(async () => {});
vi.mock("./calendar.service", () => ({ disconnectCalendarForUser }));
vi.mock("../supabase-admin", () => ({
  createAdminClient: () => (adminAvailable ? admin : null),
}));

const { deleteMyAccount } = await import("./account.service");

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(removed)) delete removed[k];
  order.length = 0;
  adminAvailable = true;
  getUser.mockResolvedValue({ id: "u1" });
  deleteUser.mockResolvedValue({ error: null });
  lists.recordings = { u1: [{ name: "a.webm", id: "1" }] };
  lists.photos = {
    u1: [{ name: "entry-1", id: null }],
    "u1/entry-1": [
      { name: "p.jpg", id: "2" },
      { name: "p.jpg.thumb", id: "3" },
    ],
  };
});

describe("deleteMyAccount", () => {
  it("removes every file, including nested photos and thumbs, then the login", async () => {
    await deleteMyAccount();
    expect(removed.recordings).toEqual(["u1/a.webm"]);
    expect(removed.photos).toEqual([
      "u1/entry-1/p.jpg",
      "u1/entry-1/p.jpg.thumb",
    ]);
    expect(order.at(-1)).toBe("deleteUser");
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });

  it("refuses without a session or without the service key", async () => {
    getUser.mockResolvedValue(null);
    await expect(deleteMyAccount()).rejects.toThrow("Not authenticated");
    getUser.mockResolvedValue({ id: "u1" });
    adminAvailable = false;
    await expect(deleteMyAccount()).rejects.toThrow(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(order).toEqual([]);
  });

  it("reports a failed login deletion instead of claiming success", async () => {
    deleteUser.mockResolvedValue({ error: { message: "boom" } });
    await expect(deleteMyAccount()).rejects.toThrow("boom");
  });
});

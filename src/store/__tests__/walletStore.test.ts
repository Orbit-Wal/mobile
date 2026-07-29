jest.mock("@/services/secureStorage", () => ({
  getSecretKey: jest.fn(),
}));

import { getSecretKey } from "@/services/secureStorage";
import { useWalletStore } from "@/store/walletStore";

const mockedGetSecretKey = getSecretKey as jest.Mock;

beforeEach(() => {
  useWalletStore.setState({ isOnboarded: false, publicKey: null, balances: {}, hydrated: false });
  mockedGetSecretKey.mockReset();
});

describe("walletStore", () => {
  it("restores onboarded state when a secret exists in SecureStore", async () => {
    mockedGetSecretKey.mockResolvedValue("SBGELNIUVE6A5I43FCPBKX7ZIO3AO63XPWP5WEQBOE4F6NTK6RNKIG3X");
    await useWalletStore.getState().hydrate();
    const state = useWalletStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.isOnboarded).toBe(true);
    expect(state.publicKey).toBeTruthy();
    expect(state.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
  });

  it("leaves isOnboarded false when no secret exists", async () => {
    mockedGetSecretKey.mockResolvedValue(null);
    await useWalletStore.getState().hydrate();
    const state = useWalletStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.isOnboarded).toBe(false);
    expect(state.publicKey).toBeNull();
  });
});

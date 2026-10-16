import assert from "node:assert/strict";
import test from "node:test";
import { assertChainIdMatches, assertNetworkChangeAllowed, CHIADO_CHAIN_ID, GNOSIS_MAINNET_CHAIN_ID, NETWORK_PRESETS } from "./network-config.ts";

test("network presets use the supported Gnosis chain IDs", () => {
  assert.equal(NETWORK_PRESETS.chiado.chainId, CHIADO_CHAIN_ID);
  assert.equal(NETWORK_PRESETS.gnosis.chainId, GNOSIS_MAINNET_CHAIN_ID);
  assert.equal(NETWORK_PRESETS.gnosis.explorerUrl, "https://gnosisscan.io");
});

test("chain mismatch is rejected before a write", () => {
  assert.throws(() => assertChainIdMatches(CHIADO_CHAIN_ID, GNOSIS_MAINNET_CHAIN_ID), /No on-chain write was sent/);
});

test("database cannot switch networks after events exist", () => {
  assert.throws(() => assertNetworkChangeAllowed(CHIADO_CHAIN_ID, GNOSIS_MAINNET_CHAIN_ID, 1), /separate deployment and database/);
  assert.doesNotThrow(() => assertNetworkChangeAllowed(CHIADO_CHAIN_ID, GNOSIS_MAINNET_CHAIN_ID, 0));
});

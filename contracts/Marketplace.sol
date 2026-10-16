// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev LEGACY / UNUSED. Live path is EventMarketplace + EventVault + TicketCollection
///      (one trio per event). Do not deploy this file.
contract MarketplaceLegacyUnused {
    function ping() external pure returns (string memory) {
        return "unused";
    }
}

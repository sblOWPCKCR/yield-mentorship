// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";

/**
@title GreenToken
@notice Just a standard ERC20 token that can be minted by anybody
 */
contract GreenToken is ERC20("GreenToken", "OWL_GTN", 18) {
    /**
    @notice mint!
    @param dst who to mint for
    @param wad how much tokens to mint
    @return wether the minting process succeeded
     */
    function mint(address dst, uint256 wad) public virtual returns (bool) {
        return _mint(dst, wad);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";

// error InsufficientBalance();
// ^ can't use this b/c waffle doesn't support custom errors

/**
@title GreenVault
@notice A (single-token) vault that mints wrapped tokens
in response to deposits
 */
contract GreenVault is ERC20("GreenVaultToken", "OWL_GVT", 18) {
    /**
    @notice the only token this vault supports
     */
    IERC20 public theOnlySupportedToken;

    /// @notice emitted on deposit
    event EventMint(address user, address token, uint256 amount);
    /// @notice emitted on withdrawal
    event EventBurn(address user, address token, uint256 amount);

    /**
    @param token address of the only token this vault will support
     */
    constructor(IERC20 token) {
        theOnlySupportedToken = token;
    }

    /**
    @notice Mint Vault token by depositing external token
    @param amount amount of tokens to deposit
     */
    function mint(uint256 amount) public {
        IERC20 token = theOnlySupportedToken;

        _mint(msg.sender, amount);

        token.transferFrom(msg.sender, address(this), amount);

        emit EventMint(msg.sender, address(token), amount);
    }

    /**
    @notice Burn Vault token and withdraw external token
    @param amount amount of tokens to withdraw
     */

    function burn(uint256 amount) public {
        IERC20 token = theOnlySupportedToken;

        _burn(msg.sender, amount);

        token.transfer(msg.sender, amount);

        emit EventBurn(msg.sender, address(token), amount);
    }
}

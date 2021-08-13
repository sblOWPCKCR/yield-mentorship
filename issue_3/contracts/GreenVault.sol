// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@yield-protocol/utils-v2/contracts/token/IERC20.sol";

// error InsufficientBalance();
// ^ can't use this b/c waffle doesn't support custom errors

/**
@title GreenToken
@notice Just a standard ERC20 token that can be minted by anybody
 */
contract GreenVault {
    /// @notice emitted on deposit
    event EventDeposit(address user, address token, uint256 amount);
    /// @notice emitted on withdrawal
    event EventWithdraw(address user, address token, uint256 amount);

    /**
    @notice (user -> (token, balance)) mapping
     */
    mapping(address => mapping(address => uint256)) public deposits;

    /**
    @notice Deposit tokens
    @param token token address
    @param amount amount of tokens to deposit
     */
    function deposit(address token, uint256 amount) public {
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        deposits[msg.sender][token] += amount;

        emit EventDeposit(msg.sender, token, amount);
    }

    /**
    @notice Withdraw tokens
    @param token token address
    @param amount amount of tokens to withdraw
     */

    function withdraw(address token, uint256 amount) public {
        require(deposits[msg.sender][token] >= amount, "InsufficientBalance");

        deposits[msg.sender][token] -= amount;

        IERC20(token).transfer(msg.sender, amount);
        emit EventWithdraw(msg.sender, token, amount);
    }
}

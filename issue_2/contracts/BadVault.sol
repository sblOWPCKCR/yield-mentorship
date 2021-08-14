// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@yield-protocol/utils-v2/contracts/token/IERC20.sol";


/**
@title BadVault
@notice Vault with deliberate reentrancy problem
 */
contract BadVault {
    address private token;
    bool private is_entered;
    mapping(address => uint256) public deposits;

    modifier nonReentrant() {
        require(!is_entered);
        is_entered = true;
        _;
        is_entered = false;
    }

    constructor(address t, uint256 amount) {
        token = t;
        deposits[msg.sender] = amount;
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    /**
    @notice Withdraw tokens
    @param amount amount of tokens to withdraw
     */

    function withdraw(uint256 amount) public nonReentrant {
        require(deposits[msg.sender] >= amount, "InsufficientBalance");

        uint256 balance = deposits[msg.sender]; // #noprod

        IERC20(token).transfer(msg.sender, amount);

        deposits[msg.sender] -= amount;

        assert(deposits[msg.sender] == balance - amount); // #noprod
    }
}

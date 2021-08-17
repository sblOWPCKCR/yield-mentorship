// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@yield-protocol/utils-v2/contracts/access/Ownable.sol";
import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";

contract FPMath {
    uint256 internal constant WAD = 10 ** 18;

    function wadMul(uint256 a, uint256 b) public pure returns (uint256) {
        uint256 ret = (a * b);
        require(b == 0 || ret / b == a, "wadMul: overflow");
        return ret / WAD;
    }
}

// error InsufficientBalance();
// ^ can't use this b/c waffle doesn't support custom errors

/**
@title GreenVault
@notice A (single-token) vault that mints wrapped tokens
in response to deposits
 */
contract GreenVault is
    ERC20("GreenVaultToken", "OWL_GVT", 18),
    Ownable,
    FPMath
{
    /**
    @notice the only token this vault supports
     */
    IERC20Metadata public theOnlySupportedToken;

    bool private is_entered;

    /**
    Multiplier: for each token deposited we mint `rewardFractionWad` Vault Tokens

    It's represented as a wad (a 18-digit fixed point number)
     */
    uint256 public rewardFractionWad;

    /// @notice emitted on deposit
    event EventMint(address user, address token, uint256 amount);
    /// @notice emitted on withdrawal
    event EventBurn(address user, address token, uint256 amount);

    event RewardFractionSet(uint256 rewardFractionWad);

    modifier nonReentrant() {
        require(!is_entered);
        is_entered = true;
        _;
        is_entered = false;
    }

    /**
    @param token address of the only token this vault will support
    @param _rewardFractionWad reward fraction to start with
     */
    constructor(IERC20Metadata token, uint256 _rewardFractionWad)
    {
        theOnlySupportedToken = token;
        setRewardFraction(_rewardFractionWad);
    }

    function setRewardFraction(uint256 _rewardFractionWad) public onlyOwner {
        rewardFractionWad = _rewardFractionWad;
        emit RewardFractionSet(rewardFractionWad);
    }

    /**
    @notice Mint Vault token by depositing external token
    @param amount amount of tokens to deposit
     */
    function deposit(uint256 amount) public nonReentrant {
        IERC20 token = theOnlySupportedToken;

        uint256 rewardAmount = wadMul(amount, rewardFractionWad);

        _mint(msg.sender, rewardAmount);
        token.transferFrom(msg.sender, address(this), amount);

        emit EventMint(msg.sender, address(token), rewardAmount);
    }

    /**
    @notice Burn Vault token and withdraw external token
    @param amount amount of tokens to withdraw
     */

    function withdraw(uint256 amount) public nonReentrant {
        IERC20 token = theOnlySupportedToken;

        uint256 rewardAmount = wadMul(amount, rewardFractionWad);
        _burn(msg.sender, rewardAmount);

        token.transfer(msg.sender, amount);

        emit EventBurn(msg.sender, address(token), rewardAmount);
    }
}

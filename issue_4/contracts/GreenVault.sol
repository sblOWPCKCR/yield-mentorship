// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@yield-protocol/utils-v2/contracts/access/Ownable.sol";
import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";

/**
@dev Internal library that implements Fixed Point Math
All numbers are WADs - fixed point numbers with decimals=18
 */
library FPMath {
    uint256 internal constant WAD = 1e18;

    /**
    @notice Multiply 2 WADs
    */
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 ret = (a * b);
        require(b == 0 || ret / b == a, "wadMul: overflow");
        return ret / WAD;
    }
}

/**
@title GreenVault
@notice A (single-token) vault that mints wrapped tokens
in response to deposits
 */
contract GreenVault is ERC20("GreenVaultToken", "OWL_GVT", 18), Ownable {
    /**
    @notice the only token this vault supports
     */
    IERC20Metadata public theOnlySupportedToken;

    /**
    Multiplier: for each token deposited we mint `exchangeRateWad` Vault Tokens

    It's represented as a wad (a 18-digit fixed point number)
     */
    uint256 public exchangeRateWad;

    /// @notice emitted on deposit
    event Minted(address user, address token, uint256 amount);
    /// @notice emitted on withdrawal
    event Burned(address user, address token, uint256 amount);

    event ExchangeRateSet(uint256 exchangeRateWad);

    /**
    @param token address of the only token this vault will support
    @param _exchangeRateWad exchange rate to start with
     */
    constructor(IERC20Metadata token, uint256 _exchangeRateWad) {
        theOnlySupportedToken = token;
        setExchangeRate(_exchangeRateWad);
    }

    function setExchangeRate(uint256 _exchangeRateWad) public onlyOwner {
        exchangeRateWad = _exchangeRateWad;
        emit ExchangeRateSet(exchangeRateWad);
    }

    /**
    @notice Mint Vault token by depositing external token
    @param amount amount of tokens to deposit
     */
    function deposit(uint256 amount) public {
        IERC20 token = theOnlySupportedToken;

        uint256 exchangeAmount = FPMath.wadMul(amount, exchangeRateWad);
        _mint(msg.sender, exchangeAmount);

        token.transferFrom(msg.sender, address(this), amount);

        emit Minted(msg.sender, address(token), exchangeAmount);
    }

    /**
    @notice Burn Vault token and withdraw external token
    @param amount amount of tokens to withdraw
     */

    function withdraw(uint256 amount) public {
        IERC20 token = theOnlySupportedToken;

        uint256 exchangeAmount = FPMath.wadMul(amount, exchangeRateWad);
        _burn(msg.sender, exchangeAmount);

        token.transfer(msg.sender, amount);

        emit Burned(msg.sender, address(token), exchangeAmount);
    }
}

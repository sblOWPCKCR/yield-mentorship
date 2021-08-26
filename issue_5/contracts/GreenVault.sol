// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "./external/chainlink/AggregatorV3Interface.sol";

import "@yield-protocol/utils-v2/contracts/access/Ownable.sol";
import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";

/**
@dev Internal library that implements Fixed Point Math
WADs are fixed point numbers with decimals=18
 */
library FPMath {
    /**
    @notice Multiply 2 WADs
    */
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return mul(a, b, 18);
    }

    /**
    @notice Multiply 2 fixed point numbers
    */
    function mul(
        uint256 a,
        uint256 b,
        uint8 bDecimals
    ) internal pure returns (uint256) {
        uint256 ret = (a * b);
        // require(b == 0 || ret / b == a, "mul: overflow");
        // ^ not needed since solidity 0.8
        return ret / (10**bDecimals);
    }
}

/**
@title GreenVault
@notice A (single-token) vault that allows users to deposit ETH and borrow DAI
 */
contract GreenVault is Ownable {
    /**
    @notice the only token this vault supports
     */
    IERC20Metadata public theOnlySupportedToken;

    /**
    @dev price feed
    */
    AggregatorV3Interface internal immutable priceFeed;

    /**
    @dev per-user data
     */
    struct UserData {
        /**
        @dev how much ETH was deposited
         */
        uint256 deposited;
        /**
        @dev how much DAI was borrowed
         */
        uint256 borrowedDAI;
    }

    /**
    @dev Mapping (user address -> user data)
     */
    mapping(address => UserData) public users;

    /// @notice emitted on deposit
    event Deposited(uint256 amount);

    /// @notice emitted on withdrawal
    event Borrowed(uint256 ethAmount, uint256 daiAmount);
    /// @notice emitted when a debt is paid back
    event PaidBack(uint256 ethAmount, uint256 daiAmount);
    /// @notice emitted when the user withdraws fuunds
    event Withdrawn(uint256 amount);
    /// @notice emitted when the user is liquidated
    event Liquidated(address user);

    /**
    @param token address of DAI token
    @param _priceFeed price feed address
     */
    constructor(IERC20Metadata token, AggregatorV3Interface _priceFeed) {
        theOnlySupportedToken = token;
        priceFeed = _priceFeed;
    }

    function getExchangeRate() internal view returns (uint256 rate, uint8 rateDecimals) {
        (uint80 roundId, int256 answer, , , uint80 answeredInRound) = priceFeed.latestRoundData();
        require(answeredInRound == roundId, "Stale feed");
        require(answer > 0, "negative exchange rate");
        rate = (uint256)(answer);
        rateDecimals = priceFeed.decimals();
    }

    /**
    @notice Deposit ETH
     */
    function deposit() public payable {
        users[msg.sender].deposited += msg.value;

        emit Deposited(msg.value);
    }

    /**
    @dev Determines if the user is 'underwater' - has more debt than they can afford
     */
    function isUnderwater(
        UserData storage user,
        uint256 xRate,
        uint8 xDecimals
    ) internal view returns (bool) {
        uint256 maxUserCanBorrow = FPMath.mul(user.deposited, xRate, xDecimals);
        return user.borrowedDAI > maxUserCanBorrow; // TODO multiply by collaterization rate
    }

    /**
    @notice Borrow DAI against previously deposited ETH
    @param collateral how much ETH to borrow against
     */
    function borrow(uint256 collateral) public {
        IERC20 token = theOnlySupportedToken;
        UserData storage user = users[msg.sender];

        (uint256 xRate, uint8 xDecimals) = getExchangeRate();
        uint256 daiAmount = FPMath.mul(collateral, xRate, xDecimals);

        user.borrowedDAI += daiAmount;
        require(!isUnderwater(user, xRate, xDecimals), "Not enough collateral (b)");

        token.transfer(msg.sender, daiAmount);
        emit Borrowed(collateral, daiAmount);
    }

    /**
    @notice Return DAI, get back ETH
    @param ethAmount how much ETH you want back
     */

    function payback(uint256 ethAmount) public {
        IERC20 token = theOnlySupportedToken;
        UserData storage user = users[msg.sender];

        (uint256 xRate, uint8 xDecimals) = getExchangeRate();
        uint256 daiAmount = FPMath.mul(ethAmount, xRate, xDecimals);

        require(user.borrowedDAI >= daiAmount, "Not enough debt");
        unchecked {
            // saving peanuts
            user.borrowedDAI -= daiAmount; // handles unuderflow
        }

        token.transferFrom(msg.sender, address(this), daiAmount);
        emit PaidBack(ethAmount, daiAmount);
    }

    /**
    @notice Withdraw ETH
    @param amount how much ETH you want to withdraw
     */
    function withdraw(uint256 amount) public {
        (uint256 xRate, uint8 xDecimals) = getExchangeRate();

        UserData storage user = users[msg.sender];

        require(user.deposited >= amount, "Not enough ETH (w)");

        unchecked {
            // saving peanuts
            user.deposited -= amount;
        }

        require(!isUnderwater(user, xRate, xDecimals), "Not enough collateral(w)");

        (bool result, ) = msg.sender.call{ value: amount }("");
        require(result, "Failed to send ETH");

        emit Withdrawn(amount);
    }

    /**
    @notice Liquidate user - wipe out their debt and deposits
     */
    function liquidate(address user) public onlyOwner {
        (uint256 xRate, uint8 xDecimals) = getExchangeRate();

        require(isUnderwater(users[user], xRate, xDecimals), "Good debt");

        delete users[user];

        emit Liquidated(user);
    }
}

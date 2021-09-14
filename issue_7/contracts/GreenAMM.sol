// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@yield-protocol/utils-v2/contracts/access/Ownable.sol";
import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";

/**
@dev Internal library that implements Fixed Point Math
WADs are fixed point numbers with decimals=18
 */
library FPMath {
    // /**
    // @notice Multiply 2 WADs
    // */
    uint256 internal constant WAD = 1e18;

    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / WAD;
    }

    /// @dev div 2 WADs
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * WAD) / b;
    }
}

/**
@notice 'Engine' of the standard xy=k AMM contract
 */
abstract contract GreenAMMEngine is Ownable {
    using FPMath for uint256;

    /// @dev info about X token
    uint256 public xReserves;
    /// @dev info about Y token
    uint256 public yReserves;

    /// @dev K from X*Y=K
    /// IMIPORTANT: K has 36 decimals
    uint256 public k;

    event KChanged(uint256 newK);
    event Initialized(uint256 x, uint256 y);
    event Minted(uint256 x, uint256 y);
    event Burned(uint256 x, uint256 y);
    event SoldX(uint256 x, uint256 y);
    event SoldY(uint256 x, uint256 y);

    modifier initialized() {
        require(xReserves > 0 || yReserves > 0, "not initialized");
        _;
    }

    modifier notInitialized() {
        require(xReserves == 0 && yReserves == 0, "already initialized");
        _;
    }

    /**
    @notice constructor
    @param xDecimals decimals of X token
    @param yDecimals decimals of Y token

    Only 18-decimal tokens are supported
     */
    constructor(uint8 xDecimals, uint8 yDecimals) {
        require(xDecimals == 18, "Only WAD-denominated tokens are supported");
        require(yDecimals == 18, "Only WAD-denominated tokens are supported");
    }

    /// @dev checks if amountX/amountY have same ratio as existing reserves
    function maintainsBalance(uint256 amountX, uint256 amountY) internal view returns (bool) {
        require(xReserves != 0 && yReserves != 0, "Empty pool");

        // since decimals for X and Y are unchanged, don't bother computing *exact* value for x/y:
        // x1 * dec_x / y1 * dec_y == x2 * dec_x / y2 * dec_y IMPLIES x1/y1 == x2/y2
        // x1/y1 == x2/y2 IS EQUIVALENT to x1 * y2 == x2 * y1
        return (xReserves * amountY == yReserves * amountX);
    }

    /// @dev recompute K based on new reserve numbers
    function _kRecompute() internal {
        k = xReserves * yReserves; // use increased precision
        emit KChanged(k);
    }

    /**
    @notice 'State Chage' function for 'init' method
    @param amountX X tokens to deposit
    @param amountY Y tokens to deposit
    @return new K value
     */
    function _init(uint256 amountX, uint256 amountY) internal notInitialized onlyOwner returns (uint256) {
        require(amountX != 0 && amountY != 0, "Can't create empty pool");

        xReserves += amountX;
        yReserves += amountY;

        _kRecompute();
        return k;
    }

    /**
    @notice 'State Chage' function for 'mint' method
    @param amountX X tokens to deposit
    @param amountY Y tokens to deposit
    @return rewardsFraction how many AMM tokens need to be issued (36-decimal fraction of total supply)
     */
    function stateChangeMint(uint256 amountX, uint256 amountY) internal initialized returns (uint256 rewardsFraction) {
        require(maintainsBalance(amountX, amountY), "Unbalancing");

        rewardsFraction = amountX.wadDiv(xReserves);

        xReserves += amountX;
        yReserves += amountY;

        _kRecompute();
    }

    /**
    @notice 'State Chage' function for 'burn' method
    @param amountX X tokens to burn
    @param amountY Y tokens to burn
    @return rewardsFraction how many AMM tokens need to be burned (36-decimal fraction of total supply)
     */
    function stateChangeBurn(uint256 amountX, uint256 amountY) internal initialized returns (uint256 rewardsFraction) {
        require(maintainsBalance(amountX, amountY), "Unbalancing");

        rewardsFraction = amountX.wadDiv(xReserves);

        xReserves -= amountX;
        yReserves -= amountY;

        _kRecompute();

        // BurnInteraction(amountX, amountY, rewardsAmount);
    }

    /**
    @notice 'State Chage' function for 'sellX' method
    @param amountX X tokens to add to reserves
    @return how many Y tokens need to be returned to the user
     */
    function stateChangeSellX(uint256 amountX) internal initialized returns (uint256) {
        // (x + A) * (y - B) = k
        // y - B = k / (x + A)
        // B = y - k / (x + A)
        uint256 amountY = yReserves - k / (xReserves + amountX);
        xReserves += amountX;
        yReserves -= amountY;

        return amountY;
    }

    /**
    @notice 'State Chage' function for 'sellY' method
    @param amountY Y tokens to add to reserves
    @return how many X tokens need to be returned to the user
     */

    function stateChangeSellY(uint256 amountY) internal initialized returns (uint256) {
        uint256 amountX = xReserves - k / (yReserves + amountY);
        xReserves -= amountX;
        yReserves += amountY;

        return amountX;
    }
}

/**
@notice Standard k=xy AMM contract
 */
contract GreenAMM is ERC20("GreenAMMToken", "OWL_GAMT", 36), GreenAMMEngine {
    using FPMath for uint256;

    /// @dev X token
    IERC20Metadata internal xToken;
    /// @dev Y token
    IERC20Metadata internal yToken;

    constructor(IERC20Metadata _x, IERC20Metadata _y) GreenAMMEngine(_x.decimals(), _y.decimals()) {
        require(address(_x) != address(_y), "tokens need to be different");
        xToken = _x;
        yToken = _y;
    }

    /**
    @notice Supply any amount of x and y to the contract
    mint k AMM tokens to sender. Can only be called once.

    @param amountX X tokens to deposit
    @param amountY Y tokens to deposit
    */
    function init(uint256 amountX, uint256 amountY) public {
        uint256 rewardsAmount = _init(amountX, amountY);
        _mint(msg.sender, rewardsAmount);

        xToken.transferFrom(msg.sender, address(this), amountX);
        yToken.transferFrom(msg.sender, address(this), amountY);

        emit Initialized(amountX, amountY);
    }

    /**
    @notice x and y are supplied to the contract in the same proportion as the x and y balances of the contract
    mint AMM tokens to sender as the proportion of their deposit to the AMM reserves

    @param amountX X tokens to deposit
    @param amountY Y tokens to deposit
    */
    function mint(uint256 amountX, uint256 amountY) public {
        uint256 rewardsAmount = stateChangeMint(amountX, amountY).wadMul(_totalSupply);

        _mint(msg.sender, rewardsAmount);

        xToken.transferFrom(msg.sender, address(this), amountX);
        yToken.transferFrom(msg.sender, address(this), amountY);

        emit Minted(amountX, amountY);
    }

    /**
    @notice AMM tokens are burned
    The AMM sends x and y tokens to the caller in the proportion of tokens burned to AMM total supply

    @param amountX X tokens to burn
    @param amountY Y tokens to burn
    */
    function burn(uint256 amountX, uint256 amountY) public {
        uint256 rewardsAmount = stateChangeBurn(amountX, amountY).wadMul(_totalSupply);

        _burn(msg.sender, rewardsAmount);

        xToken.transfer(msg.sender, amountX);
        yToken.transfer(msg.sender, amountY);

        emit Burned(amountX, amountY);
    }

    /**
    @notice The user provides x
    The AMM sends y to the user so that x_reserves * y_reserves remains at k

    @param amountX X tokens the user sells
    */
    function sellX(uint256 amountX) public {
        uint256 amountY = stateChangeSellX(amountX);

        xToken.transferFrom(msg.sender, address(this), amountX);
        yToken.transfer(msg.sender, amountY);

        emit SoldX(amountX, amountY);
    }

    /**
    @notice The user provides y
    The AMM sends x to the user so that x_reserves * y_reserves remains at k

    @param amountY Y tokens the user sells
    */
    function sellY(uint256 amountY) public {
        uint256 amountX = stateChangeSellY(amountY);

        yToken.transferFrom(msg.sender, address(this), amountY);
        xToken.transfer(msg.sender, amountX);

        emit SoldY(amountX, amountY);
    }
}

/**
@dev SMTChecker test for GreenAMMEngine

Each invariant ends with 'revert' to workaround the fact that the Engine is stateful
 */
contract GreenAMMEngineTest is GreenAMMEngine {
    using FPMath for uint256;

    constructor(uint8 xDecimals, uint8 yDecimals) GreenAMMEngine(xDecimals, yDecimals) {}

    /// @dev init test: K is recomputed
    function invInit(uint256 amountX, uint256 amountY) public {
        uint256 tokens = _init(amountX, amountY);
        assert(tokens == k);
        revert("inv");
    }

    /// @dev mint test: K is recomputed and tokens ratio stay the same
    function invMint(
        uint256 x1,
        uint256 y1,
        uint256 x2,
        uint256 y2
    ) public {
        require(x1 != 0, "inv");
        require(x2 != 0, "inv");
        require(y1 != 0, "inv");
        require(y2 != 0, "inv");

        uint256 supply1 = _init(x1, y1);
        uint256 supply2 = stateChangeMint(x2, y2).wadMul(supply1);
        assert(x2 / x1 == supply2 / supply1);
        revert("inv");
    }

    /// @dev sell X: K is unchanged
    function invSellX(
        uint256 x1,
        uint256 y1,
        uint256 sellAmount
    ) public {
        require(x1 != 0, "inv");
        require(y1 != 0, "inv");

        _init(x1, y1);
        uint256 oldK = k;
        uint256 oldX = xReserves;
        stateChangeSellX(sellAmount);

        assert(k == oldK);
        assert(xReserves == oldX + sellAmount);

        assert(xReserves * yReserves == k);
        revert("inv");
    }

    /// @dev sell Y: K is unchanged
    function invSellY(
        uint256 x1,
        uint256 y1,
        uint256 sellAmount
    ) public {
        require(x1 != 0, "inv");
        require(y1 != 0, "inv");

        _init(x1, y1);
        uint256 oldK = k;
        uint256 oldY = yReserves;
        stateChangeSellY(sellAmount);

        assert(k == oldK);
        assert(yReserves == oldY + sellAmount);

        assert(xReserves * yReserves == oldK);
        revert("inv");
    }
}

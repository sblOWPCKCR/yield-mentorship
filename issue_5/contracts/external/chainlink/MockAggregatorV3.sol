// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "./AggregatorV3Interface.sol";

/**
@dev mock ChainLink price feed
 */
contract MockAggregatorV3 is AggregatorV3Interface {
    /// @dev should this mock return stale data?
    bool public mockIsStale;

    /// @dev price the mock returns
    int256 public mockAnswer;
    /// @dev decimal points `mockAnswer` has
    uint8 public mockDecimals;

    constructor(
        bool isStale,
        int256 answer,
        uint8 _decimals
    ) {
        mockIsStale = isStale;
        mockAnswer = answer;
        mockDecimals = _decimals;
    }

    function setAnswer(int256 answer, uint8 _decimals) external {
        mockAnswer = answer;
        mockDecimals = _decimals;
    }

    function setIsStale(bool isStale) external {
        mockIsStale = isStale;
    }

    function decimals() external view override returns (uint8) {
        return mockDecimals;
    }

    function description() external pure override returns (string memory) {
        return "MockAggregatorV3";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    // getRoundData and latestRoundData should both raise "No data present"
    // if they do not have data to report, instead of returning unset values
    // which could be misinterpreted as actual reported values.
    function getRoundData(uint80)
        external
        pure
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        require(false, "No data present");
        revert("not reacheable"); // solc is not smart
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = (uint80)(block.timestamp); // take last 80 bits
        answer = mockAnswer;
        startedAt = block.timestamp - 2 minutes;
        updatedAt = block.timestamp - 1 minutes;
        answeredInRound = mockIsStale ? roundId - 1 : roundId;
    }
}

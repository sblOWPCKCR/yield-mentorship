# Task

Users can send a given `Token` to a `Vault` contract, that records their balance, only that owner can retrieve that token. Think of it as a multi-user safe.

To complete this you will need two contracts, one of them an ERC20 token that will be moved around, and another one the Vault that will store it for the users.

There are a couple of patterns to achieve this, but I suggest that you take the traditional approach:

    Vault should import the IERC20 interface, take the Token address in the Vault constructor, and cast it into an IERC20 state variable.
    The user approve the Vault to take Token from them in one transaction.
    The user calls a function that instructs the Vault to take from them an amount of Token, which now belongs to the Vault, in exchange, the Vault records the user's deposit.
    Whenever the user feels like it, it can withdraw its deposit. The Token is returned, and the Vault updates its user records.


# Solution
## Kovan
GreenToken https://kovan.etherscan.io/address/0x4239B7aB36878a6b28dcE78DdCAF3cb0bd6af40a#code
GreenVault https://kovan.etherscan.io/address/0x4f0d1950Aa61258df679c95Cd45bFe8A6499B9b8#code

# Time spent
7 hrs
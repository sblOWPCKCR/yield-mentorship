# Task

An Automated Market Maker facilitates trade between two ERC20 tokens, supplied on construction. The AMM itself is an ERC20 token as well.

5 functions:

    Init: Supply any amount of x and y to the contract. Store a k value as x * y. Mint k AMM tokens to sender. Can only be called once.
    Mint: x and y are supplied to the contract in the same proportion as the x and y balances of the contract. Mint AMM tokens to sender as the proportion of their deposit to the AMM reserves. (minted = x_supplied / x_reserves). Update k as x_reserves * y_reserves.
    Burn: AMM tokens are burned. The AMM sends x and y tokens to the caller in the proportion of tokens burned to AMM total supply. Adjust k as usual.
    Sell x: The user provides x. The AMM sends y to the user so that x_reserves * y_reserves remains at k.
    Sell y: The user provides y. The AMM sends x to the user so that x_reserves * y_reserves remains at k.

Bonus track: Instead of using transferFrom, make the AMM keep its last known reserves in two state variables. The user transfer into the AMM and then triggers one of the functions. The AMM recognizes the divergence between stored reserve values and actual balances, and infers the surplus came from the user.

# Solution
## Kovan

# Time spent

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

A highly unusual one, I guess. Why?

The main contract (GreenAMM) is split into 2 parts: GreenAMM itself and GreenAMMEngine. The engine contains minimal state information
to make the math work (token balances, K), and it's responsible for all state changes. Why?
1. To force CEI pattern. If all of state changes are in the Engine, as long as functions in the main contract start with 'StateChange...' calls, we make sure that CEI is enforced. It's still possible to screw up, but harder
2. To make SMTChecker's life simpler. You don't need external contracts to just check the math, so having bare minimum in the Engine helps the checked

Another oddity is 36-decimal representation of K. This is actually something that SMTChecker found and that's something obvious in hindsight: if you go with a standard 18-decimal value for K, and call Mint(1 wei, 1 wei), K doesn't have enough decimal points to store result of (1 wei * 1 wei) => k becomes 0 and no AMM tokens are issued. Maybe that's not a big deal, but I wanted to cover this scenario.
On the flip side, we limit the max value for K, but at least nobody loses money (and there's overflow protection)


SMTChecker is still not 100% happy with the tests I have and I still don't know why - maybe there's a legit bug in code, maybe it's one of the edge cases when 1 wei is lost due to rounding. Need to spend a bit more time there

## Kovan
https://kovan.etherscan.io/address/0x08b80cF772Ef76E62e8DACC4FB9E52dF41FF90E1#code

# Time spent
13hrs
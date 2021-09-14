# Task

There is a Vault that lends DAI. Get the contract from Etherscan and deploy it locally, then supply your Vault with an amount of DAI.

Users can deposit Ether in the Vault to get DAI, how much DAI they get for the Ether they deposit is something the Vault know by reading from a [Chainlink Oracle](https://docs.chain.link/docs/ethereum-addresses).

To withdraw their Ether, the users must repay the DAI they borrowed.

If the Ether price rises, the users can borrow more DAI without depositing more Ether.

If the Ether price drops, and the value of a user's deposit falls below the DAI it borrowed, the Vault owner can erase the user's debt and the record of their Ether deposit (the Ether remains in the Vault, but the user can't withdraw it anymore).

# Solution
## Kovan

https://kovan.etherscan.io/address/0xCF89A42Ab77Ba9226100CaC967863f641B7097dA#code

# Time spent
6hrs

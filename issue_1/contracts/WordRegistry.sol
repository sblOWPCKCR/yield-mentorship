// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "hardhat/console.sol";

import "./yield-utils-v2/contracts/access/Ownable.sol";

/**
@title Dictatorship-friendly word registry
@author Owleksiy
@notice This contract allows users to register/unregister (claim/unclaim) words
Once a word is regiistered by a user, other users can't register it, unless the
original user unregisters it.

Additionally, the owner of the contract can expropriate any registered word
 */
contract WordRegistry is Ownable {
    event OwnershipChange(string word, address previousOwner, address newOwner);
    // word -> owner mapping
    mapping(string => address) private word_to_owner;

    constructor() {
        console.log("Creating a registry, owner:", msg.sender);
    }

    function _is_owned_by_somebody(string memory word) private view returns (bool) {
        return word_to_owner[word] != address(0);
    }

    function _transfer(
        string memory word,
        address old_owner,
        address new_owner
    ) private {
        word_to_owner[word] = new_owner;
        emit OwnershipChange(word, old_owner, new_owner);
        console.log("Registered: '", word, "' to: ", new_owner);
    }

    /**
    @notice Checks if msg.sender owns the word
    @param word word to check
    @return ownership status
     */
    function does_own(string memory word) public view returns (bool) {
        return word_to_owner[word] == msg.sender;
    }

    /**
    @notice Register a word for msg.sender
    @param word word to register
     */
    function register(string memory word) public {
        require(!_is_owned_by_somebody(word), "word is already taken");

        return _transfer(word, address(0), msg.sender);
    }

    /**
    @notice Expropriate a word - transfer its ownership to contract's owner
    @param word word to expropriate
     */

    function expropriate(string memory word) public onlyOwner {
        return _transfer(word, word_to_owner[word], msg.sender);
    }

    /**
    @notice Unregister a word from msg.sender
    @param word word to unregister
     */
    function unregister(string memory word) public {
        require(word_to_owner[word] == msg.sender, "can't touch this");

        return _transfer(word, msg.sender, address(0));
    }
}

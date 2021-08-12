// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

/**
@title Word registry
@author Owleksiy
@notice This contract allows users to register/unregister (claim/unclaim) words
Once a word is registered by a user, other users can't register it, unless the
original user unregisters it.
 */
contract WordRegistry {
    event WordRegistered(string word, address newOwner);
    event WordUnregistered(string word, address oldOwner);
    // word -> owner mapping
    mapping(string => address) public wordToOwner;

    /**
    @notice Register a word for msg.sender
    @param word word to register
     */
    function register(string calldata word) public {
        require(wordToOwner[word] == address(0), "already registered");
        wordToOwner[word] = msg.sender;
        emit WordRegistered(word, msg.sender);
    }

    /**
    @notice Unregister a word from msg.sender
    @param word word to unregister
     */
    function unregister(string calldata word) public {
        require(wordToOwner[word] == msg.sender, "not registered by you");
        wordToOwner[word] = address(0);
        emit WordUnregistered(word, msg.sender);
    }
}

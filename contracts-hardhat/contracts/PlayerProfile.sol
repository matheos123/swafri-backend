// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PlayerProfile {
    struct Player {
        bytes32 profileId;
        string  username;
        uint256 registeredAt;
        bool    exists;
    }

    mapping(address => Player) private players;
    mapping(bytes32 => address) private profileToWallet;

    event PlayerRegistered(address indexed wallet, bytes32 profileId, string username, uint256 timestamp);

    function registerPlayer(bytes32 profileId, string calldata username) external {
        require(!players[msg.sender].exists, "Already registered");
        require(profileToWallet[profileId] == address(0), "Profile ID taken");

        players[msg.sender] = Player(profileId, username, block.timestamp, true);
        profileToWallet[profileId] = msg.sender;

        emit PlayerRegistered(msg.sender, profileId, username, block.timestamp);
    }

    function getPlayer(address wallet) external view returns (bytes32, string memory, uint256) {
        Player memory p = players[wallet];
        require(p.exists, "Player not found");
        return (p.profileId, p.username, p.registeredAt);
    }

    function isRegistered(address wallet) external view returns (bool) {
        return players[wallet].exists;
    }

    function resolveProfile(bytes32 profileId) external view returns (address) {
        return profileToWallet[profileId];
    }
}

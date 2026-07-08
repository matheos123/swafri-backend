// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AchievementBadge is ERC1155, Ownable {
    // Badge IDs — match your seeded achievements
    uint256 public constant FIRST_VICTORY   = 1;
    uint256 public constant TEN_VICTORIES   = 2;
    uint256 public constant FIFTY_VICTORIES = 3;
    uint256 public constant FIVE_STREAK     = 4;
    uint256 public constant LEGENDARY       = 5;
    uint256 public constant VETERAN         = 6;

    mapping(address => mapping(uint256 => bool)) private _hasBadge;

    event BadgeMinted(address indexed player, uint256 indexed badgeId, uint256 timestamp);

    constructor() ERC1155("https://web3arena.com/badges/{id}.json") Ownable(msg.sender) {}

    function mint(address player, uint256 badgeId) external onlyOwner {
        require(!_hasBadge[player][badgeId], "Badge already owned");
        _mint(player, badgeId, 1, "");
        _hasBadge[player][badgeId] = true;
        emit BadgeMinted(player, badgeId, block.timestamp);
    }

    function hasBadge(address player, uint256 badgeId) external view returns (bool) {
        return _hasBadge[player][badgeId];
    }
}

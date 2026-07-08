// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MatchRegistry {
    struct MatchResult {
        bytes32 matchId;
        address winner;
        address loser;
        bytes32 resultHash;
        uint256 timestamp;
        bool    exists;
    }

    mapping(bytes32 => MatchResult) private matches;

    event MatchRecorded(bytes32 indexed matchId, address indexed winner, address indexed loser, bytes32 resultHash, uint256 timestamp);

    function recordMatch(
        bytes32 matchId,
        address winner,
        address loser,
        bytes32 resultHash
    ) external {
        require(!matches[matchId].exists, "Match already recorded");

        matches[matchId] = MatchResult(matchId, winner, loser, resultHash, block.timestamp, true);

        emit MatchRecorded(matchId, winner, loser, resultHash, block.timestamp);
    }

    function getMatch(bytes32 matchId) external view returns (address, address, bytes32, uint256) {
        MatchResult memory m = matches[matchId];
        require(m.exists, "Match not found");
        return (m.winner, m.loser, m.resultHash, m.timestamp);
    }

    function matchExists(bytes32 matchId) external view returns (bool) {
        return matches[matchId].exists;
    }
}

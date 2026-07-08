// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GameReward
 * @notice On-chain ledger for verified match results, player points, and achievement badges.
 * @dev The backend is the trusted authority. Gameplay runs off-chain; this contract only
 *      records outcomes after the backend validates a completed match.
 */
contract GameReward is Ownable {
    /// @notice Maximum badge ID supported by the contract.
    uint8 public constant MAX_BADGE_ID = 5;

    /// @notice Immutable record of a completed match.
    struct MatchRecord {
        address winner;
        uint256 timestamp;
        string gameType;
        bytes32 resultHash;
        uint256 pointsAwarded;
        uint8 badgeEarned;
    }

    /// @dev matchId => stored match data.
    mapping(uint256 => MatchRecord) private _matches;

    /// @dev matchId => whether a match has already been recorded.
    mapping(uint256 => bool) private _matchExists;

    /// @dev player => cumulative on-chain points.
    mapping(address => uint256) private _playerPoints;

    /// @dev player => badgeId => ownership flag.
    mapping(address => mapping(uint8 => bool)) private _playerBadges;

    /// @notice Emitted when the backend records a completed match.
    event MatchRecorded(
        uint256 indexed matchId,
        address indexed winner,
        uint256 timestamp,
        string gameType,
        bytes32 resultHash,
        uint256 pointsAwarded,
        uint8 badgeEarned
    );

    /// @notice Emitted when points are awarded to a player.
    event PointsAwarded(address indexed player, uint256 points, uint256 newTotal);

    /// @notice Emitted when a badge is minted to a player.
    event BadgeAwarded(address indexed player, uint8 badgeId);

    /// @notice Thrown when attempting to record a match that already exists.
    error MatchAlreadyRecorded(uint256 matchId);

    /// @notice Thrown when reading a match that does not exist.
    error MatchNotFound(uint256 matchId);

    /// @notice Thrown when an invalid wallet address is provided.
    error InvalidAddress();

    /// @notice Thrown when an unsupported badge ID is provided.
    error InvalidBadgeId(uint8 badgeId);

    /// @notice Thrown when a player already owns the requested badge.
    error BadgeAlreadyMinted(address player, uint8 badgeId);

    /**
     * @param initialOwner Backend wallet that will record matches and award rewards.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Record a validated match result on-chain.
     * @param matchId Unique backend match identifier.
     * @param winner Wallet address of the match winner.
     * @param timestamp Unix timestamp of match completion.
     * @param gameType Game identifier (for example, "rps").
     * @param resultHash Backend-generated hash of the verified match result.
     * @param pointsAwarded Points granted for this match.
     * @param badgeEarned Badge ID earned in this match (0 = none).
     */
    function recordMatch(
        uint256 matchId,
        address winner,
        uint256 timestamp,
        string calldata gameType,
        bytes32 resultHash,
        uint256 pointsAwarded,
        uint8 badgeEarned
    ) external onlyOwner {
        if (_matchExists[matchId]) revert MatchAlreadyRecorded(matchId);
        if (badgeEarned > MAX_BADGE_ID) revert InvalidBadgeId(badgeEarned);

        _matchExists[matchId] = true;
        _matches[matchId] = MatchRecord({
            winner: winner,
            timestamp: timestamp,
            gameType: gameType,
            resultHash: resultHash,
            pointsAwarded: pointsAwarded,
            badgeEarned: badgeEarned
        });

        emit MatchRecorded(
            matchId,
            winner,
            timestamp,
            gameType,
            resultHash,
            pointsAwarded,
            badgeEarned
        );
    }

    /**
     * @notice Award cumulative points to a player.
     * @param player Recipient wallet address.
     * @param points Number of points to add.
     */
    function awardPoints(address player, uint256 points) external onlyOwner {
        if (player == address(0)) revert InvalidAddress();

        _playerPoints[player] += points;

        emit PointsAwarded(player, points, _playerPoints[player]);
    }

    /**
     * @notice Mint an achievement badge to a player.
     * @param player Recipient wallet address.
     * @param badgeId Badge ID (1 = Water, 2 = Fire, 3 = Gold, 4 = Diamond, 5 = Platinum).
     */
    function mintBadge(address player, uint8 badgeId) external onlyOwner {
        if (player == address(0)) revert InvalidAddress();
        if (badgeId == 0 || badgeId > MAX_BADGE_ID) revert InvalidBadgeId(badgeId);
        if (_playerBadges[player][badgeId]) revert BadgeAlreadyMinted(player, badgeId);

        _playerBadges[player][badgeId] = true;

        emit BadgeAwarded(player, badgeId);
    }

    /**
     * @notice Read stored match information.
     * @param matchId Match identifier to query.
     */
    function getMatch(
        uint256 matchId
    )
        external
        view
        returns (
            address winner,
            uint256 timestamp,
            string memory gameType,
            bytes32 resultHash,
            uint256 pointsAwarded,
            uint8 badgeEarned
        )
    {
        if (!_matchExists[matchId]) revert MatchNotFound(matchId);

        MatchRecord storage matchRecord = _matches[matchId];
        return (
            matchRecord.winner,
            matchRecord.timestamp,
            matchRecord.gameType,
            matchRecord.resultHash,
            matchRecord.pointsAwarded,
            matchRecord.badgeEarned
        );
    }

    /**
     * @notice Returns whether a match has been recorded.
     */
    function matchExists(uint256 matchId) external view returns (bool) {
        return _matchExists[matchId];
    }

    /**
     * @notice Returns total on-chain points for a player.
     */
    function getPlayerPoints(address player) external view returns (uint256) {
        return _playerPoints[player];
    }

    /**
     * @notice Returns whether a player owns a specific badge.
     */
    function hasBadge(address player, uint8 badgeId) external view returns (bool) {
        return _playerBadges[player][badgeId];
    }

    /**
     * @notice Returns all badge IDs owned by a player.
     */
    function getPlayerBadges(address player) external view returns (uint8[] memory) {
        uint8 ownedCount;

        for (uint8 badgeId = 1; badgeId <= MAX_BADGE_ID; badgeId++) {
            if (_playerBadges[player][badgeId]) {
                ownedCount++;
            }
        }

        uint8[] memory badges = new uint8[](ownedCount);
        uint8 index;

        for (uint8 badgeId = 1; badgeId <= MAX_BADGE_ID; badgeId++) {
            if (_playerBadges[player][badgeId]) {
                badges[index] = badgeId;
                index++;
            }
        }

        return badges;
    }
}

(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/constants/index.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "initialBadges",
    ()=>initialBadges,
    "initialMatches",
    ()=>initialMatches,
    "initialProfile",
    ()=>initialProfile,
    "initialRecruitCandidates",
    ()=>initialRecruitCandidates,
    "initialSquad",
    ()=>initialSquad,
    "initialSquadMembers",
    ()=>initialSquadMembers,
    "leaderboardData",
    ()=>leaderboardData
]);
const initialProfile = {
    username: "Archer:07",
    rank: "Diamond Rank III",
    title: "Global Elite",
    level: 42,
    reputation: 984,
    reputationMax: 1000,
    totalMatches: 1248,
    wins: 842,
    losses: 406,
    winRate: 67.4,
    walletConnected: true,
    walletAddress: "0x71C4...B29a",
    balanceRPS: 245.80,
    verified: true,
    avatarUrl: "/src/assets/images/cyber_commander_avatar_1783334547047.jpg"
};
const initialBadges = [
    {
        id: "badge-1",
        name: "Water Mastery",
        tier: "Rare",
        description: "Granted to fighters who demonstrate incredible defensive adaptability. Unlocks a 1.2x RP multiplier in sub-zero arenas.",
        unlocked: true,
        iconType: "water",
        rarityColor: "from-blue-500/30 to-blue-600/10 border-blue-500/50 text-blue-400",
        onChainId: "0x442f...e761"
    },
    {
        id: "badge-2",
        name: "Fire Storm",
        tier: "Legendary",
        description: "Granted to fighters who achieve a 7+ win streak. Unlocks custom aggressive animation effects and +10% Matchmaking priorities.",
        unlocked: true,
        iconType: "fire",
        rarityColor: "from-orange-500/30 to-orange-600/10 border-orange-500/50 text-orange-400",
        onChainId: "0xfa12...99bc"
    },
    {
        id: "badge-3",
        name: "Gold Arena King",
        tier: "Artifact",
        description: "Awarded to champions who conquer the Gold Arena Championship. Unlocks a legendary crown badge and exclusive $RPS staking pools.",
        unlocked: true,
        iconType: "gold",
        rarityColor: "from-yellow-500/30 to-yellow-600/10 border-yellow-500/50 text-yellow-400",
        onChainId: "0xb01d...ca23"
    },
    {
        id: "badge-4",
        name: "Wind Walker",
        tier: "Rare",
        description: "Complete 100 evasive counter-attacks. Unlocks +5% evasion rating inside sandstorm environments.",
        unlocked: false,
        iconType: "wind",
        rarityColor: "from-teal-500/30 to-teal-600/10 border-teal-500/50 text-teal-400",
        onChainId: "0x71e8...d901"
    },
    {
        id: "badge-5",
        name: "Earth Shatterer",
        tier: "Legendary",
        description: "Accumulate 10,000 total damage points. Unlocks standard earthquake visual modifiers and ground rumble audio triggers.",
        unlocked: false,
        iconType: "earth",
        rarityColor: "from-purple-500/30 to-purple-600/10 border-purple-500/50 text-purple-400",
        onChainId: "0x2e04...992c"
    }
];
const initialMatches = [
    {
        id: "match-1",
        status: "VICTORY",
        opponent: "CyberStriker_99",
        opponentLevel: 39,
        score: "3 - 1",
        rewardRP: 24,
        rewardRPS: 12,
        txId: "0x4a8b...9f2d",
        timestamp: "2 mins ago"
    },
    {
        id: "match-2",
        status: "DEFEAT",
        opponent: "Nova_Rift",
        opponentLevel: 45,
        score: "2 - 3",
        rewardRP: -18,
        rewardRPS: 0,
        txId: "0x7c9d...1b4a",
        timestamp: "2 hours ago"
    },
    {
        id: "match-3",
        status: "VICTORY",
        opponent: "Iron_Will",
        opponentLevel: 41,
        score: "3 - 0",
        rewardRP: 28,
        rewardRPS: 15,
        txId: "0x2e5f...55c1",
        timestamp: "1 day ago"
    },
    {
        id: "match-4",
        status: "VICTORY",
        opponent: "AlphaMech_7",
        opponentLevel: 43,
        score: "3 - 2",
        rewardRP: 22,
        rewardRPS: 10,
        txId: "0x9d4e...bb72",
        timestamp: "3 days ago"
    },
    {
        id: "match-5",
        status: "DEFEAT",
        opponent: "ShadowByte",
        opponentLevel: 44,
        score: "1 - 3",
        rewardRP: -15,
        rewardRPS: 0,
        txId: "0xf88c...aa11",
        timestamp: "5 days ago"
    }
];
const leaderboardData = [
    {
        rank: 1,
        username: "Satoshi_Shogun",
        level: 50,
        score: 3200,
        winRate: "78.2%",
        status: "online",
        badgeType: "gold"
    },
    {
        rank: 2,
        username: "EtherNinja",
        level: 48,
        score: 3050,
        winRate: "72.4%",
        status: "ingame",
        badgeType: "silver"
    },
    {
        rank: 3,
        username: "CryptoKombat",
        level: 49,
        score: 2980,
        winRate: "70.9%",
        status: "online",
        badgeType: "bronze"
    },
    {
        rank: 4,
        username: "Archer:07",
        level: 42,
        score: 2842,
        winRate: "67.4%",
        status: "online",
        badgeType: "none"
    },
    {
        rank: 5,
        username: "CyberStriker_99",
        level: 39,
        score: 2650,
        winRate: "61.2%",
        status: "ingame",
        badgeType: "none"
    },
    {
        rank: 6,
        username: "Nova_Rift",
        level: 45,
        score: 2600,
        winRate: "59.8%",
        status: "offline",
        badgeType: "none"
    },
    {
        rank: 7,
        username: "Iron_Will",
        level: 41,
        score: 2420,
        winRate: "58.1%",
        status: "online",
        badgeType: "none"
    },
    {
        rank: 8,
        username: "DeFi_Warlord",
        level: 38,
        score: 2350,
        winRate: "56.4%",
        status: "offline",
        badgeType: "none"
    }
];
const initialSquad = {
    name: "PHANTOM_UNIT_09",
    membersCount: 4,
    maxMembers: 10,
    status: "Operational Status: Optimal",
    privacy: "Public",
    winRate: "76.4%",
    winRateTrend: "↑ 4.2%",
    totalOnChainWins: 1402,
    globalStanding: "#241",
    insigniaUrl: "🛡️"
};
const initialSquadMembers = [
    {
        id: "m-1",
        username: "COMMANDER_ZERO",
        verified: true,
        ping: null,
        statusText: "ON-CHAIN VERIFIED",
        status: "online",
        rank: "LEGENDARY",
        role: "LEADER",
        micMuted: false
    },
    {
        id: "m-2",
        username: "VOID_WALKER",
        verified: false,
        ping: "24MS",
        statusText: "PING: 24MS",
        status: "online",
        rank: "ELITE",
        role: "OPERATIVE",
        micMuted: true
    },
    {
        id: "m-3",
        username: "NEON_VALKYRIE",
        verified: false,
        ping: null,
        statusText: "IN COMBAT",
        status: "ingame",
        rank: "ACE",
        role: "OPERATIVE",
        micMuted: true
    },
    {
        id: "m-4",
        username: "IRON_GIANT_9",
        verified: false,
        ping: null,
        statusText: "COMMUNICATIONS OFFLINE",
        status: "offline",
        rank: "VETERAN",
        role: "OPERATIVE",
        micMuted: false
    }
];
const initialRecruitCandidates = [
    {
        id: "rc-1",
        username: "VALKYRIE_09",
        level: 42,
        status: "IN_LOBBY",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150",
        isOnline: true,
        invited: false
    },
    {
        id: "rc-2",
        username: "CYBER_GHOST",
        level: 88,
        status: "READY",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
        isOnline: true,
        invited: false
    },
    {
        id: "rc-3",
        username: "NOMAD_K9",
        level: 0,
        status: "OFFLINE",
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150",
        isOnline: false,
        invited: false
    },
    {
        id: "rc-4",
        username: "MEDIC_ONE",
        level: 12,
        status: "MATCH_PENDING",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
        isOnline: true,
        invited: false
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/shared/context/AppStateContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppStateProvider",
    ()=>AppStateProvider,
    "useAppState",
    ()=>useAppState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/constants/index.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
// ─── Helpers ────────────────────────────────────────────────────────────────
function getStorageItem(key, fallback) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    try {
        return JSON.parse(item);
    } catch  {
        return fallback;
    }
}
const AppStateContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function AppStateProvider({ children }) {
    _s();
    const [mobileSidebarOpen, setMobileSidebarOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [profile, setProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AppStateProvider.useState": ()=>getStorageItem("rps_arena_profile", __TURBOPACK__imported__module__$5b$project$5d2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["initialProfile"])
    }["AppStateProvider.useState"]);
    const [badges, setBadges] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AppStateProvider.useState": ()=>getStorageItem("rps_arena_badges", __TURBOPACK__imported__module__$5b$project$5d2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["initialBadges"])
    }["AppStateProvider.useState"]);
    const [matches, setMatches] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AppStateProvider.useState": ()=>getStorageItem("rps_arena_matches", __TURBOPACK__imported__module__$5b$project$5d2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["initialMatches"])
    }["AppStateProvider.useState"]);
    const [leaderboard, setLeaderboard] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AppStateProvider.useState": ()=>getStorageItem("rps_arena_leaderboard", __TURBOPACK__imported__module__$5b$project$5d2f$constants$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["leaderboardData"])
    }["AppStateProvider.useState"]);
    const [isWalletModalOpen, setIsWalletModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isTxModalOpen, setIsTxModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedTxMatch, setSelectedTxMatch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isQueueActive, setIsQueueActive] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Persist to localStorage
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppStateProvider.useEffect": ()=>{
            localStorage.setItem("rps_arena_profile", JSON.stringify(profile));
        }
    }["AppStateProvider.useEffect"], [
        profile
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppStateProvider.useEffect": ()=>{
            localStorage.setItem("rps_arena_badges", JSON.stringify(badges));
        }
    }["AppStateProvider.useEffect"], [
        badges
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppStateProvider.useEffect": ()=>{
            localStorage.setItem("rps_arena_matches", JSON.stringify(matches));
        }
    }["AppStateProvider.useEffect"], [
        matches
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppStateProvider.useEffect": ()=>{
            localStorage.setItem("rps_arena_leaderboard", JSON.stringify(leaderboard));
        }
    }["AppStateProvider.useEffect"], [
        leaderboard
    ]);
    // ── Handlers ───────────────────────────────────────────────────────────────
    const handleConnectWallet = (address)=>{
        setProfile((prev)=>({
                ...prev,
                walletConnected: true,
                walletAddress: address,
                balanceRPS: prev.balanceRPS === 0 ? 150 : prev.balanceRPS
            }));
    };
    const handleDisconnectWallet = ()=>{
        setProfile((prev)=>({
                ...prev,
                walletConnected: false,
                walletAddress: null
            }));
    };
    const handleAddNewMatch = (newMatch)=>{
        setMatches((prev)=>[
                newMatch,
                ...prev
            ]);
    };
    const handleUpdateProfileStats = (rpChange, rpsChange, isWin)=>{
        setProfile((prev)=>{
            const newWins = isWin ? prev.wins + 1 : prev.wins;
            const newLosses = !isWin && rpChange < 0 ? prev.losses + 1 : prev.losses;
            const newMatches = prev.totalMatches + 1;
            const newWinRate = parseFloat((newWins / newMatches * 100).toFixed(1));
            return {
                ...prev,
                totalMatches: newMatches,
                wins: newWins,
                losses: newLosses,
                winRate: newWinRate,
                balanceRPS: Math.max(0, prev.balanceRPS + rpsChange),
                reputation: Math.min(prev.reputationMax, Math.max(0, prev.reputation + (isWin ? 5 : -3)))
            };
        });
        setLeaderboard((prev)=>prev.map((leader)=>{
                if (leader.username === profile.username) {
                    return {
                        ...leader,
                        score: Math.max(0, leader.score + rpChange),
                        level: profile.level,
                        winRate: `${profile.winRate}%`
                    };
                }
                return leader;
            }).sort((a, b)=>b.score - a.score));
    };
    const handleUpdateProfileNameAndTitle = (name, title)=>{
        setProfile((prev)=>({
                ...prev,
                username: name,
                title
            }));
        setLeaderboard((prev)=>prev.map((leader)=>leader.username === profile.username || leader.username === "Archer:07" ? {
                    ...leader,
                    username: name
                } : leader));
    };
    const handleOpenTxDetail = (match)=>{
        setSelectedTxMatch(match);
        setIsTxModalOpen(true);
    };
    // handleTriggerFindMatch is called from Navbar — navigation handled by the Navbar itself via router
    const handleTriggerFindMatch = ()=>{
        setIsQueueActive(true);
    };
    const handleLogout = ()=>{
        console.log("Log out clicked");
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AppStateContext.Provider, {
        value: {
            mobileSidebarOpen,
            setMobileSidebarOpen,
            profile,
            badges,
            matches,
            leaderboard,
            isWalletModalOpen,
            setIsWalletModalOpen,
            isTxModalOpen,
            setIsTxModalOpen,
            selectedTxMatch,
            isQueueActive,
            setIsQueueActive,
            handleConnectWallet,
            handleDisconnectWallet,
            handleAddNewMatch,
            handleUpdateProfileStats,
            handleUpdateProfileNameAndTitle,
            handleOpenTxDetail,
            handleTriggerFindMatch,
            handleLogout
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/shared/context/AppStateContext.tsx",
        lineNumber: 192,
        columnNumber: 5
    }, this);
}
_s(AppStateProvider, "Sl8zIHP1S76iC1pfsxdRp8sVUhY=");
_c = AppStateProvider;
function useAppState() {
    _s1();
    const ctx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AppStateContext);
    if (!ctx) {
        throw new Error("useAppState must be used inside <AppStateProvider>");
    }
    return ctx;
}
_s1(useAppState, "/dMy7t63NXD4eYACoT93CePwGrg=");
var _c;
__turbopack_context__.k.register(_c, "AppStateProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_1konwkz._.js.map
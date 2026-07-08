import * as fs from 'node:fs';
import * as path from 'node:path';
import { InterfaceAbi } from 'ethers';
import { GameRewardArtifact } from '../interfaces/game-reward.interface';

export function loadGameRewardAbi(): InterfaceAbi {
  const artifactPath = path.join(__dirname, '..', 'contracts', 'GameReward.json');
  const raw = fs.readFileSync(artifactPath, 'utf8');
  const artifact = JSON.parse(raw) as GameRewardArtifact;
  return artifact.abi;
}

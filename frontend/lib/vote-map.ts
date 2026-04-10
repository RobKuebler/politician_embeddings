import {
  CohesionRecord,
  EmbeddingPoint,
  Politician,
  Poll,
  VoteRecord,
  stripSoftHyphen,
} from "@/lib/data";
import { getPartyShortLabel } from "@/lib/constants";

/** Computes per-party cohesion (mean distance to centroid). */
export function computeCohesionRecords(
  points: EmbeddingPoint[],
  politicians: Politician[],
): CohesionRecord[] {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p]));
  const partyPoints = new Map<string, { x: number; y: number }[]>();

  for (const pt of points) {
    const label = stripSoftHyphen(
      polMap.get(pt.politician_id)?.party ?? "fraktionslos",
    );
    if (!partyPoints.has(label)) partyPoints.set(label, []);
    partyPoints.get(label)!.push({ x: pt.x, y: pt.y });
  }

  const cohesion: CohesionRecord[] = [];
  for (const [label, pts] of partyPoints) {
    if (label === "fraktionslos" || pts.length < 2) continue;
    const cx = pts.reduce((sum, point) => sum + point.x, 0) / pts.length;
    const cy = pts.reduce((sum, point) => sum + point.y, 0) / pts.length;
    const streuung =
      pts.reduce(
        (sum, point) =>
          sum + Math.sqrt((point.x - cx) ** 2 + (point.y - cy) ** 2),
        0,
      ) / pts.length;
    cohesion.push({ party: label, label: getPartyShortLabel(label), streuung });
  }
  return cohesion;
}

/**
 * Collapses individual selections into party pills when all members are selected.
 * Returns the normalized state with redundant individual IDs removed.
 */
export function normalizeSelection(
  polIds: number[],
  parties: string[],
  politicians: Politician[],
): { polIds: number[]; parties: string[] } {
  const partyMembers = new Map<string, number[]>();
  for (const politician of politicians) {
    const party = stripSoftHyphen(politician.party);
    if (!partyMembers.has(party)) partyMembers.set(party, []);
    partyMembers.get(party)!.push(politician.politician_id);
  }

  const polIdSet = new Set(polIds);
  const resultParties = [...parties];
  let resultPolIds = [...polIds];

  for (const [party, members] of partyMembers) {
    if (resultParties.includes(party)) continue;
    if (members.length > 1 && members.every((id) => polIdSet.has(id))) {
      resultParties.push(party);
      const memberSet = new Set(members);
      resultPolIds = resultPolIds.filter((id) => !memberSet.has(id));
    }
  }

  return { polIds: resultPolIds, parties: resultParties };
}

export function buildVoteIndex(
  votes: VoteRecord[],
): Map<number, Map<number, VoteRecord["answer"]>> {
  const voteIndex = new Map<number, Map<number, VoteRecord["answer"]>>();
  for (const vote of votes) {
    if (!voteIndex.has(vote.politician_id)) {
      voteIndex.set(vote.politician_id, new Map());
    }
    voteIndex.get(vote.politician_id)!.set(vote.poll_id, vote.answer);
  }
  return voteIndex;
}

export function findDivergentPollIds(
  votes: VoteRecord[],
  polls: Poll[],
  politicianIds: number[],
  options: { ignoreNoShow: boolean },
): number[] | undefined {
  if (politicianIds.length < 2) return undefined;
  const voteIndex = buildVoteIndex(votes);

  return polls
    .filter((poll) => {
      const answers = new Set<string>();
      for (const polId of politicianIds) {
        const answer = voteIndex.get(polId)?.get(poll.poll_id);
        if (options.ignoreNoShow) {
          if (answer && answer !== "no_show") answers.add(answer);
        } else {
          answers.add(answer ?? "no_show");
        }
      }
      return answers.size > 1;
    })
    .map((poll) => poll.poll_id);
}

const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export function createRelayRoom({ playerCount = 2, hostName = '我' } = {}) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) throw new Error('接力人数必须为 2–4 人');
  return {
    id: `relay-${Date.now()}`,
    mode: 'local-demo',
    inviteCode: makeCode(),
    currentPlayer: 0,
    round: 1,
    status: 'drawing',
    players: Array.from({ length: playerCount }, (_, index) => ({ name: index === 0 ? hostName : `等待加入 ${index + 1}` })),
    localDemo: true,
  };
}

export function handoff(room) {
  if (room.status !== 'drawing') return room;
  const currentPlayer = (room.currentPlayer + 1) % room.players.length;
  return {
    ...room,
    currentPlayer,
    status: currentPlayer === 0 ? 'round-complete' : 'drawing',
  };
}

export function continueRelay(room) {
  if (room.status !== 'round-complete') return room;
  return { ...room, round: room.round + 1, currentPlayer: 0, status: 'drawing' };
}

export function endRelay(room) {
  return { ...room, status: 'ended' };
}

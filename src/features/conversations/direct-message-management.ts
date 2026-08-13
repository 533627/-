export function assertDirectMessageTarget(
  senderId: string,
  target: { id: string; isActive: boolean },
) {
  if (senderId === target.id || !target.isActive) {
    throw new Error("DIRECT_MESSAGE_TARGET_INVALID");
  }
}

export const transportTransitions: Record<string, readonly string[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ASSIGNED", "REJECTED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED", "FAILED"],
  PICKED_UP: ["IN_TRANSIT", "DELAYED", "FAILED"],
  IN_TRANSIT: ["ARRIVED", "DELAYED", "FAILED"],
  ARRIVED: ["DELIVERED", "FAILED"],
  DELIVERED: ["COMPLETED"],
  DELAYED: ["IN_TRANSIT", "ARRIVED", "CANCELLED", "FAILED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  FAILED: [],
};

export const eventTransitions: Record<string, readonly string[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["REGISTRATION_OPEN", "CANCELLED", "POSTPONED"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "CANCELLED", "POSTPONED"],
  REGISTRATION_CLOSED: ["ONGOING", "CANCELLED", "POSTPONED"],
  ONGOING: ["COMPLETED", "CANCELLED", "POSTPONED"],
  POSTPONED: ["PUBLISHED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(
  transitions: Record<string, readonly string[]>,
  current: string,
  next: string
) {
  return transitions[current]?.includes(next) ?? false;
}

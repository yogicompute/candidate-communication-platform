export const MESSAGE_STATUSES = ['pending', 'sent', 'delivered', 'read', 'failed'] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
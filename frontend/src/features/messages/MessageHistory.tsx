import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import EmptyIllustration from '@/components/EmptyIllustration';
import EmptyState from '@/components/EmptyState';
import MessageHistoryItem from '@/features/messages/MessageHistoryItem';
import type { Message } from '@/types/message';

interface MessageHistoryProps {
  messages: Message[];
  retryingId: string | null;
  onRetry: (message: Message) => void;
  /** Off when scheduled messages are listed above, so "no history" isn't shown next to them. */
  showEmptyState?: boolean;
}

export default function MessageHistory({
  messages,
  retryingId,
  onRetry,
  showEmptyState = true,
}: MessageHistoryProps) {
  if (messages.length === 0) {
    if (!showEmptyState) return null;
    return (
      <EmptyState
        icon={<EmptyIllustration />}
        title="No communication history"
        description="You have not communicated with this candidate yet. When you send them a message, it will appear here."
      />
    );
  }

  const attemptById = new Map(messages.map((message) => [message.id, message.attemptNumber]));

  return (
    <Stack
      component="ol"
      divider={<Divider component="li" aria-hidden />}
      sx={{ listStyle: 'none', m: 0, p: 0 }}
    >
      {messages.map((message) => (
        <MessageHistoryItem
          key={message.id}
          message={message}
          retriedAttempt={message.retriedById ? (attemptById.get(message.retriedById) ?? null) : null}
          retrying={retryingId === message.id}
          retryDisabled={retryingId !== null}
          onRetry={() => onRetry(message)}
        />
      ))}
    </Stack>
  );
}
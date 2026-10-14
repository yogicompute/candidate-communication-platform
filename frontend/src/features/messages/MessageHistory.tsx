import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import EmptyState from '@/components/EmptyState';
import MessageHistoryItem from '@/features/messages/MessageHistoryItem';
import type { Message } from '@/types/message';

interface MessageHistoryProps {
  messages: Message[];
  retryingId: string | null;
  onRetry: (message: Message) => void;
}

export default function MessageHistory({ messages, retryingId, onRetry }: MessageHistoryProps) {
  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<ForumOutlinedIcon />}
        title="No communication history"
        description="Messages sent to this candidate will appear here."
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
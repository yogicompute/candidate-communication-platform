import type { Metadata } from 'next';
import TemplatesView from '@/features/templates/TemplatesView';

export const metadata: Metadata = { title: 'Templates' };

export default function TemplatesPage() {
  return <TemplatesView />;
}

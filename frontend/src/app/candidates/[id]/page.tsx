import type { Metadata } from 'next';
import CandidateDetailView from '@/features/candidates/CandidateDetailView';

export const metadata: Metadata = { title: 'Candidate details' };

export default async function CandidateDetailPage({ params }: PageProps<'/candidates/[id]'>) {
  const { id } = await params;
  return <CandidateDetailView candidateId={id} />;
}
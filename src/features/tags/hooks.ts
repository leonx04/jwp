import { db } from '@/db';
import { useLiveData } from '@/db/useLiveData';

import { listTagProposals } from './suggestRepository';

export function useTagProposals() {
  return useLiveData(['transactions', 'tags', 'transaction_tags'], () => listTagProposals(db));
}

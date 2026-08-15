import { useQuery } from '@tanstack/react-query';
import { Company } from '@/api/entities';
import { getRegion, REGIONS, DEFAULT_REGION_CODE } from '@shared/regions';

export { REGIONS, DEFAULT_REGION_CODE, getRegion };

/**
 * The market this company operates in.
 *
 * Reads the company record rather than localStorage: region drives holidays,
 * scheduling and the market context handed to the AI, so it has to be the same
 * for everyone in the company and readable by the backend. Language stays a
 * per-person preference; region is a property of the business.
 *
 * The query is shared with every other `['companies']` consumer, so this adds no
 * request of its own, and it always returns a usable region.
 */
export function useRegion() {
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => Company.list(),
    staleTime: 5 * 60 * 1000,
  });

  const company = companies[0];
  const code = company?.settings?.region || company?.region || DEFAULT_REGION_CODE;

  return { region: getRegion(code), company };
}

export default useRegion;

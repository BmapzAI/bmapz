import { QueryClient, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Global safety net for writes.
 *
 * Most mutations across the app were written with only an `onSuccess`, so when a
 * save failed the user saw nothing at all — the record simply appeared not to
 * save. This MutationCache handler catches every mutation that does NOT define
 * its own `onError` and surfaces the real reason, so a failed write can never be
 * silent again. Mutations with their own onError keep full control of the
 * message and are left alone.
 */
const mutationCache = new MutationCache({
	onError: (error, _variables, _context, mutation) => {
		if (mutation?.options?.onError) return; // handled locally, don't double-report
		const message = error?.message || 'Something went wrong';
		toast.error(`Could not save: ${message}`);
	},
});

export const queryClientInstance = new QueryClient({
	mutationCache,
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

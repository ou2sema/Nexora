import type { Query } from '@tanstack/react-query';

/**
 * Keeps the previous result while filters or pagination change within one
 * organization, but never carries it across an organization boundary.
 * Organization-scoped query keys use the shared shape
 * ['organizations', organizationId, ...].
 */
export function keepPreviousDataForOrganization<TData>(organizationId: string | null) {
  return (
    previousData: TData | undefined,
    previousQuery: Pick<Query<unknown, Error, TData>, 'queryKey'> | undefined,
  ): TData | undefined => {
    if (organizationId === null || organizationId.length === 0 || previousData === undefined) {
      return undefined;
    }

    const previousKey = previousQuery?.queryKey;
    return previousKey?.[0] === 'organizations' && previousKey[1] === organizationId
      ? previousData
      : undefined;
  };
}

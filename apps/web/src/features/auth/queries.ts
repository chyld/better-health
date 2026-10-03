import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, unwrap } from "@/lib/api";

export interface CurrentUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<CurrentUser | null> => {
    try {
      return (await unwrap(api.auth.me.$get())).user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: 5 * 60 * 1000,
});

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      unwrap(api.auth.login.$post({ json: input })),
    onSuccess: ({ user }) => {
      queryClient.clear();
      queryClient.setQueryData(meQuery.queryKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.auth.logout.$post();
    },
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(meQuery.queryKey, null);
    },
  });
}

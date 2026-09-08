// Stub API client — no backend required.
// Replace these with real fetch calls if you wire up a server.

export interface ApiComment {
  id: string;
  submissionId: number;
  userId: number;
  parentId: number | null;
  user: string;
  text: string;
  rating: number | null;
  time: string;
  createdAt: string;
}

export const api = {
  comments: {
    list: async (_submissionId: string | number): Promise<ApiComment[] | null> => [],
    post: async (
      _submissionId: string | number,
      _text: string,
      _rating?: number,
      _parentId?: number,
    ): Promise<ApiComment | null> => null,
  },
};

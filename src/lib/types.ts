// A post as serialized over the API / to the client (dates as ISO strings).
export type Post = {
  id: string;
  author: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
};

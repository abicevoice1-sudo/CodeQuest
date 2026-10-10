import { helper } from './util';

export interface User { id: string; name: string }

export async function createUser(data: { name: string }): Promise<User> {
  helper(data.name);
  return { id: 'u1', name: data.name };
}

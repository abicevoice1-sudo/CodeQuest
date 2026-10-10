import { createUser } from '@/services/userService';
import { helper } from './barrel';
import type { Config } from '@/types';

export async function main() {
  const user = await createUser({ name: 'ada' });
  return helper(user);
}

main();

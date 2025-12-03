import 'ts-node/register/index.js';
import { runAgentClient } from '../lib/agentClientCore.ts';

runAgentClient().catch((err) => {
  console.error(err);
  process.exit(1);
});

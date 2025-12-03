import { runAgentClient } from './lib/agentClientCore';

runAgentClient().catch((e) => {
  console.error(e);
  (process as NodeJS.Process).exit(1);
});

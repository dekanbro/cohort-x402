// Minimal Node-style process env typing so lib files can use process.env
declare const process: {
  env: { [key: string]: string | undefined };
  NODE_ENV?: string;
};

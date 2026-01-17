export async function dispatchToProvider(args: {
  provider: string;
  model: string;
  taskName: string;
  input: any;
  prompt: any;
  role: string;
  runId: string;
  rootRunId: string;
}): Promise<any> {
  throw new Error(
    `dispatchToProvider not implemented for provider=${args.provider}, model=${args.model}`
  );
}

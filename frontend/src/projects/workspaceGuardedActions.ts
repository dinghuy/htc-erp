type GuardedActionOptions<TArgs extends unknown[], TResult> = {
  allowed: boolean;
  deniedMessage: string;
  onDenied: (message: string) => void;
  action: (...args: TArgs) => TResult;
};

export function guardWorkspaceAction<TArgs extends unknown[], TResult>({
  allowed,
  deniedMessage,
  onDenied,
  action,
}: GuardedActionOptions<TArgs, TResult>) {
  return (...args: TArgs): TResult | undefined => {
    if (!allowed) {
      onDenied(deniedMessage);
      return undefined;
    }

    return action(...args);
  };
}

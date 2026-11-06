/** Prevent late route responses from replacing more recent route selections. */
export function createRouteRequestGuard() {
  let generation = 0;
  return {
    begin() { generation += 1; return generation; },
    invalidate() { generation += 1; },
    isCurrent(token) { return Number.isInteger(token) && token > 0 && token === generation; }
  };
}

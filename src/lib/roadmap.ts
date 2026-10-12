import type { Topic } from '../types/workspace';
export const flatten = (nodes: Topic[]): Topic[] =>
  nodes.flatMap((n) => [n, ...flatten(n.children)]);
export const leaves = (nodes: Topic[]): Topic[] => flatten(nodes).filter((n) => !n.children.length);
export function progress(nodes: Topic[]) {
  const all = leaves(nodes);
  const done = all.filter((n) => n.status === 'completed').length;
  return {
    total: all.length,
    done,
    percent: all.length ? Math.round((done / all.length) * 100) : 0,
  };
}
export function updateTopic(nodes: Topic[], id: string, change: (topic: Topic) => Topic): Topic[] {
  return nodes.map((n) =>
    n.id === id ? change(n) : { ...n, children: updateTopic(n.children, id, change) },
  );
}
export function deleteTopic(nodes: Topic[], id: string): Topic[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: deleteTopic(n.children, id) }));
}

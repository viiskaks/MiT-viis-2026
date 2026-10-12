export interface Account {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'mentee';
  enabled: boolean;
  canInteract: boolean;
}

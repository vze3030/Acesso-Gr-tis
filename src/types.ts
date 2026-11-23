export type ActiveTab = 'private' | 'community';

export interface AccessCard {
  id: string;
  communityMemberId?: string;
  ownerName: string;
  accountTitle: string;
  emailOrUser: string;
  password: string;
  notes: string;
  createdAt: string;
}

export interface CommunityMember {
  id: string;
  nick: string;
  registeredAt: string;
  verified: boolean;
}

export interface SharePayload {
  n: string; // ownerName
  t: string; // accountTitle
  e: string; // emailOrUser
  p: string; // password
  o?: string; // notes
  d?: string; // createdAt
}

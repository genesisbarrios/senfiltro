export interface MusicNFTData {
  tokenId: number;
  creator: string;
  owner: string;
  title: string;
  description: string;
  artist: string;
  musicType: 'Single' | 'Album';
  metadataIpfs: string;
  imageIpfs?: string;
  audioIpfs?: string;
  genres: string[];
  releaseDate?: number;
  bpm?: number;
  lyrics?: string;
  priceUsd: number;
  editionSize: number;
  mintedCount: number;
  royaltyPercentage: number;
  createdAt: number;
  isActive: boolean;
  tracks?: Track[];
  trackCount?: number;
  albumType?: string;
  groupId?: string;
}

export interface Track {
  title: string;
  artist: string;
  audioIpfs: string;
  imageIpfs?: string;
  bpm?: number;
  lyrics?: string;
  trackNumber: number;
  duration?: number;
}

export interface ContractResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
export type PublicCatalogTemplate = {
  id: string;
  groupId: string;
  memberId: string | null;
  releaseId: string | null;
  kind: string;
  name: string;
  descriptor: string;
  status: string;
  groupName: string;
  memberName: string | null;
  releaseName: string | null;
};

export type PublicHolding = {
  id: string;
  templateId: string;
  acquiredAt: string;
  tradeStatus: "not-for-trade" | "for-trade";
  template: PublicCatalogTemplate;
};

export type PublicWishlistEntry = {
  id: string;
  templateId: string;
  template: PublicCatalogTemplate;
};

/** Historical persisted QA catalog rows, identified individually during read-only
 * production inspection. No schema test flag exists. Never classify by name prefix:
 * legitimate artists may contain “QA”. This is discovery-only, not deletion or RLS.
 */
export const CATALOG_QA_GROUP_IDS = [
  "596ed840-084f-4463-82fc-425d0959ed98", // QA ROOM GROUP 11F
  "6f29a51c-dfee-4564-84e3-3625e44e8765", // QA MEDIA GROUP
  "c6c92a60-86ca-4c46-ae04-e7183907731f", // QA GRAPH GROUP
  "8b842d71-efb2-403b-aabc-41c56f07106e", // QA Test Group
] as const;
export const CATALOG_QA_GROUP_FILTER = `(${CATALOG_QA_GROUP_IDS.join(",")})`;
